// Mock fallback for the nexio-workflow engine (used when
// NEXT_PUBLIC_USE_MOCKS=true). `NEXT_PUBLIC_USE_MOCKS` is a supported *build*
// mode, not a dev-only flag — preview and demo deploys run it — and
// nexio-workflow will not be deployed alongside them, so without this layer
// /admin/workflows would hard-error on every demo.
//
// IT REPRODUCES THE REFUSALS, NOT JUST THE HAPPY PATH. Precedent: commit
// 2a93ecf "fix(mocks): refuse staff profile edits like the real backend", where
// a permissive mock advertised a feature production rejects. The traps in §2 of
// the integration guide are precisely the ones a demo would otherwise hide, so
// this mock:
//
//   - masks credential-shaped values on read (§2.1) and REFUSES a write that
//     carries the marker back;
//   - answers CONFLICT when a save is based on a stale `updatedAt` (§2.7);
//   - answers NOT_FOUND — not `[]` — for `executions` on an unknown id (§4);
//   - takes multiple seconds to trigger, because triggering is synchronous and
//     can take ~40s upstream (§2.3);
//   - cascades a delete into that workflow's executions (§4).
//
// It throws `WorkflowError` with the same classifications the live service
// reports, so route handlers map mock and live failures through one code path.
import { mockDelay } from './_delay'
import { WorkflowError } from '@/lib/api/workflow/errors'
import { REDACTED_MARKER, containsRedacted } from '@/lib/api/workflow/redaction'
import { clampWorkflowPaging } from '@/lib/api/workflow/paging'
import type {
  CreateWorkflowInput,
  ExecutionStep,
  JsonObject,
  JsonValue,
  ListExecutionsQuery,
  ListWorkflowsQuery,
  UpdateWorkflowInput,
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowExecutionSummary,
} from '@/lib/api/workflow/types'
import {
  WORKFLOW_CRON_FIELD_COUNT,
  WORKFLOW_NAME_MAX_LENGTH,
} from '@/lib/validation/constants'

/**
 * How long a trigger takes here. Deliberately multi-second: the real call runs
 * the whole workflow synchronously and the UI must show an explained,
 * long-running state rather than a bare spinner (§2.3). A mock that returned
 * instantly would let that affordance rot unnoticed.
 */
export const MOCK_TRIGGER_DURATION_MS = 2_500

/** Upstream refusal messages are Portuguese (§3) — so are the mock's. */
const MESSAGES = {
  redacted:
    'valor mascarado ***REDACTED*** nao pode ser enviado de volta; omita o campo para manter o valor atual',
  nameRequired: 'name e obrigatorio',
  nameTooLong: `name deve ter no maximo ${WORKFLOW_NAME_MAX_LENGTH} caracteres`,
  cronFields: 'cron deve ter seis campos, comecando pelos segundos',
  cronRequired: 'trigger SCHEDULE precisa de config.cron',
  conflict: 'o workflow foi alterado por outra requisicao',
} as const

function badRequest(upstreamMessage: string): WorkflowError {
  return new WorkflowError('BAD_REQUEST', 'The mock refused the request.', {
    upstreamMessage,
  })
}

function notFound(): WorkflowError {
  return new WorkflowError('NOT_FOUND', 'No such workflow or execution.')
}

// --- Masking (§2.1) -------------------------------------------------------

/**
 * Key names whose value is masked on read. Matched on a normalized key
 * (lowercased, `-`/`_` removed) by suffix, so `X-Api-Key`, `access_token` and
 * `clientSecret` are all covered. A heuristic standing in for the real masker —
 * close enough that the UI cannot be built assuming secrets arrive in clear.
 */
const SENSITIVE_KEY_SUFFIXES = [
  'authorization',
  'token',
  'apikey',
  'password',
  'secret',
]

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_]/g, '')
  return SENSITIVE_KEY_SUFFIXES.some((name) => normalized.endsWith(name))
}

function maskJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(maskJson)
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        isSensitiveKey(key) ? REDACTED_MARKER : maskJson(entry),
      ]),
    )
  }
  return value
}

function maskJsonObject(
  value: JsonObject | null | undefined,
): JsonObject | null {
  if (!value) return value ?? null
  return maskJson(value) as JsonObject
}

/**
 * Masks the query-string values and the userinfo inside a url, leaving scheme,
 * host, port and path alone.
 *
 * Done with string surgery rather than `new URL()` on purpose: a url may hold
 * `{{trigger.orderId}}` templates in its path or query (§7), and `URL` would
 * percent-encode the braces and corrupt them.
 */
function maskUrl(url: string | null | undefined): string | null {
  if (!url) return url ?? null
  let out = url.replace(
    /^([a-zA-Z][\w+.-]*:\/\/)([^/@?#]+)@/,
    `$1${REDACTED_MARKER}@`,
  )
  const queryAt = out.indexOf('?')
  if (queryAt === -1) return out
  const [head, tail] = [out.slice(0, queryAt), out.slice(queryAt + 1)]
  const [query, fragment] = tail.split('#', 2)
  const masked = query
    .split('&')
    .map((pair) => {
      if (pair === '') return pair
      const eq = pair.indexOf('=')
      return eq === -1 ? pair : `${pair.slice(0, eq)}=${REDACTED_MARKER}`
    })
    .join('&')
  out = `${head}?${masked}${fragment === undefined ? '' : `#${fragment}`}`
  return out
}

/** A read-safe copy: every credential-shaped value replaced by the marker. */
function maskDefinition(def: WorkflowDefinition): WorkflowDefinition {
  return {
    ...structuredClone(def),
    trigger: {
      type: def.trigger.type,
      config: maskJsonObject(def.trigger.config) ?? {},
    },
    nodes: def.nodes.map((node) => ({
      ...structuredClone(node),
      url: maskUrl(node.url),
      headers: maskJsonObject(node.headers),
      body: maskJsonObject(node.body),
      config: maskJsonObject(node.config) ?? {},
    })),
  }
}

// --- Store ----------------------------------------------------------------

const WORKFLOWS = new Map<string, WorkflowDefinition>()
const EXECUTIONS: WorkflowExecution[] = []

function seed(): void {
  const definitions: WorkflowDefinition[] = [
    {
      id: 'wf-notifica-cozinha',
      name: 'Notificar cozinha ao confirmar pedido',
      description:
        'Busca o pedido confirmado, separa totem de balcão e avisa a praça certa.',
      trigger: { type: 'MOCK_EVENT', config: { event: 'order.confirmed' } },
      startNodeId: 'busca-pedido',
      nodes: [
        {
          id: 'busca-pedido',
          type: 'HTTP_REQUEST',
          method: 'GET',
          url: 'https://api.nexio.com.br/orders/{{trigger.orderId}}',
          headers: {
            Authorization: 'Bearer tok_live_7f31c0',
            accept: 'application/json',
          },
          body: null,
          expression: null,
          config: {},
          nextOnSuccess: 'checa-canal',
          nextOnTrue: null,
          nextOnFalse: null,
        },
        {
          id: 'checa-canal',
          type: 'CONDITION',
          method: null,
          url: null,
          headers: null,
          body: null,
          expression: "#outputs['busca-pedido']['body']['channel'] == 'TOTEM'",
          config: {},
          nextOnSuccess: null,
          nextOnTrue: 'avisa-totem',
          nextOnFalse: 'avisa-balcao',
        },
        {
          id: 'avisa-totem',
          type: 'HTTP_REQUEST',
          method: 'POST',
          url: 'https://cozinha.nexio.com.br/fila?origem=totem',
          headers: { 'X-Api-Key': 'ak_9fbc21d4' },
          body: { pedido: '{{trigger.orderId}}', praca: 'expedicao' },
          expression: null,
          config: {},
          nextOnSuccess: null,
          nextOnTrue: null,
          nextOnFalse: null,
        },
        {
          id: 'avisa-balcao',
          type: 'HTTP_REQUEST',
          method: 'POST',
          url: 'https://cozinha.nexio.com.br/fila?origem=balcao',
          headers: { 'X-Api-Key': 'ak_9fbc21d4' },
          body: { pedido: '{{trigger.orderId}}', praca: 'chapa' },
          expression: null,
          config: {},
          nextOnSuccess: null,
          nextOnTrue: null,
          nextOnFalse: null,
        },
      ],
      enabled: true,
      createdAt: '2026-07-14T09:12:00Z',
      updatedAt: '2026-08-28T18:40:00Z',
    },
    {
      id: 'wf-estoque-sertao',
      name: 'Relatório de estoque da Sertão Burger',
      description:
        'Todo dia útil às 8h, envia o saldo de estoque da unidade para o grupo de compras.',
      // Six fields, SECONDS FIRST — Spring's format, not the five-field Unix
      // one (§11). A five-field expression is rejected upstream.
      trigger: { type: 'SCHEDULE', config: { cron: '0 0 8 * * MON-FRI' } },
      startNodeId: 'envia-relatorio',
      nodes: [
        {
          id: 'envia-relatorio',
          type: 'HTTP_REQUEST',
          method: 'POST',
          url: 'https://hooks.nexio.com.br/compras/estoque?token=hk_4b21aa',
          headers: { 'content-type': 'application/json' },
          body: {
            unidade: 'Sertão Burger — Savassi',
            canal: 'compras',
            apiKey: 'sk_estoque_11f0',
          },
          expression: null,
          config: {},
          nextOnSuccess: null,
          nextOnTrue: null,
          nextOnFalse: null,
        },
      ],
      enabled: true,
      createdAt: '2026-06-02T14:30:00Z',
      updatedAt: '2026-08-11T10:05:00Z',
    },
    {
      id: 'wf-convite-fidelidade',
      name: 'Convidar cliente para o programa de fidelidade',
      description: 'Desligado até o time de CRM aprovar o texto do convite.',
      trigger: { type: 'MOCK_EVENT', config: { event: 'order.delivered' } },
      startNodeId: 'convida',
      nodes: [
        {
          id: 'convida',
          type: 'HTTP_REQUEST',
          method: 'POST',
          url: 'https://crm.nexio.com.br/convites',
          headers: { Authorization: 'Bearer tok_crm_0091' },
          body: { cliente: '{{trigger.customerId}}', programa: 'fidelidade' },
          expression: null,
          config: {},
          nextOnSuccess: null,
          nextOnTrue: null,
          nextOnFalse: null,
        },
      ],
      enabled: false,
      createdAt: '2026-08-19T16:00:00Z',
      updatedAt: '2026-08-19T16:00:00Z',
    },
  ]
  for (const def of definitions) WORKFLOWS.set(def.id, def)

  const httpStep = (
    nodeId: string,
    statusCode: number,
    body: JsonValue,
    extra: Partial<ExecutionStep> = {},
    output: Partial<JsonObject> = {},
  ): ExecutionStep => ({
    nodeId,
    status: statusCode >= 200 && statusCode < 300 ? 'SUCCESS' : 'FAILED',
    output: {
      statusCode,
      headers: { 'content-type': 'application/json' },
      body,
      truncated: false,
      droppedKeys: 0,
      ...output,
    },
    error: null,
    executedAt: '2026-08-30T11:00:01Z',
    ...extra,
  })

  EXECUTIONS.push(
    {
      id: 'ex-1001',
      workflowId: 'wf-notifica-cozinha',
      status: 'SUCCESS',
      triggerPayload: { orderId: 'ord-8841', channel: 'TOTEM' },
      steps: [
        httpStep('busca-pedido', 200, {
          id: 'ord-8841',
          channel: 'TOTEM',
          total: 128.5,
        }),
        {
          nodeId: 'checa-canal',
          status: 'SUCCESS',
          // CONDITION output is just which branch was taken (§5).
          output: { result: true },
          error: null,
          executedAt: '2026-08-30T11:00:02Z',
        },
        httpStep('avisa-totem', 202, { aceito: true }),
      ],
      createdAt: '2026-08-30T11:00:00Z',
      startedAt: '2026-08-30T11:00:00Z',
      finishedAt: '2026-08-30T11:00:03Z',
      errorMessage: null,
    },
    {
      id: 'ex-1002',
      workflowId: 'wf-notifica-cozinha',
      status: 'FAILED',
      triggerPayload: { orderId: 'ord-8842', channel: 'COUNTER' },
      steps: [
        httpStep('busca-pedido', 200, {
          id: 'ord-8842',
          channel: 'COUNTER',
          total: 54.9,
        }),
        {
          nodeId: 'checa-canal',
          status: 'SUCCESS',
          output: { result: false },
          error: null,
          executedAt: '2026-08-30T12:00:02Z',
        },
        // A non-2xx fails the node but STILL records the body — usually the most
        // useful thing on the page (§5). `truncated`/`droppedKeys` say the
        // stored body is not the whole response: HAL's `_links` and friends
        // cannot be stored because keys may not start with `_` or `$` (§6).
        httpStep(
          'avisa-balcao',
          500,
          { erro: 'fila da chapa indisponivel', detalhe: 'upstream timeout' },
          {
            error: 'HTTP 500 em https://cozinha.nexio.com.br/fila',
            executedAt: '2026-08-30T12:00:04Z',
          },
          { truncated: true, droppedKeys: 3 },
        ),
      ],
      createdAt: '2026-08-30T12:00:00Z',
      startedAt: '2026-08-30T12:00:00Z',
      finishedAt: '2026-08-30T12:00:05Z',
      errorMessage: "No 'avisa-balcao' respondeu HTTP 500",
    },
    {
      id: 'ex-1003',
      workflowId: 'wf-notifica-cozinha',
      status: 'SUCCESS',
      triggerPayload: { orderId: 'ord-8850', channel: 'TOTEM' },
      steps: [
        httpStep('busca-pedido', 200, { id: 'ord-8850', channel: 'TOTEM' }),
        {
          nodeId: 'checa-canal',
          status: 'SUCCESS',
          output: { result: true },
          error: null,
          executedAt: '2026-08-31T09:30:02Z',
        },
        httpStep('avisa-totem', 202, { aceito: true }),
      ],
      createdAt: '2026-08-31T09:30:00Z',
      startedAt: '2026-08-31T09:30:00Z',
      finishedAt: '2026-08-31T09:30:03Z',
      errorMessage: null,
    },
    // Scheduled runs happen in the background with no caller and no mutation of
    // ours to hook (§11) — which is why the run list is never time-cached.
    {
      id: 'ex-2001',
      workflowId: 'wf-estoque-sertao',
      status: 'SUCCESS',
      triggerPayload: {},
      steps: [httpStep('envia-relatorio', 200, { recebido: true })],
      createdAt: '2026-08-31T11:00:00Z',
      startedAt: '2026-08-31T11:00:00Z',
      finishedAt: '2026-08-31T11:00:01Z',
      errorMessage: null,
    },
    {
      id: 'ex-2002',
      workflowId: 'wf-estoque-sertao',
      status: 'FAILED',
      triggerPayload: {},
      steps: [
        httpStep(
          'envia-relatorio',
          302,
          '',
          { error: 'redirecionamento nao seguido' },
          // A 3xx also fails, with `headers.location` recorded, because
          // redirects are not followed (§5). Render it as TEXT, never a link.
          {
            headers: {
              location: 'https://hooks.nexio.com.br/compras/estoque/v2',
            },
          },
        ),
      ],
      createdAt: '2026-09-01T11:00:00Z',
      startedAt: '2026-09-01T11:00:00Z',
      finishedAt: '2026-09-01T11:00:01Z',
      errorMessage: 'Redirecionamento nao seguido (302)',
    },
  )
}

seed()

/** Test-only: restores the seeded store so cases cannot leak into each other. */
export function __resetWorkflowMocks(): void {
  WORKFLOWS.clear()
  EXECUTIONS.length = 0
  seed()
}

function requireWorkflow(id: string): WorkflowDefinition {
  const found = WORKFLOWS.get(id)
  if (!found) throw notFound()
  return found
}

/**
 * Every write path runs this first. The real service refuses the marker
 * deliberately — accepting it would overwrite the live credential with the mask
 * and silently break the workflow (§2.1) — so the mock refuses it too, or a
 * demo would teach the naive read/edit/save loop that production rejects.
 */
function refuseRedacted(input: unknown): void {
  if (containsRedacted(input)) throw badRequest(MESSAGES.redacted)
}

function validateName(name: string | undefined): void {
  if (name === undefined) return
  if (name.trim() === '') throw badRequest(MESSAGES.nameRequired)
  if (name.length > WORKFLOW_NAME_MAX_LENGTH) {
    throw badRequest(MESSAGES.nameTooLong)
  }
}

/**
 * Only the field-count rule, which is the one that actually trips people up
 * (§11: six fields, seconds first). The full parse — fire-ability and the 30s
 * minimum interval — lands with the cron validator in the authoring phase.
 */
function validateTrigger(
  trigger: { type: string; config: JsonObject } | undefined,
): void {
  if (!trigger || trigger.type !== 'SCHEDULE') return
  const cron = trigger.config?.cron
  if (typeof cron !== 'string' || cron.trim() === '') {
    throw badRequest(MESSAGES.cronRequired)
  }
  if (cron.trim().split(/\s+/).length !== WORKFLOW_CRON_FIELD_COUNT) {
    throw badRequest(MESSAGES.cronFields)
  }
}

// --- Queries --------------------------------------------------------------

export async function listWorkflowsMock(
  query: ListWorkflowsQuery = {},
): Promise<WorkflowDefinition[]> {
  await mockDelay()
  const { limit, offset } = clampWorkflowPaging(query)
  const rows = [...WORKFLOWS.values()]
    .filter((w) => (query.enabledOnly ? w.enabled : true))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  // A bare array, with no total and no envelope — exactly what the service
  // returns (which is why the UI pages by offset, not by cursor).
  return rows.slice(offset, offset + limit).map(maskDefinition)
}

/** `workflow(id)` is nullable upstream, so an unknown id is `null`, not a throw. */
export async function getWorkflowMock(
  id: string,
): Promise<WorkflowDefinition | null> {
  await mockDelay()
  const found = WORKFLOWS.get(id)
  return found ? maskDefinition(found) : null
}

/**
 * `executions` on an unknown `workflowId` is **NOT_FOUND, not `[]`** (§4): an
 * empty list would be indistinguishable from a real workflow that was never
 * triggered, and the UI has to tell those apart (404 the page vs. empty state).
 */
export async function listExecutionsMock(
  workflowId: string,
  query: ListExecutionsQuery = {},
): Promise<WorkflowExecutionSummary[]> {
  await mockDelay()
  requireWorkflow(workflowId)
  const { limit, offset } = clampWorkflowPaging(query)
  return EXECUTIONS.filter((e) => e.workflowId === workflowId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(offset, offset + limit)
    .map(
      ({
        id,
        workflowId: wid,
        status,
        createdAt,
        finishedAt,
        errorMessage,
      }) => ({
        id,
        workflowId: wid,
        status,
        createdAt,
        finishedAt,
        errorMessage,
      }),
    )
}

export async function getExecutionMock(
  id: string,
): Promise<WorkflowExecution | null> {
  await mockDelay()
  const found = EXECUTIONS.find((e) => e.id === id)
  return found ? structuredClone(found) : null
}

// --- Mutations ------------------------------------------------------------

export async function createWorkflowMock(
  input: CreateWorkflowInput,
): Promise<WorkflowDefinition> {
  await mockDelay()
  refuseRedacted(input)
  validateName(input.name)
  validateTrigger(input.trigger)

  const now = new Date().toISOString()
  const def: WorkflowDefinition = {
    id: `wf-${globalThis.crypto.randomUUID().slice(0, 8)}`,
    name: input.name,
    description: input.description ?? null,
    trigger: input.trigger,
    startNodeId: input.startNodeId ?? null,
    nodes: input.nodes.map((node) => ({
      ...node,
      url: node.url ?? null,
      method: node.method ?? null,
      headers: node.headers ?? null,
      body: node.body ?? null,
      expression: node.expression ?? null,
      config: node.config ?? {},
      nextOnSuccess: node.nextOnSuccess ?? null,
      nextOnTrue: node.nextOnTrue ?? null,
      nextOnFalse: node.nextOnFalse ?? null,
    })),
    enabled: input.enabled ?? false,
    createdAt: now,
    updatedAt: now,
  }
  WORKFLOWS.set(def.id, structuredClone(def))
  return maskDefinition(def)
}

/**
 * A **partial patch** (§2.2): a key absent from `input` is left alone, a key set
 * to `null` clears the field. `undefined` is therefore never assigned here.
 *
 * `expectedUpdatedAt` exists for the mock's benefit only. The live service does
 * its own concurrency check and has no input field for a version, so
 * `lib/api/workflow.ts` does not forward it there — but without it there would
 * be no way to produce the CONFLICT (§2.7) a demo build needs to exercise the
 * reconcile dialog.
 */
export async function updateWorkflowMock(
  id: string,
  input: UpdateWorkflowInput,
  options: { expectedUpdatedAt?: string } = {},
): Promise<WorkflowDefinition> {
  await mockDelay()
  const current = requireWorkflow(id)
  refuseRedacted(input)
  validateName(input.name)
  validateTrigger(input.trigger)

  if (
    options.expectedUpdatedAt !== undefined &&
    options.expectedUpdatedAt !== current.updatedAt
  ) {
    // Do NOT retry this blindly on the client — that silently discards
    // someone's edit. Re-fetch, show the difference, let the user choose.
    throw new WorkflowError('CONFLICT', 'The workflow changed underneath.', {
      upstreamMessage: MESSAGES.conflict,
    })
  }

  const next: WorkflowDefinition = {
    ...current,
    ...('name' in input && input.name !== undefined
      ? { name: input.name }
      : {}),
    ...('description' in input
      ? { description: input.description ?? null }
      : {}),
    ...('enabled' in input && input.enabled !== undefined
      ? { enabled: input.enabled }
      : {}),
    ...('trigger' in input && input.trigger ? { trigger: input.trigger } : {}),
    ...('startNodeId' in input
      ? { startNodeId: input.startNodeId ?? null }
      : {}),
    ...('nodes' in input && input.nodes
      ? {
          nodes: input.nodes.map((node) => ({
            ...node,
            url: node.url ?? null,
            method: node.method ?? null,
            headers: node.headers ?? null,
            body: node.body ?? null,
            expression: node.expression ?? null,
            config: node.config ?? {},
            nextOnSuccess: node.nextOnSuccess ?? null,
            nextOnTrue: node.nextOnTrue ?? null,
            nextOnFalse: node.nextOnFalse ?? null,
          })),
        }
      : {}),
    updatedAt: new Date(Date.parse(current.updatedAt) + 1_000).toISOString(),
  }
  WORKFLOWS.set(id, structuredClone(next))
  return maskDefinition(next)
}

/** §4: `deleteWorkflow` also removes that workflow's executions. */
export async function deleteWorkflowMock(id: string): Promise<boolean> {
  await mockDelay()
  requireWorkflow(id)
  WORKFLOWS.delete(id)
  for (let i = EXECUTIONS.length - 1; i >= 0; i--) {
    if (EXECUTIONS[i].workflowId === id) EXECUTIONS.splice(i, 1)
  }
  return true
}

/**
 * §4 says to use the activate/deactivate shortcuts for a toggle rather than
 * building a partial update — which also keeps a toggle clear of the redaction
 * trap, since no node payload is involved.
 */
export async function setWorkflowEnabledMock(
  id: string,
  enabled: boolean,
): Promise<WorkflowDefinition> {
  await mockDelay()
  const current = requireWorkflow(id)
  const next: WorkflowDefinition = {
    ...current,
    enabled,
    updatedAt: new Date(Date.parse(current.updatedAt) + 1_000).toISOString(),
  }
  WORKFLOWS.set(id, structuredClone(next))
  return maskDefinition(next)
}

/**
 * Runs the whole workflow and returns the finished execution — synchronously,
 * and slowly on purpose (see {@link MOCK_TRIGGER_DURATION_MS}). The walk follows
 * `nextOnSuccess` / `nextOnTrue` / `nextOnFalse` from `startNodeId`, so the
 * recorded `steps` really are the branch that was taken (§5).
 */
export async function triggerWorkflowMock(
  id: string,
  payload: JsonObject = {},
): Promise<WorkflowExecution> {
  const def = requireWorkflow(id)
  refuseRedacted(payload)
  await mockDelay(MOCK_TRIGGER_DURATION_MS)

  const startedAt = new Date().toISOString()
  const steps: ExecutionStep[] = []
  const byId = new Map(def.nodes.map((n) => [n.id, n]))
  let cursor = def.startNodeId ?? null
  let guard = 0

  while (cursor && guard++ < def.nodes.length) {
    const node = byId.get(cursor)
    if (!node) break
    if (node.type === 'CONDITION') {
      // Deterministic stand-in for SpEL: the mock does not evaluate expressions.
      const result = Boolean(payload.condition ?? true)
      steps.push({
        nodeId: node.id,
        status: 'SUCCESS',
        output: { result },
        error: null,
        executedAt: new Date().toISOString(),
      })
      cursor = (result ? node.nextOnTrue : node.nextOnFalse) ?? null
    } else {
      steps.push({
        nodeId: node.id,
        status: 'SUCCESS',
        output: {
          statusCode: 200,
          headers: { 'content-type': 'application/json' },
          body: { ok: true, chamou: node.url ?? '' },
          truncated: false,
          droppedKeys: 0,
        },
        error: null,
        executedAt: new Date().toISOString(),
      })
      cursor = node.nextOnSuccess ?? null
    }
  }

  const execution: WorkflowExecution = {
    id: `ex-${globalThis.crypto.randomUUID().slice(0, 8)}`,
    workflowId: id,
    status: 'SUCCESS',
    triggerPayload: payload,
    steps,
    createdAt: startedAt,
    startedAt,
    finishedAt: new Date().toISOString(),
    errorMessage: null,
  }
  EXECUTIONS.push(structuredClone(execution))
  return execution
}

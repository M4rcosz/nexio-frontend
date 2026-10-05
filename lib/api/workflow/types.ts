// Hand-written mirror of the nexio-workflow GraphQL schema (§4 of that repo's
// docs/FRONTEND-INTEGRATION.md). Manual types rather than codegen, matching this
// repo's stated posture ("No OpenAPI: types are typed manually") — the surface
// is ten operations with fixed documents.
//
// Deliberately a separate file from `lib/api/types.ts`: that module already
// carries ~75 exported types for the nexio-core contract, and this is a
// different service with its own error model and paging shape.
//
// Nullability here follows the schema exactly. `String` (nullable) becomes
// `| null` and `String!` does not, because the distinction is load-bearing for
// the update mutation: omitted means "leave as is", explicit `null` means
// "clear" (§2.2).

/** An arbitrary JSON object — the schema's `JSON` scalar. */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

/** The `JSON` scalar as it is used for `headers`, `body`, `config`, `payload`. */
export type JsonObject = { [key: string]: JsonValue }

export type NodeType = 'HTTP_REQUEST' | 'CONDITION'

export type WorkflowHttpMethod =
  'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD'

export type TriggerType = 'MOCK_EVENT' | 'SCHEDULE'

export type ExecutionStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED'

export type StepStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED'

/**
 * `config` carries the type's own settings — notably `{ cron }` for a SCHEDULE
 * (six fields, seconds first — see §11 and WORKFLOW_CRON_FIELD_COUNT).
 */
export type TriggerConfig = {
  type: TriggerType
  config: JsonObject
}

/**
 * One node of the graph. The field set is **symmetric per type** and the server
 * refuses the fields a type does not use (§6): HTTP_REQUEST owns
 * `url`/`method`/`headers`/`body`/`nextOnSuccess`, CONDITION owns
 * `expression`/`nextOnTrue`/`nextOnFalse`. Modelled as one optional-heavy type
 * rather than a discriminated union because that is what the GraphQL type is —
 * the narrowing belongs in the validators, not here.
 *
 * Credential-shaped values inside `url`/`headers` arrive **masked** on read
 * (the literal `***REDACTED***`); see `./redaction.ts` before sending any of
 * this back.
 */
export type WorkflowNode = {
  id: string
  type: NodeType
  // HTTP_REQUEST only
  url?: string | null
  method?: WorkflowHttpMethod | null
  headers?: JsonObject | null
  body?: JsonObject | null
  // CONDITION only
  expression?: string | null
  config: JsonObject
  nextOnSuccess?: string | null
  nextOnTrue?: string | null
  nextOnFalse?: string | null
}

export type WorkflowDefinition = {
  id: string
  name: string
  description: string | null
  trigger: TriggerConfig
  nodes: WorkflowNode[]
  startNodeId: string | null
  enabled: boolean
  /** ISO-8601 with offset, e.g. `2026-01-01T00:00:00Z`. */
  createdAt: string
  /**
   * Also the optimistic-concurrency token in practice: two saves of the same
   * workflow race and the loser gets `CONFLICT` (§2.7).
   */
  updatedAt: string
}

/**
 * One recorded node visit. `output` is `JSON!` and, for an HTTP_REQUEST, it is a
 * **third party's response body** — never render it as markup or turn any of its
 * values into an `href` (§5 records `headers.location` on a 3xx).
 */
export type ExecutionStep = {
  nodeId: string
  status: StepStatus
  output: JsonObject
  error: string | null
  executedAt: string
}

/**
 * One run. `steps` is in execution order, which is also the branch that was
 * actually taken (§5) — render it in array order.
 *
 * `steps` is absent from list reads on purpose: `executions(...) { steps }` is
 * refused by the query-cost limit (§2.5), so the list document omits it and the
 * field is optional here.
 */
export type WorkflowExecution = {
  id: string
  workflowId: string
  status: ExecutionStatus
  triggerPayload: JsonObject
  steps?: ExecutionStep[]
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  errorMessage: string | null
}

/** A run as it comes back from the list document — no `steps` (§2.5). */
export type WorkflowExecutionSummary = Omit<
  WorkflowExecution,
  'steps' | 'triggerPayload' | 'startedAt'
>

// --- Mutation inputs ---

export type WorkflowNodeInput = {
  id: string
  type: NodeType
  url?: string | null
  method?: WorkflowHttpMethod | null
  headers?: JsonObject | null
  body?: JsonObject | null
  expression?: string | null
  config?: JsonObject | null
  nextOnSuccess?: string | null
  nextOnTrue?: string | null
  nextOnFalse?: string | null
}

export type CreateWorkflowInput = {
  name: string
  description?: string | null
  enabled?: boolean
  trigger: TriggerConfig
  startNodeId?: string | null
  nodes: WorkflowNodeInput[]
}

/**
 * A **partial patch** (§2.2): a key that is absent leaves the field alone, a key
 * sent as `null` clears it. Build these from the raw parsed object so
 * `JSON.stringify` can drop `undefined` and keep `null` — never from a spread of
 * a defaulted form state, which turns "untouched" into "overwrite".
 */
export type UpdateWorkflowInput = {
  name?: string
  description?: string | null
  enabled?: boolean
  trigger?: TriggerConfig
  startNodeId?: string | null
  nodes?: WorkflowNodeInput[]
}

// --- Read queries ---

export type ListWorkflowsQuery = {
  limit?: number
  offset?: number
  enabledOnly?: boolean
}

export type ListExecutionsQuery = {
  limit?: number
  offset?: number
}

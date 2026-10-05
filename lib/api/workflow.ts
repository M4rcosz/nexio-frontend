// Client layer for the nexio-workflow engine
// (contract: that repo's docs/FRONTEND-INTEGRATION.md):
//   - workflows(limit, offset, enabledOnly)  list definitions
//   - workflow(id)                           one definition + its graph
//   - createWorkflow(input)                  create
//   - updateWorkflow(id, input)              PARTIAL patch (§2.2)
//   - activateWorkflow / deactivateWorkflow  the enabled toggle (§4)
//   - deleteWorkflow(id)                     cascades to its executions (§4)
//   - triggerWorkflow(id, payload)           SYNCHRONOUS, up to ~40s (§2.3)
//   - executions(workflowId, limit, offset)  runs, NO steps (§2.5)
//   - execution(id)                          one run, with steps
//
// Every read is uncached but tagged (`revalidate: 0` + tags), the
// `listAiMembershipUsage` pattern: freshness is owned by `revalidateTag` in the
// mutating route handlers, not by a time window. The CLAUDE.md "client-only
// list" exception does NOT apply here — both lists are RSC-rendered, so there is
// always a tag to invalidate and the tags below are not redundant.
//
// One thing no tag can cover: SCHEDULE workflows produce executions in the
// background with no mutation of ours to hook (§11). That is why the run list is
// `revalidate: 0` rather than time-cached — there is no writer to hang a
// revalidation off.
import { USE_MOCKS } from './client'
import {
  ACTIVATE_WORKFLOW,
  CREATE_WORKFLOW,
  DEACTIVATE_WORKFLOW,
  DELETE_WORKFLOW,
  EXECUTIONS_LIST,
  EXECUTION_DETAIL,
  TRIGGER_WORKFLOW,
  UPDATE_WORKFLOW,
  WORKFLOWS_LIST,
  WORKFLOW_DETAIL,
} from './workflow/documents'
import { WorkflowError } from './workflow/errors'
import { workflowGraphql } from './workflow/graphql'
import { clampWorkflowPaging } from './workflow/paging'
import type {
  CreateWorkflowInput,
  JsonObject,
  ListExecutionsQuery,
  ListWorkflowsQuery,
  UpdateWorkflowInput,
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowExecutionSummary,
} from './workflow/types'
import {
  createWorkflowMock,
  deleteWorkflowMock,
  getExecutionMock,
  getWorkflowMock,
  listExecutionsMock,
  listWorkflowsMock,
  setWorkflowEnabledMock,
  triggerWorkflowMock,
  updateWorkflowMock,
} from './mocks/workflow'
import { WORKFLOW_TRIGGER_TIMEOUT_MS } from '@/lib/validation/constants'

export { isWorkflowConfigured } from './workflow/graphql'

// --- Cache tags -----------------------------------------------------------

/**
 * Tag pairs mirror the `business-units` + `business-units:${id}` convention
 * called out in CLAUDE.md, so a write can bust either the whole collection or
 * one row.
 */
export const workflowTags = {
  all: 'workflows',
  one: (id: string) => `workflow:${id}`,
  executions: 'workflow-executions',
  executionsOf: (workflowId: string) => `workflow-executions:${workflowId}`,
  execution: (id: string) => `workflow-execution:${id}`,
} as const

// --- Reads ----------------------------------------------------------------

/**
 * `workflows(...)` — a **bare array**, no total and no envelope, so the caller
 * pages by offset (see `./workflow/paging.ts`). Paging is clamped here rather
 * than upstream, because an out-of-range value is a `BAD_REQUEST` (§2.6).
 */
export async function listWorkflows(
  query: ListWorkflowsQuery = {},
): Promise<WorkflowDefinition[]> {
  if (USE_MOCKS) return listWorkflowsMock(query)
  const { limit, offset } = clampWorkflowPaging(query)
  const data = await workflowGraphql<{ workflows: WorkflowDefinition[] }>({
    document: WORKFLOWS_LIST,
    operationName: 'Workflows',
    variables: { limit, offset, enabledOnly: query.enabledOnly ?? false },
    tags: [workflowTags.all],
  })
  return data.workflows
}

/**
 * `workflow(id)` — nullable upstream, so an unknown id is `null` rather than a
 * throw (the `getAiConversation` shape: the page calls `notFound()`).
 */
export async function getWorkflow(
  id: string,
): Promise<WorkflowDefinition | null> {
  if (USE_MOCKS) return getWorkflowMock(id)
  try {
    const data = await workflowGraphql<{ workflow: WorkflowDefinition | null }>(
      {
        document: WORKFLOW_DETAIL,
        operationName: 'Workflow',
        variables: { id },
        tags: [workflowTags.all, workflowTags.one(id)],
      },
    )
    return data.workflow ?? null
  } catch (err) {
    // The schema says `null`, but a NOT_FOUND classification means the same
    // thing to a caller; fold it in so no page has to handle both.
    if (err instanceof WorkflowError && err.classification === 'NOT_FOUND') {
      return null
    }
    throw err
  }
}

/**
 * `executions(workflowId, ...)` — runs **without** `steps`: asking for them in a
 * list is refused by the query-cost limit (§2.5). Fetch one run with
 * {@link getExecution} when the user opens it.
 *
 * Throws `WorkflowError('NOT_FOUND')` for an unknown `workflowId` — not an empty
 * array (§4). The distinction is deliberate upstream and the UI must keep it: a
 * missing workflow is a 404 page, a workflow that was never triggered is an
 * empty state.
 */
export async function listExecutions(
  workflowId: string,
  query: ListExecutionsQuery = {},
): Promise<WorkflowExecutionSummary[]> {
  if (USE_MOCKS) return listExecutionsMock(workflowId, query)
  const { limit, offset } = clampWorkflowPaging(query)
  const data = await workflowGraphql<{
    executions: WorkflowExecutionSummary[]
  }>({
    document: EXECUTIONS_LIST,
    operationName: 'Runs',
    variables: { workflowId, limit, offset },
    tags: [workflowTags.executions, workflowTags.executionsOf(workflowId)],
  })
  return data.executions
}

/** `execution(id)` — one run with its steps, in the order they ran (§5). */
export async function getExecution(
  id: string,
): Promise<WorkflowExecution | null> {
  if (USE_MOCKS) return getExecutionMock(id)
  try {
    const data = await workflowGraphql<{
      execution: WorkflowExecution | null
    }>({
      document: EXECUTION_DETAIL,
      operationName: 'Run',
      variables: { id },
      tags: [workflowTags.execution(id)],
    })
    return data.execution ?? null
  } catch (err) {
    if (err instanceof WorkflowError && err.classification === 'NOT_FOUND') {
      return null
    }
    throw err
  }
}

// --- Writes ---------------------------------------------------------------

/**
 * `createWorkflow(input)`. Callers must run `containsRedacted(input)` first —
 * see `./workflow/redaction.ts`; the service refuses the marker and the local
 * check turns a confusing round trip into a precise field error.
 */
export async function createWorkflow(
  input: CreateWorkflowInput,
): Promise<WorkflowDefinition> {
  if (USE_MOCKS) return createWorkflowMock(input)
  const data = await workflowGraphql<{ createWorkflow: WorkflowDefinition }>({
    document: CREATE_WORKFLOW,
    operationName: 'CreateWorkflow',
    variables: { input },
  })
  return data.createWorkflow
}

/**
 * `updateWorkflow(id, input)` — a **partial patch** (§2.2). Pass the raw parsed
 * object: `JSON.stringify` drops `undefined` (field untouched) and keeps `null`
 * (field cleared), and that distinction is the whole mutation. Never pass a
 * spread of a defaulted form state, which turns "untouched" into "overwrite".
 *
 * May throw `WorkflowError('CONFLICT')` when a concurrent save wins the race
 * (§2.7). Re-fetch and let the user reconcile — never retry blindly.
 *
 * `options.expectedUpdatedAt` is honoured by the mock only: the live service
 * runs its own concurrency check and `UpdateWorkflowInput` has no version field
 * to carry one, so forwarding it would mean inventing an input the schema does
 * not have. It exists so a mock build can still produce the CONFLICT the
 * reconcile UI is built around.
 */
export async function updateWorkflow(
  id: string,
  input: UpdateWorkflowInput,
  options: { expectedUpdatedAt?: string } = {},
): Promise<WorkflowDefinition> {
  if (USE_MOCKS) return updateWorkflowMock(id, input, options)
  const data = await workflowGraphql<{ updateWorkflow: WorkflowDefinition }>({
    document: UPDATE_WORKFLOW,
    operationName: 'UpdateWorkflow',
    variables: { id, input },
  })
  return data.updateWorkflow
}

/**
 * The enabled toggle. §4 is explicit that this uses the
 * `activateWorkflow`/`deactivateWorkflow` shortcuts rather than a partial
 * update — which also keeps a toggle away from the redaction trap entirely,
 * since no node payload is sent.
 */
export async function setWorkflowEnabled(
  id: string,
  enabled: boolean,
): Promise<WorkflowDefinition> {
  if (USE_MOCKS) return setWorkflowEnabledMock(id, enabled)
  const document = enabled ? ACTIVATE_WORKFLOW : DEACTIVATE_WORKFLOW
  const data = await workflowGraphql<{
    activateWorkflow?: WorkflowDefinition
    deactivateWorkflow?: WorkflowDefinition
  }>({
    document,
    operationName: enabled ? 'ActivateWorkflow' : 'DeactivateWorkflow',
    variables: { id },
  })
  const updated = enabled ? data.activateWorkflow : data.deactivateWorkflow
  if (!updated) {
    throw new WorkflowError(
      'INTERNAL_ERROR',
      'The workflow service returned no definition for the toggle.',
    )
  }
  return updated
}

/**
 * `deleteWorkflow(id)` — **also removes that workflow's executions** (§4). Say
 * so in the confirm copy, and bust `workflow-executions:${id}` alongside the
 * definition tags.
 */
export async function deleteWorkflow(id: string): Promise<boolean> {
  if (USE_MOCKS) return deleteWorkflowMock(id)
  const data = await workflowGraphql<{ deleteWorkflow: boolean }>({
    document: DELETE_WORKFLOW,
    operationName: 'DeleteWorkflow',
    variables: { id },
  })
  return data.deleteWorkflow
}

/**
 * `triggerWorkflow(id, payload)` — runs the whole workflow and returns the
 * FINISHED execution. It is not a job submission: there is nothing to poll, and
 * the response's `steps` are the result (§2.3).
 *
 * Budgeted at {@link WORKFLOW_TRIGGER_TIMEOUT_MS} (60s), not the 10s read
 * default: the engine checks its own 30s cap *before each node* and does not
 * interrupt a node already running, so the realistic worst case is a bit over
 * 40s. The calling route handler also needs `export const maxDuration` — the
 * platform default is well under that.
 *
 * One request per click. Batching two triggers into one document is rejected
 * outright, because root mutation fields run serially (§2.4).
 */
export async function triggerWorkflow(
  id: string,
  payload: JsonObject = {},
): Promise<WorkflowExecution> {
  if (USE_MOCKS) return triggerWorkflowMock(id, payload)
  const data = await workflowGraphql<{ triggerWorkflow: WorkflowExecution }>({
    document: TRIGGER_WORKFLOW,
    operationName: 'Trigger',
    variables: { id, payload },
    timeoutMs: WORKFLOW_TRIGGER_TIMEOUT_MS,
  })
  return data.triggerWorkflow
}

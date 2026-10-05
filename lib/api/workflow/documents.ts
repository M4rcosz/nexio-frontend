// The fixed GraphQL documents for nexio-workflow (§4 and §10 of its
// docs/FRONTEND-INTEGRATION.md).
//
// They are plain template strings, and they are **owned by the server**: the
// browser never sends a document. Our route handlers are resource-shaped
// (`/api/workflow/workflows/...`) and validate only the *variables*, because the
// workflow service has no auth of its own yet (§9) — a `/graphql` passthrough
// would turn an authenticated same-origin route into an open gateway onto it.
//
// Selection sets are deliberately narrow. Query depth ≤ 14 and complexity
// ≤ 2000 are enforced upstream (§2.6), and every extra field on a list
// multiplies by the page size.

/** `WorkflowDefinition` fields every read shares. */
const DEFINITION_FIELDS = `
  id
  name
  description
  trigger { type config }
  startNodeId
  enabled
  createdAt
  updatedAt
`

/**
 * The full node shape. Credential-shaped values inside `url` and `headers` come
 * back masked as `***REDACTED***` (§2.1) — see ./redaction.ts before sending any
 * of it back.
 */
const NODE_FIELDS = `
  id
  type
  url
  method
  headers
  body
  expression
  config
  nextOnSuccess
  nextOnTrue
  nextOnFalse
`

/**
 * The list. `nodes { id }` and nothing more: the list only shows a node *count*,
 * and pulling `headers`/`body`/`config` for every node of every row would
 * multiply a third party's JSON by the page size for no gain.
 */
export const WORKFLOWS_LIST = `
query Workflows($limit: Int, $offset: Int, $enabledOnly: Boolean) {
  workflows(limit: $limit, offset: $offset, enabledOnly: $enabledOnly) {
    ${DEFINITION_FIELDS}
    nodes { id }
  }
}
`

/** One definition, with its full graph. `workflow(id)` is nullable → `null`. */
export const WORKFLOW_DETAIL = `
query Workflow($id: ID!) {
  workflow(id: $id) {
    ${DEFINITION_FIELDS}
    nodes {
      ${NODE_FIELDS}
    }
  }
}
`

/**
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ DO NOT ADD `steps` TO THIS DOCUMENT. (§2.5)                              │
 * │                                                                          │
 * │ `executions(...) { steps { … } }` is REFUSED OUTRIGHT by the query-cost   │
 * │ limit — it is not merely slow. Each execution can hold up to 200 steps    │
 * │ and every step's `output` is a third party's whole response body, so one  │
 * │ page of 20 runs could be thousands of foreign HTTP bodies.               │
 * │                                                                          │
 * │ The correct shape is this list, then EXECUTION_DETAIL for the one run     │
 * │ the user opens. `documents.test.ts` asserts the substring `steps` does    │
 * │ not appear here, so a well-meant addition fails the suite instead of      │
 * │ 500ing the runs tab in production.                                       │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * Note also that `executions` on an unknown `workflowId` is `NOT_FOUND`, not an
 * empty list (§4) — the UI must tell "no such workflow" apart from "never run".
 */
export const EXECUTIONS_LIST = `
query Runs($workflowId: ID!, $limit: Int, $offset: Int) {
  executions(workflowId: $workflowId, limit: $limit, offset: $offset) {
    id
    workflowId
    status
    createdAt
    finishedAt
    errorMessage
  }
}
`

/**
 * One run, with its steps. `steps` is in execution order, which is also the
 * branch that was actually taken (§5) — render it in array order.
 */
export const EXECUTION_DETAIL = `
query Run($id: ID!) {
  execution(id: $id) {
    id
    workflowId
    status
    triggerPayload
    createdAt
    startedAt
    finishedAt
    errorMessage
    steps { nodeId status output error executedAt }
  }
}
`

export const CREATE_WORKFLOW = `
mutation CreateWorkflow($input: CreateWorkflowInput!) {
  createWorkflow(input: $input) {
    ${DEFINITION_FIELDS}
    nodes {
      ${NODE_FIELDS}
    }
  }
}
`

/**
 * A **partial patch** (§2.2): an absent key leaves the field alone, an explicit
 * `null` clears it. Build `input` from the raw parsed object so `JSON.stringify`
 * drops `undefined` and keeps `null`.
 *
 * A save can lose a race and come back `CONFLICT` (§2.7) — re-fetch and let the
 * user decide. Never retry blindly; that discards someone's edit.
 */
export const UPDATE_WORKFLOW = `
mutation UpdateWorkflow($id: ID!, $input: UpdateWorkflowInput!) {
  updateWorkflow(id: $id, input: $input) {
    ${DEFINITION_FIELDS}
    nodes {
      ${NODE_FIELDS}
    }
  }
}
`

/** Also removes that workflow's executions (§4) — say so in the confirm copy. */
export const DELETE_WORKFLOW = `
mutation DeleteWorkflow($id: ID!) {
  deleteWorkflow(id: $id)
}
`

/**
 * §4 is explicit that the enabled toggle uses these two shortcuts rather than a
 * partial update — which also keeps a toggle away from the redaction trap, since
 * no node payload is involved at all.
 */
export const ACTIVATE_WORKFLOW = `
mutation ActivateWorkflow($id: ID!) {
  activateWorkflow(id: $id) {
    ${DEFINITION_FIELDS}
    nodes { id }
  }
}
`

export const DEACTIVATE_WORKFLOW = `
mutation DeactivateWorkflow($id: ID!) {
  deactivateWorkflow(id: $id) {
    ${DEFINITION_FIELDS}
    nodes { id }
  }
}
`

/**
 * EXACTLY ONE `triggerWorkflow` ROOT FIELD PER DOCUMENT. (§2.4)
 *
 * A document with two or more is rejected outright, and for a good reason: root
 * mutation fields run serially, so batching N triggers means N full workflow
 * runs on a single request — each one up to ~40s (§2.3). Fire them as separate
 * requests. `documents.test.ts` pins the occurrence count.
 *
 * This one call is synchronous and long: the response *is* the finished
 * execution, so there is nothing to poll. Call it with
 * `WORKFLOW_TRIGGER_TIMEOUT_MS`, never the default read timeout.
 */
export const TRIGGER_WORKFLOW = `
mutation Trigger($id: ID!, $payload: JSON) {
  triggerWorkflow(id: $id, payload: $payload) {
    id
    workflowId
    status
    triggerPayload
    createdAt
    startedAt
    finishedAt
    errorMessage
    steps { nodeId status output error executedAt }
  }
}
`

/**
 * Every document, so the structural guards in `documents.test.ts` cover any
 * document added later without needing to be updated. Keep new documents in it.
 */
export const WORKFLOW_DOCUMENTS = {
  WORKFLOWS_LIST,
  WORKFLOW_DETAIL,
  EXECUTIONS_LIST,
  EXECUTION_DETAIL,
  CREATE_WORKFLOW,
  UPDATE_WORKFLOW,
  DELETE_WORKFLOW,
  ACTIVATE_WORKFLOW,
  DEACTIVATE_WORKFLOW,
  TRIGGER_WORKFLOW,
} as const

export type WorkflowDocumentName = keyof typeof WORKFLOW_DOCUMENTS

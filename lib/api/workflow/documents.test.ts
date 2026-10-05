import { describe, it, expect } from 'vitest'
import {
  EXECUTIONS_LIST,
  EXECUTION_DETAIL,
  TRIGGER_WORKFLOW,
  WORKFLOW_DOCUMENTS,
} from './documents'

const entries = Object.entries(WORKFLOW_DOCUMENTS)

/** Max `{}` nesting depth — the cheap stand-in for GraphQL's depth metric. */
function braceDepth(document: string): number {
  let depth = 0
  let max = 0
  for (const ch of document) {
    if (ch === '{') max = Math.max(max, ++depth)
    else if (ch === '}') depth--
  }
  return max
}

/** Every `(...)` group removed, so the only colons left would be aliases. */
function withoutArgumentLists(document: string): string {
  return document.replace(/\([^)]*\)/g, '')
}

describe('EXECUTIONS_LIST must not ask for steps (§2.5)', () => {
  it('does not contain the substring "steps"', () => {
    // `executions(...) { steps { … } }` is REFUSED by the query-cost limit, not
    // merely slow: 20 runs x up to 200 steps x a third party's whole response
    // body. Fetch the list without steps, then one execution when it is opened.
    expect(EXECUTIONS_LIST).not.toContain('steps')
  })

  it('still selects what the run list renders', () => {
    for (const field of [
      'id',
      'status',
      'createdAt',
      'finishedAt',
      'errorMessage',
    ]) {
      expect(EXECUTIONS_LIST).toContain(field)
    }
  })
})

describe('EXECUTION_DETAIL is where steps belong', () => {
  it('selects steps with the fields a run view needs', () => {
    expect(EXECUTION_DETAIL).toContain('steps')
    for (const field of ['nodeId', 'status', 'output', 'error', 'executedAt']) {
      expect(EXECUTION_DETAIL).toContain(field)
    }
  })
})

describe('one triggerWorkflow per document (§2.4)', () => {
  it('never appears more than once in any document', () => {
    // Root mutation fields run serially, so two triggers on one request means
    // two full workflow runs — and the server rejects such a document outright.
    for (const [name, document] of entries) {
      const occurrences = document.match(/triggerWorkflow/g)?.length ?? 0
      expect(occurrences, name).toBeLessThanOrEqual(1)
    }
  })

  it('appears exactly once in TRIGGER_WORKFLOW', () => {
    expect(TRIGGER_WORKFLOW.match(/triggerWorkflow/g)).toHaveLength(1)
  })
})

describe('every document stays within the server-side query limits (§2.6)', () => {
  it('nests well under depth 14', () => {
    for (const [name, document] of entries) {
      expect(braceDepth(document), name).toBeLessThanOrEqual(14)
    }
  })

  it('uses no aliases — they are how the depth/complexity caps get blown', () => {
    // Aliasing the same query many times in one document is the documented way
    // to hit the limits. Once argument lists and variable definitions are
    // removed, a surviving colon could only be an alias.
    for (const [name, document] of entries) {
      expect(withoutArgumentLists(document), name).not.toContain(':')
    }
  })

  it('declares exactly one operation per document', () => {
    for (const [name, document] of entries) {
      const operations = document.match(/^\s*(query|mutation)\s/gm) ?? []
      expect(operations, name).toHaveLength(1)
    }
  })

  it('leaves no unsubstituted fragment placeholder behind', () => {
    // The shared field lists are interpolated, so an unbalanced template would
    // otherwise ship a literal `${…}` to the server.
    for (const [name, document] of entries) {
      expect(document, name).not.toContain('${')
      expect(document.trim().length, name).toBeGreaterThan(0)
    }
  })
})

import type { ReactNode } from 'react'

/**
 * Minimal Markdown renderer for assistant replies.
 *
 * The model answers in Markdown, so its `**bold**` and `* ` bullets used to
 * leak into the transcript as literal punctuation. This covers the subset it
 * actually emits — headings, lists, fenced code, tables, emphasis, inline code
 * and links — and builds React elements rather than using
 * `dangerouslySetInnerHTML`, so a reply containing HTML is shown as text
 * instead of being injected.
 */

type Block =
  | { kind: 'p'; lines: string[] }
  | { kind: 'h'; level: number; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[]; start: number }
  | { kind: 'code'; code: string }
  | { kind: 'quote'; lines: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'hr' }

const BULLET = /^ {0,3}[-*+][ \t]+(.*)$/
const ORDERED = /^ {0,3}(\d{1,9})[.)][ \t]+(.*)$/
const HEADING = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*#*$/
const FENCE = /^ {0,3}(?:```|~~~)/
const QUOTE = /^ {0,3}> ?(.*)$/
const RULE = /^ {0,3}(?:-{3,}|\*{3,}|_{3,})[ \t]*$/
const TABLE_DIVIDER = /^ *\|?[ :-]*-[ :|-]*\|?[ \t]*$/

/** `| a | b |` -> `['a', 'b']`, tolerating the optional outer pipes. */
function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
}

function isTableRow(line: string): boolean {
  return line.includes('|') && !FENCE.test(line)
}

function parse(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '') {
      i++
      continue
    }

    // Fenced code — taken verbatim, so nothing inside is parsed as Markdown.
    if (FENCE.test(line)) {
      const body: string[] = []
      i++
      while (i < lines.length && !FENCE.test(lines[i])) body.push(lines[i++])
      // A missing closing fence still ends at EOF rather than swallowing state.
      if (i < lines.length) i++
      blocks.push({ kind: 'code', code: body.join('\n') })
      continue
    }

    if (RULE.test(line)) {
      blocks.push({ kind: 'hr' })
      i++
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      blocks.push({
        kind: 'h',
        level: heading[1].length,
        text: heading[2],
      })
      i++
      continue
    }

    if (BULLET.test(line)) {
      const items: string[] = []
      while (i < lines.length) {
        const item = BULLET.exec(lines[i])
        if (!item) break
        items.push(item[1])
        i++
      }
      blocks.push({ kind: 'ul', items })
      continue
    }

    const firstOrdered = ORDERED.exec(line)
    if (firstOrdered) {
      const items: string[] = []
      while (i < lines.length) {
        const item = ORDERED.exec(lines[i])
        if (!item) break
        items.push(item[2])
        i++
      }
      blocks.push({
        kind: 'ol',
        items,
        start: Number(firstOrdered[1]),
      })
      continue
    }

    if (QUOTE.test(line)) {
      const body: string[] = []
      while (i < lines.length) {
        const quoted = QUOTE.exec(lines[i])
        if (!quoted) break
        body.push(quoted[1])
        i++
      }
      blocks.push({ kind: 'quote', lines: body })
      continue
    }

    // A table needs its divider row, or `a | b` in prose would start one.
    if (
      isTableRow(line) &&
      i + 1 < lines.length &&
      TABLE_DIVIDER.test(lines[i + 1]) &&
      lines[i + 1].includes('-')
    ) {
      const head = cells(line)
      i += 2
      const rows: string[][] = []
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        isTableRow(lines[i])
      ) {
        const row = cells(lines[i])
        // Pad or trim so every row matches the header width.
        rows.push(Array.from({ length: head.length }, (_, c) => row[c] ?? ''))
        i++
      }
      blocks.push({ kind: 'table', head, rows })
      continue
    }

    // Paragraph: runs until a blank line or the start of another block.
    const paragraph: string[] = []
    while (i < lines.length && lines[i].trim() !== '') {
      const next = lines[i]
      if (
        paragraph.length > 0 &&
        (BULLET.test(next) ||
          ORDERED.test(next) ||
          HEADING.test(next) ||
          QUOTE.test(next) ||
          RULE.test(next) ||
          FENCE.test(next))
      ) {
        break
      }
      paragraph.push(next.trim())
      i++
    }
    blocks.push({ kind: 'p', lines: paragraph })
  }

  return blocks
}

const INLINE =
  /(\*\*|__)([\s\S]+?)\1|(\*|_)([\s\S]+?)\3|`([^`]+)`|\[([^\]\n]+)\]\(([^)\s]+)\)/

const WORD = /[\p{L}\p{N}_]/u

/** Only schemes that can't execute script when clicked. */
function safeHref(href: string): string | null {
  return /^(https?:\/\/|mailto:)/i.test(href) ? href : null
}

function renderInline(text: string, key: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  let n = 0
  // Own instance per call: emphasis recurses, and a shared /g regex would have
  // its `lastIndex` reset by the inner scan and never terminate.
  const scanner = new RegExp(INLINE, 'g')

  let match: RegExpExecArray | null
  while ((match = scanner.exec(text)) !== null) {
    const [full, strong, strongText, em, emText, code, linkText, href] = match
    const start = match.index
    const end = start + full.length

    // `snake_case` and `a * b` are not emphasis: require the delimiter to sit
    // on a word boundary and to hug its content.
    const delimiter = strong ?? em
    if (delimiter) {
      const inner = (strongText ?? emText) as string
      const before = text[start - 1] ?? ''
      const after = text[end] ?? ''
      const clings = !/^\s/.test(inner) && !/\s$/.test(inner)
      const isolated =
        delimiter === '*' || delimiter === '**'
          ? true
          : !WORD.test(before) && !WORD.test(after)
      if (!clings || !isolated) continue
    }

    if (start > last) nodes.push(text.slice(last, start))
    const childKey = `${key}-${n++}`

    if (strong) {
      nodes.push(
        <strong key={childKey} className="font-semibold text-fg">
          {renderInline(strongText, childKey)}
        </strong>,
      )
    } else if (em) {
      nodes.push(<em key={childKey}>{renderInline(emText, childKey)}</em>)
    } else if (code) {
      nodes.push(
        <code
          key={childKey}
          className="rounded-md border border-border bg-bg px-1 py-0.5 font-mono text-[0.85em]"
        >
          {code}
        </code>,
      )
    } else if (linkText) {
      const url = safeHref(href)
      nodes.push(
        url ? (
          <a
            key={childKey}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-600 underline underline-offset-2 hover:text-brand-500 dark:text-brand-300"
          >
            {renderInline(linkText, childKey)}
          </a>
        ) : (
          // Unsupported scheme — show the label, drop the link.
          <span key={childKey}>{renderInline(linkText, childKey)}</span>
        ),
      )
    }

    last = end
  }

  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

const HEADING_SIZE: Record<number, string> = {
  1: 'text-base',
  2: 'text-[0.95rem]',
  3: 'text-sm',
}

function renderBlock(block: Block, key: string): ReactNode {
  switch (block.kind) {
    case 'h': {
      const Tag = `h${Math.min(block.level, 6)}` as 'h3'
      return (
        <Tag
          key={key}
          className={`mt-3 font-semibold text-fg first:mt-0 ${
            HEADING_SIZE[block.level] ?? 'text-sm'
          }`}
        >
          {renderInline(block.text, key)}
        </Tag>
      )
    }
    case 'ul':
      return (
        <ul
          key={key}
          className="list-disc space-y-1 pl-5 marker:text-fg-subtle"
        >
          {block.items.map((item, n) => (
            <li key={n} className="pl-0.5">
              {renderInline(item, `${key}-${n}`)}
            </li>
          ))}
        </ul>
      )
    case 'ol':
      return (
        <ol
          key={key}
          start={block.start}
          className="list-decimal space-y-1 pl-5 marker:text-fg-subtle"
        >
          {block.items.map((item, n) => (
            <li key={n} className="pl-0.5">
              {renderInline(item, `${key}-${n}`)}
            </li>
          ))}
        </ol>
      )
    case 'code':
      return (
        <pre
          key={key}
          className="scrollbar-thin overflow-x-auto rounded-xl border border-border bg-bg p-3"
        >
          <code className="font-mono text-xs leading-relaxed">
            {block.code}
          </code>
        </pre>
      )
    case 'quote':
      return (
        <blockquote
          key={key}
          className="border-l-2 border-brand-500/40 pl-3 text-fg-muted"
        >
          {renderInline(block.lines.join('\n'), key)}
        </blockquote>
      )
    case 'table':
      return (
        <div key={key} className="scrollbar-thin overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr>
                {block.head.map((cell, n) => (
                  <th
                    key={n}
                    className="border-b border-border px-2 py-1.5 font-semibold text-fg"
                  >
                    {renderInline(cell, `${key}-h${n}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td
                      key={c}
                      className="border-b border-border/60 px-2 py-1.5 align-top"
                    >
                      {renderInline(cell, `${key}-${r}-${c}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'hr':
      return <hr key={key} className="border-border" />
    case 'p':
      return (
        <p key={key} className="whitespace-pre-wrap">
          {renderInline(block.lines.join('\n'), key)}
        </p>
      )
  }
}

export function Markdown({ text }: { text: string }) {
  const blocks = parse(text)
  return (
    <div className="space-y-2.5 leading-relaxed [&>:first-child]:mt-0">
      {blocks.map((block, n) => renderBlock(block, `b${n}`))}
    </div>
  )
}

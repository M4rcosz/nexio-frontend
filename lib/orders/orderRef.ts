/**
 * A short, human-scannable reference derived from the opaque order id. The
 * backend provides no friendly order number, and the primary call-token is the
 * `customerName`; this is only a muted, secondary disambiguator (e.g. two
 * walk-ins share a name). Takes the last 6 hex-ish chars of the id, uppercased.
 */
export function shortOrderRef(id: string): string {
  const tail = id.replace(/-/g, '').slice(-6).toUpperCase()
  return tail || id
}

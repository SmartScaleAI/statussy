/**
 * Live Health (SMA-31) from current `components` rows.
 *
 * When the provider has component rows: operational count / total.
 * When it has none: 100% if latest overall status is `operational`, else 0%.
 * This is a live snapshot, not historical uptime or a vendor SLA.
 */

export function resolveLiveHealth(
  status: string,
  operational: number,
  total: number
): { operational: number; total: number } {
  if (total > 0) {
    return { operational, total }
  }
  return status === "operational"
    ? { operational: 1, total: 1 }
    : { operational: 0, total: 1 }
}

/** e.g. 16/17 operational components → "94.1%". */
export function formatHealth(operational: number, total: number) {
  const pct = (operational / total) * 100
  const digits = pct >= 99.5 ? 2 : 1
  return `${pct.toFixed(digits)}%`
}

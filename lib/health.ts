/**
 * Health chicklet resolution (SMA-31 live Health, SMA-79 honest modes).
 *
 * Same chicklet slot, three modes:
 * 1. Component rows exist → Health % (operational ÷ total; tooltip/aria say
 *    "Component health" — the on-card label stays "Health").
 * 2. No component rows + open incidents → "N incidents". When the count is
 *    not backed by tracked incident rows (status-only signal), the copy is
 *    "N open events" instead, so "incidents" never mislabels.
 * 3. No component rows + none open → "No incidents".
 *
 * Health % is only ever computed from real component rows — never faked as
 * 0%/100% from the overall status alone. The chicklet is never blank.
 */

export type HealthChicklet =
  | { kind: "health"; operational: number; total: number }
  | {
      kind: "incidents"
      count: number
      /**
       * True when `count` comes from tracked incident rows; false when it is
       * synthesized from a non-operational overall status alone, where
       * "incidents" would mislabel (copy switches to "open events").
       */
      countedIncidents: boolean
    }
  | { kind: "clear" }

/**
 * Resolve the chicklet mode from the live snapshot: current `components`
 * rows, open (unresolved) incident rows, and the overall status.
 *
 * A non-operational overall status with no tracked incident rows still counts
 * as one open event — some feeds signal a problem without a parseable
 * incident list, and "No incidents" would be dishonest there.
 */
export function resolveHealthChicklet(
  status: string,
  operational: number,
  total: number,
  openIncidents: number
): HealthChicklet {
  if (total > 0) {
    return { kind: "health", operational, total }
  }
  if (openIncidents > 0) {
    return { kind: "incidents", count: openIncidents, countedIncidents: true }
  }
  const eventSignaled = status !== "operational" && status !== "unknown"
  return eventSignaled
    ? { kind: "incidents", count: 1, countedIncidents: false }
    : { kind: "clear" }
}

/** What the card renders for one chicklet: slot label, value, tooltip/aria. */
export type ChickletDisplay = {
  /** Slot prefix ("Health"); null in incident modes — the value says it all. */
  label: string | null
  value: string
  /** Tooltip + aria. Must not claim component health in incident modes. */
  title: string
  /** Resolved percent for Health % sorting; null in incident modes. */
  healthPct: number | null
}

export function describeChicklet(chicklet: HealthChicklet): ChickletDisplay {
  switch (chicklet.kind) {
    case "health":
      return {
        label: "Health",
        value: formatHealth(chicklet.operational, chicklet.total),
        title: `Component health — ${chicklet.operational} of ${chicklet.total} components operational. Live snapshot, not historical uptime.`,
        healthPct: (chicklet.operational / chicklet.total) * 100,
      }
    case "incidents": {
      const noun = chicklet.countedIncidents
        ? chicklet.count === 1
          ? "incident"
          : "incidents"
        : chicklet.count === 1
          ? "open event"
          : "open events"
      return {
        label: null,
        value: `${chicklet.count} ${noun}`,
        title: chicklet.countedIncidents
          ? `${chicklet.count} open ${
              chicklet.count === 1 ? "incident" : "incidents"
            } — this service reports no component grid.`
          : `${chicklet.count} open ${
              chicklet.count === 1 ? "event" : "events"
            } signaled by overall status — this service reports no component grid or incident list.`,
        healthPct: null,
      }
    }
    case "clear":
      return {
        label: null,
        value: "No incidents",
        title: "No open incidents — this service reports no component grid.",
        healthPct: null,
      }
  }
}

/** e.g. 16/17 operational components → "94.1%". */
export function formatHealth(operational: number, total: number) {
  const pct = (operational / total) * 100
  const digits = pct >= 99.5 ? 2 : 1
  return `${pct.toFixed(digits)}%`
}

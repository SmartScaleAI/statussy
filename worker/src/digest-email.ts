/**
 * SMA-132: dark, sparse digest template (HTML + plain-text twin).
 * Grok-like full-bleed black column. No em dashes in copy.
 */
import type { ServiceStatus } from "./statuspage.js"

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
const BG = "#000000"
const RULE = "#2a2a2a"
const TEXT = "#f5f5f5"
const MUTED = "#8a8a8a"
const FOOTER = "#6b6b6b"
const CTA_BG = "#ffffff"
const CTA_FG = "#000000"
const COL_WIDTH = 480

const PILL: Record<
  "major_outage" | "partial_outage",
  { bg: string; fg: string; border: string }
> = {
  major_outage: { bg: "#3a1c1c", fg: "#f0a8a8", border: "#5c2e2e" },
  partial_outage: { bg: "#3a2e16", fg: "#e8c888", border: "#5c4a24" },
}

export const STATUS_LABEL: Record<ServiceStatus, string> = {
  operational: "Live",
  degraded: "Degraded",
  partial_outage: "Partial outage",
  major_outage: "Major outage",
  maintenance: "Maintenance",
  unknown: "Unknown",
}

export type DigestEmailItem = {
  serviceId: string
  name: string
  to: ServiceStatus
  statusUrl?: string
  incidentTitle?: string
  incidentUrl?: string
}

/** Preview rows: incident present vs status-only (no incident to report). */
export const DIGEST_PREVIEW_ITEMS: DigestEmailItem[] = [
  {
    serviceId: "openai",
    name: "OpenAI",
    to: "major_outage",
    statusUrl: "https://status.openai.com/",
    incidentTitle: "API elevated errors",
    incidentUrl: "https://status.openai.com/incidents/abc",
  },
  {
    serviceId: "anthropic",
    name: "Anthropic",
    to: "partial_outage",
    statusUrl: "https://status.claude.com/",
  },
]

export function digestBoardUrl(publicSiteUrl: string): string {
  return publicSiteUrl.replace(/\/$/, "") || "https://www.statussy.com"
}

export function digestServiceUrl(
  publicSiteUrl: string,
  serviceId: string
): string {
  return `${digestBoardUrl(publicSiteUrl)}/services/${serviceId}`
}

export function digestPrefsUrl(publicSiteUrl: string): string {
  return `${digestBoardUrl(publicSiteUrl)}/settings`
}

export function digestMarkUrl(publicSiteUrl: string): string {
  return `${digestBoardUrl(publicSiteUrl)}/icon-192.png`
}

export function digestAttentionTitle(count: number): string {
  if (count === 1) {
    return "1 service needs attention"
  }
  return `${count} services need attention`
}

export function safeHttpUrl(value: string | undefined | null): string | null {
  if (!value) {
    return null
  }
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null
    }
    return url.href
  } catch {
    return null
  }
}

export function digestTextBody(
  items: readonly DigestEmailItem[],
  publicSiteUrl: string
): string {
  const board = digestBoardUrl(publicSiteUrl)
  const prefs = digestPrefsUrl(publicSiteUrl)
  const blocks = items.map((item) => {
    const detail = digestServiceUrl(publicSiteUrl, item.serviceId)
    const official = safeHttpUrl(item.statusUrl)
    const incidentTitle = item.incidentTitle?.trim()
    const lines = [item.name, STATUS_LABEL[item.to], detail]
    if (incidentTitle) {
      const incidentHref = safeHttpUrl(item.incidentUrl)
      lines.push(
        incidentHref
          ? `${incidentTitle} (${incidentHref})`
          : incidentTitle
      )
    }
    if (official) {
      lines.push(`Official status: ${official}`)
    }
    return lines.join("\n")
  })
  return [
    "Statussy",
    "",
    digestAttentionTitle(items.length),
    "Stack alert",
    "",
    ...blocks.flatMap((block, index) => (index === 0 ? [block] : ["", block])),
    "",
    `Open your board: ${board}`,
    "",
    `Manage digest prefs: ${prefs}`,
    `Unsubscribe: ${prefs}`,
    "© SmartScale Solutions LLC",
    "statussy.com",
  ].join("\n")
}

export function digestPreviewDocument(
  publicSiteUrl = "https://www.statussy.com"
): string {
  const withIncident = DIGEST_PREVIEW_ITEMS[0]
  const withoutIncident = DIGEST_PREVIEW_ITEMS[1]
  if (!withIncident || !withoutIncident) {
    throw new Error("DIGEST_PREVIEW_ITEMS must include incident and empty rows")
  }
  const samples: Array<{ label: string; items: DigestEmailItem[] }> = [
    { label: "With an active incident", items: [withIncident] },
    { label: "No incident to report", items: [withoutIncident] },
  ]
  const blocks = samples
    .map(({ label, items }) => {
      const html = digestHtmlBody(items, publicSiteUrl)
      const inner = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html
      return `<p style="margin:0 0 12px;padding:48px 24px 0;font-family:${FONT};font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${FOOTER};">${escapeHtml(label)}</p>${inner}`
    })
    .join("")
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>Statussy digest preview</title>
</head>
<body style="margin:0;padding:0;background-color:${BG};">
${blocks}
</body>
</html>`
}

export function digestHtmlBody(
  items: readonly DigestEmailItem[],
  publicSiteUrl: string
): string {
  const board = digestBoardUrl(publicSiteUrl)
  const prefs = digestPrefsUrl(publicSiteUrl)
  const mark = digestMarkUrl(publicSiteUrl)
  const title = digestAttentionTitle(items.length)
  const rows = items
    .map((item, index) =>
      serviceRowHtml(item, publicSiteUrl, index === items.length - 1)
    )
    .join("")

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${BG};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BG}" style="margin:0;padding:0;background-color:${BG};width:100%;">
  <tr>
    <td align="center" style="padding:48px 24px 56px;">
      <table role="presentation" width="${COL_WIDTH}" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${COL_WIDTH}px;">
        <tr>
          <td style="padding:0 0 36px;">
            ${wordmarkHtml(mark)}
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 32px;">
            <h1 style="margin:0;font-family:${FONT};font-size:32px;line-height:1.2;font-weight:600;letter-spacing:-0.03em;color:${TEXT};">${escapeHtml(title)}</h1>
            <p style="margin:12px 0 0;font-family:${FONT};font-size:15px;line-height:1.4;color:${MUTED};">Stack alert</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 16px;">
            ${rows}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 0 40px;">
            ${ctaHtml(board)}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 0 0;border-top:1px solid ${RULE};">
            <p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.6;color:${FOOTER};">
              <a href="${escapeHtml(prefs)}" style="color:${FOOTER};text-decoration:none;">Manage digest prefs</a>
              &nbsp;&middot;&nbsp;
              <a href="${escapeHtml(prefs)}" style="color:${FOOTER};text-decoration:none;">Unsubscribe</a>
            </p>
            <p style="margin:6px 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${FOOTER};">
              © SmartScale Solutions LLC
              &nbsp;&middot;&nbsp;
              <a href="${escapeHtml(board)}" style="color:${FOOTER};text-decoration:none;">statussy.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

function wordmarkHtml(markUrl: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;padding-right:10px;">
                  <img src="${escapeHtml(markUrl)}" width="28" height="28" alt="" style="display:block;width:28px;height:28px;border:0;border-radius:7px;">
                </td>
                <td style="vertical-align:middle;font-family:${FONT};font-size:20px;line-height:1;font-weight:600;letter-spacing:-0.02em;color:${TEXT};">Statussy</td>
              </tr>
            </table>`
}

function serviceRowHtml(
  item: DigestEmailItem,
  publicSiteUrl: string,
  last: boolean
): string {
  const detail = digestServiceUrl(publicSiteUrl, item.serviceId)
  const official = safeHttpUrl(item.statusUrl)
  const pill =
    PILL[item.to === "partial_outage" ? "partial_outage" : "major_outage"]
  const label = STATUS_LABEL[item.to]
  const incidentTitle = item.incidentTitle?.trim()
  const incidentHref = safeHttpUrl(item.incidentUrl)
  const incidentHtml = incidentTitle
    ? `<p style="margin:6px 0 0;font-family:${FONT};font-size:13px;line-height:1.4;color:${MUTED};">${
        incidentHref
          ? `<a href="${escapeHtml(incidentHref)}" style="color:${MUTED};text-decoration:none;">${escapeHtml(incidentTitle)}</a>`
          : escapeHtml(incidentTitle)
      }</p>`
    : ""
  const officialHtml = official
    ? `<p style="margin:6px 0 0;font-family:${FONT};font-size:13px;line-height:1.4;">
                    <a href="${escapeHtml(official)}" style="color:${MUTED};text-decoration:none;">Official status</a>
                  </p>`
    : ""
  const border = last ? "" : `border-bottom:1px solid ${RULE};`

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;${border}">
              <tr>
                <td style="padding:16px 12px 16px 0;vertical-align:middle;">
                  <a href="${escapeHtml(detail)}" style="font-family:${FONT};font-size:16px;line-height:1.4;font-weight:600;color:${TEXT};text-decoration:none;">${escapeHtml(item.name)}</a>
                  ${incidentHtml}
                  ${officialHtml}
                </td>
                <td style="padding:16px 0;vertical-align:middle;white-space:nowrap;" align="right">
                  <span style="display:inline-block;padding:4px 10px;font-family:${FONT};font-size:12px;line-height:1.3;font-weight:600;color:${pill.fg};background-color:${pill.bg};border:1px solid ${pill.border};border-radius:999px;">${escapeHtml(label)}</span>
                </td>
              </tr>
            </table>`
}

function ctaHtml(board: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="${CTA_BG}" style="background-color:${CTA_BG};border-radius:999px;">
                  <a href="${escapeHtml(board)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;line-height:1;font-weight:600;color:${CTA_FG};text-decoration:none;">Open your board</a>
                </td>
              </tr>
            </table>`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

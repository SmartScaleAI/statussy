import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  PYPI_GROUP_ID,
  PYPI_GROUP_NAME,
  incidentTouchesComponents,
  mapComponentStatus,
  mapIndicator,
  mapStatuspage,
  mapStatuspageGroup,
  selectStatuspageGroupComponents,
  type StatuspageIncident,
  type StatuspageSummary,
} from "../src/statuspage.js"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures")

async function loadFixtures(): Promise<{
  summary: StatuspageSummary
  incidents: StatuspageIncident[]
}> {
  const summary = JSON.parse(await readFile(join(FIXTURES, "summary.json"), "utf8"))
  const incidentsBody = JSON.parse(await readFile(join(FIXTURES, "incidents.json"), "utf8"))
  return { summary, incidents: incidentsBody.incidents }
}

test("mapIndicator covers all Statuspage indicators", () => {
  assert.equal(mapIndicator("none"), "operational")
  assert.equal(mapIndicator("minor"), "degraded")
  assert.equal(mapIndicator("major"), "partial_outage")
  assert.equal(mapIndicator("critical"), "major_outage")
  assert.equal(mapIndicator("maintenance"), "maintenance")
  assert.equal(mapIndicator("bogus"), "unknown")
  assert.equal(mapIndicator(undefined), "unknown")
})

test("mapComponentStatus covers all Statuspage component statuses", () => {
  assert.equal(mapComponentStatus("operational"), "operational")
  assert.equal(mapComponentStatus("degraded_performance"), "degraded")
  assert.equal(mapComponentStatus("partial_outage"), "partial_outage")
  assert.equal(mapComponentStatus("major_outage"), "major_outage")
  assert.equal(mapComponentStatus("under_maintenance"), "maintenance")
  assert.equal(mapComponentStatus("something_new"), "unknown")
  assert.equal(mapComponentStatus(undefined), "unknown")
})

test("mapStatuspage parses the OpenAI fixture summary", async () => {
  const { summary, incidents } = await loadFixtures()
  const state = mapStatuspage(summary, incidents, "https://status.openai.com")

  assert.equal(state.status, "partial_outage")
  assert.equal(state.detail.source, "statuspage")
  assert.equal(state.detail.indicator, "major")
  assert.equal(state.detail.description, "Partial System Outage")
  assert.equal(state.detail.pageUpdatedAt, "2026-09-04T10:46:54Z")

  assert.equal(state.components.length, 6)
  const byName = new Map(state.components.map((c) => [c.name, c]))
  assert.equal(byName.get("Images")?.status, "operational")
  assert.equal(byName.get("Responses")?.status, "partial_outage")
  assert.equal(byName.get("Login")?.status, "degraded")
  assert.equal(byName.get("Audio")?.status, "major_outage")
  assert.equal(byName.get("Files")?.status, "maintenance")
  assert.equal(byName.get("FedRAMP")?.status, "unknown")
  assert.equal(byName.get("Images")?.externalId, "01JMXBRMFE4MAP2BHSJNZ787WX")
  assert.equal(byName.get("Images")?.position, 0)

  assert.equal(state.incidents.length, 2)
  const [open, resolved] = state.incidents
  assert.equal(open.title, "Elevated error rates on Responses API")
  assert.equal(open.status, "investigating")
  assert.equal(open.impact, "major")
  assert.equal(open.startedAt, "2026-09-04T12:00:00Z")
  assert.equal(open.resolvedAt, null)
  assert.equal(open.url, "https://status.openai.com/incidents/01M1QAAAAAEEYEREC54HNAHY99")
  assert.equal(resolved.status, "resolved")
  assert.equal(resolved.resolvedAt, "2026-09-04T10:46:54Z")

  // The open (unresolved) incident becomes the snapshot headline.
  assert.equal(state.incidentTitle, "Elevated error rates on Responses API")
})

test("mapStatuspage handles an all-operational page with no incidents", () => {
  const summary: StatuspageSummary = {
    page: { url: "https://status.openai.com/" },
    status: { indicator: "none", description: "All Systems Operational" },
    components: [{ id: "abc", name: "API", status: "operational", position: 0 }],
  }
  const state = mapStatuspage(summary, [], "https://status.openai.com")
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.incidents.length, 0)
  assert.equal(state.components.length, 1)
})

test("mapStatuspage ignores resolved incidents for the headline", async () => {
  const { summary, incidents } = await loadFixtures()
  const resolvedOnly = incidents.filter((i) => i.status === "resolved")
  const state = mapStatuspage(summary, resolvedOnly, "https://status.openai.com")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.incidents.length, 1)
})

test("mapStatuspage prefers vendor shortlink for incident url", () => {
  const incident: StatuspageIncident = {
    id: "x1",
    name: "Thing broke",
    status: "identified",
    shortlink: "https://stspg.io/abc",
    created_at: "2026-09-04T12:00:00Z",
  }
  const state = mapStatuspage(
    { status: { indicator: "minor" } },
    [incident],
    "https://status.openai.com",
  )
  assert.equal(state.incidents[0].url, "https://stspg.io/abc")
  assert.equal(state.status, "degraded")
})

const CONTENTSTACK_LIKE: StatuspageSummary = {
  status: { indicator: "major", description: "Partial System Outage" },
  components: [
    { id: "aws", name: "Amazon Web Services US Region", status: "partial_outage", group: true, position: 1 },
    { id: "lytics-group", name: "Lytics", status: "operational", group: true, position: 8 },
    { id: "lytics-api", name: "Lytics - API", status: "operational", group: false, group_id: "lytics-group", position: 1 },
    { id: "lytics-collect", name: "Lytics - Collect API", status: "degraded_performance", group: false, group_id: "lytics-group", position: 2 },
    { id: "lytics-web", name: "Lytics - Web Application", status: "operational", group: false, group_id: "lytics-group", position: 3 },
    { id: "lytics-pipe", name: "Lytics - Data Pipeline", status: "operational", group: false, group_id: "lytics-group", position: 4 },
    { id: "cms", name: "CMS", status: "major_outage", group: false, group_id: "aws", position: 1 },
  ],
}

test("selectStatuspageGroupComponents returns only Lytics leaves", () => {
  const children = selectStatuspageGroupComponents(CONTENTSTACK_LIKE.components, {
    groupId: "lytics-group",
    groupName: "Lytics",
  })
  assert.deepEqual(
    children.map((c) => c.name),
    ["Lytics - API", "Lytics - Collect API", "Lytics - Web Application", "Lytics - Data Pipeline"],
  )
})

test("incidentTouchesComponents matches group component ids or Lytics in the title", () => {
  const ids = new Set(["lytics-api", "lytics-group"])
  assert.equal(
    incidentTouchesComponents(
      { id: "1", name: "CMS down", components: [{ id: "cms", name: "CMS" }] },
      ids,
      "Lytics",
    ),
    false,
  )
  assert.equal(
    incidentTouchesComponents(
      { id: "2", name: "Collect delay", components: [{ id: "lytics-collect", name: "Lytics - Collect API" }] },
      new Set(["lytics-collect"]),
      "Lytics",
    ),
    true,
  )
  assert.equal(
    incidentTouchesComponents({ id: "3", name: "Lytics migration", components: [] }, ids, "Lytics"),
    true,
  )
})

test("mapStatuspageGroup ignores the host-page indicator and strips the group prefix", () => {
  const state = mapStatuspageGroup(
    CONTENTSTACK_LIKE,
    [
      {
        id: "cms-inc",
        name: "AWS CMS outage",
        status: "investigating",
        components: [{ id: "cms", name: "CMS" }],
      },
      {
        id: "lytics-inc",
        name: "Collect API latency",
        status: "identified",
        impact: "minor",
        components: [{ id: "lytics-collect", name: "Lytics - Collect API" }],
        started_at: "2026-09-06T10:00:00Z",
      },
    ],
    "https://status.contentstack.com",
    { groupId: "lytics-group", groupName: "Lytics" },
  )
  assert.equal(state.status, "degraded")
  assert.equal(state.detail.source, "statuspage_group")
  assert.equal(state.incidentTitle, "Collect API latency")
  assert.deepEqual(
    state.components.map((c) => c.name),
    ["API", "Collect API", "Web Application", "Data Pipeline"],
  )
  assert.equal(state.incidents.length, 1)
  assert.equal(state.incidents[0].title, "Collect API latency")
})

test("mapStatuspageGroup throws when the group is missing", () => {
  assert.throws(() =>
    mapStatuspageGroup(
      { status: { indicator: "none" }, components: [] },
      [],
      "https://status.contentstack.com",
      { groupName: "Lytics" },
    ),
  )
})

const PYTHON_INFRA_LIKE: StatuspageSummary = {
  status: { indicator: "maintenance", description: "Service Under Maintenance" },
  components: [
    { id: PYPI_GROUP_ID, name: "PyPI", status: "operational", group: true, position: 1 },
    { id: "pypi-general", name: "pypi.org - General", status: "operational", group: false, group_id: PYPI_GROUP_ID, position: 1 },
    { id: "pypi-cdn", name: "pypi.org - CDN", status: "operational", group: false, group_id: PYPI_GROUP_ID, position: 2 },
    { id: "pypi-files", name: "files.pythonhosted.org - Files", status: "operational", group: false, group_id: PYPI_GROUP_ID, position: 3 },
    { id: "pypi-redirects", name: "files.pythonhosted.org - Redirects", status: "operational", group: false, group_id: PYPI_GROUP_ID, position: 4 },
    { id: "hosting", name: "PyPI Hosting Platforms", status: "operational", group: true, position: 2 },
    { id: "aws-ec2", name: "AWS ec2-us-east-2", status: "operational", group: false, group_id: "hosting", position: 1 },
    { id: "fastly", name: "Content Delivery Network", status: "under_maintenance", group: true, position: 3 },
    { id: "fastly-lhr", name: "Fastly Europe (LHR)", status: "under_maintenance", group: false, group_id: "fastly", position: 1 },
    { id: "python-org", name: "python.org", status: "partial_outage", group: true, position: 4 },
    { id: "python-cdn", name: "python.org - CDN", status: "partial_outage", group: false, group_id: "python-org", position: 1 },
  ],
}

test("selectStatuspageGroupComponents keeps PyPI + files.pythonhosted.org only", () => {
  const children = selectStatuspageGroupComponents(PYTHON_INFRA_LIKE.components, {
    groupId: PYPI_GROUP_ID,
    groupName: PYPI_GROUP_NAME,
  })
  assert.deepEqual(
    children.map((c) => c.name),
    [
      "pypi.org - General",
      "pypi.org - CDN",
      "files.pythonhosted.org - Files",
      "files.pythonhosted.org - Redirects",
    ],
  )
})

test("mapStatuspageGroup for PyPI ignores PSF / Fastly page status", () => {
  const state = mapStatuspageGroup(
    PYTHON_INFRA_LIKE,
    [
      {
        id: "fastly-inc",
        name: "Fastly London maintenance",
        status: "investigating",
        components: [{ id: "fastly-lhr", name: "Fastly Europe (LHR)" }],
      },
      {
        id: "pypi-inc",
        name: "PyPI CDN elevated errors",
        status: "resolved",
        components: [{ id: "pypi-cdn", name: "pypi.org - CDN" }],
      },
    ],
    "https://status.python.org",
    { groupId: PYPI_GROUP_ID, groupName: PYPI_GROUP_NAME },
  )
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.detail.source, "statuspage_group")
  assert.equal(state.detail.groupId, PYPI_GROUP_ID)
  assert.equal(state.incidents.length, 1)
  assert.equal(state.incidents[0].title, "PyPI CDN elevated errors")
  assert.equal(state.components.length, 4)
  assert.ok(state.components.every((c) => /pypi\.org|files\.pythonhosted\.org/i.test(c.name)))
  assert.ok(!state.components.some((c) => /fastly|python\.org|AWS/i.test(c.name)))
})

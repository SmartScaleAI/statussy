import assert from "node:assert/strict"
import test from "node:test"
import {
  isHetznerActiveMaintenance,
  isHetznerOpenOutage,
  mapHetzner,
  parseHetznerNextData,
  type HetznerIncident,
  type HetznerPage,
} from "../src/hetzner.js"

const NOW = new Date("2026-09-05T03:00:00.000Z")

const cloudVolumes: HetznerIncident = {
  id: 399842,
  system: "/systems/92",
  titleEn: "Limited availability of Cloud Volumes in Hillsboro (HIL)",
  incidentState: "identified",
  incidentType: "other",
  startTime: "2026-08-21T10:41:23+00:00",
  endTime: null,
}

const futureMaintenance: HetznerIncident = {
  id: 382763,
  system: "/systems/43",
  titleEn: "Maintenance at backbone connection between FRA - HEL1",
  incidentState: "scheduled",
  incidentType: "maintenance",
  startTime: "2026-09-07T21:00:00+00:00",
  endTime: "2026-09-08T04:00:00+00:00",
}

const liveMaintenance: HetznerIncident = {
  id: 400001,
  system: "/systems/3",
  titleEn: "Cloud Server host maintenance",
  incidentState: "in_progress",
  incidentType: "maintenance",
  startTime: "2026-09-05T01:00:00+00:00",
  endTime: "2026-09-05T05:00:00+00:00",
}

const resolvedOutage: HetznerIncident = {
  id: 402610,
  system: "/systems/36",
  titleEn: "Fault at DENIC",
  incidentState: "resolved",
  incidentType: "outage",
  startTime: "2026-09-04T11:30:00+00:00",
  endTime: "2026-09-04T12:38:47+00:00",
}

const openOutage: HetznerIncident = {
  id: 402700,
  system: "/systems/3",
  titleEn: "Cloud Server network outage",
  incidentState: "investigating",
  incidentType: "outage",
  startTime: "2026-09-05T02:00:00+00:00",
  endTime: null,
}

function page(overrides: Partial<HetznerPage> = {}): HetznerPage {
  return {
    systems: [
      { id: 3, titleEn: "Cloud Server", systemState: "published" },
      { id: 43, titleEn: "Backbone", systemState: "published" },
      { id: 92, titleEn: "Cloud Volumes", systemState: "published" },
    ],
    incidents: {
      informationList: [cloudVolumes],
      maintenanceList: [futureMaintenance],
      incidentHistory: [resolvedOutage],
      topNotification: [],
    },
    ...overrides,
  }
}

test("informational notices and future maintenance do not paint", () => {
  assert.equal(isHetznerOpenOutage(cloudVolumes, NOW), false)
  assert.equal(isHetznerActiveMaintenance(futureMaintenance, NOW), false)
  const state = mapHetzner(page(), { now: NOW })
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.components.length, 0)
  assert.equal(state.incidents.find((incident) => incident.externalId === "399842")?.impact, "informational")
})

test("in-progress maintenance paints the card and affected system", () => {
  assert.equal(isHetznerActiveMaintenance(liveMaintenance, NOW), true)
  const state = mapHetzner(
    page({
      incidents: {
        informationList: [],
        maintenanceList: [liveMaintenance],
        incidentHistory: [],
      },
    }),
    { now: NOW },
  )
  assert.equal(state.status, "maintenance")
  assert.equal(state.incidentTitle, "Cloud Server host maintenance")
  assert.equal(state.components[0]?.name, "Cloud Server")
  assert.equal(state.components[0]?.status, "maintenance")
})

test("open outages paint major_outage; resolved history does not", () => {
  assert.equal(isHetznerOpenOutage(openOutage, NOW), true)
  assert.equal(isHetznerOpenOutage(resolvedOutage, NOW), false)
  const state = mapHetzner(
    page({
      incidents: {
        informationList: [cloudVolumes],
        maintenanceList: [futureMaintenance],
        incidentHistory: [resolvedOutage, openOutage],
      },
    }),
    { now: NOW },
  )
  assert.equal(state.status, "major_outage")
  assert.equal(state.incidentTitle, "Cloud Server network outage")
  assert.equal(state.detail.source, "hetzner")
})

test("parseHetznerNextData reads pageProps from official HTML", () => {
  const html = `<!DOCTYPE html><html><head></head><body>
<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        systems: [{ id: 3, titleEn: "Cloud Server" }],
        incidents: {
          informationList: [cloudVolumes],
          maintenanceList: [],
          incidentHistory: [],
          topNotification: [],
        },
      },
    },
  })}</script>
</body></html>`
  const parsed = parseHetznerNextData(html)
  assert.equal(parsed.systems[0]?.titleEn, "Cloud Server")
  assert.equal(parsed.incidents.informationList?.[0]?.id, 399842)
})

test("parseHetznerNextData throws when the payload is missing", () => {
  assert.throws(() => parseHetznerNextData("<html></html>"), /no __NEXT_DATA__/)
})

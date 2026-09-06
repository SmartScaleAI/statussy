import assert from "node:assert/strict"
import test from "node:test"
import {
  mapUptimeKuma,
  mapUptimeKumaHeartbeatStatus,
  type UptimeKumaHeartbeatPayload,
  type UptimeKumaPage,
} from "../src/uptime-kuma.js"

test("mapUptimeKumaHeartbeatStatus covers Kuma probe codes", () => {
  assert.equal(mapUptimeKumaHeartbeatStatus(1), "operational")
  assert.equal(mapUptimeKumaHeartbeatStatus(0), "major_outage")
  assert.equal(mapUptimeKumaHeartbeatStatus(3), "maintenance")
  assert.equal(mapUptimeKumaHeartbeatStatus(2), "unknown")
  assert.equal(mapUptimeKumaHeartbeatStatus(undefined), "unknown")
})

const page: UptimeKumaPage = {
  config: { slug: "public", title: "Blender Status Overview" },
  incidents: [],
  maintenanceList: [],
  publicGroupList: [
    {
      id: 1,
      name: "Website and User Accounts",
      monitorList: [
        { id: 130, name: "Blender website" },
        { id: 79, name: "Blender ID" },
      ],
    },
    {
      id: 4,
      name: "Media and Downloads",
      monitorList: [{ id: 90, name: "Downloads" }],
    },
  ],
}

const heartbeat: UptimeKumaHeartbeatPayload = {
  heartbeatList: {
    "130": [{ status: 1, time: "2026-09-06 13:00:00.000" }],
    "79": [{ status: 1, time: "2026-09-06 13:00:00.000" }],
    "90": [{ status: 1, time: "2026-09-06 13:00:00.000" }],
  },
}

test("mapUptimeKuma is operational when every latest heartbeat is up", () => {
  const state = mapUptimeKuma(page, heartbeat)
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.components.length, 3)
  assert.equal(state.detail.source, "uptime_kuma")
  assert.equal(state.detail.title, "Blender Status Overview")
})

test("mapUptimeKuma uses the latest heartbeat and paints a down monitor", () => {
  const down: UptimeKumaHeartbeatPayload = {
    heartbeatList: {
      "130": [
        { status: 1, time: "2026-09-06 12:00:00.000" },
        { status: 0, time: "2026-09-06 13:00:00.000", msg: "timeout" },
      ],
      "79": [{ status: 1, time: "2026-09-06 13:00:00.000" }],
      "90": [{ status: 3, time: "2026-09-06 13:00:00.000" }],
    },
  }
  const state = mapUptimeKuma(page, down)
  assert.equal(state.status, "major_outage")
  assert.equal(state.components.find((component) => component.name === "Blender website")?.status, "major_outage")
  assert.equal(state.components.find((component) => component.name === "Downloads")?.status, "maintenance")
})

test("mapUptimeKuma warning incidents paint degraded; info notices do not", () => {
  const noisy: UptimeKumaPage = {
    ...page,
    incidents: [
      { id: 1, style: "info", title: "Scheduled blog post", createdDate: "2026-09-01 00:00:00" },
      { id: 2, style: "warning", title: "Projects git degraded", createdDate: "2026-09-06 12:00:00" },
    ],
  }
  const state = mapUptimeKuma(noisy, heartbeat)
  assert.equal(state.status, "degraded")
  assert.equal(state.incidentTitle, "Projects git degraded")
  assert.equal(state.incidents.length, 2)
})

test("mapUptimeKuma throws when the monitor list is empty", () => {
  assert.throws(
    () => mapUptimeKuma({ publicGroupList: [] }, { heartbeatList: { "1": [{ status: 1 }] } }),
    /no monitors/,
  )
})

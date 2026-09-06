import assert from "node:assert/strict"
import test from "node:test"
import { mapHoneybadgerHtml, mapHoneybadgerTone } from "../src/honeybadger.js"

const FLIPPER = `<div class="summary-text">
  All systems are <span class="up-accent">operational</span>
</div>
<div class="site">
  <div class="color-bar-up color-bar"></div>
  <div class="site-name">
    <a href="/sites/0f02ee80-6e9c-4937-9f2b-9c393dbee26f">Website</a>
  </div>
</div>
<div class="site">
  <div class="color-bar-up color-bar"></div>
  <div class="site-name">
    <a href="/sites/2aed2306-992b-49ab-a26e-4cbdc54384b8">API</a>
  </div>
</div>`

const FLIPPER_DOWN = `<div class="summary-text">
  All systems are <span class="down-accent">down</span>
</div>
<div class="site">
  <div class="color-bar-down color-bar"></div>
  <div class="site-name">
    <a href="/sites/aaaa">API</a>
  </div>
</div>`

test("mapHoneybadgerTone covers Honeybadger color-bar tokens", () => {
  assert.equal(mapHoneybadgerTone("up"), "operational")
  assert.equal(mapHoneybadgerTone("down"), "major_outage")
  assert.equal(mapHoneybadgerTone("degraded"), "degraded")
})

test("mapHoneybadgerHtml parses Flipper Cloud sites", () => {
  const state = mapHoneybadgerHtml(FLIPPER, "https://status.flippercloud.io")
  assert.equal(state.detail.source, "honeybadger")
  assert.equal(state.status, "operational")
  assert.equal(state.components.length, 2)
  const byName = new Map(state.components.map((component) => [component.name, component]))
  assert.equal(byName.get("Website")?.externalId, "0f02ee80-6e9c-4937-9f2b-9c393dbee26f")
  assert.equal(byName.get("API")?.status, "operational")
  assert.equal(state.incidents.length, 0)
})

test("mapHoneybadgerHtml rolls a down site into major_outage", () => {
  const state = mapHoneybadgerHtml(FLIPPER_DOWN, "https://status.flippercloud.io")
  assert.equal(state.status, "major_outage")
  assert.equal(state.components[0]?.status, "major_outage")
})

test("mapHoneybadgerHtml throws when no sites are present", () => {
  assert.throws(() => mapHoneybadgerHtml("<html></html>", "https://status.flippercloud.io"))
})

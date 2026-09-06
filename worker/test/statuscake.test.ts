import assert from "node:assert/strict"
import test from "node:test"
import {
  mapStatusCakeBanner,
  mapStatusCakeHtml,
  mapStatusCakeTag,
  parseStatusCakeBanner,
  parseStatusCakeComponents,
  parseStatusCakeEvents,
} from "../src/statuscake.js"

const MAILCHIMP_HTML = `
<div class="notification is-success" id="status-bar">
  <div class="container">
    <div class="level">
      <div class="level-left">
        <span class="icon"><i class="fa fa-check"></i></span> All Systems are Online
      </div>
    </div>
  </div>
</div>
<div class="singleton-container">
  <div class="singleton-status singleton-parent level">
    <div class="level-left"><span>Admin</span></div>
    <div class="level-right"><span class="tag is-success">Good Service</span></div>
  </div>
  <div class="singleton-children">
    <div class="level singleton-with-parent is-hidden" data-id="p13298">
      <div class="level-left">- US1 Admin</div>
      <div class="level-right"><span class="tag is-success">Good Service</span></div>
    </div>
  </div>
</div>
<div class="singleton-container">
  <div class="singleton-status singleton-parent level">
    <div class="level-left"><span>API</span></div>
    <div class="level-right"><span class="tag is-warning">Degraded Performance</span></div>
  </div>
</div>
<div class="singleton-container">
  <div class="singleton-status singleton-parent level">
    <div class="level-left"><span>Mailchimp Transactional</span></div>
    <div class="level-right"><span class="tag is-success">Good Service</span></div>
  </div>
  <div class="singleton-children">
    <div class="level singleton-with-parent is-hidden" data-id="p16595">
      <div class="level-left">- Mailchimp Transactional</div>
      <div class="level-right"><span class="tag is-success">Good Service</span></div>
    </div>
  </div>
</div>
<div id="outage_history">
  <div class="box event green">
    <div class="content">
      <article class="media">
        <div class="media-content">
          <div class="content">
            <h3>Mandrill/Transactional Delays</h3>
            <p><small>
              <a href="/details/7eb90a04e6552">View Event Details</a>
              | Created <span class="timestamp">Tue, 01 Sep 2026 16:19:00 +0000</span>
            </small></p>
            <p>
              <strong>Resolved</strong>
              <p>Sends are going out.</p>
              <small>Posted: <span class="timestamp">Tue, 01 Sep 2026 20:27:00 +0000</span></small>
            </p>
            <p>
              <strong>Investigating</strong>
              <p>We are investigating send delays.</p>
            </p>
          </div>
        </div>
      </article>
    </div>
  </div>
</div>
`

test("mapStatusCakeBanner covers banner classes and copy", () => {
  assert.equal(mapStatusCakeBanner("notification is-success", "All Systems are Online"), "operational")
  assert.equal(mapStatusCakeBanner("notification is-warning", "Some systems"), "degraded")
  assert.equal(mapStatusCakeBanner("notification is-danger", "Major outage"), "major_outage")
  assert.equal(mapStatusCakeBanner("notification is-danger", "Some systems offline"), "major_outage")
  assert.equal(mapStatusCakeBanner("notification is-danger", "Issues"), "partial_outage")
  assert.equal(mapStatusCakeBanner("notification is-info", "Maintenance"), "maintenance")
})

test("mapStatusCakeTag covers tile labels", () => {
  assert.equal(mapStatusCakeTag("Good Service", "tag is-success"), "operational")
  assert.equal(mapStatusCakeTag("Degraded Performance", "tag is-warning"), "degraded")
  assert.equal(mapStatusCakeTag("Partial Outage", "tag is-danger"), "partial_outage")
  assert.equal(mapStatusCakeTag("Major Outage", "tag is-danger"), "major_outage")
  assert.equal(mapStatusCakeTag("Under Maintenance", "tag is-info"), "maintenance")
})

test("parseStatusCakeBanner reads the Mailchimp status bar", () => {
  const banner = parseStatusCakeBanner(MAILCHIMP_HTML)
  assert.ok(banner)
  assert.match(banner.className, /is-success/)
  assert.match(banner.text, /All Systems are Online/)
})

test("parseStatusCakeComponents reads parents and children with unique ids", () => {
  const components = parseStatusCakeComponents(MAILCHIMP_HTML)
  assert.equal(components.length, 5)
  assert.equal(components[0].name, "Admin")
  assert.equal(components[0].externalId, "admin")
  assert.equal(components[1].name, "US1 Admin")
  assert.equal(components[1].externalId, "admin/us1-admin")
  assert.equal(components[2].name, "API")
  assert.equal(components[2].status, "degraded")
  assert.equal(components[3].externalId, "mailchimp-transactional")
  assert.equal(components[4].externalId, "mailchimp-transactional/mailchimp-transactional")
})

test("parseStatusCakeEvents reads the latest lifecycle from an event box", () => {
  const incidents = parseStatusCakeEvents(MAILCHIMP_HTML, "https://status.mailchimp.com")
  assert.equal(incidents.length, 1)
  assert.equal(incidents[0].externalId, "7eb90a04e6552")
  assert.equal(incidents[0].title, "Mandrill/Transactional Delays")
  assert.equal(incidents[0].status, "resolved")
  assert.equal(incidents[0].url, "https://status.mailchimp.com/details/7eb90a04e6552")
  assert.equal(incidents[0].resolvedAt, "2026-09-01T20:27:00.000Z")
})

test("mapStatusCakeHtml uses the banner, not a degraded child tile", () => {
  const state = mapStatusCakeHtml(MAILCHIMP_HTML, "https://status.mailchimp.com")
  assert.equal(state.detail.source, "statuscake")
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.components.length, 5)
  assert.equal(state.incidents.length, 1)
})

test("mapStatusCakeHtml throws on empty HTML", () => {
  assert.throws(() => mapStatusCakeHtml("<html></html>", "https://status.mailchimp.com"))
})

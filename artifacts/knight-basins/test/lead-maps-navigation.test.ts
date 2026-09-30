import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const leadsSource = readFileSync(new URL("../src/admin/LeadsManager.tsx", import.meta.url), "utf8");
const calendarSource = readFileSync(new URL("../src/admin/TechnicianCalendarPage.tsx", import.meta.url), "utf8");

describe("lead and technician Google Maps navigation", () => {
  it("saves a pasted Maps link through the site-location API", () => {
    assert.match(leadsSource, /data-testid="input-lead-maps-link"/);
    assert.match(leadsSource, /data-testid="button-save-lead-maps-link"/);
    assert.match(
      leadsSource,
      /fetch\(`\/api\/admin\/leads\/\$\{lead\.id\}\/site-location`, \{[\s\S]*?method: "PATCH"[\s\S]*?credentials: "include"[\s\S]*?JSON\.stringify\(\{ mapsLink: normalizedLink \}\)/,
    );
  });

  it("shows saved coordinates, opens the saved destination, and offers an address-search fallback", () => {
    assert.match(leadsSource, /data-testid="lead-maps-coords"/);
    assert.match(
      leadsSource,
      /href=\{siteLocation\.siteMapsUrl\}[\s\S]*?target="_blank"[\s\S]*?data-testid="button-navigate-lead"/,
    );
    assert.match(leadsSource, /data-testid="button-search-lead-address"/);
    assert.match(leadsSource, /leadAddressMapsSearchUrl\(lead\.address\.trim\(\)\)/);
    assert.match(leadsSource, /encodeURIComponent\(address\)/);
  });

  it("uses a readable API validation message and safe local fallbacks", () => {
    assert.match(leadsSource, /response\.status === 400 && apiMessage/);
    assert.match(leadsSource, /บันทึกลิงก์ Google Maps ไม่สำเร็จ กรุณาตรวจสอบลิงก์แล้วลองอีกครั้ง/);
    assert.match(leadsSource, /เชื่อมต่อเพื่อบันทึกลิงก์ Google Maps ไม่ได้ กรุณาลองอีกครั้ง/);
    assert.doesNotMatch(leadsSource, /feedback\.text\s*\|\|\s*error\.message/);
  });

  it("adds a touch-sized saved-destination link without removing address-search links", () => {
    assert.match(
      calendarSource,
      /href=\{url\}[\s\S]*?target="_blank"[\s\S]*?rel="noreferrer"[\s\S]*?h-10 min-h-10[\s\S]*?data-testid="button-navigate-job"/,
    );
    assert.match(calendarSource, /<SavedJobMapLink url=\{job\.siteMapsUrl\} \/>/);
    assert.match(calendarSource, /<SavedJobMapLink url=\{j\.siteMapsUrl\} \/>/);
    assert.match(calendarSource, /href=\{googleMapsUrl\(job\.address\)\}/);
    assert.match(calendarSource, /href=\{googleMapsUrl\(j\.address\)\}/);
    assert.match(calendarSource, /useListAdminLeads\(undefined, \{\s*query: \{ enabled: needsLeadMaps \}/);
    assert.match(calendarSource, /siteMapsUrlByLeadId\.get\(job\.id\)/);
  });
});
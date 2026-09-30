import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const widgetSource = readFileSync(
  new URL("../src/admin/OpsAssistantWidget.tsx", import.meta.url),
  "utf8",
);
const adminAppSource = readFileSync(
  new URL("../src/admin/AdminApp.tsx", import.meta.url),
  "utf8",
);

describe("admin operations assistant widget", () => {
  it("provides the floating entry point, chat panel, and three accessible modes", () => {
    assert.match(widgetSource, /data-testid="button-open-ops-assistant"/);
    assert.match(widgetSource, /data-testid="panel-ops-assistant"/);
    assert.match(widgetSource, /testId: "assistant-mode-dashboard"/);
    assert.match(widgetSource, /testId: "assistant-mode-leads"/);
    assert.match(widgetSource, /testId: "assistant-mode-calendar"/);
    assert.match(widgetSource, /aria-pressed=\{mode === option\.id\}/);
  });

  it("limits questions to 500 characters and posts the selected mode", () => {
    assert.match(widgetSource, /data-testid="input-ops-assistant-question"/);
    assert.match(widgetSource, /maxLength=\{500\}/);
    assert.match(widgetSource, /data-testid="button-ask-ops-assistant"/);
    assert.match(widgetSource, /disabled=\{!question\.trim\(\) \|\| isLoading\}/);
    assert.match(widgetSource, /fetch\("\/api\/admin\/assistant\/ask"/);
    assert.match(widgetSource, /JSON\.stringify\(\{ question: cleanQuestion, mode: selectedMode \}\)/);
  });

  it("shows message history, loading feedback, and a safe unavailable message", () => {
    assert.match(widgetSource, /data-testid="list-assistant-messages"/);
    assert.match(widgetSource, /data-testid="assistant-loading"/);
    assert.match(widgetSource, /data-testid="assistant-unavailable"/);
    assert.match(widgetSource, /ผู้ช่วย AI ยังไม่พร้อมให้บริการ/);
    assert.match(widgetSource, /payload\.ok !== true/);
  });

  it("includes suggested questions, the disclaimer, and the LINE escalation link", () => {
    assert.match(widgetSource, /data-testid="assistant-suggestions"/);
    assert.match(widgetSource, /งานติดตั้งในเดือนนี้มีกี่งาน/);
    assert.match(widgetSource, /data-testid="assistant-disclaimer"/);
    assert.match(widgetSource, /คำตอบของ AI ใช้เป็นข้อมูลประกอบ ควรตรวจสอบกับข้อมูลจริงอีกครั้ง/);
    assert.match(widgetSource, /data-testid="button-assistant-escalate"/);
    assert.match(widgetSource, /line\.me\/R\/ti\/p\/@789gcnhq/);
  });

  it("renders the widget only after the unauthenticated login guard", () => {
    assert.match(
      adminAppSource,
      /if \(!session\?\.authenticated\) \{\s*return <AdminLogin \/>;\s*\}[\s\S]*?<OpsAssistantWidget \/>/,
    );
    assert.match(adminAppSource, /import \{ OpsAssistantWidget \} from "\.\/OpsAssistantWidget";/);
  });
});
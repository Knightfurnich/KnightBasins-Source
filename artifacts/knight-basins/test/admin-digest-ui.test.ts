import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const sourcePath = fileURLToPath(new URL("../src/admin/AdminLogsManager.tsx", import.meta.url));

describe("AdminLogsManager weekly digest UI", () => {
  it("offers an owner-triggered weekly Telegram digest from the UX Insights tab", async () => {
    const source = await readFile(sourcePath, "utf8");
    assert.match(source, /data-testid="button-audit-weekly-digest"/);
    assert.match(source, /ส่งสรุปรายงานเข้า Telegram ตอนนี้/);
    assert.match(source, /send-weekly-digest\?dryRun=1/);
    assert.match(source, /send-weekly-digest", \{ method: "POST" \}/);
  });

  it("shows a message preview and requires a separate confirmation before sending", async () => {
    const source = await readFile(sourcePath, "utf8");
    assert.match(source, /data-testid="dialog-audit-weekly-digest"/);
    assert.match(source, /role="dialog" aria-modal="true"/);
    assert.match(source, /data-testid="text-audit-weekly-digest-preview"/);
    assert.match(source, /data-testid="button-audit-weekly-digest-confirm"/);
    assert.match(source, /ยืนยันส่งเข้า Telegram/);
    assert.match(source, /disabled=\{!digestPreview \|\| digestPreviewMutation\.isPending \|\| digestSendMutation\.isPending\}/);
  });

  it("surfaces preview and send failures instead of offering an unchecked send", async () => {
    const source = await readFile(sourcePath, "utf8");
    assert.match(source, /data-testid="audit-weekly-digest-preview-error"/);
    assert.match(source, /data-testid="audit-weekly-digest-send-error"/);
  });
});
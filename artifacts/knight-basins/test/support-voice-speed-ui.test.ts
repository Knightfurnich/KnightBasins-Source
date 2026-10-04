import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

// job-255: the speed control on /admin/voice-settings. Source-level checks, like support-voice-toggle-ui.test.ts: the page
// imports React and path aliases that node cannot load directly.

const source = readFileSync(new URL("../src/admin/AdminVoiceSettings.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");

/** The body of a function declared as `const name = (...) => {` up to its closing `  };`. */
function functionBody(name: string): string {
  const start = source.indexOf(`  const ${name} = `);
  assert.ok(start > -1, `${name} not found`);
  return source.slice(start, source.indexOf("\n  };", start));
}

describe("speed control on /admin/voice-settings", () => {
  it("offers 1.00, 1.25 and 1.50 and shows the saved speed in Thai", () => {
    assert.match(source, /const SPEED_CHOICES = \[1, 1\.25, 1\.5\] as const/);
    assert.match(source, /data-testid="panel-voice-speed"/);
    assert.match(source, /data-testid="status-voice-speed-current"/);
    assert.match(source, /`ความเร็ว \$\{formatRate\(savedRate\)\} เท่า`/);
    assert.match(source, /data-testid=\{`button-voice-speed-\$\{formatRate\(rate\)\}`\}/);
    assert.match(source, /function formatRate\(rate: number\) \{\s*return rate\.toFixed\(2\);/);
  });

  it("marks the chosen speed (aria-pressed) and says when a choice is not saved yet", () => {
    assert.match(source, /aria-pressed=\{isChosen\}/);
    assert.match(source, /data-testid="status-voice-speed-pending"/);
    assert.match(source, /ยังไม่บันทึก/);
    assert.match(source, /const effectiveRate = selectedRate \?\? savedRate;/);
  });

  it("has a save button that is only active when the choice differs from the saved speed", () => {
    assert.match(source, /data-testid="button-save-voice-speed"/);
    assert.match(source, /บันทึกความเร็ว/);
    assert.match(source, /disabled=\{!rateChanged \|\| updateVoice\.isPending \|\| !current\}/);
    assert.match(source, /const rateChanged = selectedRate !== null && Math\.abs\(selectedRate - savedRate\) > 1e-9;/);
  });

  it("saves through the existing PATCH with the voice and the new speed, and does not send enabled", () => {
    const body = functionBody("saveSpeakingRate");
    assert.match(body, /updateVoice\.mutate\(\{ data: \{ voiceName: current\.voiceName, speakingRate: rate \} \}/);
    assert.doesNotMatch(body, /enabled/);
    assert.match(body, /บันทึกความเร็วเสียงเป็น \$\{formatRate\(rate\)\} เท่าแล้ว/);
    assert.match(body, /onError: \(error\) => setSaveError\(errorMessage\(error\)\)/);
  });

  it("the other saves leave the speed alone: changing the voice or the switch sends no speakingRate", () => {
    assert.match(functionBody("saveVoice"), /updateVoice\.mutate\(\{ data: \{ voiceName \} \}/);
    assert.doesNotMatch(functionBody("saveVoice"), /speakingRate/);
    assert.doesNotMatch(functionBody("toggleVoiceEnabled"), /speakingRate/);
  });

  it("the preview speaks at the chosen speed, saved or not", () => {
    assert.match(source, /body: JSON\.stringify\(\{ voiceName, speakingRate: effectiveRate \}\)/);
  });

  it("the controls are off while the settings are loading or failed to load", () => {
    assert.match(source, /disabled=\{!current \|\| settingsQuery\.isLoading \|\| settingsQuery\.isError\}\s+onClick=\{\(\) => setSelectedRate\(rate\)\}/);
    assert.match(functionBody("saveSpeakingRate"), /settingsQuery\.isLoading \|\| settingsQuery\.isError \|\| updateVoice\.isPending/);
  });

  it("the enable switch is still there and unchanged", () => {
    assert.match(source, /data-testid="toggle-voice-enabled"/);
    assert.match(source, /enabled: !enabled/);
  });
});

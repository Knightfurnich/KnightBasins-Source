import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const adminVoiceSource = readFileSync(
  new URL("../src/admin/AdminVoiceSettings.tsx", import.meta.url),
  "utf8",
);
const supportSource = readFileSync(
  new URL("../src/components/KnightSupport.tsx", import.meta.url),
  "utf8",
);

describe("support voice toggle UI", () => {
  it("renders a disabled-by-default admin switch with the required status identifiers", () => {
    assert.match(adminVoiceSource, /data-testid="panel-voice-enabled"/);
    assert.match(adminVoiceSource, /data-testid="toggle-voice-enabled"/);
    assert.match(adminVoiceSource, /data-testid="status-voice-enabled-state"/);
    assert.match(adminVoiceSource, /role="switch"/);
    assert.match(adminVoiceSource, /aria-checked=\{enabled\}/);
    assert.match(adminVoiceSource, /enabled:\s*!enabled/);
    assert.match(adminVoiceSource, /disabled=\{!current[\s\S]*?updateVoice\.isPending\}/);
  });

  it("loads the public voice status once and only enables audio for an explicit true response", () => {
    assert.match(supportSource, /const \[voiceEnabled, setVoiceEnabled\] = useState\(false\)/);
    assert.match(supportSource, /fetch\("\/api\/support\/voice-status"\)/);
    assert.match(supportSource, /payload\.enabled === true/);
    assert.match(supportSource, /\}, \[\]\);/);
  });

  it("hides assistant speak buttons until the voice status is enabled", () => {
    assert.match(
      supportSource,
      /message\.role === "assistant" && voiceEnabled && \([\s\S]*?className="knight-support-speak-button"/,
    );
  });
});
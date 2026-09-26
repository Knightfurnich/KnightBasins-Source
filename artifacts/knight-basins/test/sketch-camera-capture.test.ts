import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const studioPageUrl = new URL("../src/components/StudioPage.tsx", import.meta.url);
const cssUrl = new URL("../src/index.css", import.meta.url);
const [studioPageSource, cssSource] = await Promise.all([
  readFile(studioPageUrl, "utf8"),
  readFile(cssUrl, "utf8"),
]);

describe("Sketch camera capture", () => {
  it("offers a rear-camera input and separate camera and file-picker buttons", () => {
    assert.match(studioPageSource, /type="file" accept="image\/\*" capture="environment"/);
    assert.match(studioPageSource, /data-testid="input-sketch-camera"/);
    assert.match(studioPageSource, /data-testid="button-sketch-camera"/);
    assert.match(studioPageSource, /data-testid="button-sketch-file"/);
    assert.match(studioPageSource, /เลือกภาพจากเครื่อง/);
  });

  it("limits each sketch to three photos while preserving the existing upload identifiers", () => {
    assert.match(studioPageSource, /const MAX_SKETCH_FILES = 3/);
    assert.match(studioPageSource, /data-testid="text-sketch-file-count"/);
    assert.match(studioPageSource, /แนบแล้ว \{sketchFiles\.length\} \/ \{MAX_SKETCH_FILES\} รูป/);
    assert.match(studioPageSource, /sketchFiles\.length < MAX_SKETCH_FILES/);
    for (const testId of [
      "input-studio-sketch",
      "grid-studio-sketch-slots",
      "slot-studio-sketch-${index}",
      "img-studio-sketch-preview-${index}",
      "button-remove-studio-sketch-${index}",
    ]) {
      assert.ok(studioPageSource.includes(testId), `missing preserved sketch upload ID: ${testId}`);
    }
  });

  it("shows analysis progress and per-image results, with a safe fallback and editable dimensions", () => {
    assert.match(studioPageSource, /fetch\("\/api\/sketch\/analyze", \{ method: "POST", body: formData \}\)/);
    assert.match(studioPageSource, /formData\.append\("file", file\)/);
    assert.match(studioPageSource, /data-testid="status-sketch-analysis"/);
    assert.match(studioPageSource, /role="status"/);
    assert.match(studioPageSource, /aria-live="polite"/);
    assert.match(studioPageSource, /data-testid=\{`card-sketch-analysis-\$\{index\}`\}/);
    assert.match(studioPageSource, /confidence/);
    assert.match(studioPageSource, /analysis\.notes/);
    assert.match(studioPageSource, /runAMm: analysis\.runAMm!/);
    assert.match(studioPageSource, /depthMm: analysis\.depthMm!/);
    assert.match(studioPageSource, /ไม่สามารถอ่านขนาดจากภาพได้ กรุณากรอกด้วยตนเอง/);
    assert.match(studioPageSource, /data-testid="input-sketch-length"/);
    assert.match(studioPageSource, /data-testid="input-sketch-depth"/);
  });

  it("keeps sketch estimates focused and stacks the capture buttons on narrow screens", () => {
    assert.match(studioPageSource, /mode !== "sketch" && <StudioStoneComparison/);
    assert.match(studioPageSource, /mode !== "sketch" && <div className="studio-pricing-inputs">/);
    assert.match(studioPageSource, /mode !== "sketch" && <div><span>จำนวนชิ้นงาน/);
    assert.match(studioPageSource, /mode !== "sketch" && <div><span>พื้นที่แผ่นรวม/);
    assert.match(studioPageSource, /mode === "sketch" && estimate\.upstandLengthM <= 0/);
    assert.match(studioPageSource, /mode === "sketch" && estimate\.openEdgeLengthM <= 0/);
    assert.match(studioPageSource, /mode !== "sketch" && <div><span>รวมก่อนส่วนลด/);
    assert.match(cssSource, /\.studio-page--sketch \.studio-sketch-actions/);
    assert.match(cssSource, /grid-template-columns: minmax\(0, 1fr\)/);
  });
});
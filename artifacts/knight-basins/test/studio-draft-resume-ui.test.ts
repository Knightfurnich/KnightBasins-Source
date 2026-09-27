import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const studioPageSource = readFileSync(new URL("../src/components/StudioPage.tsx", import.meta.url), "utf8");

test("Studio exposes a save-for-resume button that posts the current layout", () => {
  assert.match(studioPageSource, /data-testid="button-studio-save-draft"/);
  assert.match(studioPageSource, /customFetch<StudioDraftApiResponse>\("\/api\/studio\/draft"/);
  assert.match(studioPageSource, /body:\s*JSON\.stringify\(createStudioDraftPayload\(normalizedState\)\)/);
  assert.match(studioPageSource, /shape:\s*studioPresetForShare\(state,\s*pieces\[0\]\)/);
  assert.match(studioPageSource, /dimensions:\s*studioDraftDimensions\(state,\s*pieces\)/);
});

test("the saved API payload preserves stone, basin placements, and edge geometry", () => {
  const payloadBuilder = studioPageSource.slice(
    studioPageSource.indexOf("function createStudioDraftPayload"),
    studioPageSource.indexOf("function studioDraftPiecesFromEdges"),
  );

  assert.ok(payloadBuilder.includes("stoneColor: state.activeStone"));
  assert.ok(payloadBuilder.includes("basinPlacements: state.basinPlacements"));
  assert.ok(payloadBuilder.includes("sideStatusesByPiece"));
  assert.ok(payloadBuilder.includes("pieces: pieces.map"));
  assert.ok(payloadBuilder.includes("activePieceId: state.activePieceId"));
});

test("a dft draft URL loads from the API and restores the saved state", () => {
  assert.match(studioPageSource, /const remoteDraftKey = mode === "studio"/);
  assert.match(studioPageSource, /customFetch<unknown>\(`\/api\/studio\/draft\/\$\{encodeURIComponent\(remoteDraftKey\)\}`/);
  assert.match(studioPageSource, /restoreStudioDraftState\(current,\s*remoteDraft,\s*basinProducts,\s*stoneColors\)/);
  assert.match(studioPageSource, /setDraftResult\("เปิดแบบร่างจากลิงก์แล้ว"\)/);
  assert.match(studioPageSource, /data-testid="studio-draft-resume-dialog"/);
  assert.match(studioPageSource, /data-testid="input-studio-draft-resume-url"/);
  assert.match(studioPageSource, /navigator\.clipboard\.writeText\(shareableDraftUrl\)/);
});

test("an unavailable or expired remote draft leaves the default Studio ready", () => {
  assert.match(studioPageSource, /status === 404\s*\?\s*"ไม่พบแบบร่างหรือลิงก์หมดอายุแล้ว"/);
  assert.match(studioPageSource, /"โหลดแบบร่างไม่สำเร็จ กรุณาลองเปิดลิงก์อีกครั้ง"/);
});
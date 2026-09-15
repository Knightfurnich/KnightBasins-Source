import assert from "node:assert/strict";
import test from "node:test";
import { decodeStudioDraft, encodeStudioDraft, readStoredStudioDraft, writeStoredStudioDraft, type StudioDraftRecord } from "../src/data/studio-draft.ts";
import type { StudioState } from "../src/data/studio-model.ts";

const state: StudioState = {
  mode: "studio",
  shape: "I",
  dimensions: { depthMm: 620, runAMm: 2100, runBMm: 0, runCMm: 0 },
  pieces: [{
    id: "piece-1",
    name: "ชิ้นงาน 1",
    rectangles: [{ id: "rectangle-1", widthMm: 2100, lengthMm: 620, xMm: 0, yMm: 0, rotation: 0, label: "แผ่นหลัก" }],
    sideStatuses: {},
  }],
  activePieceId: "piece-1",
  backsplash: { enabled: true, heightMm: 150 },
  upstandHeightMm: 120,
  openEdgePricePerMTHB: 95,
  discountTHB: 500,
  location: "province",
  vat: true,
  quoteFormat: "OF",
  stoneColors: ["BW010", "SO423"],
  activeStone: "SO423",
  basinSkus: ["KF001", "KF002"],
  basinPlacements: [{ id: "basin-1", sku: "KF002", pieceId: "piece-1", xMm: 700, yMm: 60, widthMm: 500, depthMm: 500 }],
};

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  } as unknown as Storage;
}

test("studio draft links preserve the full editable state", () => {
  const decoded = decodeStudioDraft(encodeStudioDraft(state));
  assert.deepEqual(decoded, state);
});

test("studio drafts round-trip through browser storage", () => {
  const storage = memoryStorage();
  const record: StudioDraftRecord = { version: 1, savedAt: "2026-09-15T04:00:00.000Z", state };
  assert.equal(writeStoredStudioDraft(record, storage), true);
  assert.deepEqual(readStoredStudioDraft(storage), record);
});

test("invalid studio draft links and storage records are rejected", () => {
  assert.equal(decodeStudioDraft("not-a-draft"), null);
  const storage = memoryStorage();
  storage.setItem("knight-studio-draft-v1", JSON.stringify({ version: 1, savedAt: "bad", state: { mode: "studio" } }));
  assert.equal(readStoredStudioDraft(storage), null);
});
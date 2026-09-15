import assert from "node:assert/strict";
import test from "node:test";
import { createStudioDraftLink, createStudioShareLink, decodeStudioDraft, encodeStudioDraft, readStoredShortStudioDraft, readStoredStudioDraft, readStoredStudioDrafts, removeStoredStudioDraft, STUDIO_SHORT_DRAFTS_STORAGE_KEY, writeStoredStudioDraft, writeStoredStudioDrafts, type NamedStudioDraftRecord, type StudioDraftRecord, type ShortStudioDraftRecord } from "../src/data/studio-draft.ts";
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

test("short Studio draft links stay compact and restore from the local Draft Store", () => {
  const storage = memoryStorage();
  const link = createStudioDraftLink(state, "https://example.test", storage);
  const url = new URL(link);
  const id = url.searchParams.get("draft") ?? "";

  assert.ok(link.length <= 100);
  assert.match(id, /^KB-[A-Z0-9]{6}$/);
  assert.equal(url.pathname, "/studio");
  assert.deepEqual(readStoredShortStudioDraft(id, storage)?.state, state);
  assert.equal((JSON.parse(storage.getItem(STUDIO_SHORT_DRAFTS_STORAGE_KEY) || "[]") as ShortStudioDraftRecord[]).length, 1);
});

test("shared Studio links restore without browser storage", () => {
  const link = createStudioShareLink(state, "https://example.test");
  const url = new URL(link);
  const token = url.searchParams.get("draft") ?? "";

  assert.ok(link.length > 100);
  assert.equal(url.pathname, "/studio");
  assert.deepEqual(decodeStudioDraft(token), state);
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

test("named Studio drafts persist, list, and delete independently", () => {
  const storage = memoryStorage();
  const first: NamedStudioDraftRecord = { version: 1, id: "draft-1", name: "ห้องน้ำชั้น 1", createdAt: "2026-09-15T04:00:00.000Z", savedAt: "2026-09-15T04:00:00.000Z", state };
  const second: NamedStudioDraftRecord = { ...first, id: "draft-2", name: "ห้องน้ำชั้น 2" };
  assert.equal(writeStoredStudioDrafts([first, second], storage), true);
  assert.deepEqual(readStoredStudioDrafts(storage), [first, second]);
  assert.equal(removeStoredStudioDraft(first.id, storage), true);
  assert.deepEqual(readStoredStudioDrafts(storage), [second]);
});
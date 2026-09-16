import type { StudioCatalogContext, StudioState } from "./studio-model";

export const STUDIO_DRAFT_STORAGE_KEY = "knight-studio-draft-v1";
export const STUDIO_NAMED_DRAFTS_STORAGE_KEY = "knight-studio-drafts-v1";
export const STUDIO_SHORT_DRAFTS_STORAGE_KEY = "knight-studio-short-drafts-v1";

export type StudioDraftRecord = {
  version: 1;
  savedAt: string;
  state: StudioState;
  catalogContext?: StudioCatalogContext;
};

export type NamedStudioDraftRecord = {
  version: 1;
  id: string;
  name: string;
  createdAt: string;
  savedAt: string;
  state: StudioState;
  catalogContext?: StudioCatalogContext;
};

export type ShortStudioDraftRecord = {
  version: 1;
  id: string;
  savedAt: string;
  state: StudioState;
  catalogContext?: StudioCatalogContext;
};

export type StudioDraftPayload = {
  state: StudioState;
  catalogContext?: StudioCatalogContext;
};

function base64UrlEncode(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function looksLikeStudioState(value: unknown): value is StudioState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StudioState>;
  return (candidate.mode === "studio" || candidate.mode === "sketch") &&
    typeof candidate.activeStone === "string" &&
    Array.isArray(candidate.stoneColors) &&
    Array.isArray(candidate.basinSkus) &&
    Array.isArray(candidate.basinPlacements) &&
    Boolean(candidate.backsplash) &&
    Boolean(candidate.dimensions);
}

function looksLikeCatalogContext(value: unknown): value is StudioCatalogContext {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StudioCatalogContext>;
  return typeof candidate.savedAt === "string" &&
    typeof candidate.revision === "string" &&
    Array.isArray(candidate.basinItems) &&
    candidate.basinItems.every((item) => Boolean(item) && typeof item === "object" && typeof (item as { sku?: unknown }).sku === "string");
}

function looksLikeDraftPayload(value: unknown): value is StudioDraftPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StudioDraftPayload>;
  return looksLikeStudioState(candidate.state) &&
    (candidate.catalogContext === undefined || looksLikeCatalogContext(candidate.catalogContext));
}

export function encodeStudioDraft(state: StudioState, catalogContext?: StudioCatalogContext) {
  return base64UrlEncode(JSON.stringify(catalogContext ? { state, catalogContext } : state));
}

export function decodeStudioDraftRecord(token: string): StudioDraftPayload | null {
  try {
    const parsed: unknown = JSON.parse(base64UrlDecode(token));
    if (looksLikeStudioState(parsed)) return { state: parsed };
    return looksLikeDraftPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function decodeStudioDraft(token: string): StudioState | null {
  return decodeStudioDraftRecord(token)?.state ?? null;
}

export function readStoredStudioDraft(storage: Storage | undefined = typeof localStorage === "undefined" ? undefined : localStorage): StudioDraftRecord | null {
  if (!storage) return null;
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STUDIO_DRAFT_STORAGE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Partial<StudioDraftRecord>;
    if (candidate.version !== 1 || typeof candidate.savedAt !== "string" || !looksLikeStudioState(candidate.state)) return null;
    if (candidate.catalogContext !== undefined && !looksLikeCatalogContext(candidate.catalogContext)) return null;
    return candidate as StudioDraftRecord;
  } catch {
    return null;
  }
}

export function writeStoredStudioDraft(record: StudioDraftRecord, storage: Storage | undefined = typeof localStorage === "undefined" ? undefined : localStorage) {
  if (!storage) return false;
  try {
    storage.setItem(STUDIO_DRAFT_STORAGE_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

export function clearStoredStudioDraft(storage: Storage | undefined = typeof localStorage === "undefined" ? undefined : localStorage) {
  if (!storage) return;
  try {
    storage.removeItem(STUDIO_DRAFT_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private browsing; the URL draft still works.
  }
}

function isShortStudioDraft(value: unknown): value is ShortStudioDraftRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ShortStudioDraftRecord>;
  return candidate.version === 1 &&
    typeof candidate.id === "string" &&
    /^KB-[A-Z0-9]{6}$/.test(candidate.id) &&
    isValidTimestamp(candidate.savedAt) &&
    looksLikeStudioState(candidate.state) &&
    (candidate.catalogContext === undefined || looksLikeCatalogContext(candidate.catalogContext));
}

function shortDraftSuffix() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint32Array(6);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(values);
    return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
  }
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function nextShortStudioDraftId(existing: ShortStudioDraftRecord[]) {
  const used = new Set(existing.map((draft) => draft.id));
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const id = `KB-${shortDraftSuffix()}`;
    if (!used.has(id)) return id;
  }
  return `KB-${Date.now().toString(36).toUpperCase().slice(-6).padStart(6, "0")}`;
}

export function readStoredShortStudioDrafts(storage: Storage | undefined = typeof localStorage === "undefined" ? undefined : localStorage): ShortStudioDraftRecord[] {
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STUDIO_SHORT_DRAFTS_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(isShortStudioDraft) : [];
  } catch {
    return [];
  }
}

export function writeStoredShortStudioDrafts(
  drafts: ShortStudioDraftRecord[],
  storage: Storage | undefined = typeof localStorage === "undefined" ? undefined : localStorage,
) {
  if (!storage) return false;
  try {
    storage.setItem(STUDIO_SHORT_DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
    return true;
  } catch {
    return false;
  }
}

export function writeShortStudioDraft(
  state: StudioState,
  storage: Storage | undefined = typeof localStorage === "undefined" ? undefined : localStorage,
  savedAt = new Date().toISOString(),
  catalogContext?: StudioCatalogContext,
) {
  const drafts = readStoredShortStudioDrafts(storage);
  const record: ShortStudioDraftRecord = {
    version: 1,
    id: nextShortStudioDraftId(drafts),
    savedAt,
    state,
    catalogContext,
  };
  return writeStoredShortStudioDrafts([record, ...drafts], storage) ? record : null;
}

export function readStoredShortStudioDraft(
  id: string,
  storage: Storage | undefined = typeof localStorage === "undefined" ? undefined : localStorage,
) {
  return readStoredShortStudioDrafts(storage).find((draft) => draft.id === id) ?? null;
}

export function createStudioDraftLink(
  state: StudioState,
  origin: string = typeof window === "undefined" ? "http://localhost" : window.location.origin,
  storage: Storage | undefined = typeof localStorage === "undefined" ? undefined : localStorage,
  catalogContext?: StudioCatalogContext,
) {
  const url = new URL("/studio", origin);
  const shortDraft = writeShortStudioDraft(state, storage, catalogContext?.savedAt, catalogContext);
  url.searchParams.set("draft", shortDraft?.id ?? encodeStudioDraft(state, catalogContext));
  return url.toString();
}

export function createStudioShareLink(
  state: StudioState,
  origin: string = typeof window === "undefined" ? "http://localhost" : window.location.origin,
  catalogContext?: StudioCatalogContext,
) {
  const url = new URL("/studio", origin);
  url.searchParams.set("draft", encodeStudioDraft(state, catalogContext));
  return url.toString();
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

function isNamedStudioDraft(value: unknown): value is NamedStudioDraftRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<NamedStudioDraftRecord>;
  return candidate.version === 1 &&
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.name === "string" &&
    candidate.name.trim().length > 0 &&
    isValidTimestamp(candidate.createdAt) &&
    isValidTimestamp(candidate.savedAt) &&
    looksLikeStudioState(candidate.state) &&
    (candidate.catalogContext === undefined || looksLikeCatalogContext(candidate.catalogContext));
}

export function readStoredStudioDrafts(storage: Storage | undefined = typeof localStorage === "undefined" ? undefined : localStorage): NamedStudioDraftRecord[] {
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STUDIO_NAMED_DRAFTS_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(isNamedStudioDraft) : [];
  } catch {
    return [];
  }
}

export function writeStoredStudioDrafts(drafts: NamedStudioDraftRecord[], storage: Storage | undefined = typeof localStorage === "undefined" ? undefined : localStorage) {
  if (!storage) return false;
  try {
    storage.setItem(STUDIO_NAMED_DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
    return true;
  } catch {
    return false;
  }
}

export function removeStoredStudioDraft(draftId: string, storage: Storage | undefined = typeof localStorage === "undefined" ? undefined : localStorage) {
  const drafts = readStoredStudioDrafts(storage);
  return writeStoredStudioDrafts(drafts.filter((draft) => draft.id !== draftId), storage);
}
import type { StudioState } from "./studio-model";

export const STUDIO_DRAFT_STORAGE_KEY = "knight-studio-draft-v1";
export const STUDIO_NAMED_DRAFTS_STORAGE_KEY = "knight-studio-drafts-v1";

export type StudioDraftRecord = {
  version: 1;
  savedAt: string;
  state: StudioState;
};

export type NamedStudioDraftRecord = {
  version: 1;
  id: string;
  name: string;
  createdAt: string;
  savedAt: string;
  state: StudioState;
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

export function encodeStudioDraft(state: StudioState) {
  return base64UrlEncode(JSON.stringify(state));
}

export function decodeStudioDraft(token: string): StudioState | null {
  try {
    const parsed: unknown = JSON.parse(base64UrlDecode(token));
    return looksLikeStudioState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function readStoredStudioDraft(storage: Storage | undefined = typeof localStorage === "undefined" ? undefined : localStorage): StudioDraftRecord | null {
  if (!storage) return null;
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STUDIO_DRAFT_STORAGE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Partial<StudioDraftRecord>;
    if (candidate.version !== 1 || typeof candidate.savedAt !== "string" || !looksLikeStudioState(candidate.state)) return null;
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
    looksLikeStudioState(candidate.state);
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
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADMIN_ARCHIVE_ERROR_MESSAGE,
  createAdminArchiveMutationCallbacks,
  filterAdminItems,
  toggleAdminItemActive,
} from "../src/admin/adminArchive.ts";

type Fixture = {
  id: number;
  code: string;
  name: string;
  active: boolean;
  sortOrder: number;
};

const fixtures: Fixture[] = [
  { id: 1, code: "ACTIVE-1", name: "Active white", active: true, sortOrder: 2 },
  { id: 2, code: "ARCHIVED-1", name: "Archived black", active: false, sortOrder: 1 },
];

describe("admin catalog visibility", () => {
  for (const [label, searchableFields] of [
    ["basins", ["code", "name"] as const],
    ["installed stones", ["code", "name"] as const],
    ["sheet stones", ["code", "name"] as const],
  ] as const) {
    describe(label, () => {
      it("shows only active records by default", () => {
        assert.deepEqual(
          filterAdminItems(fixtures, "active", "", searchableFields).map(
            (item) => item.id,
          ),
          [1],
        );
      });

      it("shows only archived records in Archived view", () => {
        assert.deepEqual(
          filterAdminItems(fixtures, "archived", "", searchableFields).map(
            (item) => item.id,
          ),
          [2],
        );
      });

      it("shows both records in All view and still applies search", () => {
        assert.deepEqual(
          filterAdminItems(fixtures, "all", "ARCHIVED", searchableFields).map(
            (item) => item.id,
          ),
          [2],
        );
        assert.deepEqual(
          filterAdminItems(fixtures, "all", "", searchableFields).map(
            (item) => item.id,
          ),
          [2, 1],
        );
      });
    });
  }
});

describe("admin archive and restore behavior", () => {
  it("toggles active without changing the record identity or catalog fields", () => {
    const original = fixtures[0];
    const archived = toggleAdminItemActive(original);
    const restored = toggleAdminItemActive(archived);

    assert.equal(archived.id, original.id);
    assert.equal(archived.code, original.code);
    assert.equal(archived.name, original.name);
    assert.equal(archived.active, false);
    assert.deepEqual(restored, original);
  });

  it("closes and refreshes only after a successful mutation", () => {
    const calls: string[] = [];
    const callbacks = createAdminArchiveMutationCallbacks({
      invalidate: () => calls.push("invalidate"),
      closeDialog: () => calls.push("close"),
      toast: ({ description, variant }) =>
        calls.push(`toast:${variant ?? "default"}:${description}`),
      successMessage: "Restored",
    });

    callbacks.onSuccess();

    assert.deepEqual(calls, [
      "invalidate",
      "close",
      "toast:default:Restored",
    ]);
  });

  it("keeps the dialog open and reports a clear error when mutation fails", () => {
    const calls: string[] = [];
    const callbacks = createAdminArchiveMutationCallbacks({
      invalidate: () => calls.push("invalidate"),
      closeDialog: () => calls.push("close"),
      toast: ({ description, variant }) =>
        calls.push(`toast:${variant ?? "default"}:${description}`),
      successMessage: "Hidden",
    });

    callbacks.onError();

    assert.deepEqual(calls, [
      `toast:destructive:${ADMIN_ARCHIVE_ERROR_MESSAGE}`,
    ]);
  });
});
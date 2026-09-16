import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADMIN_ARCHIVE_ERROR_MESSAGE,
  compareAdminNumber,
  compareAdminText,
  createAdminArchiveMutationCallbacks,
  filterAdminItems,
  sortAdminItems,
  toggleAdminSort,
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

describe("admin table sorting", () => {
  it("toggles the selected column between ascending and descending", () => {
    const first = toggleAdminSort(null, "price");
    const second = toggleAdminSort(first, "price");
    const other = toggleAdminSort(second, "name");

    assert.deepEqual(first, { key: "price", direction: "asc" });
    assert.deepEqual(second, { key: "price", direction: "desc" });
    assert.deepEqual(other, { key: "name", direction: "asc" });
  });

  it("sorts numbers and text while keeping sortOrder as a stable tie-breaker", () => {
    const items = [
      { id: 1, name: "White 10", price: 7500, active: true, sortOrder: 2 },
      { id: 2, name: "White 2", price: 5900, active: true, sortOrder: 1 },
      { id: 3, name: "White 2", price: 5900, active: true, sortOrder: 0 },
    ];

    const byPrice = sortAdminItems(items, { key: "price", direction: "asc" }, (left, right, key) =>
      key === "price" ? compareAdminNumber(left.price, right.price) : 0,
    );
    const byNameDesc = sortAdminItems(items, { key: "name", direction: "desc" }, (left, right, key) =>
      key === "name" ? compareAdminText(left.name, right.name) : 0,
    );

    assert.deepEqual(byPrice.map((item) => item.id), [3, 2, 1]);
    assert.deepEqual(byNameDesc.map((item) => item.id), [1, 2, 3]);
  });
});
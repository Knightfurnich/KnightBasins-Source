import type { AdminVisibility } from "./AdminVisibilityFilter";

export const ADMIN_ARCHIVE_ERROR_MESSAGE =
  "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";

type AdminCatalogItem = {
  active: boolean;
  sortOrder: number;
};

export type AdminSortDirection = "asc" | "desc";

export type AdminSortState<Key extends string> = {
  key: Key;
  direction: AdminSortDirection;
} | null;

export function toggleAdminSort<Key extends string>(
  current: AdminSortState<Key>,
  key: Key,
): AdminSortState<Key> {
  if (current?.key === key) {
    return {
      key,
      direction: current.direction === "asc" ? "desc" : "asc",
    };
  }
  return { key, direction: "asc" };
}

export function sortAdminItems<T extends AdminCatalogItem, Key extends string>(
  items: readonly T[],
  sort: AdminSortState<Key>,
  compare: (left: T, right: T, key: Key) => number,
) {
  if (!sort) return [...items];

  return [...items].sort((left, right) => {
    const result = compare(left, right, sort.key);
    if (result === 0) {
      const tieBreak = left.sortOrder - right.sortOrder;
      return sort.direction === "asc" ? tieBreak : -tieBreak;
    }
    return sort.direction === "asc" ? result : -result;
  });
}

export function compareAdminText(left: unknown, right: unknown) {
  return new Intl.Collator("th", {
    numeric: true,
    sensitivity: "base",
  }).compare(String(left ?? ""), String(right ?? ""));
}

export function compareAdminNumber(left: unknown, right: unknown) {
  return Number(left ?? 0) - Number(right ?? 0);
}

export function compareAdminBoolean(left: boolean, right: boolean) {
  return Number(left) - Number(right);
}

export function filterAdminItems<T extends AdminCatalogItem>(
  items: readonly T[] | undefined,
  visibility: AdminVisibility,
  search: string,
  searchableFields: readonly (keyof T)[],
) {
  const query = search.toLowerCase();

  return (items ?? [])
    .filter((item) => {
      const matchesVisibility =
        visibility === "all" ||
        (visibility === "active" ? item.active : !item.active);

      return (
        matchesVisibility &&
        searchableFields.some((field) =>
          String(item[field] ?? "")
            .toLowerCase()
            .includes(query),
        )
      );
    })
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function toggleAdminItemActive<T extends { active: boolean }>(item: T) {
  return { ...item, active: !item.active };
}

type AdminToast = (options: {
  description: string;
  variant?: "destructive";
}) => unknown;

export function createAdminArchiveMutationCallbacks(options: {
  invalidate: () => void;
  closeDialog: () => void;
  toast: AdminToast;
  successMessage: string;
}) {
  return {
    onSuccess: () => {
      options.invalidate();
      options.closeDialog();
      options.toast({ description: options.successMessage });
    },
    onError: () => {
      options.toast({
        description: ADMIN_ARCHIVE_ERROR_MESSAGE,
        variant: "destructive",
      });
    },
  };
}
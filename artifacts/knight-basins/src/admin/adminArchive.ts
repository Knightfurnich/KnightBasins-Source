import type { AdminVisibility } from "./AdminVisibilityFilter";

export const ADMIN_ARCHIVE_ERROR_MESSAGE =
  "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";

type AdminCatalogItem = {
  active: boolean;
  sortOrder: number;
};

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
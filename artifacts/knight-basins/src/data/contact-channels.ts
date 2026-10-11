/**
 * A quotation's price stands for QUOTE_PRICE_VALID_DAYS; the saved link keeps
 * opening for QUOTE_LINK_VALID_DAYS. Both were printed to customers (30 in the
 * quote screens, 45 on the expired screen) so the pair lives here (job 431-B F).
 */
export const QUOTE_PRICE_VALID_DAYS = 30;
export const QUOTE_LINK_VALID_DAYS = 45;

/** Collecting work at the plant runs on its own clock -- not sales hours. */
export const PLANT_PICKUP_HOURS = "จันทร์–ศุกร์ 08:30–16:30 · เสาร์ 08:30–11:30 (ติดต่อล่วงหน้า)";

/**
 * job 422-B C: every phone number a customer can *read* on the storefront comes from here.
 *
 * Rules this file enforces (measured by test/customer-facing-consistency.test.ts):
 *  · display format always dashed: 094-496-1949
 *  · `tel:` hrefs are derived from the same value, never written by hand
 *  · primary first, then the two approved backups -- no test/retired numbers
 *  · the modal/event name for "a dialog is covering the screen" lives here too, so the
 *    floating assistant and the inquiry dialog agree on one signal (job 422-B D)
 */
export const CONTACT_PHONE_PRIMARY = "094-496-1949";
export const CONTACT_PHONE_BACKUP_SALES = "091-978-2292";
export const CONTACT_PHONE_BACKUP_TEAM = "089-762-2209";

/** Ordered exactly as the team answers the phone: primary, then backups. */
export const CONTACT_PHONES = [
  CONTACT_PHONE_PRIMARY,
  CONTACT_PHONE_BACKUP_SALES,
  CONTACT_PHONE_BACKUP_TEAM,
] as const;

/** Numbers that must never reach a customer-facing surface (test data / retired lines). */
export const FORBIDDEN_CUSTOMER_PHONES = ["080-606-4444", "061-845-9666", "0135553014"] as const;

export const DISPLAY_PHONE_PATTERN = /^0[1-9]\d-\d{3}-\d{4}$/;

/** "094-496-1949" -> "tel:0944961949" (hrefs stay un-dashed by convention, display never does). */
export function telHref(displayPhone: string): string {
  return `tel:${displayPhone.replace(/[^0-9]/g, "")}`;
}

/** One string for a line of copy: "094-496-1949 · 091-978-2292 · 089-762-2209". */
export function contactPhonesText(phones: readonly string[] = CONTACT_PHONES): string {
  return phones.join(" · ");
}

/** Same three numbers, comma separated, for places whose copy already used "tel A, tel B". */
export function contactPhonesCommaText(phones: readonly string[] = CONTACT_PHONES): string {
  return phones.join(", ");
}

/**
 * Business hours / reply window, as already published elsewhere on the site
 * (`App.tsx` after-sales block) -- kept here so the two surfaces cannot drift.
 */
export const SALES_REPLY_WINDOW = "ภายใน 24 ชั่วโมง";
export const SALES_WORKING_HOURS = "จันทร์-ศุกร์ 08:00–17:00 · เสาร์ 08:00–12:00";

/** Emitted on `window` when a full-screen dialog opens/closes (see job 422-B D). */
export const OVERLAY_OPEN_EVENT = "knightbasins:overlay-open";
export type OverlayOpenDetail = { open: boolean };

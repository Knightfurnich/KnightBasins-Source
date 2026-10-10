// The one place the API writes a customer-facing phone number (job 421-C). Before this the chat replies carried their own
// copies, and the storefront shows several spellings of the same lines (with and without dashes), so a customer could see
// "different" numbers on different pages.
//
// Order set by the owner on 8 Oct 2026: the first number is the main line; the other two are the backups.

export const SUPPORT_PHONE_PRIMARY = "094-496-1949";
export const SUPPORT_PHONES_BACKUP = ["091-978-2292", "089-762-2209"] as const;

/** The three lines, main line first, as one string for a chat reply. */
export const SUPPORT_PHONES_TEXT = [SUPPORT_PHONE_PRIMARY, ...SUPPORT_PHONES_BACKUP].join(" · ");

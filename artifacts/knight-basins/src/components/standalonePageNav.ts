/**
 * job 458-B - one menu for every standalone page, in a plain `.ts` module so a `node --test` lock
 * can read it without a JSX loader.
 *
 * The hrefs, words, emoji and order below are the storefront header's own (`.main-nav` in
 * `src/App.tsx`, a file this job must not touch) - they were read out of that file, not retyped, and
 * `test/standalone-page-header-458b.test.ts` compares the two lists on every run. So "the same menu
 * everywhere" stays a checked fact: rename a link in `App.tsx` without mirroring it here, or drop
 * `/price-guide` from the menu (a promise job 453-B made), and that test goes red.
 */
export const STANDALONE_PAGE_NAV: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/", label: "แคตตาล็อก" },
  { href: "/stone", label: "หินสังเคราะห์" },
  { href: "/sketch", label: "ส่งแบบร่าง" },
  { href: "/portfolio", label: "📸 ผลงานจริง" },
  { href: "/site-prep", label: "📐 เตรียมหน้างาน" },
  { href: "/price-guide", label: "คู่มือราคา" },
];

/** The storefront's basket link, word for word. */
export const STANDALONE_PAGE_QUOTE_LABEL = "ใบเสนอราคา";

/** The words the standalone pages already used for the way back to the storefront. */
export const STANDALONE_PAGE_HOME_LABEL = "กลับสู่หน้าร้าน";

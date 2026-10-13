import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";

export type StorefrontTheme = "light" | "dark";

export const STOREFRONT_THEME_STORAGE_KEY = "knight-storefront-theme";

type ThemeStorageReader = Pick<Storage, "getItem">;
type ThemeStorageWriter = Pick<Storage, "setItem">;

function browserStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function readStorefrontTheme(storage: ThemeStorageReader | undefined = browserStorage()): StorefrontTheme {
  if (!storage) return "light";
  try {
    return storage.getItem(STOREFRONT_THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function writeStorefrontTheme(theme: StorefrontTheme, storage: ThemeStorageWriter | undefined = browserStorage()) {
  try {
    storage?.setItem(STOREFRONT_THEME_STORAGE_KEY, theme);
  } catch {
    // Keep the in-memory selection if browser storage is unavailable.
  }
}

export function nextStorefrontTheme(theme: StorefrontTheme): StorefrontTheme {
  return theme === "light" ? "dark" : "light";
}

export const STOREFRONT_THEME_STYLES = `
[data-theme="light"] .storefront-theme-root,
[data-theme="dark"] .storefront-theme-root {
  min-height: 100vh;
  background-color: var(--paper);
  color: var(--ink);
}

[data-theme="light"] .storefront-theme-toggle,
[data-theme="dark"] .storefront-theme-toggle {
  display: inline-grid;
  width: 40px;
  min-width: 40px;
  height: 40px;
  min-height: 40px;
  flex: 0 0 40px;
  place-items: center;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
  color: var(--ink);
  cursor: pointer;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}

[data-theme="light"] .storefront-theme-toggle:hover,
[data-theme="dark"] .storefront-theme-toggle:hover {
  background-color: var(--brand-sky);
}

[data-theme="light"] .storefront-theme-toggle:focus-visible,
[data-theme="dark"] .storefront-theme-toggle:focus-visible {
  outline: 2px solid var(--brand-blue);
  outline-offset: 2px;
}

[data-theme="dark"] {
  color-scheme: dark;
  --paper: #0f172a;
  --card-paper: #162238;
  --line: #34445b;
  --ink: #e8eff8;
  --ink-soft: #aab9cc;
  --saffron: #44a9d4;
  --saffron-dark: #74c4eb;
  --deep: #0b1324;
  --brand-blue: #7ab9fb;
  --brand-sky: #1a3049;
  --success: #78d7b6;
  --background: 222 47% 11%;
  --foreground: 210 40% 96%;
  --border: 215 28% 28%;
  --card: 217 33% 17%;
  --card-foreground: 210 40% 96%;
  --card-border: 215 28% 28%;
  --popover: 217 33% 17%;
  --popover-foreground: 210 40% 96%;
  --popover-border: 215 28% 28%;
  --muted: 215 28% 20%;
  --muted-foreground: 215 20% 72%;
  --input: 215 28% 28%;
  --primary: 205 72% 56%;
  --primary-foreground: 222 47% 11%;
  --secondary: 215 28% 20%;
  --secondary-foreground: 210 40% 96%;
  --accent: 215 28% 20%;
  --accent-foreground: 210 40% 96%;
  --ring: 205 72% 66%;
  --button-outline: rgb(226 237 248 / 18%);
  --badge-outline: rgb(226 237 248 / 10%);
  --elevate-1: rgb(255 255 255 / 4%);
  --elevate-2: rgb(255 255 255 / 8%);
}

[data-theme="dark"] .site-header {
  background-color: rgb(15 23 42 / 94%);
  border-color: var(--line);
}

[data-theme="dark"] .site-footer {
  background-color: #0b1324;
  color: var(--ink);
}

[data-theme="dark"] :is(.product-card, .quote-block, .quote-summary, .quote-editor, .customer-block, .profile-lock-card, .site-prep-card, .portfolio-card) {
  background-color: var(--card-paper);
  border-color: var(--line);
  color: var(--ink);
}

[data-theme="dark"] :is(.page-wrap, .site-prep-page) {
  color: var(--ink);
}

[data-theme="dark"] :is(input:not([type="color"]):not([type="checkbox"]):not([type="radio"]), textarea, select) {
  border-color: var(--line);
  background-color: var(--card-paper);
  color: var(--ink);
}

[data-theme="dark"] :is(input, textarea)::placeholder {
  color: var(--ink-soft);
  opacity: 0.85;
}

[data-theme="dark"] .order-mode-tabs button {
  background-color: var(--card-paper);
  border-color: var(--line);
  color: #cbd5e1;
}

[data-theme="dark"] .order-mode-tabs button:hover {
  border-color: var(--brand-blue);
  color: #ffffff;
}

[data-theme="dark"] .order-mode-tabs button.is-active {
  background-color: #2563eb;
  color: #ffffff;
  border-color: #3b82f6;
  font-weight: 600;
}

[data-theme="dark"] .order-mode-tabs button.is-active small {
  color: #e0f2fe;
  opacity: 0.95;
}

[data-theme="dark"] .filter-tabs {
  background-color: var(--card-paper);
  border: 1px solid var(--line);
}

[data-theme="dark"] .filter-tabs button {
  color: var(--ink-soft);
}

[data-theme="dark"] .filter-tabs button:hover {
  color: var(--ink);
}

[data-theme="dark"] .filter-tabs button.is-active {
  background-color: var(--brand-blue);
  color: #0b1324;
  font-weight: 600;
}

[data-theme="dark"] .catalog-basin-hero {
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.4);
}

[data-theme="dark"] .catalog-hero h1 {
  color: #ffffff;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
}

[data-theme="dark"] .catalog-hero h1 em {
  color: #60a5fa;
}

[data-theme="dark"] .hero-copy {
  color: #e2e8f0;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}

[data-theme="dark"] .eyebrow {
  color: #cbd5e1;
}

[data-theme="dark"] .eyebrow.accent {
  color: #38bdf8;
  font-weight: 600;
}

[data-theme="dark"] .text-link {
  color: #7ab9fb;
  border-bottom-color: #7ab9fb;
}

[data-theme="dark"] .text-link:hover {
  color: #bae6fd;
  border-bottom-color: #bae6fd;
}

[data-theme="dark"] .homepage-guide-link {
  color: #cbd5e1;
}

[data-theme="dark"] .homepage-guide-link:hover {
  color: #ffffff;
}

[data-theme="dark"] .catalog-toolbar h2 {
  color: #ffffff;
}

[data-theme="dark"] .catalog-toolbar h2 span {
  color: #94a3b8;
}

[data-theme="dark"] .catalog-toolbar p.eyebrow {
  color: #38bdf8;
}

[data-theme="dark"] .search-field,
[data-theme="dark"] .sort-field {
  border-bottom-color: var(--line);
  color: var(--ink-soft);
}

[data-theme="dark"] .search-field input,
[data-theme="dark"] .sort-field select {
  color: var(--ink);
}

[data-theme="dark"] .sort-field-help {
  color: var(--ink-soft);
}

[data-theme="dark"] .product-art {
  background-color: #1e293b;
}

[data-theme="dark"] .product-index,
[data-theme="dark"] .art-note {
  color: var(--ink-soft);
}

[data-theme="dark"] .product-price {
  color: var(--brand-blue);
}

/* Updates Page Dark Mode Improvements */
[data-theme="dark"] .space-y-6 article {
  background-color: var(--card-paper) !important;
  border-color: var(--line) !important;
  color: var(--ink) !important;
}

[data-theme="dark"] .space-y-6 article h2 {
  color: #ffffff !important;
}

[data-theme="dark"] .space-y-6 article strong {
  color: #ffffff !important;
}

[data-theme="dark"] .space-y-6 article p,
[data-theme="dark"] .space-y-6 article li {
  color: #cbd5e1 !important;
}

/* Customer Tracking & Digital Handover Gate / Cards Dark Mode */
[data-theme="dark"] :is(.customer-track-page, .digital-handover-page) {
  background: var(--paper) !important;
  color: var(--ink) !important;
}

[data-theme="dark"] :is(.customer-track-panel, .handover-panel, .empty-state, .customer-track-state, .handover-state) {
  background-color: var(--card-paper) !important;
  border-color: var(--line) !important;
  color: var(--ink) !important;
}

[data-theme="dark"] :is(.digital-handover-page, .customer-track-page) :is(h1, h2, h3, strong) {
  color: #ffffff !important;
}

[data-theme="dark"] :is(.digital-handover-page, .customer-track-page) :is(p, span, small, time) {
  color: #cbd5e1 !important;
}

[data-theme="dark"] :is(.customer-track-state, .handover-state) {
  background-color: #162238 !important;
  border: 1px solid #34445b !important;
}

[data-theme="dark"] :is(.customer-track-state, .handover-state) h1 {
  color: #ffffff !important;
  text-shadow: 0 2px 8px rgba(0,0,0,0.5);
}

[data-theme="dark"] :is(.customer-track-state, .handover-state) p {
  color: #cbd5e1 !important;
}

[data-theme="dark"] :is(.customer-track-state, .handover-state) .customer-track-kicker,
[data-theme="dark"] :is(.customer-track-state, .handover-state) .handover-state-kicker {
  color: #38bdf8 !important;
}

[data-theme="dark"] :is(.customer-track-state-icon, .handover-state-icon) {
  background-color: #1e293b !important;
  color: #38bdf8 !important;
}

[data-theme="dark"] .handover-action,
[data-theme="dark"] .customer-track-button {
  background-color: var(--card-paper) !important;
  border-color: var(--line) !important;
  color: #ffffff !important;
}

[data-theme="dark"] :is(.studio-canvas, .studio-stone-choice, .studio-basin-choice, .studio-basin-choice-art, .studio-canvas-quickbar) {
  --ink: #173f6b;
  --ink-soft: #55718a;
  --paper: #f4f9fd;
  --card-paper: #ffffff;
  --line: #d7e5ef;
  --saffron: #2a9bd0;
  --saffron-dark: #1268b3;
  --deep: #103e6b;
  --brand-blue: #1268b3;
  --brand-sky: #e5f4fb;
  --success: #197b67;
  --background: 34 28% 94%;
  --foreground: 204 25% 18%;
  --border: 33 18% 82%;
  --card: 36 33% 97%;
  --card-foreground: 204 25% 18%;
  --popover: 36 33% 97%;
  --popover-foreground: 204 25% 18%;
  --muted: 39 30% 90%;
  --muted-foreground: 204 18% 38%;
  --input: 33 18% 82%;
  --primary: 204 29% 16%;
  --primary-foreground: 37 32% 91%;
  --secondary: 39 47% 86%;
  --secondary-foreground: 204 25% 18%;
  --accent: 39 47% 86%;
  --accent-foreground: 204 25% 18%;
}

[data-theme="dark"] .studio-canvas {
  border-color: #a9d4e4;
  background-color: #f8fcfe;
  background-image: linear-gradient(#dcecf3 1px, transparent 1px), linear-gradient(90deg, #dcecf3 1px, transparent 1px);
}

[data-theme="dark"] .studio-stone-choice,
[data-theme="dark"] .studio-basin-choice {
  border-color: #d7e5ef;
  background-color: #fbfdfe;
  color: #173f6b;
}

[data-theme="dark"] .studio-basin-choice-art,
[data-theme="dark"] .studio-canvas-quickbar {
  background-color: #eef7fa;
  color: #173f6b;
}

@media print {
  [data-theme="dark"] .formal-quote-sheet,
  [data-theme="dark"] .formal-quote-sheet * {
    background-color: #ffffff !important;
    color: #111111 !important;
    box-shadow: none !important;
  }
}

/* Fix StonePage dark mode contrast */
.storefront-theme-root[data-theme="dark"],
[data-theme="dark"] .storefront-theme-root {
  background-color: var(--paper) !important;
}

[data-theme="dark"] :is(.stone-hero, .stone-page, .config-layout) {
  color: var(--ink);
}

[data-theme="dark"] .stone-hero h1 {
  color: #ffffff;
}

[data-theme="dark"] .mode-switch button {
  background: var(--card-paper);
  border-color: var(--line);
  color: var(--ink-soft);
}

[data-theme="dark"] .mode-switch button.is-active {
  background: var(--card-paper);
  border-color: var(--brand-blue);
  color: var(--ink);
}

[data-theme="dark"] .stone-colors button {
  background: var(--card-paper);
  border-color: var(--line);
  color: var(--ink);
}

[data-theme="dark"] .stone-colors button:hover {
  border-color: var(--brand-blue);
}

[data-theme="dark"] .stone-colors button.is-active {
  border-color: var(--brand-blue);
  box-shadow: 0 0 0 2px var(--brand-blue);
}

[data-theme="dark"] .config-summary {
  background: var(--card-paper);
  border-color: var(--line);
  color: var(--ink);
}

[data-theme="dark"] .stone-price-filters {
  background: var(--card-paper);
  border: 1px solid var(--line);
}

[data-theme="dark"] .stone-price-filters button {
  color: var(--ink-soft);
}

[data-theme="dark"] .stone-price-filters button.is-active {
  background: var(--brand-blue);
  color: #ffffff;
}

/* ─── job 465-C · dark theme: readable text (C-H). Colours and fills only; no token value assigned. ───────────────────
   --brand-blue turns into the light #7ab9fb here, so every fill that used it with white text fell to ~2.07, and several
   components kept pale fixed fills whose text already uses dark-theme tokens. Plain rules because a { color: inherit }
   and h1,h2,h3 { color: var(--ink) } (index.css) outrank Tailwind utilities. */

/* C · /quote share box */
[data-theme="dark"] .quote-share { background: var(--card-paper) !important; border-color: var(--line) !important; }
[data-theme="dark"] .quote-share strong,
[data-theme="dark"] .quote-share p { color: var(--ink) !important; }

/* white label on the light-blue brand fill (2.07) -> dark label */
[data-theme="dark"] :is(
  .product-card-action--quote, .button--accent, .button--dark, .studio-sketch-bridge-cta,
  .knight-support-trigger, .knight-support-trigger span,
  .stone-price-filters button.is-active, button[data-testid^="button-studio-mode-"].is-active,
  .quote-format-switch button.is-active, .quote-format-switch button.is-active small
) { color: #0b1324 !important; }

/* D · home: studio / pillar-quote actions kept a pale fill with the light dark-theme blue text (1.97) */
[data-theme="dark"] .product-card-action--studio { background: var(--brand-sky) !important; border-color: var(--line) !important; color: var(--brand-blue) !important; }
[data-theme="dark"] .product-card-action--studio:hover { background: #223f5f !important; }

/* pale fixed fills (their text already uses dark-theme tokens): the surface follows the theme */
[data-theme="dark"] :is(
  .sort-field, .quote-format-panel, .quote-empty, .quantity-editor.large,
  .quote-format-switch button:not(.is-active),
  .studio-piece-card, .studio-selector-trigger, .studio-rectangle-editor, .studio-draft-banner,
  .studio-edge-finish-toolbar, .studio-edge-select, .studio-edge-finish-option
) { background: var(--card-paper) !important; }

/* E · /portfolio category tabs: white pill with pale --ink text (1.16); the active tab stays navy / white */
[data-theme="dark"] button[data-testid^="portfolio-tab-"][class*="bg-white"] { background: var(--card-paper) !important; }
/* navy #003366 text on the dark page (/portfolio eyebrow + count badge, /readme link rows + badge); white cards excluded */
[data-theme="dark"] [class*="text-[#003366]"]:not([class*="bg-white"] *) { color: var(--brand-blue) !important; }

/* qa/tools/contrast-probe.js cannot measure text over a background-image, and these two kept a pale gradient on top of
   their dark fill: the footer (every page: phone, hours, address were pale ink on pale blue) and the Studio sketch banner */
[data-theme="dark"] .site-footer { background-image: none !important; background-color: #0b1324 !important; }
[data-theme="dark"] .studio-sketch-bridge-banner { background-image: none !important; background-color: var(--card-paper) !important; }

/* H · /studio: required-field red #c64d3f = 3.44 on the dark card */
[data-theme="dark"] .studio-contact-grid label span { color: #ff9b8d !important; }

/* ─── job 466-C · /sketch in the dark theme ─────────────────────────────────────────────────────────────────────────
   The upload panel, its 3 photo slots, the AI result cards, the workpiece cards and the bridge banner kept a fixed pale
   fill (a linear-gradient or #fff / #f8fbfd) while their text uses the dark-theme tokens (--ink / --ink-soft / --brand-blue):
   pale text on a pale surface. contrast-probe.js skips text over a gradient, so it never reported it (qa/tools/gradient-scan-465c.mjs
   samples the real pixels). The surfaces follow the theme here; the light theme is not touched. */
[data-theme="dark"] .studio-page--sketch :is(.studio-sketch-dropzone, .studio-sketch-analysis-card, .studio-sketch-workpiece-card) {
  background-image: none !important; background-color: var(--card-paper) !important; border-color: var(--line) !important;
}
[data-theme="dark"] .studio-page--sketch .studio-sketch-dropzone.is-dragging { background-color: #1e3a56 !important; border-color: var(--brand-blue) !important; }
[data-theme="dark"] .studio-page--sketch .studio-sketch-slot:not(.studio-sketch-slot--filled) { background-color: var(--brand-sky) !important; border-color: var(--line) !important; }
[data-theme="dark"] .studio-page--sketch .studio-sketch-slot--add:hover { background-color: #223f5f !important; border-color: var(--brand-blue) !important; }
[data-theme="dark"] .studio-page--sketch .studio-sketch-dropzone-icon { background: var(--brand-sky) !important; color: var(--brand-blue) !important; }
[data-theme="dark"] .studio-page--sketch .studio-sketch-dropzone-copy strong { color: var(--ink) !important; }
[data-theme="dark"] .studio-page--sketch :is(.studio-sketch-workpiece-section > strong, .studio-sketch-analysis-title, .studio-sketch-workpieces-summary, .studio-sketch-workpiece-heading, .studio-sketch-workpiece-dimensions) { color: var(--ink) !important; }
[data-theme="dark"] .studio-page--sketch :is(.studio-sketch-analysis-copy p:not(.studio-sketch-cutout-note), .studio-sketch-cutout-list, .studio-sketch-no-cutouts, .studio-sketch-workpiece-shape) { color: var(--ink-soft) !important; }
[data-theme="dark"] :is(.studio-sketch-bridge-banner, .sketch-studio-bridge-banner) { background-image: none !important; background-color: var(--card-paper) !important; border-top-color: var(--line) !important; border-right-color: var(--line) !important; border-bottom-color: var(--line) !important; }

/* ─── job 467-C · dark theme: summary panels + product-card labels ──────────────────────────────────────────────────
   B) .quote-summary / .config-summary are a dark-blue panel with color: var(--paper). --paper is the DARK page colour in this theme
      (#0f172a), so every line without its own colour (and .quote-terms strong) became dark text on dark blue (1.44). The panel text
      follows the light-theme paper colour (#f4f9fd) here; the light theme is untouched.
   C) .product-index ("KF001") / .art-note sit on .product-art: a pale gradient + product photo that stay light in the dark theme
      (the page-level #1e293b is overridden by the later linear-gradient). Pale text on it = 1.04-1.73, measured on the rendered pixels
      (qa/tools/gradient-scan-465c.mjs). The labels get their own dark chip so they read on any photo. */
[data-theme="dark"] :is(.quote-summary, .config-summary) { color: #f4f9fd; }
[data-theme="dark"] .quote-terms strong { color: #f4f9fd; }
[data-theme="dark"] .product-index,
[data-theme="dark"] .art-note { color: #e8eff8; background-color: rgba(11, 19, 36, 0.88); border-radius: 4px; padding: 2px 6px; }
[data-theme="dark"] .art-note { padding: 6px 2px; }
`;

export type StorefrontThemeValue = {
  theme: StorefrontTheme;
  toggleTheme: () => void;
};

const StorefrontThemeContext = createContext<StorefrontThemeValue | null>(null);

export function useStorefrontTheme(): StorefrontThemeValue {
  const [theme, setTheme] = useState<StorefrontTheme>(() => readStorefrontTheme());

  const toggleTheme = useCallback(() => {
    const nextTheme = nextStorefrontTheme(theme);
    writeStorefrontTheme(nextTheme);
    setTheme(nextTheme);
  }, [theme]);

  return useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);
}

export function StorefrontThemeProvider({ value, children }: { value: StorefrontThemeValue; children: ReactNode }) {
  return (
    <StorefrontThemeContext.Provider value={value}>
      <style data-storefront-theme-styles="">{STOREFRONT_THEME_STYLES}</style>
      {children}
    </StorefrontThemeContext.Provider>
  );
}

export function ThemeToggle() {
  const themeValue = useContext(StorefrontThemeContext);
  if (!themeValue) throw new Error("ThemeToggle must be rendered inside StorefrontThemeProvider");

  const { theme, toggleTheme } = themeValue;
  const isDark = theme === "dark";
  const actionLabel = isDark ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด";

  return (
    <button
      type="button"
      className="storefront-theme-toggle"
      onClick={toggleTheme}
      aria-label={actionLabel}
      aria-pressed={isDark}
      title={actionLabel}
      data-testid="button-storefront-theme-toggle"
    >
      {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}
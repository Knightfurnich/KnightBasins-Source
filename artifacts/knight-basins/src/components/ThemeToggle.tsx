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
import { useState } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

export type AdminTheme = "light" | "dark";

const ADMIN_THEME_STORAGE_KEY = "knight-admin-theme";

const ADMIN_THEME_STYLES = `
.admin-app[data-admin-theme="dark"] {
  color-scheme: dark;
  --paper: #0d1726;
  --card-paper: #142235;
  --line: #2d4056;
  --ink: #eef4fa;
  --ink-soft: #b8c7d7;
  --saffron: #f1c66d;
  --brand-blue: #8dbbff;
  --brand-sky: #183652;
  --background: 216 46% 10%;
  --foreground: 210 40% 96%;
  --border: 213 31% 25%;
  --card: 215 37% 14%;
  --card-foreground: 210 40% 96%;
  --popover: 215 37% 14%;
  --popover-foreground: 210 40% 96%;
  --muted: 215 29% 20%;
  --muted-foreground: 213 20% 74%;
  --input: 213 31% 28%;
  --primary: 211 55% 48%;
  --primary-foreground: 210 40% 98%;
  --secondary: 215 29% 20%;
  --secondary-foreground: 210 40% 96%;
  --accent: 215 29% 20%;
  --accent-foreground: 210 40% 96%;
  --ring: 211 88% 68%;
}

.admin-app[data-admin-theme="dark"] .admin-header {
  background-color: rgb(13 23 38 / 94%);
  border-color: var(--line);
}

.admin-app[data-admin-theme="dark"] .admin-sidebar {
  background-color: #101d2e;
  border-color: var(--line);
}

.admin-app[data-admin-theme="dark"] .dashboard-ai-cost-card {
  border-color: var(--line) !important;
  background: var(--card-paper);
}

.admin-app[data-admin-theme="dark"] .dashboard-ai-cost-card__index {
  color: var(--ink-soft);
}

.admin-app[data-admin-theme="dark"] .dashboard-ai-badge {
  border-color: var(--line);
  background: var(--paper);
  color: var(--ink-soft);
}

.admin-app[data-admin-theme="dark"] .dashboard-ai-badge--active {
  border-color: rgb(145 227 194 / 32%);
  color: #91e3c2;
}

.admin-app[data-admin-theme="dark"] .dashboard-ai-badge--empty {
  color: var(--ink-soft);
}

.admin-app[data-admin-theme="dark"] .dashboard-ai-badge__name {
  color: var(--ink);
}

.admin-app[data-admin-theme="dark"] .dashboard-ai-cost-link {
  border-color: rgb(141 187 255 / 42%);
  background: rgb(141 187 255 / 12%);
  color: var(--brand-blue);
}

.admin-app[data-admin-theme="dark"] [class~="text-[#17816d]"] {
  color: #91e3c2;
}

.admin-app[data-admin-theme="dark"] [class~="text-[#8a6318]"] {
  color: #ffdb87;
}

.admin-app[data-admin-theme="dark"] [class~="text-[#a24439]"] {
  color: #ffaaa3;
}

.admin-app[data-admin-theme="dark"] :is(
  .bg-white,
  .bg-gray-50,
  .bg-gray-100,
  .bg-slate-50,
  .bg-slate-100,
  [class~="bg-white/95"],
  [class~="bg-white/70"],
  [class~="bg-white/60"]
) {
  background-color: var(--card-paper);
}

.admin-app[data-admin-theme="dark"] :is(input, textarea, select) {
  color: var(--ink);
  border-color: var(--line);
}

.admin-app[data-admin-theme="dark"] :is(input, textarea)::placeholder {
  color: var(--ink-soft);
  opacity: 0.8;
}

.admin-app[data-admin-theme="dark"] :is(table, th, td) {
  border-color: var(--line);
}

/* Admin Login & Forms in Dark Mode (index.css ถูก freeze — override ด้วย specificity สูง) */
.admin-login[data-admin-theme="dark"] {
  background-color: #0d1726 !important;
  background-image: none !important;
  color: #eef4fa !important;
}

.admin-login[data-admin-theme="dark"] > div > div:last-child,
.admin-login[data-admin-theme="dark"] div[class*="card-paper"] {
  background-color: #142235 !important;
  background-image: none !important;
  border-color: #2d4056 !important;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.45) !important;
}

.admin-login[data-admin-theme="dark"] h1,
.admin-login[data-admin-theme="dark"] h2,
.admin-login[data-admin-theme="dark"] h3 {
  color: #ffffff !important;
}

.admin-login[data-admin-theme="dark"] p,
.admin-login[data-admin-theme="dark"] label,
.admin-login[data-admin-theme="dark"] small {
  color: #cbd5e1 !important;
}

.admin-login[data-admin-theme="dark"] input,
.admin-login[data-admin-theme="dark"] select,
.admin-login[data-admin-theme="dark"] textarea {
  background: #0d1726 !important;
  border-color: #2d4056 !important;
  color: #ffffff !important;
}

.admin-login[data-admin-theme="dark"] input::placeholder {
  color: #94a3b8 !important;
}

`;

function readStoredAdminTheme(): AdminTheme {
  if (typeof window === "undefined") return "light";

  try {
    return window.localStorage.getItem(ADMIN_THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function writeStoredAdminTheme(theme: AdminTheme) {
  try {
    window.localStorage.setItem(ADMIN_THEME_STORAGE_KEY, theme);
  } catch {
    // Keep the selected theme for this session even when storage is unavailable.
  }
}

export function useAdminTheme() {
  const [theme, setTheme] = useState<AdminTheme>(readStoredAdminTheme);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    writeStoredAdminTheme(nextTheme);
    setTheme(nextTheme);
  };

  return { theme, toggleTheme };
}

export function AdminThemeStyles() {
  return <style data-admin-theme-styles="">{ADMIN_THEME_STYLES}</style>;
}

export function AdminThemeToggle({
  theme,
  onToggle,
}: {
  theme: AdminTheme;
  onToggle: () => void;
}) {
  const isDark = theme === "dark";
  const actionLabel = isDark ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด (ประหยัดพลังงาน)";

  return (
    <>
      <AdminThemeStyles />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-10 min-h-10 w-10 shrink-0 rounded-none border-[var(--line)] bg-transparent text-[var(--ink)] hover:bg-[var(--line)]/50"
        onClick={onToggle}
        aria-label={actionLabel}
        aria-pressed={isDark}
        title={actionLabel}
        data-testid="button-admin-theme-toggle"
      >
        {isDark ? (
          <Sun className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Moon className="h-4 w-4" aria-hidden="true" />
        )}
      </Button>
    </>
  );
}
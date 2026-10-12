import io, subprocess, shutil, sys
R = "../../"
cases = [
 ("1 remove: /studio-guide step card back to bg-white", "src/pages/StudioGuidePage.tsx", 'className="sg-card rounded-2xl border border-[var(--line)] p-6 shadow-sm"', 'className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm"'),
 ("2 remove: dark .sg-card rule", "src/pages/StudioGuidePage.tsx", '[data-theme="dark"] .sg-card { background-color: var(--card-paper); }', ''),
 ("3 remove: dark .quote-terms strong colour", "src/components/ThemeToggle.tsx", '[data-theme="dark"] .quote-terms strong { color: #f4f9fd; }', ''),
 ("4 remove: pinned .summary-warning colour", "src/index.css", '.quote-summary .summary-warning { color: #0b1324; }', ''),
 ("5 remove: product label chip fill", "src/components/ThemeToggle.tsx", 'background-color: rgba(11, 19, 36, 0.88)', 'background-color: transparent'),
 ("6 remove: pinned 'free' colour", "src/index.css", '.quote-summary .total-rows .free-text { color: #7cc7ea; }', ''),
 ("7 break: sweep exit code", "../../qa/tools/sweep-467c.mjs", 'process.exit(bad.length ? 1 : 0)', 'process.exit(0)'),
]
for name, f, a, b in cases:
    raw = io.open(f, encoding="utf-8", newline="").read()
    assert raw.count(a) == 1 or raw.replace("\r\n","\n").count(a) == 1, name
    nl = "\r\n" if "\r\n" in raw else "\n"
    mod = raw.replace("\r\n","\n").replace(a, b).replace("\n", nl)
    io.open(f, "w", encoding="utf-8", newline="").write(mod)
    r = subprocess.run("node --experimental-strip-types --test test/contrast-theme-guard.test.ts", shell=True, capture_output=True, text=True, encoding="utf-8")
    io.open(f, "w", encoding="utf-8", newline="").write(raw)
    out = r.stdout
    fails = [l for l in out.splitlines() if l.startswith("✖") and "467-C" not in l]
    print(f"{name}: exit={r.returncode} FAILS:", "; ".join(fails[:2])[:170])
r = subprocess.run("node --experimental-strip-types --test test/contrast-theme-guard.test.ts", shell=True, capture_output=True, text=True, encoding="utf-8")
print("restored: exit", r.returncode, [l for l in r.stdout.splitlines() if l.startswith("ℹ") and ("pass" in l or "fail" in l)][:2])

import io, subprocess
F = "src/components/ThemeToggle.tsx"
FIELDS = ':is(input, select, textarea):not([type="checkbox"], [type="radio"], [type="file"], [type="range"], [type="hidden"], [type="color"]):not(:focus):not(.admin-app *):not(.studio-basin-stale-row select)'
D = f'[data-theme="dark"] {FIELDS} {{ border-color: #7a8fa8; }}'
L = f'[data-theme="light"] {FIELDS} {{ border-color: #738a9e; }}'
cases = [
 ("1 dark field border rule removed", D, ''),
 ("2 dark field border back to the line colour #34445b", D, D.replace("#7a8fa8", "#34445b")),
 ("3 light field border rule removed", L, ''),
 ("4 light field border back to the line colour #d7e5ef", L, L.replace("#738a9e", "#d7e5ef")),
 ("5 dark search/sort/portfolio wrapper rule removed", '[data-theme="dark"] :is(.search-field, .sort-field, .portfolio-search-bar) { border-color: #7a8fa8; }', ''),
 ("6 light wrapper rule removed", '[data-theme="light"] :is(.search-field, .sort-field, .portfolio-search-bar) { border-color: #738a9e; }', ''),
 ("7 dark /sketch picker ring removed", '[data-theme="dark"] :is(select[data-testid^="select-sketch-stone-"], select[data-testid^="select-sketch-basin-"]) { box-shadow: inset 0 0 0 1px #7a8fa8; }', ''),
 ("8 light /sketch picker ring removed", '[data-theme="light"] :is(select[data-testid^="select-sketch-stone-"], select[data-testid^="select-sketch-basin-"]) { box-shadow: inset 0 0 0 1px #738a9e; }', ''),
 ("9 a border-WIDTH change sneaks in (forbidden: colour only)", D, D + '\n[data-theme="dark"] input { border-width: 2px; }'),
 ("10 focus exclusion removed (would override the focus edge)", D, D.replace(":not(:focus)", "")),
]
cmd = "node --experimental-strip-types --test test/contrast-theme-guard.test.ts"
raw0 = io.open(F, encoding="utf-8", newline="").read(); nl = "\r\n" if "\r\n" in raw0 else "\n"
for name, a, b in cases:
    raw = io.open(F, encoding="utf-8", newline="").read(); n = raw.replace("\r\n", "\n")
    assert n.count(a) == 1, name
    io.open(F, "w", encoding="utf-8", newline="").write(n.replace(a, b).replace("\n", nl))
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding="utf-8")
    io.open(F, "w", encoding="utf-8", newline="").write(raw)
    out = r.stdout.splitlines()
    fails = [l.strip() for l in out if l.strip().startswith("✖") and "475-C" not in l and "failing tests" not in l]
    msg = [l.strip() for l in out if "AssertionError" in l][:1]
    print(f"{name}: exit={r.returncode} | {'; '.join(fails[:1])[:100]} | {msg[0][:110] if msg else ''}")
r = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding="utf-8")
print("restored: exit", r.returncode, [l for l in r.stdout.splitlines() if l.startswith("ℹ") and ("pass" in l or "fail" in l)][:2])

import io, subprocess
F = "src/components/ThemeToggle.tsx"
SEL = ':is(input, textarea):not(:disabled):not(.admin-app *)::placeholder'
RULE = f'[data-theme="dark"] {SEL},\n[data-theme="light"] {SEL} {{ color: var(--ink-soft); opacity: 1; }}'
cases = [
 ("1 rule removed (browser default 50% alpha again)", RULE, ''),
 ("2 colour back to the translucent ink (rgba(18,62,106,.5))", RULE, RULE.replace("color: var(--ink-soft); opacity: 1;", "color: rgba(18, 62, 106, 0.5); opacity: 1;")),
 ("3 opacity dropped to .5", RULE, RULE.replace("opacity: 1;", "opacity: 0.5;")),
 ("4 light theme left out", RULE, RULE.replace(',\n[data-theme="light"] ' + SEL, '')),
 ("5 a rule that also recolours the typed text slips in", RULE, RULE + '\n[data-theme="light"] input { color: var(--ink-soft); }'),
 ("6 474-C search placeholder rule loosened", ':is(.search-field, .portfolio-search-bar) input::placeholder { color: var(--ink-soft); opacity: 1; }', ':is(.search-field, .portfolio-search-bar) input::placeholder { color: var(--ink-soft); opacity: 0.6; }'),
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
    fails = [l.strip() for l in out if l.strip().startswith("✖") and "476-C" not in l and "failing tests" not in l]
    msg = [l.strip() for l in out if "AssertionError" in l][:1]
    print(f"{name}: exit={r.returncode} | {'; '.join(fails[:1])[:100]} | {msg[0][:120] if msg else ''}")
r = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding="utf-8")
print("restored: exit", r.returncode, [l for l in r.stdout.splitlines() if l.startswith("ℹ") and ("pass" in l or "fail" in l)][:2])

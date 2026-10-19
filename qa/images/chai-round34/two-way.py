import io, subprocess
cases = [
 ("1 revert: dark box back to the fixed white (rule removed)", "src/components/ThemeToggle.tsx", '[data-theme="dark"] .line-quantity { background-color: var(--card-paper); }', ''),
 ("2 revert: dark box fill set to #ffffff", "src/components/ThemeToggle.tsx", '[data-theme="dark"] .line-quantity { background-color: var(--card-paper); }', '[data-theme="dark"] .line-quantity { background-color: #ffffff; }'),
 ("3 revert: number/icons no longer pinned to --ink", "src/components/ThemeToggle.tsx", '[data-theme="dark"] .line-quantity button { color: var(--ink); }', '[data-theme="dark"] .line-quantity button { color: #ffffff; }'),
 ("4 new fixed white surface added to index.css (nobody decided its dark colour)", "src/index.css", '.line-quantity { border-color: var(--line); border-radius: 8px; overflow: hidden; background: white; }', '.line-quantity { border-color: var(--line); border-radius: 8px; overflow: hidden; background: white; }\n.new-qty-chip { background: #fff; }'),
]
cmd = "node --experimental-strip-types --test test/contrast-theme-guard.test.ts"
for name, f, a, b in cases:
    raw = io.open(f, encoding="utf-8", newline="").read()
    nl = "\r\n" if "\r\n" in raw else "\n"
    n = raw.replace("\r\n", "\n")
    assert n.count(a) == 1, name
    io.open(f, "w", encoding="utf-8", newline="").write(n.replace(a, b).replace("\n", nl))
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding="utf-8")
    io.open(f, "w", encoding="utf-8", newline="").write(raw)
    out = r.stdout.splitlines()
    fails = [l.strip() for l in out if l.strip().startswith("✖") and "472-C" not in l and "failing tests" not in l]
    err = [l.strip() for l in out if "AssertionError" in l or "should" in l.lower() or "a new fixed white" in l][:1]
    print(f"{name}: exit={r.returncode}\n   FAILS: {'; '.join(fails[:1])}\n   {err}")
r = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding="utf-8")
print("restored: exit", r.returncode, [l for l in r.stdout.splitlines() if l.startswith("ℹ") and ("pass" in l or "fail" in l)][:2])

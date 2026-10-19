import io, subprocess
F = "src/components/ThemeToggle.tsx"
cases = [
 ("1a dark card border removed", '[data-theme="dark"] .product-card[aria-checked="false"] { border-color: #7a8fa8; }', ''),
 ("1b dark card border back to the line colour", '[data-theme="dark"] .product-card[aria-checked="false"] { border-color: #7a8fa8; }', '[data-theme="dark"] .product-card[aria-checked="false"] { border-color: #34445b; }'),
 ("1c light card border removed", '[data-theme="light"] .product-card[aria-checked="false"],\n[data-theme="light"] .product-card[aria-checked="false"]:hover { border-color: #738a9e; }', ''),
 ("2a dark unticked check-box border removed", '[data-theme="dark"] :is(.install-toggle, .vat-row label) input:not(:checked) + span { border-color: #7a8fa8; }', ''),
 ("2b light unticked install border removed", '[data-theme="light"] .install-toggle input:not(:checked) + span { border-color: #738a9e; }', ''),
 ("2c light ticked install border removed", '[data-theme="light"] .install-toggle input:checked + span { border-color: #1f6f98; }', ''),
 ("3 dark tick colour back to --ink", 'border-right-color: #0b1324; border-bottom-color: #0b1324; }', 'border-right-color: var(--ink); border-bottom-color: var(--ink); }'),
 ("4 menu badge number back to white", '[data-theme="dark"] :is(.quote-link, .mobile-cart) span { color: #0b1324; }', '[data-theme="dark"] :is(.quote-link, .mobile-cart) span { color: #ffffff; }'),
 ("5a studio toolbar face back to the fixed white", '[data-theme="dark"] .studio-draft-toolbar-actions .icon-button { background-color: var(--card-paper); }', ''),
 ("5b dark disabled opacity back to .35", '.icon-button:disabled { opacity: 0.6; }', '.icon-button:disabled { opacity: 0.35; }'),
 ("5c light disabled opacity back to .35", '[data-theme="light"] .studio-draft-toolbar-actions .icon-button:disabled { opacity: 0.8; }', '[data-theme="light"] .studio-draft-toolbar-actions .icon-button:disabled { opacity: 0.35; }'),
 ("7 progress step disc back to #fbfdfe", '[data-theme="dark"] .studio-progress-step:not(.is-done) .studio-progress-step-icon { background-color: var(--card-paper); }', '[data-theme="dark"] .studio-progress-step:not(.is-done) .studio-progress-step-icon { background-color: #fbfdfe; }'),
 ("8 dark search field fill removed (pale 82% white again)", '[data-theme="dark"] .search-field { background-color: var(--card-paper); }', ''),
 ("9/10 placeholder colour back to the browser default", 'input::placeholder { color: var(--ink-soft); opacity: 1; }', 'input::placeholder { color: #879eb4; opacity: 1; }'),
 ("12 LINE exception widened (rule added for the LINE button)", '[data-theme="dark"] .search-field { background-color: var(--card-paper); }', '[data-theme="dark"] .search-field { background-color: var(--card-paper); }\n[data-theme="dark"] .line-logo-mark { color: #0b1324; }'),
]
cmd = "node --experimental-strip-types --test test/contrast-theme-guard.test.ts"
raw0 = io.open(F, encoding="utf-8", newline="").read()
nl = "\r\n" if "\r\n" in raw0 else "\n"
for name, a, b in cases:
    raw = io.open(F, encoding="utf-8", newline="").read()
    n = raw.replace("\r\n", "\n")
    assert n.count(a) == 1, name
    io.open(F, "w", encoding="utf-8", newline="").write(n.replace(a, b).replace("\n", nl))
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding="utf-8")
    io.open(F, "w", encoding="utf-8", newline="").write(raw)
    out = r.stdout.splitlines()
    fails = [l.strip() for l in out if l.strip().startswith("✖") and "474-C" not in l and "failing tests" not in l]
    msg = [l.strip() for l in out if "AssertionError" in l][:1]
    print(f"{name}: exit={r.returncode} | {'; '.join(fails[:1])[:110]} | {msg[0][:150] if msg else ''}")
r = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding="utf-8")
print("restored: exit", r.returncode, [l for l in r.stdout.splitlines() if l.startswith("ℹ") and ("pass" in l or "fail" in l)][:2])

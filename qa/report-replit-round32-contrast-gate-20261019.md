# 470-R — readiness-gated contrast scanning and two real colour states

## Scope and provenance

Source baseline: main `d4e4662b3d90e04b620f8c9eb9304cecaece0c97`, including the
owner-merged/deployed contrast work. Runner: Replit Agent, Linux x86_64,
Node 24.13.0; 19 October 2026, Asia/Bangkok. Exact final head, CI runner OS/time,
both-round route tables and green/red CI links are recorded in the PR acceptance
comment after those runs complete; pending CI is not claimed as passing here.

Only these source/control files change:

- `qa/tools/gradient-scan-465c.mjs`
- `qa/tools/sweep-467c.mjs`
- `qa/tools/test-gradient-occlusion.mjs`
- `.github/workflows/release-validation.yml` — contrast jobs only
- `artifacts/knight-basins/src/components/ThemeToggle.tsx` — the two colour rules only
- `artifacts/knight-basins/test/contrast-readiness.test.ts` — new regression guards
- This report and `qa/images/replit-round32/` evidence.

No App.tsx, global index.css, colour-token assignment, API/data/public/deploy
file, business text, price, name, size or geometry is changed. No additional
allowlist entry or threshold change. GitHub Connection only; no main push,
agent merge/deploy, production database write or real customer data.

## A — readiness, not a longer sleep

The scanner installs fetch observation before application scripts and seeds
the requested theme before the first React render (no arbitrary initial
sleep/reload/sleep sequence). A successful response counts only after its
cloned body is consumed; required catalogue/gallery JSON must parse.

Every scanned route has an explicit 30-second readiness deadline (bounded
override available for controlled timeout tests). Navigation has its own
bounded wait. A route is ready only with document/font/image completion,
no pending API fetches, successful catalogue data, the route-specific checks,
and **two consecutive unchanged DOM observations**:

- `/`: product cards equal the active catalogue basin count.
- `/stone`: rendered code set equals an active installed/sheet API code set,
  and every card has a price. Stable offline fallback cards cannot pass.
- `/portfolio`: successful gallery API; photo count equals delivered items.
  A genuine successful empty collection can pass with its actual empty-state
  marker; loading/error states cannot.
- Other catalogue-dependent routes: successful catalogue and settled content.
  Standalone pages do not require an API hook they never mount; `/site-prep`
  requires its own gallery response, while static pages require settled content
  with no visible loading indicator.
- Cart state and lazy-image settling are followed by the same readiness check.

Content mutations or unfinished API work during paired pixel capture also
fail closed. Failure prints **`ยังไม่ได้ตรวจ (หน้าโหลดไม่จบ: <เส้นทาง>)`** and
exits **2**; the sweep propagates 2, never a false success.

The new browser controls deliver JSON late, then render one card before all
three. They assert that the stable fallback and partial first card are not
measured. Blocking `/api/catalog` is proved against both the raw scanner and
the full sweep: exit 2, the required Thai diagnostic, and no partial first-page
measurement. Existing partial-overlay/fixed-text/tile-boundary controls remain.

## B — before/after, actual sampled backgrounds

The before values below are the owner's actual failing main log, not invented
local baselines. The after values are pixel measurements of explicit error/
price fixtures rendered using the **real compiled application CSS and actual
ThemeToggle stylesheet**, with the original classes and text. They are
controlled state-rendering proof, not a claim that production was changed.

| State | Before (owner log, dark 390) | After (controlled dark 390) | Actual sampled background | Source rule |
|---|---:|---:|---|---|
| Gallery error, original full Thai message | 2.91 | **10.51** | rgb(15,23,42) | ThemeToggle.tsx:557–559, error foreground #ffb4ab |
| `small.stone-card-prices`, `แผ่น ฿12,000` | 1.02 | **10.11** | rgb(244,249,253) | ThemeToggle.tsx:561–565, two-theme price foreground #173f6b and backing #f4f9fd |

Price labels are pinned in **both themes**, including fallback states. Their
backing colour avoids relying on an inherited dark-theme foreground over a
possibly pale card; no padding, size, position, text or price is modified.
The reported 1.02 occurred in the owner's incomplete catalogue render; the
readiness gate now refuses that incomplete route, but the colour rule still
protects the actual price label instead of hiding it.

Raw local browser controls and sampled RGBs: `qa/images/replit-round32/browser-controls.log`.
The same controls run inside every contrast CI case. CI artifacts also retain
per-route measured, occluded and unmeasurable counts and their existing reasons.

## C/E — same-commit repetition and genuine red proof

The contrast matrix runs **1440 and 390 × rounds 1 and 2**, each still capped
at ten minutes. A separate contrast-only comparison job requires four complete
34-pair summaries. It checks identical route order, measured counts, coverage,
exclusion counts, REAL verdicts and overflow across rounds, with ready data.
Volatile timings and raw image byte identity are not treated as semantic
contrast results. Missing/failing rounds cannot pass the comparison.

The established approved LINE exception is unchanged. A separate intentional-
bad-colour branch/run is used for CI red proof after the scanner change;
that deliberate regression is not part of the candidate. Its immutable SHA,
run and actual failing row are linked in the PR comment alongside the candidate
green run. A4 fixture remains in 1440 round 1 only.

## D — optional document skipping not implemented

Workflow-wide `paths-ignore: qa/**, **/*.md` would also skip the untouched
validation/unit jobs and, worse, ignore changes to `qa/tools/**` (the scanner
itself). This optional optimisation is not applied: the job remains fail-closed
and scanner modifications always exercise the gate. No other CI job changes.

## Commands and preliminary evidence

```sh
pnpm exec tsc --build --force
(cd artifacts/knight-basins && pnpm exec tsc --noEmit)
(cd artifacts/api-server && pnpm exec tsc --noEmit)
PORT=5179 BASE_PATH=/ pnpm --filter @workspace/knight-basins run build
(cd artifacts/knight-basins && node --experimental-strip-types --test test/contrast-readiness.test.ts test/contrast-theme-guard.test.ts)
CHROME_BIN=/repl/tools/bin/chromium node qa/tools/test-gradient-occlusion.mjs
```

Local targeted unit guards: **81/81**, no failures/skips. Local complete
CI-discovered non-browser web suite: **1529 total / 1529 pass / 0 fail / 0 skip**
(some environment-dependent cases may be skipped on CI; final counts are not
inferred from this local result). Shared libraries and
both artifact typechecks: **exit 0**. Production-parity web build: **exit 0**.
The authoritative complete web/API unit totals are the exact-head CI result,
not an inferred total or the local wildcard command including browser tests.

Raw logs are in `qa/images/replit-round32/`. CI retains each width/round artifact.
The final PR comment supplies GitHub comparison stats, commit/runner/time,
the complete route table and any limitations observed in the actual CI runs.

## Five-line handoff

Changed: real readiness contracts/deadlines, capture consistency, two colour-only fixes.
Tests: preliminary 81/81, both typechecks/build 0; final exact-head CI recorded in PR.
Unverified here: production after an owner-authorized deploy; no agent deployment.
Risk: unavailable public data must fail closed rather than measure a partial page.
Next: review the two-round comparison and genuine red proof, then owner acceptance.

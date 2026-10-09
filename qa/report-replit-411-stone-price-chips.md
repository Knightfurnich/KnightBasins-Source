# 411-R — narrow-page overflow fix: stone quantity editor and readme company badge

**Layout verified: all 15 page/viewport cells are overflow0 in the patched main
snapshot. Test acceptance remains incomplete: the full workspace suite timed
out and the broader snapshot checks have failures. No merge or deploy.**

The user approved the mobile quantity-editor fix in chat. Refreshed main's
`qa/job-411-replit-stone-price-chip-overflow.md` also explicitly expands the
task to the `/readme` company badge and authorizes necessary file expansion.
Implementation base: `0cc838755732471fcf49bb89deb956365e4b5850`.

### Implementation and verification environment

- CSS: at ≤720px only, scope to
  `.config-main:has(.stone-price-filters) > .quantity-editor.large`.
  Set `width:100%`, `min-width:0`; allow the label to shrink and wrap.
- `/readme`: add ≤720px Tailwind utilities to the company-heading wrapper and
  company badge only. This requires `src/components/SalesGuide.tsx`, outside
  the original short path list but explicitly permitted by the refreshed brief.
  Shared Badge defaults, company wording and desktop classes remain unchanged.
- Price chips already scroll internally and need no change. No App.tsx edit.
  No hero, root clipping, API, catalog/data, pricing or PriceGuide edit.
- Browser checks use an isolated temporary frontend snapshot, not the divergent
  workspace App.tsx. Unchanged frontend/lib source blobs were hash-compared to
  GitHub main; differing tracked frontend files were hydrated from that main.
  Shared external dependencies are reused, while `@workspace` package aliases
  point into the snapshot. TypeScript library declarations were rebuilt there.
- Temporary Vite serves at `http://127.0.0.1:5191`, base `/`.
  Its test-only API proxy points to the production public API, read-only.
  No non-GET/HEAD browser requests were observed. No temporary server config
  or dependency wiring is included in the PR.
- Before: 10 October 2026, **00:56:52 Asia/Bangkok**
  (`2026-10-09T17:56:52.569Z`).
  After: **00:59:00 Asia/Bangkok**
  (`2026-10-09T17:59:00.967Z`).
  After figures are from actual patched source served by Vite, not injected CSS.

## A–B. Actual source before/after — all 15 cells

Each triple is **innerWidth / clientWidth / scrollWidth → overflow px**.

| Path | Viewport | Before | After |
|---|---|---|---|
| `/` | 1440×900 | 1440/1425/1425 → 0 | 1440/1425/1425 → **0** |
| `/stone` | 1440×900 | 1440/1425/1425 → 0 | 1440/1425/1425 → **0** |
| `/quote` | 1440×900 | 1440/1425/1425 → 0 | 1440/1425/1425 → **0** |
| `/price-guide` | 1440×900 | 1440/1425/1425 → 0 | 1440/1425/1425 → **0** |
| `/readme` | 1440×900 | 1440/1425/1425 → 0 | 1440/1425/1425 → **0** |
| `/` | 390×844 | 390/375/375 → 0 | 390/375/375 → **0** |
| `/stone` | 390×844 | 390/375/377 → 2 | 390/375/375 → **0** |
| `/quote` | 390×844 | 390/375/375 → 0 | 390/375/375 → **0** |
| `/price-guide` | 390×844 | 390/375/375 → 0 | 390/375/375 → **0** |
| `/readme` | 390×844 | 390/375/387 → 12 | 390/375/375 → **0** |
| `/` | 360×800 | 360/345/345 → 0 | 360/345/345 → **0** |
| `/stone` | 360×800 | 360/345/376 → 31 | 360/345/345 → **0** |
| `/quote` | 360×800 | 360/345/345 → 0 | 360/345/345 → **0** |
| `/price-guide` | 360×800 | 360/345/345 → 0 | 360/345/345 → **0** |
| `/readme` | 360×800 | 360/345/387 → 42 | 360/345/345 → **0** |

All 15 before and after document responses: HTTP200, rendered public content,
zero observed console errors/uncaught exceptions. Classic scrollbar15px is
confirmed by the triples. Raw evidence:
[before](evidence/411-fix/metrics-before.json),
[after](evidence/411-fix/metrics-after.json).

### C. Overflower candidates before → after

Candidate scan: `right > documentElement.clientWidth + 1`, exclude elements
contained by an internally horizontal-scrollable ancestor.

| Path / viewport | Before candidates | Actual right bounds before | After candidates |
|---|---|---|---|
| Stone390 | quantity editor / label | 377.39 / 376.39, cw375 | none |
| Stone360 | quantity editor / label | 375.89 / 374.89, cw345 | none |
| Readme390 | heading wrapper / company badge / h1 | all387.11, cw375 | none |
| Readme360 | heading wrapper / company badge / h1 | all387.11, cw345 | none |
| Both pages1440 | none | — | none |

Desktop chip row retains the existing horizontal scrolling layout. Both mobile
chip rows still scroll internally; the document no longer scrolls horizontally.

### C. Actual before/after screenshots — 12 images

| Page | Width | Before | After |
|---|---:|---|---|
| Stone | 1440 | [image](evidence/411-fix/stone-before-1440.jpg) | [image](evidence/411-fix/stone-after-1440.jpg) |
| Stone | 390 | [image](evidence/411-fix/stone-before-390.jpg) | [image](evidence/411-fix/stone-after-390.jpg) |
| Stone | 360 | [image](evidence/411-fix/stone-before-360.jpg) | [image](evidence/411-fix/stone-after-360.jpg) |
| Readme | 1440 | [image](evidence/411-fix/readme-before-1440.jpg) | [image](evidence/411-fix/readme-after-1440.jpg) |
| Readme | 390 | [image](evidence/411-fix/readme-before-390.jpg) | [image](evidence/411-fix/readme-after-390.jpg) |
| Readme | 360 | [image](evidence/411-fix/readme-before-360.jpg) | [image](evidence/411-fix/readme-after-360.jpg) |

Stone captures show the filter row, not only the hero; Readme captures show the
affected company heading. Narrow after captures were visually inspected.

### D. CSS contract and broader tests

- New assertions applied to unmodified remote source: **exit1, 2pass / 2fail**.
  Quantity assertion: “the stone-only mobile quantity editor must override
  max-content width”. Readme assertion: the narrow-screen shrinkable heading
  and wrapping badge classes must exist.
- Same assertions with both fixes: **exit0, 4pass / 0fail**, including existing
  hero and stone-grid contracts.
- [Fail-before evidence](evidence/411-fix/contract-before.txt) /
  [Pass-after evidence](evidence/411-fix/contract-after.txt).
- Snapshot `pnpm run typecheck:libs`: exit0.
  Snapshot `pnpm --filter @workspace/knight-basins run typecheck`: exit0.
- Snapshot broad check excluding four `*.browser.test.ts` files:
  **1209 tests / 1206pass / 3fail / 0cancelled**, exit1.
  Failures: stock response browser scenario, retired-hostname nginx assertion,
  prerender `/network` JSON-LD `@id` (root id instead of route id).
  Some non-`*.browser.test.ts` files also launch Chromium; this is not an
  assertion that all browser checks were excluded.
- After the overlapping full suite stopped, the stock-only snapshot recheck
  (`test/admin-stock-inventory.test.ts`) passed **1/1, exit0**.
  The two other broad-check failures remain unresolved; the original aggregate
  above is preserved rather than recalculated from separate test runs.
- Exact full **workspace** command:
  `timeout 270s pnpm --filter @workspace/knight-basins test`: **exit124**,
  no aggregate summary before timeout. Observed failures include stock response,
  admin upload, basin visual, dispatch persistence and quote-print browser suites.
  [Safe full-suite summary](evidence/411-fix/full-test-summary.txt).
  Workspace App.tsx differs from remote main, so this is not isolated-main proof.
- No fixes to these unrelated failures are bundled in this CSS PR; no clean
  full-suite or final acceptance claim. API was paused for the full workspace
  suite and restarted afterward.

### E. Unchanged routes / protection boundaries

After source fix, 12 distinct public routes returned200:
`/`, `/stone`, `/quote`, `/price-guide`, `/readme`, `/portfolio`, `/updates`,
`/site-prep`, `/studio`, `/studio-guide`, `/sketch`, `/network`.
The first five also have all three rendered-width checks above.
`/price-guide` remains overflow0 in all three sizes and is not edited.

Only three application/test paths change:
`src/index.css`, `src/components/SalesGuide.tsx`, `test/hero-overflow.test.ts`
within `artifacts/knight-basins`. Other changed paths are this report and its
evidence. Source App.tsx, hero declarations, API paths, data and pricing/guide
files retain their remote-main blobs in the PR.

### Five-line result

1. Root cause: intrinsic quantity-editor width on Stone; nowrap badge forcing a wider Readme flex heading.
2. Fix: ≤720px stone-only width/label containment; ≤720px company wrapper/badge wrapping, without text or desktop changes.
3. Actual source before/after: Stone390 2→0 / Stone360 31→0; Readme390 12→0 / Readme360 42→0; all other cells stay0 — 15/15 after0.
4. Regression contract: fail-before2 / pass-after4; typecheck0; 12 routes200; broad/full tests are not clean.
5. Uncertain: full-suite acceptance is pending independent test-failure investigation; branch commit SHA is recorded in PR body via GitHub Connection. No merge/deploy.

---

## Initial production diagnosis (historical, before implementation)

Measured 10 October 2026 approximately 00:45 Asia/Bangkok
(`2026-10-09T17:45:26.766Z`).
Source main refreshed through GitHub Connection:
`ae522d9d21230a2a3bb6b31616e72412a51ac116`.
Actual production origin: `https://knightbasins.com`.

## A–B. Fresh baseline — desktop Chromium, classic scrollbars

Headless Chromium, `mobile:false`, deviceScaleFactor 1; overlay scrollbar
features disabled. The actual 15px classic scrollbar was confirmed from
`innerWidth − clientWidth`, not assumed from launch flags.

```js
const d = document.documentElement;
({
  innerWidth: window.innerWidth,
  clientWidth: d.clientWidth,
  scrollWidth: d.scrollWidth,
  overflow: d.scrollWidth - d.clientWidth,
});
```

| Path | Viewport | innerWidth | clientWidth | scrollWidth | Overflow |
|---|---|---:|---:|---:|---:|
| `/` | 1440×900 | 1440 | 1425 | 1425 | 0 |
| `/stone` | 1440×900 | 1440 | 1425 | 1425 | 0 |
| `/quote` | 1440×900 | 1440 | 1425 | 1425 | 0 |
| `/price-guide` | 1440×900 | 1440 | 1425 | 1425 | 0 |
| `/` | 390×844 | 390 | 375 | 375 | 0 |
| `/stone` | 390×844 | 390 | 375 | 377 | **2** |
| `/quote` | 390×844 | 390 | 375 | 375 | 0 |
| `/price-guide` | 390×844 | 390 | 375 | 375 | 0 |
| `/` | 360×800 | 360 | 345 | 345 | 0 |
| `/stone` | 360×800 | 360 | 345 | 376 | **31** |
| `/quote` | 360×800 | 360 | 345 | 345 | 0 |
| `/price-guide` | 360×800 | 360 | 345 | 345 | 0 |

All twelve captures: HTTP 200 and zero observed console errors/uncaught
exceptions. No non-GET/HEAD request was observed in this browser session.

## C. Current overflowing elements and chip-only diagnostic experiment

The current source and production DOM differ from the brief's stated causal
description: price chips **already have their own horizontal scrolling container**.
The observed quantity editor, not an uncontained chip button, extends beyond
the document client area.

| Viewport | Element | left | right | Other measurements |
|---|---|---:|---:|---|
| 390×844 | `.stone-price-filters` | 19.5 | 355.5 | client 336, internal scroll 994, `overflow-x:auto`; inside root client width375 |
| 390×844 | `.quantity-editor.large` | 19.5 | 377.39 | width357.89, outside root client375; no scrollable ancestor |
| 390×844 | quantity editor label span | 158.5 | 376.39 | outside root client375 |
| 360×800 | `.stone-price-filters` | 18 | 327 | client309, internal scroll994, `overflow-x:auto`; inside root client345 |
| 360×800 | `.quantity-editor.large` | 18 | 375.89 | width357.89, parent width309, outside root client345 |
| 360×800 | quantity editor label span | 157 | 374.89 | outside root client345 |

Source inspected through GitHub Connection:

```css
.stone-price-filters { display: flex; overflow-x: auto; /* existing */ }
.quantity-editor { width: max-content; min-width: 330px; /* existing */ }
/* existing narrow-screen rule */
.quantity-editor { min-width: 100%; }
```

The quantity editor retains its intrinsic `max-content` width despite the
mobile minimum width. At 360 it is roughly49px wider than its309px parent.

To test the chip-only hypothesis, a temporary style was injected **only into
the audit browser**, then removed. This was not a repository or production
server change:

```css
@media (max-width: 720px) {
  .stone-price-filters {
    min-width: 0;
    max-width: 100%;
    flex-wrap: wrap;
  }
  .stone-price-filters button {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 100%;
    white-space: normal;
  }
}
```

| Viewport | Actual baseline overflow | Temporary chip-only trial overflow |
|---|---:|---:|
| 1440×900 | 0 | 0 |
| 390×844 | 2 | **2 (unchanged)** |
| 360×800 | 31 | **31 (unchanged)** |

This trial does not demonstrate a fix and is not presented as an after-fix
measurement. No changes to hero, root overflow, pricing, data, API or guide.

### Actual before screenshots

The earlier diagnosis captures are superseded for PR evidence by the paired
source-snapshot before/after images in section C above. At the initial diagnosis
there were no implementation-after screenshots; these now exist.

## Historical D. Checks available at the initial diagnosis

At the initial diagnosis, no CSS contract or implementation existed.
The immediately preceding workspace checks were:

- `pnpm --filter @workspace/knight-basins run typecheck`: exit0.
- `timeout 270s pnpm --filter @workspace/knight-basins test`: outer exit124;
  runner reported1145 tests,1123 pass,21 fail,1 cancelled.

These are recorded context, not after-fix validation or an isolated test of
the remote main snapshot. The workspace App.tsx differs from remote main.

## Historical E. Read-only initial diagnosis boundaries

Twelve distinct public routes returned200:
`/`, `/stone`, `/quote`, `/price-guide`, `/portfolio`, `/updates`,
`/site-prep`, `/studio`, `/studio-guide`, `/sketch`, `/readme`, `/network`.
The first four also have the full three-viewport table above.
`/price-guide` remains overflow0 at all three viewports.

Read through GitHub Connection:
`src/index.css`, `src/App.tsx`, `test/hero-overflow.test.ts`,
`vite.config.ts`, `package.json` within `artifacts/knight-basins`,
and the task brief. None were edited.

## Historical five-line diagnosis / scope question (now answered)

1. Current baseline is stone +2px at390 and +31px at360, not the older +8/+36 figures.
2. Chips already scroll internally; the quantity editor's intrinsic width is the observed page-width overflower.
3. A chip-only wrapping/width diagnostic leaves both nonzero values unchanged; other three pages stay0 throughout.
4. Regression test, actual after measurements, six before/after captures and code PR are pending; full workspace tests already have failures.
5. Proposal: authorize a narrowly scoped mobile quantity-editor width/label fix on the stone page, then implement the contract and verify all12 cells. Otherwise retain this diagnosis without claiming the chip-only task is fixed.

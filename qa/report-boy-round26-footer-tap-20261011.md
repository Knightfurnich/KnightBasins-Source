# Boy · round 26 · job 461-B — the three footer links became real tap targets

Date 12 Oct 2026 (Asia/Bangkok) · author Boy (Qwen) · reviewer David + boss
Branch `fix/boy-461b-footer-tap-targets` · cut from `main@38398cf`, rebased onto `main@0003e58` (458-B is merged **and deployed** — queue R7 confirms production chips `30 · 18 · 10 · 2` with no raw category id, so this branch carries only 461-B) · **PR #582**
Job sheet `qa/job-461-boy-footer-tap-targets.md` · boss approval 11 ต.ค. 69: the footer block of `src/App.tsx` only
Environment: Linux sandbox · node v22.23.3 · pnpm · chromium 145.0.7632.18 headless · measured by Boy
(English prose; the Thai link labels quoted below were read out of the rendered page, not retyped.)

## 0 · baseline

* David (Linux 6.8.0-142-generic · `main@9c880ac4`): api-server **1,329 · pass 1,329 · fail 0** ·
  knight-basins `npm test` **1,399 · pass 1,357 · fail 0 · skipped 42**
* The number being fixed: Chai measured **23.1 px** for these three links in job 460-C step 0
  (`main@034858d`). Re-measured here on a production build of `main` before touching code: all three compute
  `line-height: 23.1px` and their boxes are **46.2 / 23.1 / 23.1 px** at 390 px (the first reads 46.2 because
  its label already wraps to two 23.1 px lines). Same number, independently reproduced.
* Commands used: `cd artifacts/knight-basins && npm test` ·
  `files=$(find test -maxdepth 1 -name '*.test.ts' ! -name '*.browser.test.ts' | sort) && node --experimental-strip-types --test $files` ·
  `npx tsc --noEmit` · `pnpm run typecheck:libs` · `PORT=3000 NODE_ENV=production pnpm run build` ·
  `python3 qa/evidence/461b/measure461.py` with the read-only harness `qa/evidence/461b/srv461.cjs`.

## 1 · what changed (the whole diff)

`NetworkFooterLinks` in `artifacts/knight-basins/src/App.tsx` — the block that both the storefront `Footer`
and the standalone footer render, so one edit covers every page:

```tsx
const FOOTER_TAP_TARGET = { minHeight: 44, lineHeight: "44px" } as const;
```

…and that object is applied as `style={FOOTER_TAP_TARGET}` on exactly the three named links
(`link-footer-knightfurnich` · `link-footer-hinsangkhro` · `link-network-footer-price-guide`), next to the
`className="footer-owner-link"` they already had. Diff: 1 code file, +26 / −3, four hunks, all of them
inside lines 431-480 of `NetworkFooterLinks`; plus one new test file, the evidence and this report.

Why each choice, with the measurement that decided it:

* **On the element, not in CSS.** `src/index.css` is frozen for this job, and an inline style needs no
  guesswork about which frozen rule wins.
* **`lineHeight` is what grows the target** — the box height of these links is their line of text; after the
  change every one of them measures 44 px. `minHeight` states the same floor for the box itself.
* **No `display` change.** A `display: inline-flex` version also reached 44 px but moved the three links onto
  one line at 390 px (x 156 / 426 / 752 at the same y, instead of three lines stacked at x 156). GOAL C says
  the footer keeps today's arrangement, so that version was rejected — and the "no display" case in the new
  test is what stops it from coming back.
* **44 px was reachable, so the 24 px fallback was not used.** 44 px = WCAG 2.5.5 and the floor job 453-B
  already set for the header menu; the AA minimum of WCAG 2.2 (2.5.8, 24 px) is cleared with room.

Untouched, on purpose: the hero (rule #449) and every other part of `App.tsx` · `src/index.css` ·
`src/pages/**` (460-C, Chai) · `src/data/**`, `artifacts/api-server/**` (Chai) · `/price-guide` price content
and every `.pg-*` (the only price-guide thing here is the height of the footer link that already pointed there) ·
production and the database.

## 2 · measured before / after (production build of each tree · chromium · real DOM boxes · `/api/*` answered 500)

Column order: `link-footer-knightfurnich` · `link-footer-hinsangkhro` · `link-network-footer-price-guide`.

| viewport | lines before | lines after | heights before (px) | heights after (px) | x columns before → after | footer height (px) | scrollWidth − clientWidth |
|---|---|---|---|---|---|---|---|
| 390 px | 3 | 3 | 46.2 / 23.1 / 23.1 | 88 / 44 / 44 | 156 / 156 / 156 → 156 / 156 / 156 | 623 → 706 | 0 → 0 |
| 360 px | 3 | 3 | 46.2 / 23.1 / 23.1 | 88 / 44 / 44 | 156 / 156 / 156 → 156 / 156 / 156 | 679 → 762 | 0 → 0 |
| 768 px | 2 | 2 | 23.1 / 23.1 / 23.1 | 44 / 44 / 44 | 161 / 454 / 161 → 161 / 454 / 161 | 559 → 601 | 0 → 0 |
| 1440 px | 1 | 1 | 23.1 / 23.1 / 23.1 | 44 / 44 / 44 | 178 / 471 / 621 → 178 / 471 / 621 | 314 → 335 | 0 → 0 |

* Every one of the three links reads **44 px or more** after (88 px where the label wraps to two lines),
  from **23.1 px** before — at every width, including the ≥44 floor on the two-line label.
* **Nothing moved**: same number of lines (3 / 3 / 2 / 1), same x columns, same link widths
  (216 / 133 / 161 at 390-360 and 277 / 133 / 161 at 768-1440, before and after). The footer only grows
  taller: +83 px at 390 px, +21 px at 1440 px.
* Rows grow with their boxes, so nothing overlaps and 2.5.8's spacing exception is not being leaned on.
* `scrollWidth − clientWidth = 0 px` on every width, before and after; no `overflow-x: hidden` added
  anywhere (the existing 431-B/453-B locks keep that covered). 0 page errors; 3 links found in every state.
* Images: `qa/images/boy-round26/BEFORE-footer-<width>.png` / `AFTER-footer-<width>.png` for 390 and 1440
  as the sheet asks, plus 360 and 768 (8 crops). Geometry + the two scripts that produced them:
  `qa/evidence/461b/footer-measurements.json`, `measure461.py`, `srv461.cjs`.

## 3 · tests

New lock `artifacts/knight-basins/test/footer-tap-targets-461b.test.ts` — **9 cases**, all reading the footer
block itself with comments stripped (so prose cannot satisfy a lock): the size object exists once and carries
44 px in both `minHeight` and `lineHeight`; each named link has it and keeps the frozen `footer-owner-link`
class; exactly three links are sized; no `display` is smuggled in; the three hrefs and their order are the same;
the `flex flex-wrap gap-x-4 gap-y-1` strip and the `footer-network-links` testid are unchanged; `src/index.css`
holds none of this; the header (453-B) and hero (#449) code is still in the file.

| run | result |
|---|---|
| `cd artifacts/knight-basins && npm test` (David's command, after) | **1,408 · pass 1,366 · fail 0 · skipped 42** = baseline 1,399 / 1,357 **+9** — exactly the nine cases of the new file |
| knight-basins, CI file list (166 files, no `*.browser.test.ts`) | **1,374 · pass 1,365 · fail 0 · skipped 9** |
| api-server, CI file list (101 files) | **1,329 · pass 1,329 · fail 0** — equal to David's baseline; no api-server file is in this diff (`git diff --stat origin/main -- artifacts/api-server` prints nothing) |
| `npx tsc --noEmit` · `pnpm run typecheck:libs` | exit 0 · exit 0 |
| `PORT=3000 NODE_ENV=production pnpm run build` | exit 0 · prerender + production-assets OK |

Method note, kept in the record: two earlier api-server runs in this sandbox reported failures (16, then 9,
and 213 once). Those were the sandbox — suites binding the same ports while other jobs ran, and one invocation
where a quoted glob made node load files outside the CI list. Run serially with the CI file list it is
1,329 / 1,329 / 0, matching David, and the PR's own CI job agrees. Written down instead of quietly dropped.

### two-way proof

1. **Unit level.** Deleting `style={FOOTER_TAP_TARGET}` from the first link (one line, nothing else) →
   **7 of 9 pass · 2 fail**: `link-footer-knightfurnich carries the size object and keeps its class and href` and
   `exactly the three named links are sized`. Putting it back → **9/9**, and the full `npm test` above is green.
2. **Screen level.** Same harness and viewport, both builds: `BEFORE-footer-390.png` shows three thin lines of
   links, `AFTER-footer-390.png` shows the same three lines, taller — and section 2 is the numeric version of
   that pair (23.1 → 44 px, lines 3 → 3, overflow 0 → 0).
3. **Risk checked rather than assumed.** The rejected `display: inline-flex` variant is the counter-example:
   it hit 44 px and broke GOAL C. Its symptom is exactly what the new "no display change" case forbids.

## 4 · not verifiable from here

* **The footer a crawler reads (JavaScript off).** This sandbox cannot prerender — no chromium the build can
  drive (`Chromium/Chrome is unavailable` → static SEO shell; the chromium present times out against the
  preview server, which has no `/api/catalog`) — so the prerendered footer cannot be photographed either
  before or after. Everything above is a JS-on production build of the same code.
* **Live `knightbasins.com`** still serves an older deploy; nothing here claims production.
* **The other `.footer-owner-link`s in the two footers** (คลังผลงานจริง · คู่มือเตรียมหน้างาน · อัปเดตระบบ ·
  เครือข่ายช่าง · Private Workbench …) share the class and the same frozen line box, but they are not the three
  this job names, so they were left alone and are **not measured** — see section 5.
* Target spacing of links inside page bodies (portfolio chips and the like) is 460-C's ground, not this sheet.

## 5 · risk / next

* Making the whole footer class 44 px belongs in one `src/index.css` rule (`.footer-owner-link { line-height: 44px; min-height: 44px }`),
  which would let this inline object be deleted instead of extended. The file is frozen today — on your word I
  can either repeat the object for the remaining links in the same block or fold them all into the sheet.
* The taller footer costs 83 px of page height at 390 px. If a later pass wants that back, the same two lines
  drop to 24 px (WCAG 2.2 AA minimum) — one token, and the new test is where the number is pinned.
* `qa/QUEUE.md` and `KANBAN.md` were left to David; the 12-point checklist is ticked in the PR body.
* Standing reminder: the PAT that once appeared in chat stays revoked; no secret is in this PR.

## five-line summary (rule 8 — for the boss)

1. The three sister-site links in the shared footer block of `src/App.tsx` went from **23.1 px to 44 px** hit
   height (one `minHeight`/`lineHeight` 44 px object applied to those three links) — nothing else in the file,
   no `index.css`, no `src/pages/**`, no price content, no api-server or data file.
2. Measured in chromium on production builds: **23.1 → 44 px** (88 px where a label wraps to two lines) at
   390/360/768/1440, with **the same line counts, x columns and link widths** — only the footer grows
   (623 → 706 px at 390), and `scrollWidth − clientWidth = 0` before and after; 8 crops in `qa/images/boy-round26/`.
3. Tests: 9 new cases green · `npm test` 1,408 (pass 1,366 · fail 0 · skip 42) = David's baseline +9 ·
   CI file list 1,374 / 1,365 / fail 0 · api-server CI list 1,329 / 1,329 / fail 0 · `tsc` 0 · build 0 ·
   two-way proof 7/9 → 9/9 plus the rejected `inline-flex` counter-example.
4. Not verifiable: the no-JavaScript crawler footer (no usable prerender in this sandbox), anything on the live
   site, and the footer's other links (outside this job's three, deliberately neither changed nor measured).
5. Offer: one `index.css` rule fixes the entire footer class and retires the inline object, or I extend the same
   object to the remaining links — both need your go-ahead because the file and the job scope say stop.

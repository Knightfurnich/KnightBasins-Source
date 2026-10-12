# Boy · round 25 · job 458-B — one shared header for the four standalone pages

Date 11 Oct 2026 (Asia/Bangkok) · author Boy (Qwen) · reviewer David + boss
Branch `fix/boy-458b-shared-header` · **PR #579** · rebased on `main@38398cf` (measurement tree was `3ad8da9`; the commits in between are docs-only — 0 files under `artifacts/`) · job sheet `qa/job-458-boy-shared-header.md` (ฉบับ 2) · queue R6.2
Environment: Linux sandbox · node v22.23.3 · pnpm · chromium 145.0.7632.18 headless · run by Boy
(English prose again: every Thai string below is copied out of the measured DOM by the script that wrote this
file, so a hand-typed tone mark cannot corrupt the evidence — that bit this job family twice already.)

## 0 · baseline

* David (Linux 6.8.0-142-generic · `main@a00284a`): api-server **1,329 · pass 1,329 · fail 0** ·
  knight-basins `npm test` **1,399 · pass 1,357 · fail 0 · skipped 42**
* This sandbox, on the untouched tree `main@3ad8da9` (its own worktree, nothing else running):
  `cd artifacts/knight-basins && npm test` → **1,399 · pass 1,357 · fail 0 · skipped 42** — David's baseline
  reproduced exactly, so the finished tree's +13 tests / +13 passes are precisely the 13 cases of the new file.
* Commands used: `cd artifacts/knight-basins && npm test` ·
  `files=$(find test -maxdepth 1 -name '*.test.ts' ! -name '*.browser.test.ts' | sort) && node --experimental-strip-types --test $files` ·
  `npx tsc --noEmit` (both packages) · `pnpm run typecheck:libs` ·
  `PORT=3000 NODE_ENV=production pnpm run build` · `python3 qa/evidence/458b/measure458.py <label> <dist> <out>`

## 1 · what changed

| file | change |
|---|---|
| `src/components/StandalonePageHeader.tsx` (new) | the header: brand block that links home, the site menu, the quote link, one back-to-store link, `data-page` + `data-testid="standalone-page-header"`. It reuses the storefront's own classes (`.site-header`, `.brand`, `.main-nav`, `.header-actions`) so typography/spacing/height come from the frozen stylesheet instead of a fourth copy. |
| `src/components/standalonePageNav.ts` (new) | the menu list as a plain `.ts` module (a `node --test` lock cannot import `.tsx`). Every href/label/emoji was read out of `.main-nav` in `src/App.tsx` rather than retyped, and a test compares the two lists on every run, so the menu cannot drift into two truths. |
| `src/pages/SitePrepPage.tsx` · `src/pages/PortfolioPage.tsx` · `src/pages/PriceGuidePage.tsx` · `src/components/SalesGuide.tsx` | private `<header>` block → one line `<StandalonePageHeader page=… subtitle=… />`, plus the imports that became dead. Portfolio's chips/filters/JSON-LD and the price guide's tables, rates and numbers are untouched. |
| `test/header-nav-a11y.test.ts` | 453-B's floor ("a standalone page always has a way home") now looks *through* the shared block: if a page renders it, the link must be there. Strictly the same promise + one extra assertion that the named `…-back-to-store` link still exists. |
| `test/price-guide-page.test.ts` | its server-render harness stubs `@/data/assets`, exactly like `test/site-prep-page.test.ts` already does, because the shared header shows the brand picture and `import.meta.env` does not exist under tsx. No assertion changed. |
| `test/standalone-page-header-458b.test.ts` (new) | 13 cases (section 5). |

`git diff --stat origin/main`:
```
.../knight-basins/src/components/SalesGuide.tsx    | 26 ++++--------------
 .../knight-basins/src/pages/PortfolioPage.tsx      | 23 ++--------------
 .../knight-basins/src/pages/PriceGuidePage.tsx     | 32 ++--------------------
 artifacts/knight-basins/src/pages/SitePrepPage.tsx | 15 ++--------
 .../knight-basins/test/header-nav-a11y.test.ts     | 12 +++++++-
 .../knight-basins/test/price-guide-page.test.ts    | 12 +++++++-
 6 files changed, 35 insertions(+), 85 deletions(-)
```
Not touched: `src/App.tsx` · `src/index.css` · `src/data/**` · `artifacts/api-server/**` · `src/admin/**` ·
rule #449 (hero) · portfolio chip/filter logic · `/price-guide` price content · databases · production.

## 2 · measured (real production build of each tree, chromium, `/api/*` answered 500 so all wording comes from the build)

Header height /readme · /site-prep · /portfolio · /price-guide (px), smallest tap target, fewest header links, overflow:

**BEFORE (`main@3ad8da9`)**

| viewport | /readme | /site-prep | /portfolio | /price-guide | smallest tap | fewest menu links | scrollWidth−clientWidth |
|---|---|---|---|---|---|---|---|
| 390 px | 120 | 65 | 91 | 81 | 20 | 1 | 0 |
| 360 px | 120 | 65 | 91 | 81 | 20 | 1 | 0 |
| 768 px | 74 | 65 | 71 | 61 | 20 | 1 | 0 |
| 1440 px | 74 | 65 | 71 | 61 | 20 | 1 | 0 |

**AFTER (this branch)**

| viewport | /readme | /site-prep | /portfolio | /price-guide | smallest tap | fewest menu links | scrollWidth−clientWidth |
|---|---|---|---|---|---|---|---|
| 390 px | 101 | 101 | 101 | 101 | 44 | 8 | 0 |
| 360 px | 101 | 101 | 101 | 101 | 44 | 8 | 0 |
| 768 px | 78 | 78 | 78 | 78 | 44 | 8 | 0 |
| 1440 px | 78 | 78 | 78 | 78 | 44 | 8 | 0 |

* height equal on every page: BEFORE `{"390px": false, "360px": false, "768px": false, "1440px": false}` → **AFTER `{"390px": true, "360px": true, "768px": true, "1440px": true}`** (101 px at 390/360, 78 px at 768/1440); header menu items per page: before 1·1·1·4 → after 7·7·7·7 (+ basket and back-to-store link) (101 px at 390/360, 78 px at 768/1440)
* `scrollWidth − clientWidth` = **0 px on all four pages at all four widths, before and after** · no `overflow-x: hidden` anywhere (453-B's lock still green)
* page errors during the runs: before 0, after 0
* menu strip: at 390/360 px `menuScrolls: true` (the strip's own content is wider than the box, so it scrolls
  sideways) and the cue `::after content: "→"` is rendered; at 768/1440 px `menuScrolls: false`, no cue needed,
  and the header height is unchanged either way.
* idle menu link colour `color(srgb 0.281961 0.410588 0.524314)` on the composited header background = **20.88:1**
  (WCAG maths in the harness; the same `color-mix(in srgb, var(--ink-soft) 70%, var(--ink))` value 453-B chose for the storefront)
* header link words as rendered on `/readme` at 390 px: แคตตาล็อก, หินสังเคราะห์, ส่งแบบร่าง, 📸 ผลงานจริง, 📐 เตรียมหน้างาน, คู่มือราคา, ใบเสนอราคา, กลับสู่หน้าร้าน — same list on all four pages
* back-to-store link on every page: `กลับสู่หน้าร้าน` box 124×44 px, id `link-<page>-back-to-store` (the ids 453-B's probes already read)

## 3 · images

`qa/images/boy-round25/` — `BEFORE-<page>-<width>.png` / `AFTER-<page>-<width>.png` for the four pages at 390 and
1440 px = **16 files** (the sheet asks for 8 before/after; both widths are included so the mobile two-row header and
the desktop single row are both visible). Each crop is the `<header>` element itself, same harness, only the code differs. Examples worth opening
first: `BEFORE-readme-390.png` (120 px, two links, no menu) vs `AFTER-readme-390.png` (101 px, full menu + cue),
and `BEFORE-price-guide-390.png` (81 px with a link whose box is 0 px) vs `AFTER-price-guide-390.png`.
Raw numbers + the rig: `qa/evidence/458b/header-measurements.json`, `measure458.py`, `srv458.cjs`; the two scripts that produced them are there too
(`measure458.py`, `srv458.cjs`) so Replit or David can rerun without rebuilding the rig.

## 4 · ข้อ F — nothing that just landed may go backwards (measured on the AFTER build's storefront, 390 px)

| promise | result |
|---|---|
| #554 · `/price-guide` stays in the main menu | `True` (also locked in the new unit test) |
| #554 · menu links are real tap targets | heights [44] px |
| #554 · mobile cart link ≥ 44 px | 44×44 px |
| #551 · no raw category id visible (chips) | ["ทั้งหมด 30", "อ่างที่เลือก 0", "เคาน์เตอร์ 18", "ทรงสูง 10", "เสาวางของตั้งพื้น 2"] · raw visible: [] |
| this job · equal headers without new CSS | heights after = 101/101/101/101 and 78/78/78/78 · `src/index.css` untouched |

## 5 · tests

New lock `test/standalone-page-header-458b.test.ts` (13 cases): the shared block is the only `<header>` in the
system · each page renders it exactly once and owns no header of its own · the menu equals the storefront menu
(parsed from `src/App.tsx` — href, label, emoji, order) · `/price-guide` is in it · the mobile cue / `min-height:
44px` / `color-mix(... 70% ...)` numbers agree between the shared block and `App.tsx` · the CSS stays one
well-formed template literal · the `/price-guide` header row carries no digit and no price word while the price
markup (`price-guide-content`, `buildPriceGuideJsonLd`, `PRICE_GUIDE_SCHEMA_PRICES`, `<th scope="row">`) survives.

| run | result |
|---|---|
| `cd artifacts/knight-basins && npm test` (whole suite, after) | **1,412 · pass 1,370 · fail 0 · skipped 42** (baseline 1,399 → +13 = exactly the new file) |
| CI variant (`find … ! -name '*.browser.test.ts'`) | **1,378 tests (166 files) · pass 1,369 · fail 0 · skipped 9** |
| `cd artifacts/api-server && npm test` | green in this PR's CI (below); this PR changes **no** api-server file (`git diff --stat origin/main -- artifacts/api-server` = empty). In this sandbox two full runs beside other jobs gave 1,329 · pass 1,313 · **fail 16** and 1,329 · pass 1,320 · **fail 9** — the same suites pass file-by-file (`test/payload-guard.test.ts` 13/13), i.e. sandbox port contention, recorded instead of hidden. |
| `npx tsc --noEmit` — knight-basins / api-server | exit 0 / exit 0 |
| `pnpm run typecheck:libs` | exit 0 |
| `PORT=3000 NODE_ENV=production pnpm run build` | exit 0 · prerender + production-assets OK |

### CI (จริงบน PR นี้)
**PR #579 got both checks, both green** — run `38189160998` on head `09d3727` ("Release validation"):
`Unit tests (api-server and knight-basins)` = **success** (3m01s) · `Validate release contents` = **success** ·
merge state `CLEAN` / `MERGEABLE` · <https://github.com/Knightfurnich/KnightBasins-Source/actions/runs/38189160998>
All of that job's steps were also run here before pushing (exit 0, tables above), which is what makes the
api-server line below readable: the same suites are green in CI, so the 16 failures are this sandbox's port
contention, not code.
The two pushes after that run changed only this report file (no `src/`, no `test/`), so their checks are the same jobs on
the same code — the current state is always the "checks" tab of #579. (Different from round 24: #543 was closed as a
transfer before any job ran, so there was nothing to compare; here the gate really fires for `pull_request` into
protected `main`.)

### two-way proof

1. **Unit level.** Putting a private `<header>` back into `SalesGuide.tsx` (one file, nothing else touched) gave
   **26 of 28 pass · 2 fail** — `readme renders the shared header and no header of its own` and 453-B's
   `every page keeps a link back to the storefront`. Removing the injection returned **28/28**; the whole suite
   above is green with the shared block only.
2. **On screen.** Same viewport, same harness, same build command: BEFORE shows four different heights and three
   pages with no menu at all; AFTER shows one bar (101 px at 390, 78 px at 1440) with the full menu and the cue.
3. **The bug the screen caught and the tests did not.** The first version of the header's own comment inside the
   CSS template literal contained a backtick; it closed the literal early, so every standalone page rendered the
   app error boundary while `tsc`, `build` and all unit tests stayed green. The measurement caught it as
   `headerHeight: n/a (no such element)`. That class of mistake is now a unit test (well-formed literal, exactly one `<style>`),
   and it is the strongest argument in this repo for measuring instead of asserting.

## 6 · not verifiable from here

* **The JavaScript-off crawler view.** This sandbox cannot prerender (`Chromium/Chrome is unavailable` → the build
  falls back to the static SEO shell, and pointing `CHROMIUM_PATH` at the one chromium here times out on `/`
  because the preview server has no `/api/catalog`). So the header that a crawler is served cannot be photographed
  locally at all — before *and* after — and every number here is a JS-on measurement of the same code path.
* **Live `knightbasins.com`.** It still serves the pre-458-B deploy; nothing about production is claimed.
* `/studio-guide` and `/updates` keep their own compact headers (out of SCOPE; 453-B's floor is still locked for
  them by the updated test) — they will look different from the four unified pages until someone widens the job.
* Dark-theme contrast of the new menu links was computed from the same token as the storefront
  (`{color(srgb 0.281961 0.410588 0.524314)}`), but not re-measured in dark mode.

## 7 · risk / next

* Menu truth now exists twice (`.main-nav` inside `App.tsx`, `standalonePageNav.ts` for the standalone pages) with a
  test welded between them, because `App.tsx` is frozen for this job. When it frees up, `Header` should map over
  `STANDALONE_PAGE_NAV` and the copy disappears — one-line change, no behaviour change, I can do it in this branch.
* The header restates three CSS declarations that live in `App.tsx`'s inline `<style>` (cue, 44 px, colour mix)
  because a standalone route never renders that `<style>`. Same reason, same follow-up: move them into a real
  stylesheet the day `src/index.css` unfreezes.
* Tap-target rule also had to cover the back-to-store link: it inherits the shared button class and measured 42 px,
  so a `min-height: 44px` line was added — now locked in the tests and re-measured at 44 px.
* 452-F (Freebuff) can build on this header instead of a fifth copy — the block takes `page` + `subtitle` and is
  the only place its CSS lives. `PortfolioPage` header is the only part of that file this job touched, so their
  chip work can start once this PR closes.
* Unchanged from last round: the PAT that leaked in chat stays revoked; nothing secret is in this PR.

## five-line summary (rule 8 — for the boss)

1. Four standalone pages (`/readme` `/site-prep` `/portfolio` `/price-guide`) now render one shared header;
   `src/App.tsx`, `src/index.css`, portfolio chips and every price figure untouched.
2. Measured equal header heights on all four pages (101 px at 390/360, 78 px at 768/1440; before: 65/81/91/120),
   0 px overflow everywhere, smallest tap target 44 px (was 0–40), menu contrast 20.88:1, home
   link + the storefront's own seven menu items on every page, mobile strip scrolls with a "→" cue.
3. Tests: new 13-case lock + 453-B's lock updated ⇒ `npm test` 1,412 (pass 1,370 · fail 0 · skip 42) · CI subset
   1,378 tests (166 files) · pass 1,369 · fail 0 · skipped 9 · api-server 1,329 · pass 1,329 · fail 0 · no api-server file is touched by this PR · `tsc` 0 · production build 0. Two-way proof: private header → 2 fails
   / restore → 28-28; BEFORE/AFTER images in `qa/images/boy-round25/`.
4. Not verifiable: the JS-off prerendered crawler view (no working prerender in this sandbox), anything live on
   `knightbasins.com`, dark-mode re-measure, `/studio-guide` + `/updates` (out of scope, floor still locked).
5. Offer: when `App.tsx` unfreezes, the duplicated menu list and the three restated CSS rules collapse into one
   source; say the word and I do it here. 452-F can reuse this header as-is.

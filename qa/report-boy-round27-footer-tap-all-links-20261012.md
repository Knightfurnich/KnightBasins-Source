# Boy · round 27 · job 461-B ฉบับแก้ 1 — the other six footer links are 44 px targets too

Date 12 Oct 2026 (Asia/Bangkok) · author Boy (Qwen) · reviewer David + boss
Branch `fix/boy-461b-footer-tap-targets-rev1` · base `main@11563b0` · PR #584
Round 1 (report `qa/report-boy-round26-footer-tap-20261011.md`, merged `52966d0`, deployed and re-measured on
production by David) sized the three sister-site links; **this round sizes the six links of the footer's meta bar**
with the same single value, as ordered in ฉบับแก้ 1.
Environment: Linux sandbox · node v22.23.3 · pnpm · chromium 145.0.7632.18 headless · measured by Boy
(English prose; Thai labels below were read out of the rendered page by the script that collected the numbers.)

## 0 · baseline

* David's re-measurement of these six links: **17 - 23 px**, ordered here.
* Untouched base `main@11563b0`, measured in this sandbox (own worktree, own production build, own port, nothing
  else running): the six compute `line-height: 23.1px` and their boxes are
  **17 / 17 / 17 / 17 px** at 390 / 360 / 768 / 1440, except `Private Workbench` at **23.1 px**. Chai's original
  23.1 px finding and David's 17 px both reproduce exactly.
* Method and commands identical to round 1: `PORT=3000 NODE_ENV=production pnpm run build` per tree →
  `qa/evidence/461b/rev1/srv461b.cjs` (static, `/api/*` answered 500 so the footer is the build's own) →
  `python3 qa/evidence/461b/rev1/measure461b.py` (chromium, `getBoundingClientRect()` + `getComputedStyle()` per
  link, row grouping with a 10 px tolerance so a baseline offset is not counted as a new line).
  Test/type commands: `npm test`, the CI file list (`find test -maxdepth 1 -name '*.test.ts' ! -name '*.browser.test.ts'`),
  `npx tsc --noEmit`, `pnpm run typecheck:libs`.

## 1 · what changed (the whole diff)

`src/App.tsx`, footer region only — the size object of round 1 moves to module scope and is applied to six more links:

    const FOOTER_TAP_TARGET = { minHeight: 44, lineHeight: "44px" } as const;

* six `style={FOOTER_TAP_TARGET}` added: `/portfolio`, `/price-guide`, `/site-prep`, `/updates`, `/network`,
  `/?workbench=1`;
* the declaration moved above `Footer()` because nine links in two footer components (`Footer` and
  `NetworkFooterLinks`, the latter also rendered by `StandaloneNetworkFooter`) now share one value — restating it per
  component is the duplication this repo keeps hiring jobs to remove;
* `test/footer-tap-targets-461b.test.ts` rewritten to cover **all nine** links by parsing each tag's attributes
  (href / className / style / data-testid) instead of pattern-matching a tag string, so attribute order and the
  optional `data-testid` stop mattering (10 cases, base file was 9);
* `test/release-v120.test.ts`, `test/updates-page.test.ts`, `test/updates-page-v200.test.ts` pinned the **literal**
  `<Link href="/updates" …>` tag, so any added attribute moves a literal pin: each pattern gained
  ` style={FOOTER_TAP_TARGET}` in the same position and still asserts the same href, class, `data-testid`, the
  `{LATEST_UPDATE_VERSION}` label expression and the closing tag. Nothing was relaxed — each now pins one attribute
  more. This is the only edit to files that are not mine, it is in `test/` (inside the job's SCOPE), and it is called
  out in the PR body.
* Not touched: `src/index.css` (and a test case asserts no 44 px rule leaked into it) · the hero (rule #449) ·
  the rest of `App.tsx` · `src/pages/**` (460-C) · `src/data/**`, `artifacts/api-server/**` · every price figure and
  `.pg-*` class · production and the database.

## 2 · measured before / after (box heights, px, at 390 / 360 / 768 / 1440)

The six links of this round — width after is byte-identical to width before, so one column is enough:

| href | label as rendered | before | after | widths (before = after) |
|---|---|---|---|---|
| `/portfolio` | คลังผลงานติดตั้งจริง | 17 / 17 / 17 / 17 | **44 / 44 / 44 / 44** | 93 / 93 / 93 / 93 |
| `/price-guide` | ราคาและวิธีเลือกหินสังเคราะห์ | 17 / 17 / 17 / 17 | **44 / 44 / 44 / 44** | 126 / 126 / 126 / 126 |
| `/site-prep` | คู่มือเตรียมหน้างาน | 17 / 17 / 17 / 17 | **44 / 44 / 44 / 44** | 83 / 83 / 83 / 83 |
| `/updates` | บันทึกการอัปเดต (v2.2.1) | 17 / 17 / 17 / 17 | **44 / 44 / 44 / 44** | 132 / 132 / 132 / 132 |
| `/network` | เครือข่ายเว็บไซต์ของเรา | 17 / 17 / 17 / 17 | **44 / 44 / 44 / 44** | 101 / 101 / 101 / 101 |
| `/?workbench=1` | Private Workbench | 23.1 / 23.1 / 23.1 / 23.1 | **44 / 44 / 44 / 44** | 121 / 121 / 121 / 121 |

* **17 px → 44 px** on five links, **23.1 → 44 px** on `Private Workbench`, at every width. 44 px is WCAG 2.5.5 and
  the number 453-B already uses for the header menu, so the WCAG 2.2 AA floor (2.5.8 = 24 px) is passed with room;
  the approved fallback to 24 px was **not** needed and no target leans on the spacing exception.
* **No re-flow**: the meta bar occupies the same number of lines before and after — 3 → 3 at 390 and 360, 3 → 3 at
  768, 1 → 1 at 1440 — with unchanged x columns (`18 / 121 / 258 …` at 390; `324 / 437 / 583 / 687 / 839 / 1279` at
  1440). Only heights grew, so the footer is taller: **706 → 781 px** at 390, 762 → 837 at 360, 601 → 676 at 768,
  **335 → 356 px** at 1440.
* `scrollWidth − clientWidth = 0 px` before and after, every page, every width; no `overflow-x: hidden` anywhere in
  the footer range (a test case asserts that too).
* Round 1's three links, read in the same runs — nothing stepped back:

| link | before (base already had round 1) | after this round |
|---|---|---|
| `link-footer-knightfurnich` | 88 / 88 / 44 / 44 | 88 / 88 / 44 / 44 |
| `link-footer-hinsangkhro` | 44 / 44 / 44 / 44 | 44 / 44 / 44 / 44 |
| `link-network-footer-price-guide` | 44 / 44 / 44 / 44 | 44 / 44 / 44 / 44 |

* Page errors across the eight measurement runs: **0**; nine links found in every run.
* Images: `qa/images/boy-round27/BEFORE-footer-meta-390.png` · `AFTER-footer-meta-390.png` and the same pair at
  1440 — the four crops the sheet asks for (the 360/768 crops stay in the sandbox with the raw geometry).
  Numbers: `qa/evidence/461b/rev1/footer-measurements.json`, plus `measure461b.py` and `srv461b.cjs` beside it so
  anyone can retake them without rebuilding a rig.

## 3 · tests

| run | result |
|---|---|
| `node --test test/footer-tap-targets-461b.test.ts` (this branch) | **10 · pass 10 · fail 0** (same file at the base tree: 9 cases) |
| that file + the three re-pinned locks | **28 · pass 28 · fail 0** |
| the seven files around this area (adding `price-guide-page`, `header-nav-a11y`, `site-prep-page`) | **65 · pass 65 · fail 0** |
| `cd artifacts/knight-basins && npm test` — this branch, alone | **1,422 · pass 1,380 · fail 0 · skipped 42** |
| `cd artifacts/knight-basins && npm test` — untouched base, same sandbox, alone | **1,421 · pass 1,379 · fail 0 · skipped 42** — so **+1 test / +1 pass**, the one extra case of the rewritten lock file |
| knight-basins, CI file list (167 files) | **1,388 · pass 1,379 · fail 0 · skipped 9** |
| `npx tsc --noEmit` · `pnpm run typecheck:libs` | exit 0 · exit 0 |
| `PORT=3000 NODE_ENV=production pnpm run build` | exit 0; the shipped bundle (`index-DwIFmGW6.js`) is grepped for the compiled form of that value — `lineHeight:"44px"` is in it — so what was measured is what ships |

api-server, run alone and serial here: **1,329 · pass 1,311 · fail 18** on this branch and **1,329 · pass 1,312 ·
fail 17** on the untouched base — the same admin / backup / sketch / permission suites in both, and
`git diff --stat origin/main -- artifacts/api-server` prints nothing (this PR contains no api-server file). Those
suites want a database and free local ports the sandbox does not give them; PR #582's CI job ran both packages alone
and was green, so that is the reference. Recorded, not smoothed over.

### two-way proof

1. **Unit.** Delete one `style={FOOTER_TAP_TARGET}` (first `/site-prep`, then `/network`, one attribute each,
   nothing else touched) → **2 of 10 fail**: `all nine footer links reference it` and
   `exactly these hrefs, in order, each sized`. Put it back → **10/10**. Because the three version-label tests pin
   the `/updates` tag, an attribute moving or vanishing fails them too — the sharing is now load-bearing.
2. **Screen.** `BEFORE-footer-meta-390.png` shows six 17 px links on three lines; `AFTER-footer-meta-390.png` shows
   the same three lines and the same columns at 44 px. Section 2 is the numeric form of that pair.
3. **The rejected variant, still rejected.** A `display` change (e.g. `inline-flex`) reaches 44 px too but moves
   links between lines — measured in round 1 — so the size object still contains no `display`, and the rewritten
   lock asserts that for all nine.

## 4 · not verifiable from here

* **JavaScript-off crawler footer**: this sandbox still cannot prerender (no chromium the build can drive ⇒ static
  SEO shell), so that state is unmeasured before *and* after — unchanged limitation from round 26, restated rather
  than hidden. Every number above is a JS-on production build of the same code.
* **Live `knightbasins.com`** until merge + deploy (round 1's production figures are David's, quoted in §0).
* Whether the two plain spans in the meta bar (`TH / 2026 COLLECTION`, the VAT notice) should be targets at all —
  they stay text, and a test asserts they remain text; that is a product call for David.
* Horizontal gaps between link columns at 768/1440 (the 2.5.8 spacing clause): x offsets are unchanged by this diff
  and are in the JSON; a full spacing audit belongs to 460-C.
* Dark-theme contrast of these links: the colour is still the frozen `--brand-blue` rule in `index.css`; not
  re-measured in dark mode here.

## 5 · risk / next

* Height cost only: 706 → 781 px at 390 (+75), 335 → 356 px at 1440 (+21). If that has to be clawed back,
  `lineHeight: "24px"` in the same declaration keeps the WCAG 2.2 AA floor and frees most of it — one token, pinned
  by the lock file.
* The nine inline `style` props exist because `src/index.css` is frozen. One rule
  (`.footer-meta .footer-owner-link, .footer-network-links .footer-owner-link { line-height: 44px; min-height: 44px }`)
  would replace all nine and the module const, and the three re-pinned tag patterns could return to their original
  form — the diff I would send the day the sheet unlocks.
* The count case (`all nine footer links reference it`) is the tripwire: a tenth footer link added without the
  shared value turns the suite red instead of shipping a 17-px target again.
* `qa/QUEUE.md` / `KANBAN.md` left to David. Standing note: the PAT that once appeared in chat stays revoked; no
  secret is in this PR.

## five-line summary (rule 8 — for the boss)

1. The six remaining footer links now carry the same size object round 1 introduced (moved to module scope so nine
   links across two footer components share one value); hero/#449, the rest of `App.tsx`, `index.css`,
   `src/pages/**`, `src/data/**`, api-server and every price figure untouched.
2. Measured in chromium on production builds of base and branch: **17 px → 44 px** (23.1 → 44 for Private
   Workbench) at 390/360/768/1440, **same widths, same x columns, same line counts**, `scrollWidth − clientWidth = 0`
   before and after; only the footer grew (706 → 781 px at 390, 335 → 356 px at 1440); round 1's three links
   unchanged; four footer crops in `qa/images/boy-round27/`.
3. Tests: rewritten lock **10/10** (base 9), the three literal-tag pins updated in step → **28/28**; footer-adjacent
   files **65/65**; `npm test` 1,422/1,380/0/42 vs base **1,421/1,379/0/42** in the same sandbox (exactly +1); CI
   file list **1,388/1,379/0**; `tsc` 0; production build 0; two-way proof **8/10 → 10/10**.
4. Not verifiable: the JS-off crawler footer (no usable prerender here), live production before merge, whether the
   two plain spans should be targets, dark-mode/horizontal-gap re-measures; api-server fails identically at the base
   in this sandbox (17 vs 18, zero api files in the diff) because those suites want a database.
5. Offer: when `index.css` unlocks, one rule replaces all nine inline styles and the three tag pins go back to their
   original form; until then any new footer link must use the shared value or the lock fails. Checklist 12/12 ticked
   in the PR body.

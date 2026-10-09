# 406-R — Hero horizontal overflow

**Status:** Scoped hero fix is in a draft PR. The full-page acceptance check still fails on `/stone` at mobile width because separate content remains out of bounds; that content was not changed in this scope.  
**Evidence checked:** 2026-10-09 22:43 Asia/Bangkok  
**Preview origin:** `http://127.0.0.1:80`  
**Branch:** `fix/replit-hero-horizontal-overflow`  
**Branch-head SHA:** recorded in the pull request description (the GitHub Connection equivalent of `git log -1 --format=%H`).

## What changed

The three hero pseudo-elements previously used `inset: 0 -20vw`. That made their paint boxes wider than the page and caused horizontal scrolling. Setting `inset: 0` removed the scroll in most cases but also narrowed the visible gradient.

The fix extends each pseudo-element only to the matching `.page-wrap` gutter, `clamp(18px, 5vw, 76px)`, then adds the same two gutters back into `background-size`. This keeps the original 20vw bleed width and centered gradient, while bounding the pseudo-element to the page-wrap edges. It does not use `overflow` clipping on `html` or `body`, and does not modify pricing, API data, `index.html`, `/admin`, or `/price-guide`.

The browser measurement confirmed that each pseudo-element spans exactly the document client width: 1,425px on the three desktop target pages and 390px on mobile. The side-by-side captures show the gradient still reaching both viewport edges at its original scale. The preview continued to report certificate errors for remote image resources, so those images were unavailable in both sets of captures; the CSS gradient itself was visible.

## Measurements

The production values below are the baseline supplied with this assignment; no production writes were made.

### Supplied production baseline

| Viewport | `/` | `/stone` | `/quote` | `/price-guide` |
|---|---:|---:|---:|---:|
| 1440×900 | 1425→1641 (**216px**) | 1425→1641 (**216px**) | 1425→1641 (**216px**) | 1425→1425 (**0px**) |
| 390×844 | 390→449 (**59px**) | 390→478 (**88px**) | 390→449 (**59px**) | Not supplied |

Each cell is `clientWidth → scrollWidth (overflow)`.

### Local preview before and after

| Route | Viewport | Before | After |
|---|---|---:|---:|
| `/` | 1440×900 | 1425→1641 (**216px**) | 1425→1425 (**0px**) |
| `/stone` | 1440×900 | 1425→1641 (**216px**) | 1425→1425 (**0px**) |
| `/quote` | 1440×900 | 1425→1641 (**216px**) | 1425→1425 (**0px**) |
| `/price-guide` | 1440×900 | 1440→1440 (**0px**) | 1440→1440 (**0px**) |
| `/` | 390×844 | 390→449 (**59px**) | 390→390 (**0px**) |
| `/stone` | 390×844 | 390→470 (**80px**) | 390→470 (**80px**) |
| `/quote` | 390×844 | 390→449 (**59px**) | 390→390 (**0px**) |
| `/price-guide` | 390×844 | 390→390 (**0px**) | 390→390 (**0px**) |

The `/price-guide` preview response is the SPA fallback; its document returned HTTP 200 and remained at zero overflow. The local desktop client width is 1,440px there because that page has no vertical scrollbar; the target pages report 1,425px at the same 1,440px viewport.

### Measurement used

At 1440×900 and 390×844, in the preview page console:

```js
(() => {
  const d = document.documentElement;
  return {
    clientWidth: d.clientWidth,
    scrollWidth: d.scrollWidth,
    over: d.scrollWidth - d.clientWidth,
  };
})()
```

### Remaining separate overflow

After the hero change, `/stone` at 390×844 still measures 80px of document overflow. The stone selection summary text (`.stone-search-row > span`) reached x=463, and a fixed toast list reached x=470. These are separate from the hero pseudo-element, which ends at x=390. Per the assignment's scope rule, neither was changed here. They are proposed as a separate mobile-layout follow-up; broad page clipping would hide the issue rather than fix it.

## Regression and route checks

- New CSS regression test against the unmodified `main` stylesheet: **failed**, as required. It reported actual inset `0 -20vw` versus expected `0 calc(0px - clamp(18px, 5vw, 76px))`.
- Same regression test against the fix: **1 passed, 0 failed**.
- `pnpm --filter @workspace/knight-basins run typecheck`: **passed**.
- CI-equivalent non-browser test set: **1,119 passed, 0 failed, 0 skipped**.
- The package's unfiltered `pnpm --filter @workspace/knight-basins test` run reported **1,130 passed and 23 failed**, in browser cases with timeouts/races. A serialized rerun with the API workflow stopped did not finish within 300 seconds; browser verification therefore remains incomplete. These failures are reported rather than represented as passing.
- The 12 public preview routes returned HTTP 200: `/`, `/portfolio`, `/stone`, `/quote`, `/studio`, `/sketch`, `/site-prep`, `/studio-guide`, `/readme`, `/updates`, `/track`, and `/handover`.
- No production POST, PUT, or DELETE requests were made.

## Before/after screenshots

Each comparison contains desktop and mobile captures from before and after the CSS change.

### Home — `/`

![Home before and after comparison](evidence/hero-overflow-home-comparison.jpg)

### Stone — `/stone`

![Stone before and after comparison](evidence/hero-overflow-stone-comparison.jpg)

### Quote — `/quote`

![Quote before and after comparison](evidence/hero-overflow-quote-comparison.jpg)

## Files in the draft PR

The PR is limited to six files: the shared hero CSS, one CSS regression test, this report, and three comparison images. It does not change any out-of-scope source or data files.

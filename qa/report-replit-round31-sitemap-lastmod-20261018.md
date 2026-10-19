# 469-R — sitemap lastmod: source changes and acceptance evidence

## Provenance and scope

- Repository: Knightfurnich/KnightBasins-Source.
- Exact main baseline: `25c6970302602443dddff79e31d70e73a95bf481`.
- Runner: Replit Agent; Linux 6.18.57 x86_64; Node 24.13.0.
- Local checks: 19 October 2026, 13:49 Asia/Bangkok (UTC+07).
- New branch: `replit/469r-sitemap-lastmod`; PR targets main.
- Authoritative delivered head SHA, immutable green/red CI run URLs and full-suite
  totals are recorded in the PR acceptance comment and GitHub Checks. This avoids
  claiming that local targeted tests are the full CI suite.
- Only `public/sitemap.xml` lastmod values, the new
  `test/sitemap-lastmod.test.ts`, and `qa/**` are submitted.
- No robots/LLM/IndexNow files, src, API server, deployment files, workflows,
  prices, business text or database data are changed. No push to main, merge or
  deployment was performed. GitHub operations use the installed connection only.

## A — before/after, all twelve rows in the original order

Dates follow the owner's confirmed table in `qa/job-469-replit-sitemap-lastmod.md`.
These are the historical change dates, not today's date or a future date.

| Path | Before | After | Reason / evidence |
|---|---|---|---|
| `/` | 2026-10-10 | **2026-10-12** | 463-C: LINE name, network label, map/head-office customer text |
| `/portfolio` | 2026-09-25 | 2026-09-25 | Skipped: no confirmed route-specific content change date |
| `/stone` | 2026-10-10 | **2026-10-13** | 467-C: customer-visible image/product labels |
| `/price-guide` | 2026-10-10 | **2026-10-13** | Owner's 467-C/468-R change-date table; later than the 12 October map change; this PR changes no fee code |
| `/site-prep` | 2026-09-25 | 2026-09-25 | Skipped: no confirmed route-specific content change date |
| `/studio-guide` | 2026-09-25 | **2026-10-13** | 467-C: dark-theme cards, FAQ and gallery |
| `/quote` | 2026-09-25 | **2026-10-13** | 463-C address/payment text on 12 October; summary changes on 13 October |
| `/studio` | 2026-09-25 | 2026-09-25 | Skipped: no confirmed route-specific content change date |
| `/sketch` | 2026-09-25 | **2026-10-13** | 466-C: dark-theme customer-visible text |
| `/readme` | 2026-09-25 | **2026-10-12** | 463-C: showroom address and network label |
| `/updates` | 2026-10-02 | 2026-10-02 | Skipped as instructed; global release date alone does not authorize a new lastmod |
| `/network` | 2026-10-05 | 2026-10-05 | Skipped: no confirmed route-specific content change date |

The before XML is preserved in `qa/images/replit-round31/sitemap-before.xml`.
Masking only lastmod contents makes before/candidate byte-identical: loc,
changefreq, priority, URL ordering, twelve-entry count, namespace and formatting
are preserved.

## C — the new guard and the release-comparison limitation

The test reads the actual shipped XML. Four tests check:

1. Exactly twelve URLs with the existing origin, paths, order, frequency and priority.
2. Exactly one real YYYY-MM-DD calendar date per URL, no future dates in Asia/Bangkok.
   Calendar round-tripping rejects impossible dates such as 2026-02-30.
3. All seven confirmed routes have lastmod at least their known deployment date.
   Five uncertain routes retain their values; they are not blanket-dated.
4. A changed declared release requires an explicit review of sitemap dates.

**Authorized fallback for universal release freshness:** `UPDATE_RELEASES` is in
`src/pages/UpdatesPage.tsx`, not `src/data`. Main's latest entry is v2.2.1,
`dateTime: "2026-10-04"` (displayed as 4 October 2569). It has no per-route
affected-page metadata. Requiring every URL to be at least this global date would
force changes to `/portfolio`, `/site-prep`, `/studio` and `/updates`, contrary to
the explicit skip instruction. Therefore criteria (1)+(2) are the universal
checks; the seven proven routes also have their own date floors.

The fourth test pins the reviewed release date, not every URL's lastmod.
When a new release is declared, it fails with an instruction to review affected
routes, update the confirmed dates and acknowledge the release review. It never
silently skips a missing or unreadable release definition.

Source evidence:
`UpdatesPage.tsx` main blob `4cabca883d574223a133e71f03c7fb113bc15ee5`.
The original customer-text/deploy checklist is
`qa/job-422-boy-customer-text-consistency.md`.

### Actual local commands and results

From the repository root:

```sh
pnpm run typecheck:libs
cd artifacts/knight-basins
node --experimental-strip-types --test test/sitemap-lastmod.test.ts
pnpm exec tsc -p tsconfig.json --noEmit
cd ../..
node qa/tools/verify-sitemap-lastmod.mjs
```

- Targeted test: **4 tests / 4 pass / 0 fail / 0 skipped**.
- Shared-library and frontend TypeScript checks: **exit 0**.
- The reversible proof uses the real XML, launches the real test and restores
  byte-for-byte contents in `finally`. Its six runs are:

| Proof | Expected and observed exit | Result |
|---|---:|---|
| Candidate | 0 | 4 pass |
| Revert `/` to stale 2026-10-10 | 1 | `stale lastmod`; 3 pass / 1 fail |
| Future date | 1 | `future lastmod`; 3 pass / 1 fail |
| Impossible 2026-02-30 | 1 | calendar-date failure |
| Remove one URL | 1 | twelve-URL and required-route failures |
| Restore candidate | 0 | 4 pass; original bytes restored |

Raw commands/output: `qa/images/replit-round31/reversible-proof.log`,
`typecheck-libs.log`, `typecheck-web.log`.

Full unit testing is the existing release CI job, whose file discovery excludes
`*.browser.test.ts`. No workflow/package script is changed.
The literal package `pnpm run test` also includes real-browser integration cases;
it is not presented as an equivalent safe unit-only command or claimed as run here.
Reviewer's supplied main baseline is web 1513 total / 1504 pass / 0 fail / 9 skipped,
API 1329 / 1329 / 0. It was not independently rerun locally. Actual candidate
CI totals and green/red links are supplied in the PR comment, not inferred from
those baseline numbers.

## B/D — production checks: explicitly pre-deploy, not final acceptance

At 13:49 Thailand time:

```sh
curl --fail --silent --show-error https://knightbasins.com/sitemap.xml
node qa/tools/check-sitemap-production.mjs
```

- Production XML and the exact main baseline were **byte-identical**.
- All **12 public routes returned HTTP 200**.
- Candidate vs live differs in **exactly seven lastmod rows**, as expected before
  an authorized merge/deployment. The checker correctly exits **1**, not a false pass.
- Raw live XML and twelve-row HTTP/mismatch table:
  `qa/images/replit-round31/production-before.xml`,
  `production-before-check.log`.

**After-deploy equality is NOT verified yet.** This PR has not been merged or
deployed, and the agent is not authorized to do so. After the reviewer authorizes
and performs deployment, rerun:

```sh
node qa/tools/check-sitemap-production.mjs
```

Acceptance requires exit 0, every loc/lastmod/changefreq/priority row equal in the
same order, twelve HTTP 200 responses, and the no-UI-source-change scope check.
Do not relabel the pre-deploy baseline as post-deploy proof.

## Five-line summary

Changed: seven confirmed historical lastmod dates; five uncertain routes preserved; one guard plus QA evidence/tools.
Tests: local guard 4/4, typechecks exit 0, stale/future/calendar/missing-URL red controls and restored green proved.
Not yet verified: production equality after an authorized deployment; full CI outcomes live in the PR acceptance comment.
Risk: until deployment, production intentionally still serves the seven old dates; global release dates do not identify individual page changes.
Next: review CI/source scope, authorize merge/deploy separately, then run the read-only production checker; no merge/deploy by the agent.

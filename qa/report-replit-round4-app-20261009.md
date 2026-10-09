# Knight Basins — Round 4 Replit app QA

**Run date:** 2026-10-09  
**Scope:** Assignment 401-R, storefront and app only. The separate API/data and independent external-audit assignments were not run.

## Summary

**Result: production verification blocked; local preview has failures.** The Hostinger hostname documented for the storefront did not serve the app during this check: normal TLS verification reported a certificate-name mismatch, and GET requests with certificate verification disabled returned `404 page not found`. This blocked production verification of the Round 4 price feed, hidden colours, and page rendering.

The local Dev/preview served the 12 public routes at both tested viewport sizes. The quote form created one synthetic test quote through the local API, without sending a notification. The preview also showed certificate-related resource failures, a missing `/price-guide` route, and horizontal overflow on three desktop pages.

No production POST or DELETE requests were made. No real account was used. No application code was changed.

## Environments and method

- **Production target:** the Hostinger storefront hostname documented in `deploy/hostinger/README.md`.
- A normal TLS request failed because the certificate had no subject name matching that hostname. A public-browser capture displayed `404 page not found`. To record HTTP status despite the TLS error, the read-only production GET checks were repeated with certificate verification disabled; the response was still 404.
- **Dev/preview:** Chromium against the Replit preview, at **1440 × 900** (desktop) and **390 × 844** (mobile). The Vite proxy routed `/api` to the local API workflow on port 8080.
- The preview catalog check used `GET /api/catalog`. The image checks used HEAD requests to ten distinct image URLs from that Dev response.
- The quote test used the normal preview form and a synthetic contact value. It clicked the regular “generate quote” action, not the Telegram notification action.

## A. Twelve public pages — Dev/preview

All 12 routes returned a document response of **200** in both viewports. Console/resource errors below are counts observed during each page load; the repeated errors were `net::ERR_CERT_AUTHORITY_INVALID`.

| Route | Console errors desktop/mobile | Failed requests desktop/mobile | Broken images desktop/mobile | Horizontal overflow desktop/mobile |
|---|---:|---:|---:|---|
| `/` | 17 / 8 | 17 / 8 | 8 / 4 | Yes / No |
| `/portfolio` | 0 / 0 | 0 / 0 | 0 / 0 | No / No |
| `/stone` | 35 / 18 | 35 / 18 | 36 / 18 | Yes / No |
| `/quote` | 0 / 0 | 0 / 0 | 0 / 0 | Yes / No |
| `/studio` | 1 / 1 | 1 / 1 | 0 / 0 | No / No |
| `/sketch` | 0 / 0 | 0 / 0 | 0 / 0 | No / No |
| `/site-prep` | 0 / 0 | 0 / 0 | 0 / 0 | No / No |
| `/studio-guide` | 0 / 0 | 0 / 0 | 0 / 0 | No / No |
| `/readme` | 0 / 0 | 0 / 0 | 0 / 0 | No / No |
| `/updates` | 0 / 0 | 0 / 0 | 0 / 0 | No / No |
| `/track` | 0 / 0 | 0 / 0 | 0 / 0 | No / No |
| `/handover` | 0 / 0 | 0 / 0 | 0 / 0 | No / No |

The preview met the route-load check, but **did not meet the no-console-error check**. The root and stone pages had the most failed external image requests. Desktop horizontal overflow was detected on `/`, `/stone`, and `/quote`; no mobile overflow was detected on the 12 routes.

## B. `/stone` and `/price-guide`

- Dev `GET /api/catalog` returned 200. Its payload contained 30 active basins, 72 active installed-stone records, and 71 active sheet-stone records; none of those records had `active: false`.
- The preview `/stone` page displayed `12,000` in both tested viewports. The Dev catalog response contained 19 sheet-stone records with a price exactly equal to 12,000.
- **Hidden-colour selection after the Round 4 production feed change: not verified.** Production could not be reached successfully. The Dev catalog data is not evidence that the production `hidden_colours` feed or its seven hidden colours are excluded from storefront choices.
- `/price-guide` is not registered as a local app page: the SPA returned its not-found content while the document itself returned 200. The production GET returned 404. **The requested price-guide check failed.**

## C. `/quote` form — Dev/preview only

- Added `KF001`, completed the email field with synthetic test data, and submitted using the regular quote-generation button.
- The preview sent one `POST /api/leads` to the local preview origin; the API returned **200** and the browser navigated to `/quote/view`.
- The Telegram notification button was not clicked, and no notification POST was observed.
- **Production writes: none.** The test created a synthetic quote through the local Dev/preview flow.

## D. `/admin/*` login screens

`/admin`, `/admin/ai-cost`, and `/admin/catalog` displayed the password login screen in both desktop and mobile viewports. Each had a password field and login text. No credentials were entered and no account was authenticated.

## E. Ten image URLs

Ten distinct URLs were sampled from image fields in the Dev `GET /api/catalog` payload. Every URL contained `srv1964473`; every HEAD check returned **404** (`text/plain`) when retried with certificate verification disabled. The normal TLS failure and the production storefront 404 mean none of these images can be counted as a verified production 200.

| # | Image URL | HEAD |
|---:|---|---:|
| 1 | `https://knightbasins.srv1964473.hstgr.cloud/api/uploads/catalog-mua03t7d-3e99dedba004d47f.jpg?v=mua03t7d` | 404 |
| 2 | `https://knightbasins.srv1964473.hstgr.cloud/api/uploads/catalog-mu42jwa9-439b97503d5c1e86.jpg?v=mu42jwa9` | 404 |
| 3 | `https://knightbasins.srv1964473.hstgr.cloud/api/uploads/catalog-mua052m4-dda19b739017a596.jpg?v=mua052m4` | 404 |
| 4 | `https://api.srv1964473.hstgr.cloud/kb/images/basin-hd/KF002.jpg` | 404 |
| 5 | `https://knightbasins.srv1964473.hstgr.cloud/api/uploads/catalog-mua05rff-0a5b2aa03a5e73f7.jpg?v=mua05rff` | 404 |
| 6 | `https://api.srv1964473.hstgr.cloud/kb/images/basin-hd/KF003.jpg` | 404 |
| 7 | `https://knightbasins.srv1964473.hstgr.cloud/api/uploads/catalog-mua060bn-e00a5572f3851e3a.jpg?v=mua060bn` | 404 |
| 8 | `https://knightbasins.srv1964473.hstgr.cloud/api/uploads/catalog-mu42k5m7-b95ec8cf75483fcb.jpg?v=mu42k5m7` | 404 |
| 9 | `https://knightbasins.srv1964473.hstgr.cloud/api/uploads/catalog-mua06fsz-43fdd862d610d949.jpg?v=mua06fsz` | 404 |
| 10 | `https://api.srv1964473.hstgr.cloud/kb/images/basin-hd/KF005.jpg` | 404 |

**Image result: 0/10 passed** the requested `200` and no-`srv1964473` conditions.

## Production GET results

Using the documented Hostinger hostname, GET checks returned `404 page not found` for `/`, `/portfolio`, `/stone`, `/quote`, `/studio`, `/sketch`, `/site-prep`, `/studio-guide`, `/readme`, `/updates`, `/track`, `/handover`, `/price-guide`, `/admin`, `/admin/ai-cost`, and `/admin/catalog`. A direct TLS-verified request failed before an HTTP response because the certificate name did not match the hostname.

## F. Pre-PR checks and findings

- `pnpm --filter @workspace/knight-basins run typecheck` — **passed**.
- Non-browser Knight Basins unit tests — **1,118 passed, 0 failed, 0 skipped**. Browser tests were excluded from this unit-test count.
- **Highest-priority finding:** the documented production storefront hostname currently has a TLS-name mismatch and returns 404 for every tested route. Production page/feed checks remain blocked.
- **High:** the ten sampled image URLs use the legacy server-ID hostname and returned 404; preview console errors and broken-image counts are concentrated on `/` and `/stone`.
- **High:** `/price-guide` has no local route and returns not-found content.
- **Medium:** desktop horizontal overflow was detected on `/`, `/stone`, and `/quote`.

The report is limited to assignment 401-R. It does not audit API routes, feed-generation logic, cron schedules, databases, or the separate 402-C / 403-Q scope.

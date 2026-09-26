# Knight Basins API — Security & Vulnerability Audit Report

**Auditor:** ชัย (Security Audit & Vulnerability Assessment) · **Date:** 26 ก.ย. 69
**Method:** Static code review + local unit testing only. No requests were sent to any production server; nothing here involved a pentest, DoS, or brute-force attempt against a live host, per FORBIDDEN in `qa/job-84-chai-security-audit-and-vulnerability-assessment.md`.
**Scope reviewed:** `artifacts/api-server/src/**` (app bootstrap, admin auth, rate limiting, file uploads, all `admin-router.ts` routes, `leads.ts`, `places.ts`, `sketch-vision.ts`) plus `pnpm audit` across the workspace.

## Risk Summary

| # | Severity | Area | Finding | File:Line |
|---|----------|------|---------|-----------|
| 1 | **High** | API Abuse / Cost Bleeding | Per-IP rate limiting derives `req.ip` from `X-Forwarded-For` under a hard-coded `trust proxy: 1`, with no code-level guarantee that exactly one trusted reverse proxy sits in front of the process. If that assumption doesn't hold in the real deployment topology, every IP-keyed limiter (admin login brute-force, `/sketch/analyze`, `/places/autocomplete`, sketch/slip uploads) can be bypassed by rotating the header per request. | `artifacts/api-server/src/app.ts:12`, `artifacts/api-server/src/lib/rate-limit.ts:20-22` |
| 2 | **Medium** | Secret Leakage / Error Hygiene | `analyzeSketchImage`'s generic `catch` interpolates the raw native `error.message` (not just Gemini's own structured API error) into the `notes` field of a **200 OK** response returned straight to the calling client on `/api/sketch/analyze`. An unexpected native exception (TLS/DNS/fetch-internal wording) could leak infrastructure detail externally. | `artifacts/api-server/src/lib/sketch-vision.ts:381-385` |
| 3 | **Medium** | API Abuse / Cost Bleeding | The rate limiter's bucket store is an in-process `Map` (`lib/rate-limit.ts:15`). It is correct for the current single-instance deployment, but nothing in the code enforces that constraint — if the api-server is ever scaled to N replicas without a shared store (Redis, etc.), every IP-based cap (login brute-force, AI-cost endpoints) becomes effectively N× weaker with no error or warning. | `artifacts/api-server/src/lib/rate-limit.ts:15-63` |
| 4 | **Low** | API Abuse / Cost Bleeding | `POST /admin/session` (login) has no defense beyond the 5-req/60s per-IP limiter (Finding #1). Once #1 is fixed, consider a secondary limiter keyed independently of IP (e.g. a fixed-size global sliding window) as defense-in-depth against a genuinely distributed brute-force attempt. | `artifacts/api-server/src/routes/admin-router.ts:1341,1389` |
| 5 | **Info** | Dependency Vulnerabilities | `pnpm audit --audit-level=high` reports **0 known vulnerabilities** across all workspaces as of this audit. | n/a |
| 6 | **Info** | Admin Authorization | Every `/admin/*` route is gated: `router.use("/admin", createAdminAuthMiddleware(database))` (line 1408) runs before all permission-checked handlers, and each handler additionally calls `requireAdminPermission` / `requireAnyAdminPermission` / `requireAdminOwner`. The only 3 routes with no such guard are `GET/POST/DELETE /admin/session` themselves (login/logout/session-check) — correctly public since they *are* the auth boundary. **No route escapes as accidentally public.** Verified against a full `grep` of all 63 `router.*` registrations in the file. | `artifacts/api-server/src/routes/admin-router.ts` |
| 7 | **Info** | File Upload Security | `readMultipartForm`/`saveUploadedMedia` are well hardened: filenames are always server-generated (`crypto.randomBytes` + fixed regex `MANAGED_FILENAME`), `path.basename` + a resolved-path prefix check block traversal, and the file is opened with `O_CREAT\|O_EXCL\|O_NOFOLLOW` (blocks symlink races and overwrite). Both the declared `Content-Type` **and** binary magic-byte signatures (`hasFileSignature`) are checked — a renamed/disguised file is rejected either way. No SVG/HTML upload path exists, eliminating stored-XSS-via-upload. No fix needed. | `artifacts/api-server/src/lib/image-upload.ts:160-179,303-341` |
| 8 | **Info** | Secret Leakage / Error Hygiene | The shared Express error handler (`app.ts:78-86`) never echoes `error.message`, `error.stack`, or any raw error object to the client — it logs the full error server-side via `pino` and always replies with a fixed generic message (with one safe carve-out: Postgres unique-violation `23505` → generic "already exists" message). Confirmed empirically in `security-audit.test.ts` by forcing a genuine DB-layer connection failure through an authenticated admin route. | `artifacts/api-server/src/app.ts:78-86` |
| 9 | **Info** | Secret Leakage | No hardcoded API keys, passwords, or tokens found in `artifacts/api-server/src`. All session/invite/API-key/OAuth-state tokens use `crypto.randomBytes` (never `Math.random`). The only matched string resembling a secret format (`"kbw_"`) is a public prefix constant used to *recognize* an admin API key's shape, not a real key. | `artifacts/api-server/src/lib/admin-api-keys.ts:4`, `artifacts/api-server/src/middlewares/admin-auth.ts:12` |

## Detailed Findings & Fixes

### Finding 1 (High) — IP-based rate limiting depends on an unverified proxy-hop count
**What:** `app.ts:12` sets `app.set("trust proxy", 1)`, so Express derives `req.ip` by trusting exactly one hop of `X-Forwarded-For`. Every rate limiter in the app (`createRateLimiter` in `lib/rate-limit.ts:20-22`) keys its bucket on that `req.ip` by default. This is only correct if the api-server sits behind **exactly one** reverse proxy (Traefik, per this project's deployment) that always fully overwrites the `X-Forwarded-For` header itself and is never bypassed. Nothing in the codebase asserts or tests that topology.
**Risk:** If the container is ever reachable with one more or one fewer hop than assumed (an added CDN/WAF, a load balancer in front of Traefik, or the port being reachable directly), an external caller's own `X-Forwarded-For` value is trusted as the "real" client IP. Rotating that header on every request gives each request a fresh rate-limit bucket, defeating: admin-login brute-force protection (`admin-login`, 5/min), `/sketch/analyze` cost-bleed protection (5/10min), `/places/autocomplete` (30/min), and the sketch/slip upload limiters (5/10min each).
**Verified in `security-audit.test.ts`:** `describe("Area 1: IP-based rate limiting can be bypassed via X-Forwarded-For")` demonstrates that, against the real bundled `app.ts` (with its real `trust proxy: 1`), 6 login attempts each carrying a *different* `X-Forwarded-For` value all land in distinct buckets and never trip the 429, while 6 attempts from a fixed apparent IP correctly trip it on the 6th. This is not a report of a hypothetical — it is the app's actual current behavior under test.
**Fix:**
1. Confirm and document the exact number of trusted proxy hops in the real production network path (Traefik container → api-server container, per `project_knight_basins.md`), and pin `trust proxy` to that exact value (or an explicit trusted-IP list via `app.set("trust proxy", ["<traefik-ip>"])`) rather than a bare `1`.
2. Add an infra-level guard (Traefik/nginx config) that always strips any client-supplied `X-Forwarded-For` before appending its own, so a client can never inject entries upstream of the proxy's own hop.
3. Consider keying the admin-login limiter additionally on the submitted username/context (there is none here — password-only login — so a secondary non-IP signal is limited; prioritize #1 and #2).

### Finding 2 (Medium) — Native exception text can reach an external client via `/sketch/analyze`
**What:** In `sketch-vision.ts:381-385`, the `catch` block for a Gemini Vision call builds a user-visible message with `` `เรียก Gemini Vision ไม่สำเร็จ: ${error.message}` `` for any error that isn't an `AbortError`. This differs from the earlier `if (!response.ok)` branch (line 373-375), which only uses Gemini's own structured `error.message` from its JSON response — the catch block instead can carry a raw Node/undici exception message (e.g. TLS, DNS, or fetch-internal wording) which is then stored as the `notes` field of an item in the **200 OK** JSON array returned directly to the caller of `POST /api/sketch/analyze`.
**Risk:** Low-to-moderate information disclosure of internal networking/runtime detail to an external, only rate-limited (not authenticated) endpoint.
**Fix:** Replace the interpolated message with a fixed generic string (e.g. `"เรียก Gemini Vision ไม่สำเร็จ กรุณาลองใหม่"`), and log `error` (the real object) server-side via the existing `logger`, mirroring how `app.ts`'s global handler already treats unexpected errors.

### Finding 3 (Medium) — In-memory rate-limit store assumes a single process
**What:** `buckets = new Map()` in `lib/rate-limit.ts:15` is process-local. This is fine today (single api-server container per the current Docker Compose setup), but is a silent footgun: nothing fails loudly if the service is later scaled horizontally.
**Fix:** No change required now. Before any horizontal scaling of `api-server`, migrate `createRateLimiter` to a shared store (Redis `INCR`/`EXPIRE`, or equivalent) — leave a comment at the `buckets` declaration noting this constraint so a future scaling change doesn't silently reintroduce Finding 1's bypass at a larger blast radius.

### Finding 4 (Low) — No non-IP defense-in-depth on admin login
Already covered under Finding 1's fix list; tracked separately because it is optional hardening rather than a bug, and only matters once Finding 1 is closed.

## Dependency Audit (Area 5)
```
pnpm audit --audit-level=high
No known vulnerabilities found
```
Run against the full monorepo lockfile on 26 ก.ย. 69. No High/Critical advisories in any of the 9 workspaces.

## What Was Checked and Found Sound (no fix needed)
- **Admin route-guard coverage** — 100% of non-auth `/admin/*` routes carry a permission middleware (Finding 6).
- **File upload hardening** — MIME allow-list + magic-byte verification + path-traversal-proof filename handling + no executable/HTML/SVG upload types (Finding 7).
- **Error hygiene at the app boundary** — the shared error handler never leaks stack traces, file paths, or raw DB errors (Finding 8), verified with a real forced DB failure in the test suite.
- **Secret hygiene** — no hardcoded secrets; all tokens are CSPRNG-generated (Finding 9).
- **CSRF posture** — the admin session cookie is `httpOnly`, `sameSite: "lax"`, and conditionally `secure`; combined with the strict CORS allow-list in `app.ts:33-58` (only configured origins, no wildcard), cross-site state-changing requests cannot carry the session cookie. Acceptable as-is; an explicit CSRF token would be defense-in-depth but is not required given this posture.
- **Security headers** — `app.ts:59-69` sets a restrictive CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and HSTS in production.

## Evidence Index
See `artifacts/api-server/test/security-audit.test.ts` for the executable proof behind Findings 1, 6, and 8 (route-guard coverage, IP-bypass reproduction, and error-handler sanitization), run via `node --experimental-strip-types --test artifacts/api-server/test/security-audit.test.ts`.

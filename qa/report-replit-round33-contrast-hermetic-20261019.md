# 471-R revision 2 — classify rows; wait for 474-C before final acceptance

## Current status: DRAFT, awaiting 474-C

Read the latest job's **ฉบับแก้ 2** from main
`8714e4506c817ac4a5a4a4e054ff8a2c0f119ad3`, including merged 472-C.
The actual PR head/base and Thai handoff time are pinned in the PR comment.
No source colour is changed by this PR; refreshed source is downloaded from
main only to build and verify its already-merged colour fix.

### Per-row policy, not new exceptions

| Row category | Examples | Minimum | Criterion |
|---|---|---:|---|
| Text | Values, placeholders, numeric quantities, short text/badges | 4.5 | WCAG 1.4.3 |
| Large text | At least 24px, or 18.66px bold | 3.0 | Existing large-text rule |
| Meaningful UI | SVG-only action buttons, action glyph ×/+/−, checkbox/radio boundaries, input boundaries | 3.0 | WCAG 1.4.11 |
| Pure decoration | aria-hidden companion SVG duplicating a rendered text label | Not measured | Explicit selector/reason in excluded evidence |

Each measured and unmeasurable row carries `category`, `threshold` and
`criterion`; decorations have a reason and no pass verdict. A sole visual action
icon is **not** decorative merely because its button has an aria-label.
SVG title text is not mistaken for a visible text label.
An ordinary × in text remains text, while an actionable × button is UI.
The LINE exception is unchanged and is still the only contrast exception.

Input values and placeholders are measured as text independently of their
border's UI row. Textareas use the padded content box, not a vertically centred
single-line baseline, so wrapped/top-aligned placeholders cannot silently vanish.
Visible required control pixels that cannot be sampled still fail closed.

Controlled Chromium proof at **1440 and 390**: the same approximately 3.04
foreground passes icon/checkbox/radio/input-border rows at 3.0, while failing
normal text, input values and placeholders at 4.5. The textarea fixture includes
a tall wrapped placeholder. Large text retains 3.0. Decorative SVG exclusions
include reasons; an icon-only button with aria-hidden SVG/title stays measured.

The three-round comparator now also compares the actual decoration exclusions,
not just their total count. The unit test changes a third-round exclusion while
preserving other counts and proves that comparison fails.

### Verification performed now

- Final targeted preview/readiness/theme/policy suite: **91/91 pass**, 0 fail/skip.
- The storefront **production build**, prerender of all 12 public routes, and
  production-asset verification pass against refreshed main.
- Browser controls pass (including F/G, occlusion/refresh/fail-closed controls,
  and quantity undo/restore at both widths). Final classification-only rerun
  additionally covers SVG title and wrapped textarea placeholders.
- Source-472-C quantity verification is recorded separately in
  `rev2-quantity-rows.json` and the four corresponding raw logs. This is targeted
  cart verification, **not** a full-source H or three-round C acceptance.
- Option B remains unchanged: timeout 5 seconds, at most three attempts, logs
  method/path/status/ms plus attempt/cache metadata. No JSON-only/media-broken
  fixtures are submitted. The new request log is `rev2-contrast-api.log`.

Actual targeted `/quote#cart` on the rebuilt main with 472-C:

| Width | Theme | Checked | Quantity glyphs measured | Quantity ratio range | Quantity failures |
|---:|---|---:|---:|---|---:|
| 1440 | dark | 177 | 6 | 13.74 | 0 |
| 1440 | light | 177 | 6 | 10.75–10.94 | 0 |
| 390 | dark | 167 | 6 | 13.74 | 0 |
| 390 | light | 167 | 6 | 10.94 | 0 |

Each capture has the two expected seeded product rows and two quantity boxes.
The two numeric rows require 4.5; the four action icons require 3.0.
**The quantity controls no longer occur in the failure list.**

Remaining findings are not hidden: the new input-border rows identify
**18 customer-form boundaries** at **1.61 dark /1.24–1.26 light**, below UI 3.0,
at both widths. Light placeholders are **2.74–2.76**, below text 4.5; dark
placeholders are **6.15**. Checkbox/badge failures and LINE remain recorded.
All selectors/thresholds are in `rev2-quantity-rows.json`; raw route logs retain
every measured row. David should consider the border findings with the 474-C
owner before final H acceptance. No source colour or exemption was changed.

### Explicit wait condition

At the start of this revision, main contains **472-C** but not **474-C**, and
the only open PR is this QA draft. Do **not** claim final C/E/H from earlier
heads or from the targeted cart measurements.

After **474-C merges**, refresh main and rebase again, then collect **C**:
three consecutive sweeps per width on the same final head and a genuinely
successful `Compare both contrast rounds`; **E**: final-head CI/unit/A4; **H**:
the actual complete built-source sweep has only the LINE exception left.
Normal automatic PR CI is not a substitute for that post-474-C acceptance.
The historical full web/API totals below are from revision 1, not this rebased
head; full final unit/A4 acceptance remains pending as instructed.

### Scope and handoff

Only scoped QA tools/contrast jobs/tests/report/evidence are submitted. The
472-C source and additional theme tests are inherited from main, not a new
colour edit. The main version of the shared guard file is preserved, with only
the existing per-round/aggregate timeout assertion transplanted.
No main push, merge, deploy or production database access. GitHub Connection only.

---

## Historical revision 1 evidence — superseded for current acceptance

The following measurements/logs are retained as historical evidence only.
In particular, their old 4.5-on-every-icon verdicts and pre-472-C white quantity
backing are **not** the current row policy or current quantity state.

## Status: PARTIAL — do not merge as an accepted green gate yet

Baseline: GitHub main `2072da75e7b460237f8f32b08b472f543be5a2c5`.
Before PR creation, main advanced to
`5cb050677077ccd02cba0ada311599d2400c8f8d` with team/onboarding/queue documents
only. No scanner, workflow, tests or application source changed; the PR uses
that refreshed base without copying the unrelated documentation into its diff.
Runner: Replit Agent, Linux x86_64, Node 24.13.0, 19 October 2026,
Asia/Bangkok. Exact submitted head, CI status/time, final unit totals and
three-round tables belong in the PR acceptance comment after actual execution.
No pending CI result is represented here as successful.

**The application still contains the source-colour defects owned by 472-C.**
This PR deliberately does not touch application source to manufacture green.
F/G browser controls pass; H's six quantity rows demonstrably change red/green
in controlled rendering. Full-source green and the successful three-round
acceptance comparison remain unaccepted until the real source defects are fixed
by their owner. Additional newly visible failures must not be allowlisted.

## A — option B, not a claim of a hermetic preview

Option A was investigated with public catalogue and portfolio snapshots, but
the real render also requests product and portfolio images under
`/api/uploads/...`. Replacing the two JSON endpoints alone produced missing
images, changed pixel backgrounds and misleading coverage. Those intermediate
snapshots are **not shipped** or claimed as acceptance evidence. Adding a binary
media snapshot library was not part of the two JSON fixture paths in this ticket.

Choose the explicitly permitted **option B** instead:

- Public GET proxy: `AbortSignal.timeout(5000)` covers response and body reads.
- At most **three** attempts for network errors, HTTP 429 and HTTP 5xx.
  Non-transient HTTP errors are returned explicitly, not substituted with data.
- Successful response bytes, including public images, are cached for this
  preview process; concurrent identical requests share a request. Failures are
  not cached. The three consecutive rounds use the same successful bytes.
- Every completed incoming request logs one line:
  `method path final-status total-ms {"source":...,"attempts":[...]}`
  including each upstream attempt's status and elapsed ms. Cache hits and
  exhausted retries are distinguishable.
- Unknown writes return 405. The existing sketch-analysis POST remains a
  local generated test fixture. No production writes, cookies or auth headers
  are sent upstream.

This remains network-dependent at first successful retrieval; it is **not**
called hermetic. Exhausted retries or unavailable required data must fail closed.
Data freshness is **not** this gate's job; `Validate release contents` retains
that responsibility. Refreshing preview data means restarting the preview, not
silently replacing its cache midway through the three rounds.

## Root evidence, independently downloaded

Main run [39258254257](https://github.com/Knightfurnich/KnightBasins-Source/actions/runs/39258254257),
head `984165e15320428fe2148faedfd004bde7a2d8fb`:

- Both round-1 jobs failed; both round-2 jobs passed; comparison was skipped.
- Downloaded artifact `contrast-390-round1`, ID **12189061634**, digest
  `sha256:dc02604a323075d07f470d031bf0e32e420c7ebcd397da29bf3610c72e5f0c20`.
- Its `tmp/contrast-api.log` is **0 bytes**.
- Its actual pixel log ends:

```text
ยังไม่ได้ตรวจ (หน้าโหลดไม่จบ: /portfolio) — {"ok":false,"pending":0,"responses":{"/api/portfolio":0},"products":0,"colors":0,"prices":0,"gallery":0,...}
```

That is a real network/readiness failure, not a colour failure. The replacement
request log is retained in every new CI artifact, even when a scan fails.

## B — startup readiness

`wait-contrast-preview.mjs` requires **all three** endpoints:
`/`, `/api/catalog`, `/api/portfolio`, HTTP 200 and consumed expected bodies.
The bounded deadline prints each missing endpoint's exact Thai diagnostic,
prints both service logs, and exits **2**. A real child-process test serves
successful HTML/catalogue but HTTP 503 Portfolio: it exits 2 for
`/api/portfolio`, never READY.

The real proxy is tested in a child process with a controlled fetch transport:
two HTTP 503s then HTTP 200 require exactly three upstream attempts; repeating
the successful GET uses the byte cache; two failed GETs make six attempts and
both return 502; a write returns 405. Actual log format/statuses are asserted.

## F — why the quantity was invisible, and what is now sampled

1. The old collector used `if (own.length < 3) return`: `"1"` and `"2"` were
   discarded before either measured or unmeasurable output.
2. `own` read only direct text nodes. Input **values** are DOM properties and
   SVG-only buttons have no own text nodes, so neither became a candidate.
3. A minimum 25 changed pixels also rejected tiny visible glyphs. New short
   text/control candidates require a real changed pixel; contrast thresholds
   themselves are unchanged.
4. An opaque-glyph colour-distance test is unsuitable for thin, rotated
   checkbox strokes and disabled/antialiased icons. Their own ink is isolated
   by the paired images; computed control foreground also includes ancestor
   opacity. This does not lower the 4.5 threshold or exempt a failure.

The collector now records:

- Text input/textarea **values**, actual computed ink and text box.
- SVG-only buttons' computed stroke/fill (`currentColor` resolved by Chromium).
- Custom checkbox outline/checkmark ink, including pseudo-elements.
- All nonempty 1–2-character own text nodes, including quantity numbers.
- Stepper membership, number/icon coverage, sampled backing, disabled state,
  occlusion evidence and explicit unmeasurable diagnostics.

Password/file/hidden controls are not value-text candidates. Existing display,
visibility, size, ancestor clipping and moving-track rules still apply. Native
checkbox input nodes hidden by the application are represented by their painted
custom span, not a nonexistent visible native glyph. A visible control whose
pixels cannot be measured fails closed; it does not quietly pass.

## G — seeded cart contract

The scanner seeds KF001 quantity 2 and KF009 quantity 1. Before measuring
`/quote#cart` it requires exactly two product rows, two visible `.line-quantity`
boxes, the expected SKU/quantity in each, and two buttons in each box. API,
fonts/images and two stable observations remain mandatory. Reload is awaited,
not replaced with the old four-second sleep.

After capture, exactly **six measured stepper rows** are required. A missing
icon/number cannot be accepted simply because the DOM boxes exist.

The controlled missing-row case actually renders only one row and one quantity
box: **exit 2**, no measured JSON, exact diagnostic:

```text
ยังไม่ได้ตรวจ (หน้าโหลดไม่จบ: /quote#cart)
```

Its raw log includes `expected:2, rows:1, quantityBoxes:1, ok:false`.

## H — measured red/restored quantity pixels, and the acceptance limitation

The browser controls use the actual compiled application CSS and real theme
stylesheet, with the correct theme ancestor and UTF-8 text. Only the **test
page's** quantity backing is changed. No application CSS is modified.

| Controlled real-CSS render | 1440 | 390 | Foreground / sampled backing |
|---|---:|---:|---|
| dark, original white backing | six rows **1.16 RED** | six rows **1.16 RED** | rgb(232,239,248) / rgb(255,255,255) |
| dark, proposed restored backing | six rows **13.74 GREEN** | six rows **13.74 GREEN** | rgb(232,239,248) / rgb(22,34,56) |
| light, original white backing | six rows pass | six rows pass | Original light-theme source colours |

Input value `"17"`, one-character `"7"`, two-character `"12"`, and two custom
checkboxes are also explicitly asserted as measured. Existing overlay, partial
good/bad, fixed text, tile boundary, delayed JSON/partial DOM, Portfolio,
capture-time refresh/mutation, blocked scanner/sweep, and real error/price
controls continue to run.

These are **controlled rendering measurements, not a restored-source green CI**.
The raw scanner is a measurement producer (normally exit 0 even for bad ratios);
the **full sweep** owns colour exit 1. Final-source sweep/CI exits and exact
failing rows must be attached separately. Do not mislabel an exit-2 timeout as
H's genuine colour red.

The initial diagnostic actual-app cart already measured **145 rows** rather
than 130, with two real product rows, two quantity boxes and six quantity
glyphs. It exposed the original white-backed quantity and additional custom
checkbox / short cart-badge failures. That diagnostic used the rejected
JSON-only preview; it is not substituted for the final option-B full sweep.

### Actual final option-B full sweep, 1440 (not a controlled colour page)

The full source baseline completed **all 17 routes in both themes** with ready
data: **34 measurements**, then the full sweep returned **exit 1**, with
**13 route/theme pairs** outside the unchanged LINE exception. This is genuine
colour red, not an exit-2 readiness failure. It is **not** called accepted green.

Actual `/quote#cart`, dark and light: **145 checked**, two expected product
rows, two rendered quantity boxes, **six measured stepper glyphs**. Dark
quantity rows are **1.14–1.16** on sampled rgb(255,255,255); light quantity
rows pass (**10.75–10.94**, actual browser colours in this baseline). Disabled
state and antialiasing are reported rather than conflated with a missing row.
The new detector also exposes checkbox/short-text/control failures elsewhere.
Their colours are not changed by this QA PR.

Raw full-sweep log, exact 1440 summary and measured cart-row evidence are in
`qa/images/replit-round33/`. CI will additionally retain each width's three
rounds and full per-theme pixel JSONs; that future evidence is not inferred from
this one local round.

## C/D — three genuinely consecutive rounds and unchanged gate severity

Each width builds once, starts one preview, then runs rounds **1, 2, 3
sequentially**, retaining one response cache. Widths remain 1440 and 390.
The old ten-minute **per-round** budget is retained through `timeout 10m`;
the enclosing three-round job has 35 minutes including build/controls/A4.
This changes only contrast jobs; it does not extend or rerun unrelated jobs.

An actual colour-red round keeps its exit-1 verdict while allowing the next
round's evidence to be collected. Exit 2, timeout or missing summary stops
immediately. No failure is overwritten with a later success.

Comparison requires six complete 34-pair summaries, successful readiness,
matching commit, and identical checked counts, control/hero coverage, exclusions
and verdicts. Existing rejection of any REAL/overflow failure is retained.
The comparison runs with `always()` so a failed upstream job cannot silently
skip it. Missing evidence still fails.

**C is not accepted until the actual final-head three-round comparison passes.**
The known source defects prevent claiming an all-green acceptance now.
Keep the original LINE-only allowlist and thresholds. Existing immutable
stone-price red proof remains
[39230540157](https://github.com/Knightfurnich/KnightBasins-Source/actions/runs/39230540157):
2.63, visible price row, exit 1 at both widths.

## Tests and commands

```sh
pnpm run typecheck:libs
(cd artifacts/knight-basins && pnpm exec tsc --noEmit)
(cd artifacts/api-server && pnpm exec tsc --noEmit)
GITHUB_SHA=fixture-head node --experimental-strip-types --test \
  artifacts/knight-basins/test/contrast-hermetic.test.ts \
  artifacts/knight-basins/test/contrast-readiness.test.ts
CHROME_BIN=/repl/tools/bin/chromium node qa/tools/test-gradient-occlusion.mjs
node qa/tools/wait-contrast-preview.mjs http://127.0.0.1:5173
SCAN_WIDTH=1440 node qa/tools/sweep-467c.mjs http://127.0.0.1:5173 --out <round>
node qa/tools/sweep-467c.mjs --compare-rounds <downloaded-six-summaries>
```

Both artifact typechecks and shared-library check: **exit 0**. Targeted final
preview/readiness tests: **8/8 pass**, no skips/failures. Browser controls: pass,
including F/G and the six red/restored quantity rows at both widths.
Including the existing contrast-theme guards, the final targeted run is
**86/86 pass**, 0 fail/skip.

The initial complete non-browser web run was **1533/1533 pass, 0 fail/skip**.
A fifth new test was subsequently added. The final complete non-browser web
run is **1534 total /1534 pass /0 fail /0 skip**, 47.58 seconds. The final
contrast-theme/readiness/preview guard subset is **86/86 pass**.
Local complete API run: **1329 total /1328 pass /1 fail /0 skip**, the unrelated
speech voice-environment override assertion (Kore versus expected Zephyr).
No API/environment/source fix is included. CI's actual result is authoritative,
not inferred from this local failure or the owner's earlier 1329/1329 baseline.

Like existing CI, full non-browser unit discovery is:

```sh
files=$(find test -maxdepth 1 -name '*.test.ts' ! -name '*.browser.test.ts' | sort)
node --experimental-strip-types --test $files
```

This is **not** a claim that the package's wildcard `pnpm run test`, which also
discovers browser/integration cases, was executed. Existing A4 fixture regression
remains in the 1440 job once; its actual CI result is pending, not assumed.

## E / protected scope / checklist

Only QA tools, contrast jobs, contrast guard tests, this report and round33
evidence are submitted. No `artifacts/knight-basins/src/**`,
`artifacts/api-server/**`, `data/**`, `deploy/**`, `public/**`, robots/LLM docs,
business text/prices/dimensions or token change. No production DB write,
main push, merge or deploy. Repository operations use the GitHub Connection.
The PR comment supplies the actual scoped GitHub comparison/stat and head.

- [x] A: option B selected explicitly, bounded proxy/log/cache implemented.
- [x] B: three-endpoint readiness and blocked-Portfolio exit-2 test.
- [ ] C: final-head full three-round green comparison not yet accepted.
- [x] D: thresholds and sole LINE exception retained; genuine old red linked.
- [ ] E: source scope preserved; final CI/unit/A4 acceptance pending.
- [x] F: control/short-text candidates, paired pixels and real browser assertions.
- [x] G: complete cart DOM and measured quantity coverage; missing-row exit 2.
- [ ] H: six-row red/restored fixture demonstrated; full-source green pending.

## Five-line handoff

แก้: proxy ทาง B + readiness ครบ endpoint + วัดคอนโทรล/ข้อความสั้น + ตรวจตะกร้าจริง
เทสต์: targeted 8/8 และ browser controls ผ่าน; ผล final-head/CI อยู่ใน PR
ตรวจไม่ได้: ยังไม่รับรอง C/H เขียวบน source จริงหรือ production หลัง deploy
ความเสี่ยง: ด่านใหม่เปิดเผยสีตกจริงเพิ่ม ห้ามยกเว้นหรือแก้สีข้ามเจ้าของ
ข้อเสนอ: เดวิดตรวจ Draft PR และประสาน 472-C; เจ้าของ merge/deploy เองเท่านั้น

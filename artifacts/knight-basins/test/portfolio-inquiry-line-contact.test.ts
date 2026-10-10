import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";

/**
 * job 414-B (phase 1 + 2): the LINE contact path has to branch per device, and
 * the optional LINE Login must never become a gate. The helpers below live as
 * plain function declarations inside the .tsx (same technique as
 * portfolio-inquiry-search.test.ts) so their behaviour -- not just their
 * existence in the source -- is asserted here.
 */
const modalUrl = new URL("../src/components/PortfolioInquiryModal.tsx", import.meta.url);
const modalSource = await readFile(modalUrl, "utf8");
const modalAst = ts.createSourceFile(
  fileURLToPath(modalUrl),
  modalSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

const helperNames = [
  "lineContactModeForViewport",
  "buildLineDeepLink",
  "lineLoginHref",
  "lineButtonLabel",
  "lineIdentityName",
  "shouldOfferLineLogin",
] as const;

function loadLineContactHelpers() {
  const helpers = modalAst.statements.filter(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement)
      && Boolean(statement.name)
      && helperNames.includes(statement.name!.text as (typeof helperNames)[number]),
  );
  assert.equal(
    helpers.length,
    helperNames.length,
    "PortfolioInquiryModal should declare every tested LINE contact helper",
  );
  const helperSource = helpers
    .map((helper) => modalSource.slice(helper.getStart(modalAst), helper.end).replace(/^export\s+/, ""))
    .join("\n");
  // Constants the helpers close over -- values must match the module.
  const moduleConstants = [
    `const LINE_OA_DEEPLINK_BASE = "https://line.me/R/oaMessage/%40789gcnhq/?text=";`,
    `const LINE_LOGIN_PATH = "/api/auth/line/login";`,
    `const DESKTOP_LINE_BREAKPOINT_PX = 1024;`,
  ].join("\n");
  const compiled = ts.transpileModule(
    `${moduleConstants}\n${helperSource}\nreturn { ${helperNames.join(", ")} };`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
  ).outputText;
  return new Function(compiled)() as {
    lineContactModeForViewport: (width: number, hasFinePointer: boolean) => "dialog" | "deeplink";
    buildLineDeepLink: (message: string) => string;
    lineLoginHref: (pathWithQuery: string) => string;
    lineButtonLabel: (authenticated: boolean, isCatalog: boolean) => string;
    lineIdentityName: (status: unknown) => string;
    shouldOfferLineLogin: (status: unknown) => boolean;
  };
}

const {
  lineContactModeForViewport,
  buildLineDeepLink,
  lineLoginHref,
  lineButtonLabel,
  lineIdentityName,
  shouldOfferLineLogin,
} = loadLineContactHelpers();

describe("desktop LINE contact path stays on-site (job 414-B A)", () => {
  it("uses the in-page dialog only on a wide viewport with a fine pointer", () => {
    assert.equal(lineContactModeForViewport(1440, true), "dialog");
    assert.equal(lineContactModeForViewport(1024, true), "dialog", "1024px is the documented breakpoint");
    assert.equal(lineContactModeForViewport(1023, true), "deeplink", "just below the breakpoint keeps the deep link");
    assert.equal(lineContactModeForViewport(1366, false), "deeplink", "a touchscreen at desktop width keeps the deep link");
    assert.equal(lineContactModeForViewport(390, false), "deeplink", "phones keep the working oaMessage link");
    assert.equal(lineContactModeForViewport(0, true), "deeplink", "unknown viewport must not trap the visitor");
    assert.equal(lineContactModeForViewport(Number.NaN, true), "deeplink", "unreadable metrics fall back to the link");
  });

  it("keeps the mobile deep link exactly as it was", () => {
    const href = buildLineDeepLink("สวัสดีครับ สนใจสั่งผลิตแบบนี้\n/photo/a.jpg");
    assert.ok(href.startsWith("https://line.me/R/oaMessage/%40789gcnhq/?text="));
    assert.equal(href, `https://line.me/R/oaMessage/%40789gcnhq/?text=${encodeURIComponent("สวัสดีครับ สนใจสั่งผลิตแบบนี้\n/photo/a.jpg")}`);
  });

  it("points the desktop dialog at the QR and the correct desktop add-friend page", () => {
    assert.equal(/const LINE_OA_QR_URL = "([^"]+)"/.exec(modalSource)?.[1], "https://qr-official.line.me/sid/L/789gcnhq.png");
    assert.equal(/const LINE_OA_ADD_FRIEND_URL = "([^"]+)"/.exec(modalSource)?.[1], "https://line.me/R/ti/p/@789gcnhq");
    assert.match(modalSource, /src=\{LINE_OA_QR_URL\}/);
    assert.match(modalSource, /href=\{LINE_OA_ADD_FRIEND_URL\}/);
    assert.match(modalSource, /data-testid="dialog-line-desktop"/);
    assert.match(modalSource, /data-testid="img-line-desktop-qr"/);
    assert.match(modalSource, /data-testid="button-line-add-friend"/);
    assert.match(modalSource, /data-testid="button-line-copy-summary"/);
    assert.match(modalSource, /data-testid="text-line-desktop-hint"/);
  });

  it("renders the desktop branch without navigating away, and never removes the phone form", () => {
    // The desktop entry point is a <button> that opens state -- not an <a> to line.me.
    assert.match(modalSource, /onClick=\{\(\) => setLinePanelOpen\(true\)\}/);
    assert.match(modalSource, /data-testid-line-channel="desktop-panel"/);
    // The summary that the copy button shares with the deep link stays visible.
    assert.match(modalSource, /data-testid="text-line-summary-preview"/);
    assert.match(modalSource, /navigator\.clipboard\.writeText\(lineMessage\)/);
    // Escape backs out of the panel first, then closes the modal.
    assert.match(modalSource, /if \(linePanelOpen\) \{ setLinePanelOpen\(false\); return; \}/);
    assert.match(modalSource, /data-testid="button-submit-inquiry"/);
    assert.match(modalSource, /data-testid="input-inquiry-phone"/);
  });

  it("keeps the touch deep link anchor (with its original test id) for non-desktop visitors", () => {
    assert.match(modalSource, /\{!desktopMode && \(/);
    assert.match(modalSource, /href=\{lineHref\}/);
    assert.match(modalSource, /data-testid="button-inquiry-line"/);
  });
});

describe("optional LINE Login (job 414-B B)", () => {
  it("builds a returnTo that survives a query string", () => {
    assert.equal(lineLoginHref("/stone?color=SG420"), "/api/auth/line/login?returnTo=%2Fstone%3Fcolor%3DSG420");
    assert.equal(lineLoginHref("/"), "/api/auth/line/login?returnTo=%2F");
    assert.equal(lineLoginHref("   "), "/api/auth/line/login?returnTo=%2F", "blank input falls back to the site root");
  });

  it("offers login only when it is configured and the visitor is anonymous", () => {
    assert.equal(shouldOfferLineLogin({ configured: true, authenticated: false }), true);
    assert.equal(shouldOfferLineLogin({ configured: true, authenticated: true, user: { displayName: "บอส" } }), false);
    assert.equal(shouldOfferLineLogin({ configured: false, authenticated: false }), false, "no broken link when unconfigured");
    assert.equal(shouldOfferLineLogin(null), false, "unknown status (request still running or failed) must not gate anything");
  });

  it("labels the LINE button by identity, and can show the server-side name/picture", () => {
    assert.equal(lineButtonLabel(false, true), "🟢 ทักคุยผ่าน LINE พร้อมส่งรุ่นนี้ทันที");
    assert.equal(lineButtonLabel(false, false), "🟢 ทักคุยผ่าน LINE พร้อมส่งรูปนี้ทันที");
    assert.match(lineButtonLabel(true, true), /ส่งเข้าแชท LINE ของคุณ/);
    assert.equal(lineIdentityName({ authenticated: true, user: { displayName: "  คุณนพ  " } }), "คุณนพ");
    assert.equal(lineIdentityName({ authenticated: true, user: { userId: "u-123456" } }), "ลูกค้า LINE (123456)", "signed-in but name-less still shows something honest");
    assert.equal(lineIdentityName({ authenticated: false, user: { displayName: "ghost" } }), "", "never echo a user object while signed out");
    assert.equal(lineIdentityName(null), "");
    assert.match(modalSource, /data-testid="row-line-identity"/);
    assert.match(modalSource, /data-testid="img-line-avatar"/);
    assert.match(modalSource, /data-testid="text-line-display-name"/);
    assert.match(modalSource, /fetch\(LINE_STATUS_PATH/);
  });

  it("reads identity from the session endpoint and keeps every non-login exit visible", () => {
    assert.match(modalSource, /credentials: "same-origin"/);
    // QR + copy + phone + submit all render in the signed-out state as well.
    for (const testId of ["dialog-line-desktop", "button-line-copy-summary", "input-inquiry-phone", "button-submit-inquiry"]) {
      assert.ok(modalSource.includes(`data-testid="${testId}"`), `${testId} must exist independently of login`);
    }
    assert.ok(!/if \(!lineLoggedIn\) return null/.test(modalSource), "no early return that could gate the modal on login");
    assert.match(modalSource, / เข้าสู่ระบบด้วย LINE \(ไม่บังคับ\)/);
  });
});

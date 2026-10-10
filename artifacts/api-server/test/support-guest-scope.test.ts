import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, describe, it } from "node:test";
import { importTypeScriptModule } from "./route-harness.ts";

// job-235: what the web chat (น้องไนท์) says to a visitor who is not signed in with LINE and asks something outside the catalog.
//
// support-route.test.ts exercises the route against a real Postgres and is skipped everywhere that has none (this machine,
// CI), so nothing there protects this behaviour. These tests need no database: they cover the reply helper the route
// ends with, the response schema, and (by reading the source) that the route really ends with that helper.

type SupportModule = typeof import("../src/routes/support.ts");
type ZodModule = typeof import("../../../lib/api-zod/src/index.ts");

const originalEnv = { DATABASE_URL: process.env["DATABASE_URL"], SESSION_SECRET: process.env["SESSION_SECRET"] };
let support: SupportModule;
let source: string;
let SendSupportChatMessageResponse: ZodModule["SendSupportChatMessageResponse"];

before(async () => {
  process.env["DATABASE_URL"] = "postgres://support-guest-scope-test";
  process.env["SESSION_SECRET"] = "support-guest-scope-test-secret";
  support = await importTypeScriptModule<SupportModule>("src/routes/support.ts");
  // bundled like the route: the generated zod file is imported without a file extension, which node cannot load directly
  ({ SendSupportChatMessageResponse } = await importTypeScriptModule<ZodModule>("../../lib/api-zod/src/index.ts"));
  source = await readFile(new URL("../src/routes/support.ts", import.meta.url), "utf8");
});

after(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

// The text a signed-in customer got before job-235, character for character (it was also the visitor's reply).
const PREVIOUS_FALLBACK = "ดิฉันช่วยค้นหา SKU อ่างล้างหน้า รหัสสีหิน ราคา ขนาด และวิดีโอ 3D 360° ได้ค่ะ ลองพิมพ์เช่น KF001, KF023 หรือ BW010";

describe("job-235: the reply for a visitor who is not signed in", () => {
  it("states the scope, invites LINE sign-in and gives the sales numbers (main line first, job 421-C)", () => {
    const { reply, matchedType, loginRequired } = support.supportFallbackResponse(false);
    assert.equal(loginRequired, true);
    assert.equal(matchedType, "none");
    assert.equal(reply, support.GUEST_SCOPE_REPLY);
    for (const expected of [
      "โหมดทั่วไป (ยังไม่เข้าสู่ระบบ LINE)",
      "ข้อมูลสินค้าในแคตตาล็อก",
      "\"KF023\"",
      "\"BW010\"",
      "เข้าสู่ระบบด้วย LINE",
      "094-496-1949",
      "091-978-2292",
      "089-762-2209",
    ]) {
      assert.ok(reply.includes(expected), `the reply is missing: ${expected}`);
    }
  });

  it("is exactly the three paragraphs the work order specifies", () => {
    assert.equal(
      support.GUEST_SCOPE_REPLY,
      "ตอนนี้คุณกำลังใช้โหมดทั่วไป (ยังไม่เข้าสู่ระบบ LINE) ดิฉันตอบได้เฉพาะข้อมูลสินค้าในแคตตาล็อก เช่น \"KF023\" หรือ \"BW010\" ค่ะ\n\n"
        + "หากต้องการปรึกษาการออกแบบ การชำระเงิน สถานะใบเสนอราคา หรือข้อมูลอื่น ๆ กรุณาเข้าสู่ระบบด้วย LINE ที่ปุ่มด้านบน เพื่อคุยกับน้องไนท์โหมดเต็มแบบเดียวกับใน LINE ค่ะ\n\n"
        + "หรือติดต่อฝ่ายขาย 094-496-1949 · 091-978-2292 · 089-762-2209",
    );
  });

  it("does not repeat the old catalog-only text or the old claim", () => {
    assert.ok(!support.GUEST_SCOPE_REPLY.includes("ดิฉันช่วยค้นหา SKU อ่างล้างหน้า"));
    assert.ok(!support.GUEST_SCOPE_REPLY.includes("ป้องกันการสุ่ม"));
  });
});

describe("job-235: a signed-in customer's path is unchanged", () => {
  it("keeps the previous text and sends no loginRequired flag", () => {
    const response = support.supportFallbackResponse(true) as Record<string, unknown>;
    assert.equal(response["reply"], PREVIOUS_FALLBACK);
    assert.equal(response["matchedType"], "none");
    assert.equal("loginRequired" in response, false, "a signed-in customer is never told to sign in");
  });
});

describe("job-235: the route ends with that helper", () => {
  it("answers the last branch with supportFallbackResponse(Boolean(account)) and nothing else", () => {
    // job-238 added an audit call to the catch block (support-chat-error-audit.test.ts guards it); the reply branch is unchanged
    assert.match(source, /res\.json\(supportFallbackResponse\(Boolean\(account\)\)\);\s*\} catch \(error\) \{[\s\S]*?next\(error\);\s*\}\s*\}\);/);
  });

  it("keeps the Hermes branch ahead of it, for signed-in customers only", () => {
    const hermes = source.indexOf("if (account && hermesSupportConfigured())");
    const fallback = source.indexOf("res.json(supportFallbackResponse(Boolean(account)))");
    assert.ok(hermes > 0 && fallback > hermes, "the assistant is asked before the fallback is used");
  });

  it("holds the old catalog-only sentence in one place only (the signed-in fallback) and never the old claim", () => {
    assert.equal(source.split("ดิฉันช่วยค้นหา SKU อ่างล้างหน้า").length - 1, 1);
    assert.ok(!source.includes("ป้องกันการสุ่ม"));
  });
});

describe("job-235: the response schema allows the new field", () => {
  const base = { reply: "x", matchedType: "none" as const };

  it("accepts loginRequired true and false, and its absence", () => {
    assert.equal(SendSupportChatMessageResponse.safeParse({ ...base, loginRequired: true }).success, true);
    assert.equal(SendSupportChatMessageResponse.safeParse({ ...base, loginRequired: false }).success, true);
    assert.equal(SendSupportChatMessageResponse.safeParse(base).success, true);
  });

  it("rejects a loginRequired that is not a boolean", () => {
    for (const bad of ["yes", 1, null]) {
      assert.equal(SendSupportChatMessageResponse.safeParse({ ...base, loginRequired: bad }).success, false, JSON.stringify(bad));
    }
  });

  it("round-trips the reply the route actually sends", () => {
    assert.equal(SendSupportChatMessageResponse.safeParse(support.supportFallbackResponse(false)).success, true);
    assert.equal(SendSupportChatMessageResponse.safeParse(support.supportFallbackResponse(true)).success, true);
  });

  it("is declared in openapi.yaml under SupportChatResponse as an optional boolean", async () => {
    const spec = await readFile(new URL("../../../lib/api-spec/openapi.yaml", import.meta.url), "utf8");
    const block = spec.replace(/\r\n/g, "\n").match(/\n    SupportChatResponse:\n([\s\S]*?)\n    SupportPaymentSlipResponse:/);
    assert.ok(block, "SupportChatResponse schema found");
    assert.match(block![1]!, /\n        loginRequired:\n          type: boolean\n/);
    assert.doesNotMatch(block![1]!, /required: \[[^\]]*loginRequired/);
  });
});

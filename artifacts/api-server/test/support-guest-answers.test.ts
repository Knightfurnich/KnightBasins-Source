import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, afterEach, before, describe, it, mock } from "node:test";
import { commercialConstants } from "../src/lib/commercial-constants.ts";
import { IMAGE_DISCLAIMER } from "../src/lib/support-guest-answers.ts";
import { extractSupportProfileFields } from "../src/lib/support-profile.ts";
import { isIdentityQuestion, isServiceAreaQuestion, isShoppingMessage } from "../src/lib/support-signals.ts";
import { serveTypeScriptRoute } from "./route-harness.ts";

// job 421-C: what the web chat says to a visitor who is not signed in.
//
// The route runs for real (express + the support router) with only routes/catalog.ts swapped for a snapshot of the live
// catalogue, because the real one needs a database. Nothing here calls a model: a visitor never reaches Hermes.

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(here, "fixtures", "support-catalog.json");
const catalog = JSON.parse(readFileSync(fixturePath, "utf8")) as {
  basins: Array<{ sku: string; category: string; priceTHB: number }>;
  installedStones: Array<{ code: string; pricePerSqmTHB: number }>;
  sheetStones: Array<{ code: string; basePriceTHB: number }>;
};
const constants = commercialConstants();
const baht = (value: number) => value.toLocaleString("th-TH");

const SAVED_ENV = ["SESSION_SECRET", "SUPPORT_CATALOG_FIXTURE", "HERMES_API_URL", "HERMES_API_KEY"] as const;
const savedEnv = Object.fromEntries(SAVED_ENV.map((key) => [key, process.env[key]]));
let server: Awaited<ReturnType<typeof serveTypeScriptRoute>>;
const hermesCalls: string[] = [];

type ChatReply = { status: number; reply: string; matchedType?: string; loginRequired?: boolean; profileUpdate?: { status: string } };

async function ask(message: string): Promise<ChatReply> {
  const response = await fetch(`${server.url}/api/support/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  const body = await response.json() as Omit<ChatReply, "status">;
  return { status: response.status, ...body };
}

before(async () => {
  process.env["SESSION_SECRET"] = "support-guest-answers-test-secret";
  process.env["SUPPORT_CATALOG_FIXTURE"] = fixturePath;
  // Hermes is configured on purpose: a visitor must still never reach it.
  process.env["HERMES_API_URL"] = "https://hermes.test";
  process.env["HERMES_API_KEY"] = "hermes-key-under-test";
  server = await serveTypeScriptRoute("src/routes/support.ts", "/api", {
    "./catalog": path.join(here, "support-catalog-stub.ts"),
  });
  const realFetch = globalThis.fetch;
  mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
    if (String(input).startsWith("https://hermes.test")) {
      hermesCalls.push(String(input));
      return new Response(JSON.stringify({ choices: [{ message: { content: "should never be asked" } }] }), { status: 200 });
    }
    return realFetch(input as never, init);
  });
});

afterEach(() => {
  hermesCalls.length = 0;
});

after(async () => {
  mock.restoreAll();
  await server.close();
  for (const key of SAVED_ENV) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("a visitor who wants a product is answered from the catalogue (job 421-C A)", () => {
  it("'อยากได้อ่างล้างหน้าสำหรับคอนโด 1 ห้อง' gets basin ranges, the conditions, and two ways forward -- not the profile prompt", async () => {
    const answer = await ask("อยากได้อ่างล้างหน้าสำหรับคอนโด 1 ห้องค่ะ");
    assert.equal(answer.status, 200);
    assert.ok(!answer.reply.includes("พบข้อมูลโปรไฟล์"), `bounced to the profile path: ${answer.reply}`);
    assert.equal(answer.profileUpdate, undefined);
    assert.match(answer.reply.split("\n")[0]!, /^ได้เลยค่ะ/, "the first line already answers");

    const counter = catalog.basins.filter((item) => item.category === "counter basin").map((item) => item.priceTHB);
    const standing = catalog.basins.filter((item) => item.category !== "counter basin").map((item) => item.priceTHB);
    assert.ok(answer.reply.includes(`${baht(Math.min(...counter))}–${baht(Math.max(...counter))} บาท/ชุด`), "counter-basin range from the catalogue");
    assert.ok(answer.reply.includes(`${baht(Math.min(...standing))}–${baht(Math.max(...standing))} บาท/ชุด`), "standing-basin range from the catalogue");

    const install = constants.addons.find((addon) => addon.id === "basin_install")!;
    assert.ok(answer.reply.includes(`VAT ${constants.vat_percent}%`), "VAT line (B)");
    assert.ok(answer.reply.includes(`${baht(install.price)} ${install.unit}`), "installation charge for a basin set (B)");

    assert.match(answer.reply, /เข้าสู่ระบบด้วย LINE/, "way forward 1: sign in");
    assert.ok(answer.reply.includes("094-496-1949"), "way forward 2: call the team");
    assert.equal(answer.loginRequired, true, "the page shows the sign-in button as one of the two ways");
  });

  it("a countertop request gets stone rates, VAT and the small-job charges from the price book", async () => {
    const answer = await ask("อยากได้ท็อปครัวหินสังเคราะห์ 3 เมตรค่ะ");
    const installed = catalog.installedStones.map((item) => item.pricePerSqmTHB);
    assert.ok(answer.reply.includes(`${baht(Math.min(...installed))}–${baht(Math.max(...installed))} บาท/ตร.ม.`));
    assert.ok(answer.reply.includes(`VAT ${constants.vat_percent}%`));
    for (const rule of constants.installation.rules.filter((item) => item.charge && /พื้นที่น้อยกว่า/.test(item.condition))) {
      assert.ok(answer.reply.includes(`${baht(rule.charge!)} ${rule.unit}`), `small-job charge missing: ${rule.scope}`);
    }
    assert.match(answer.reply, /เข้าสู่ระบบด้วย LINE/);
    assert.ok(!answer.reply.includes("พบข้อมูลโปรไฟล์"));
  });

  it("'ติดตั้งอ่างล้างหน้าฟรีไหม' answers the installation question first and does not promise free installation", async () => {
    const answer = await ask("ติดตั้งอ่างล้างหน้าฟรีไหมคะ");
    const install = constants.addons.find((addon) => addon.id === "basin_install")!;
    assert.ok(answer.reply.split("\n")[0]!.includes(`${baht(install.price)} ${install.unit}`));
    assert.ok(!/ติดตั้งฟรี|ฟรีค่าติดตั้ง/.test(answer.reply));
  });

  it("a visitor who leaves a phone number while asking for a basin is still answered (no 'sign in to save your profile')", async () => {
    const answer = await ask("อยากได้อ่างล้างหน้า เบอร์โทร 0812345678 คอนโดชั้น 12");
    assert.ok(!answer.reply.includes("พบข้อมูลโปรไฟล์"), answer.reply);
    assert.match(answer.reply, /ชุดอ่างล้างหน้า/);
  });

  it("a visitor who only sends profile details (no product) still gets the sign-in-to-save prompt", async () => {
    const answer = await ask("ขอแก้ไขเบอร์โทร 0812345678");
    assert.equal(answer.profileUpdate?.status, "login_required");
  });
});

describe("conditions travel with every product price (job 421-C B)", () => {
  it("a stone code answer carries VAT, the small-job charges and the colour disclaimer", async () => {
    const stone = catalog.installedStones[0]!;
    const answer = await ask(`ราคา ${stone.code} เท่าไหร่คะ`);
    assert.equal(answer.matchedType, "stone");
    assert.ok(answer.reply.includes(`${baht(stone.pricePerSqmTHB)} บาท/ตร.ม.`), "the price itself is unchanged");
    assert.ok(answer.reply.includes(`VAT ${constants.vat_percent}%`));
    assert.ok(answer.reply.includes(`${baht(constants.installation.rules[0]!.charge!)} ${constants.installation.rules[0]!.unit}`));
    assert.ok(answer.reply.includes(IMAGE_DISCLAIMER));
  });

  it("a basin code answer carries VAT, the installation charge and the colour disclaimer", async () => {
    const basin = catalog.basins[0]!;
    const answer = await ask(`${basin.sku} ราคาเท่าไหร่`);
    assert.equal(answer.matchedType, "basin");
    assert.ok(answer.reply.includes(`${baht(basin.priceTHB)} บาท`));
    assert.ok(answer.reply.includes(`VAT ${constants.vat_percent}%`));
    assert.ok(answer.reply.includes(`${baht(constants.addons.find((addon) => addon.id === "basin_install")!.price)}`));
    assert.ok(answer.reply.includes(IMAGE_DISCLAIMER));
  });

  it("the disclaimer sentence is the knowledge-base feed's wording", () => {
    assert.equal(IMAGE_DISCLAIMER, "ภาพเป็นตัวอย่างเพื่อการอ้างอิง สีจริงอาจต่างจากการแสดงผลบนจอ แนะนำดูตัวอย่างจริงที่โชว์รูม");
  });
});

describe("who is น้องไนท์ -- answered, never a login wall (job 421-C C)", () => {
  for (const question of ["คุณคือใครคะ", "เป็นคนหรือบอทคะ", "คุยกับคนจริงหรือเปล่า", "คุณเป็น AI ใช่ไหม"]) {
    it(`'${question}'`, async () => {
      const answer = await ask(question);
      assert.equal(answer.status, 200);
      assert.match(answer.reply, /^น้องไนท์เป็นผู้ช่วยอัตโนมัติของทีม Knight Furnich ค่ะ/);
      assert.match(answer.reply, /ไม่ใช่คนจริง/);
      assert.ok(answer.loginRequired !== true, "no sign-in prompt for an identity question");
      assert.ok(!answer.reply.includes("โหมดทั่วไป"), "not the generic guest fallback");
    });
  }

  it("age / children questions get one honest line and no invented life story", async () => {
    const answer = await ask("อายุเท่าไหร่ มีลูกกี่คน");
    assert.match(answer.reply, /ผู้ช่วยอัตโนมัติ/);
    assert.ok(!/\d+ ?ปี|ลูก ?\d|สามี|ภรรยา|แต่งงานแล้ว/.test(answer.reply));
    assert.ok(answer.loginRequired !== true);
  });

  it("never claims to be a person", async () => {
    for (const question of ["คุณคือใครคะ", "เป็นคนหรือบอทคะ", "อายุเท่าไหร่ มีลูกกี่คน"]) {
      const answer = await ask(question);
      assert.ok(!/ฉันเป็นคน|ดิฉันเป็นคน|เป็นมนุษย์|ผมคือ|ครับ/.test(answer.reply), answer.reply);
    }
  });
});

describe("branch / service-area questions do not invent anything (job 421-C D)", () => {
  it("'มีสาขาที่เชียงใหม่ไหมคะ' says there is no branch data, states the province rule from the price book, and offers a way on", async () => {
    const answer = await ask("มีสาขาที่เชียงใหม่ไหมคะ");
    assert.match(answer.reply, /ไม่มีข้อมูลสาขาในระบบ/);
    assert.ok(!/มีสาขา(อยู่|ที่|ใน)|สาขาอยู่/.test(answer.reply), "no branch is claimed");
    const province = constants.installation.rules.find((rule) => rule.scope === "ต่างจังหวัด")!;
    assert.ok(answer.reply.includes(`${baht(province.charge!)} ${province.unit}`));
    assert.match(answer.reply, /เข้าสู่ระบบด้วย LINE/);
    assert.ok(answer.reply.includes("094-496-1949"));
  });

  it("'มีส่งไปเชียงใหม่ไหม' and 'ติดตั้งต่างจังหวัดได้ไหม' take the same path", async () => {
    for (const question of ["มีส่งไปเชียงใหม่ไหม", "ติดตั้งต่างจังหวัดได้ไหม"]) {
      const answer = await ask(question);
      assert.match(answer.reply, /ไม่มีข้อมูลสาขาในระบบ/, question);
    }
  });
});

describe("a visitor never reaches the model (job 421-C F)", () => {
  it("none of these messages, nor a free-text one that matches nothing, calls Hermes", async () => {
    for (const message of [
      "อยากได้อ่างล้างหน้าสำหรับคอนโด 1 ห้องค่ะ",
      "คุณคือใครคะ",
      "มีสาขาที่เชียงใหม่ไหมคะ",
      "ช่วยออกแบบห้องน้ำให้หน่อยเรื่องการจัดวางสไตล์มินิมอลแบบญี่ปุ่น",
    ]) {
      await ask(message);
    }
    assert.deepEqual(hermesCalls, []);
  });

  it("an unmatched question still gets the existing guest fallback with the sign-in flag and the shared phone lines", async () => {
    const answer = await ask("ช่วยออกแบบห้องน้ำให้หน่อยเรื่องการจัดวางสไตล์มินิมอลแบบญี่ปุ่น");
    assert.equal(answer.loginRequired, true);
    assert.ok(answer.reply.includes("094-496-1949 · 091-978-2292 · 089-762-2209"));
  });
});

describe("the message classifiers", () => {
  it("shopping: wanting / asking the price of something we sell", () => {
    for (const yes of ["อยากได้อ่างล้างหน้าสำหรับคอนโด", "ราคาท็อปครัวเท่าไหร่", "สนใจหินสังเคราะห์", "KF001 กี่บาท", "ติดตั้งอ่างฟรีไหม"]) {
      assert.equal(isShoppingMessage(yes), true, yes);
    }
    for (const no of ["ที่อยู่ติดตั้ง: 99 สุขุมวิท คอนโด ชั้น 12", "ต้องการเปลี่ยนเบอร์โทร", "สวัสดีค่ะ", "ขอบคุณค่ะ", "ประเภทสถานที่: คอนโด"]) {
      assert.equal(isShoppingMessage(no), false, no);
    }
  });

  it("identity and service area", () => {
    assert.equal(isIdentityQuestion("เป็นคนหรือบอทคะ"), true);
    assert.equal(isIdentityQuestion("ผมเป็นคนกรุงเทพ อยากได้อ่าง"), false);
    assert.equal(isServiceAreaQuestion("มีสาขาที่เชียงใหม่ไหมคะ"), true);
    assert.equal(isServiceAreaQuestion("อยากได้อ่างล้างหน้า"), false);
  });
});

describe("profile extraction: a purchase sentence is not a profile statement (job 421-C A)", () => {
  it("'for a condo' inside a purchase gives no property type", () => {
    assert.deepEqual(extractSupportProfileFields("อยากได้อ่างล้างหน้าสำหรับคอนโด 1 ห้องค่ะ"), {});
    assert.deepEqual(extractSupportProfileFields("ราคาอ่างสำหรับบ้านเดี่ยวเท่าไหร่"), {});
  });

  it("a labeled or plain profile statement still counts (no change for real profile updates)", () => {
    assert.deepEqual(extractSupportProfileFields("ประเภทสถานที่: คอนโด ชั้นคอนโด: 12"), { propertyType: "condo", condoFloor: "12" });
    assert.deepEqual(extractSupportProfileFields("คอนโด ชั้น 12"), { propertyType: "condo", condoFloor: "12" });
  });

  it("explicit contact details inside a purchase message are still extracted (the route decides who may save them)", () => {
    assert.equal(extractSupportProfileFields("อยากได้อ่างล้างหน้า เบอร์โทร 0812345678").phone, "0812345678");
  });
});

describe("one source for the phone lines (job 421-C E)", () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = path.join(dir, entry);
      return statSync(full).isDirectory() ? sourceFiles(full) : full.endsWith(".ts") ? [full] : [];
    });
  }

  it("the sales numbers are written in lib/contact-info.ts only", () => {
    const numbers = /(094-?496-?1949|091-?978-?2292|089-?762-?2209|080-?606-?4444|061-?845-?9666)/;
    const offenders = sourceFiles(path.join(here, "..", "src"))
      .filter((file) => numbers.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(path.join(here, "..", "src"), file).replaceAll("\\", "/"));
    assert.deepEqual(offenders, ["lib/contact-info.ts"]);
  });
});

describe("how the route decides (read from the source, like support-guest-scope.test.ts)", () => {
  const source = readFileSync(path.join(here, "..", "src", "routes", "support.ts"), "utf8");

  it("the visitor branch comes before the Hermes branch and asks no model", () => {
    const guest = source.indexOf("if (!account) {\n      if (isServiceAreaQuestion(message))");
    const hermes = source.indexOf("if (account && hermesSupportConfigured())");
    assert.ok(guest > 0 && hermes > guest);
    const guestBlock = source.slice(guest, hermes);
    assert.ok(!guestBlock.includes("askHermesSupport"), "no model call for a visitor");
  });

  it("the profile prompt is skipped for a visitor who is shopping", () => {
    assert.ok(source.includes("Object.keys(extracted).length > 0 && (account || !shopping)"));
  });

  it("keeps the response contract: only the existing fields are sent", () => {
    const guest = source.indexOf("if (!account) {\n      if (isServiceAreaQuestion(message))");
    const block = source.slice(guest, source.indexOf("if (account && hermesSupportConfigured())"));
    assert.ok(/matchedType: "none", loginRequired: true/.test(block));
  });
});

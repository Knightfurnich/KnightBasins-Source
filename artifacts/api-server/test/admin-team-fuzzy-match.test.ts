import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env["DATABASE_URL"] ??= "postgres://admin-team-fuzzy-match-test";

import { importTypeScriptModule } from "./route-harness.ts";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const adminRoutePath = path.resolve(testDir, "../src/routes/admin-router.ts");

type MatcherModule = {
  matchedTechnicianTeamCode: (text: string) => { code: string; confidence: string } | null;
  matchTeamToken: (token: string) => { code: string; confidence: string } | null;
  normalizeTeamText: (text: string) => string;
  looseTeamText: (text: string) => string;
  teamTextEditDistance: (a: string, b: string) => number;
};

describe("Technician Team Fuzzy Matcher (Task 25B)", () => {
  let matcher: MatcherModule;

  before(async () => {
    matcher = await importTypeScriptModule<MatcherModule>(adminRoutePath);
  });

  it("normalizes casual Thai characters, digits, and confusable consonants", () => {
    assert.equal(matcher.normalizeTeamText("ทีม ๑"), "ทีม1");
    assert.equal(matcher.normalizeTeamText("ช่าง\u200Bเจมส์"), "ช่างเจมส์");
    assert.equal(matcher.normalizeTeamText("ช่างภัทร"), "ช่างพัทร");
  });

  it("loose form strips tone marks and vowel marks above/below line", () => {
    assert.equal(matcher.looseTeamText("เจมส์"), "เจมส");
    assert.equal(matcher.looseTeamText("ชัยยา"), "ชยยา");
  });

  it("calculates Levenshtein edit distance", () => {
    assert.equal(matcher.teamTextEditDistance("เจมส์", "เจมส์"), 0);
    assert.equal(matcher.teamTextEditDistance("เจมส", "เจมส์"), 1);
    assert.equal(matcher.teamTextEditDistance("เจม", "เจมส์"), 2);
  });

  const CASES: Array<{ text: string; expectedCode: string | null; expectedConfidence?: string }> = [
    // --- 12 เคสจริงจากคลัง LINE Archive ---
    { text: "คุณหญิง JB26/1013 วัดงาน 14/09/69 ทีมเจมส์", expectedCode: "CM", expectedConfidence: "exact" },
    { text: "ทองประเสร็ฐ เก็บงาน 21/09/69. ทีมเจมส์ครับ.", expectedCode: "CM", expectedConfidence: "exact" },
    { text: "JB26/1074 ทีมโรงงาน ส่งลูกค้า 25/09/69", expectedCode: "KF", expectedConfidence: "exact" },
    { text: "เทคโน อินทีเรีย JB26/1070 เก็บงาน 23/09/69 ทีมออฟฟิต", expectedCode: "KF", expectedConfidence: "exact" },
    { text: "เทคโน อินทีเรีย JB26/1070 เก็บงาน 23/09/69 ทีมออฟฟิศ", expectedCode: "KF", expectedConfidence: "exact" },
    { text: "ทองประเสร็ฐ JB26/1014 รอคิวติดตั้ง ทีมพร้อม", expectedCode: "PM", expectedConfidence: "exact" },
    { text: "26/1029 ทีมเนตร ครับ", expectedCode: "PP", expectedConfidence: "exact" },
    { text: "คาม่า JB26/0425 ติดตั้ง 21/09/69 ทีมเนตร", expectedCode: "PP", expectedConfidence: "exact" },
    { text: "กู๊ดเฮ้าส์ JB26/1037 ติดตั้ง 17/09/69 ทีมทู", expectedCode: "ST", expectedConfidence: "exact" },
    { text: "คุณหนูนา JB26/1043 วัดงาน 18/09/69 13.30 น. ทีมยี่", expectedCode: "TP", expectedConfidence: "exact" },
    { text: "พงศ์ถาวร JB26/0956 ติดตั้ง 18/09/69 ช่างเปา", expectedCode: "PA", expectedConfidence: "exact" },
    { text: "ดีเอส JB25/0786 ติดตั้ง 21-23/09/69 ช่างชัยยา", expectedCode: "CL", expectedConfidence: "exact" },

    // --- 10 เคสจำลองการสะกดผิด / ตัดคำท้าย ---
    { text: "ลูกค้า A JB26/2001 ติดตั้ง 01/10/69 ทีมเจม", expectedCode: "CM", expectedConfidence: "prefix" },
    { text: "ลูกค้า B JB26/2002 ติดตั้ง 01/10/69 ทีมเจมส", expectedCode: "CM", expectedConfidence: "exact" },
    { text: "ลูกค้า C JB26/2003 ติดตั้ง 01/10/69 ทีมเนต", expectedCode: "PP", expectedConfidence: "prefix" },
    { text: "ลูกค้า D JB26/2004 ติดตั้ง 01/10/69 ทีมเจมส์ครับ", expectedCode: "CM", expectedConfidence: "exact" },
    { text: "ลูกค้า E JB26/2005 ติดตั้ง 01/10/69 ทีมออฟฟิส", expectedCode: "KF", expectedConfidence: "exact" },
    { text: "ลูกค้า F JB26/2006 ติดตั้ง 01/10/69 ทีมชัย", expectedCode: "CL", expectedConfidence: "prefix" },
    { text: "ลูกค้า G JB26/2007 ติดตั้ง 01/10/69 ทีมโรง", expectedCode: "KF", expectedConfidence: "prefix" },
    { text: "ลูกค้า H JB26/2008 ติดตั้ง 01/10/69 ทีมกอล", expectedCode: "TJ", expectedConfidence: "prefix" },
    { text: "ลูกค้า I JB26/2009 ติดตั้ง 01/10/69 ทีมยี่", expectedCode: "TP", expectedConfidence: "exact" },
    { text: "ลูกค้า J JB26/2010 ติดตั้ง 01/10/69 ทีมทู", expectedCode: "ST", expectedConfidence: "exact" },

    // --- 4 เคส Negative: ต้องไม่จับมั่ว ---
    { text: "บ่ายไปรับแผ่นสีน้ำเงินโรงงานพี่อ้วนให้พี่หมู", expectedCode: null },
    { text: "รัน 26/1016 ช่างอ๊อก ซื้กาวขาว 1 หลอด", expectedCode: null },
    { text: "0832229035 ช่างพงษ์", expectedCode: null },
    { text: "แบบช่าง 26/1057", expectedCode: null },
  ];

  for (const { text, expectedCode, expectedConfidence } of CASES) {
    it(`matches "${text.slice(0, 35)}..." -> ${expectedCode ?? "null"}`, () => {
      const match = matcher.matchedTechnicianTeamCode(text);
      if (expectedCode === null) {
        assert.equal(match, null, `Expected null for "${text}" but got ${match?.code}`);
      } else {
        assert.ok(match !== null, `Expected code ${expectedCode} for "${text}" but got null`);
        assert.equal(match.code, expectedCode);
        if (expectedConfidence) {
          assert.equal(match.confidence, expectedConfidence);
        }
      }
    });
  }
});

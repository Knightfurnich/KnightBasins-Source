import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

type QuoteAccessModule = typeof import("../src/lib/quote-access.ts");

const originalSessionSecret = process.env["SESSION_SECRET"];
let quoteAccess: QuoteAccessModule;

before(async () => {
  process.env["SESSION_SECRET"] = "quote-access-test-secret";
  quoteAccess = await import("../src/lib/quote-access.ts");
});

after(() => {
  if (originalSessionSecret === undefined) delete process.env["SESSION_SECRET"];
  else process.env["SESSION_SECRET"] = originalSessionSecret;
});

describe("public quote response", () => {
  it("keeps the customer details needed to print the approved quote", () => {
    const response = quoteAccess.publicQuoteResponse({
      quoteNumber: "Sep 26 / US / 123456",
      quoteAccessSecret: "secret-that-must-not-leak",
      publicQuoteToken: "token-that-must-not-leak",
      phone: "0812345678",
      taxId: "0135553014114",
      address: "224/26 ถนนติวานนท์ จังหวัดปทุมธานี 12000",
      taxAddress: "224/26 ถนนติวานนท์ จังหวัดปทุมธานี 12000",
      studioData: {
        customer: {
          phone: "0812345678",
          taxId: "0135553014114",
          address: "224/26 ถนนติวานนท์ จังหวัดปทุมธานี 12000",
        },
      },
    });

    assert.equal(response.phone, "0812345678");
    assert.equal(response.taxId, "0135553014114");
    assert.equal(response.address, "224/26 ถนนติวานนท์ จังหวัดปทุมธานี 12000");
    assert.equal(response.taxAddress, "224/26 ถนนติวานนท์ จังหวัดปทุมธานี 12000");
    assert.deepEqual((response.studioData as { customer: Record<string, string> }).customer, {
      phone: "0812345678",
      taxId: "0135553014114",
      address: "224/26 ถนนติวานนท์ จังหวัดปทุมธานี 12000",
    });
    assert.equal("quoteAccessSecret" in response, false);
    assert.equal("publicQuoteToken" in response, false);
  });
});
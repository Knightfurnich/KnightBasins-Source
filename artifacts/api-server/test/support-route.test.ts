import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { afterEach, describe, it, mock } from "node:test";
import pg from "pg";
import { serveTypeScriptRoute } from "./route-harness.ts";

function sessionCookie(token: string) {
  const payload = Buffer.from(JSON.stringify({ token })).toString("base64url");
  const signature = createHmac("sha256", process.env["SESSION_SECRET"] ?? "support-route-test-secret").update(payload).digest("hex");
  return `knight_line_session=${payload}.${signature}`;
}

// Unlike the other route tests, these run against a REAL Postgres: they INSERT customer
// accounts, sessions and leads through a pg pool and the route reads the catalog from
// the same database. So they only run when DATABASE_URL points at a disposable local
// database that already has the app schema. Without one they used to fail with
// getaddrinfo ENOTFOUND/EAI_AGAIN on the old placeholder host, and with a production
// URL exported they would have written test rows into production.
function databaseSkipReason(): string | false {
  const url = process.env["DATABASE_URL"];
  if (!url) return "DATABASE_URL is not set: needs a disposable local Postgres with the app schema";
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return "DATABASE_URL is not a valid URL";
  }
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host);
  if (!local && process.env["ALLOW_REMOTE_TEST_DB"] !== "1") {
    return `refusing to write test rows to non-local database host "${host}" (set ALLOW_REMOTE_TEST_DB=1 only for a throwaway test database)`;
  }
  return false;
}
const databaseSkip = databaseSkipReason();

const realFetch = globalThis.fetch;

function mockHermesFetch(handler: (body: Record<string, unknown>) => Response) {
  mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("hermes.test")) return handler(JSON.parse(String(init?.body ?? "{}")));
    return realFetch(input as never, init);
  });
}

describe("KnightSupport profile update confirmation", { skip: databaseSkip }, () => {
  it("writes the authenticated account and open lead only after confirmation", async () => {
    process.env["SESSION_SECRET"] ??= "support-route-test-secret";
    const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
    const suffix = `${Date.now()}-${randomBytes(4).toString("hex")}`;
    const token = randomBytes(32).toString("base64url");
    const accountResult = await pool.query<{ id: number }>(
      `INSERT INTO customer_accounts
        (line_user_id, display_name, full_name, phone, tax_name, tax_id, tax_branch, tax_address, property_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [`support-test-${suffix}`, "Support Test", "คุณเดิม", "0811111111", "บริษัทเดิม จำกัด", "0105550000000", "สำนักงานใหญ่", "ที่อยู่เดิม", "house-townhome"],
    );
    const accountId = accountResult.rows[0]?.id;
    assert.ok(accountId);
    const secondToken = randomBytes(32).toString("base64url");
    const secondAccountResult = await pool.query<{ id: number }>(
      `INSERT INTO customer_accounts
        (line_user_id, display_name, full_name)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [`support-test-second-${suffix}`, "Second Support Test", "ผู้ใช้ที่สอง"],
    );
    const secondAccountId = secondAccountResult.rows[0]?.id;
    assert.ok(secondAccountId);
    await pool.query(
      `INSERT INTO customer_sessions (account_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [accountId, createHash("sha256").update(token).digest("hex"), new Date(Date.now() + 60_000)],
    );
    await pool.query(
      `INSERT INTO customer_sessions (account_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [secondAccountId, createHash("sha256").update(secondToken).digest("hex"), new Date(Date.now() + 60_000)],
    );
    const leadResult = await pool.query<{ id: number }>(
      `INSERT INTO customer_leads
        (lead_key, status, source, order_mode, name, phone, tax_name, tax_id, tax_branch, tax_address, property_type, product_skus, customer_account_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::text[], $13)
       RETURNING id`,
      [`support-lead-${suffix}`, "selecting", "test", "quick-purchase", "คุณเดิม", "0811111111", "บริษัทเดิม จำกัด", "0105550000000", "สำนักงานใหญ่", "ที่อยู่เดิม", "house-townhome", ["KF001"], accountId],
    );
    const leadId = leadResult.rows[0]?.id;
    assert.ok(leadId);

    let route = await serveTypeScriptRoute("src/routes/support.ts");
    const headers = { "Content-Type": "application/json", Cookie: sessionCookie(token) };
    const secondHeaders = { "Content-Type": "application/json", Cookie: sessionCookie(secondToken) };
    try {
      const message = await fetch(`${route.url}/api/support/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: "ชื่อผู้ติดต่อ: คุณใหม่ เบอร์โทร: 0822222222 ชื่อภาษีใหม่: บริษัทใหม่ จำกัด เลขผู้เสียภาษี: 0105551111111 สาขา: สาขา 2 ที่อยู่ใบกำกับภาษี: ที่อยู่ใหม่ ประเภทสถานที่: คอนโด ชั้นคอนโด: 8",
        }),
      });
      assert.equal(message.status, 200);
      const pending = await message.json() as { profileUpdate?: { status?: string }; reply?: string };
      assert.equal(pending.profileUpdate?.status, "confirmation_required");
      assert.match(pending.reply ?? "", /ยืนยัน/);

      const unchanged = await pool.query<{ tax_name: string; tax_id: string }>(
        "SELECT tax_name, tax_id FROM customer_accounts WHERE id = $1",
        [accountId],
      );
      assert.equal(unchanged.rows[0]?.tax_name, "บริษัทเดิม จำกัด");
      assert.equal(unchanged.rows[0]?.tax_id, "0105550000000");

      await route.close();
      route = await serveTypeScriptRoute("src/routes/support.ts");

      const otherAccountConfirmation = await fetch(`${route.url}/api/support/chat`, {
        method: "POST",
        headers: secondHeaders,
        body: JSON.stringify({ message: "ยืนยัน" }),
      });
      assert.equal(otherAccountConfirmation.status, 200);
      const otherAccountResult = await otherAccountConfirmation.json() as { reply?: string; profileUpdate?: { status?: string } };
      assert.equal(otherAccountResult.profileUpdate, undefined);
      assert.match(otherAccountResult.reply ?? "", /ยังไม่มีข้อมูล/);

      const otherAccountCancellation = await fetch(`${route.url}/api/support/chat`, {
        method: "POST",
        headers: secondHeaders,
        body: JSON.stringify({ message: "ยกเลิก" }),
      });
      assert.equal(otherAccountCancellation.status, 200);
      const otherCancellationResult = await otherAccountCancellation.json() as { reply?: string; profileUpdate?: { status?: string } };
      assert.equal(otherCancellationResult.profileUpdate, undefined);
      assert.match(otherCancellationResult.reply ?? "", /ยังไม่มีข้อมูล/);

      const confirmed = await fetch(`${route.url}/api/support/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message: "ยืนยัน" }),
      });
      assert.equal(confirmed.status, 200);
      const updated = await confirmed.json() as { profileUpdate?: { status?: string }; reply?: string };
      assert.equal(updated.profileUpdate?.status, "updated");
      assert.match(updated.reply ?? "", /เรียบร้อยแล้ว/);

      const savedAccount = await pool.query<{ full_name: string; phone: string; tax_name: string; tax_id: string; property_type: string; condo_floor: string }>(
        "SELECT full_name, phone, tax_name, tax_id, property_type, condo_floor FROM customer_accounts WHERE id = $1",
        [accountId],
      );
      assert.equal(savedAccount.rows[0]?.full_name, "คุณใหม่");
      assert.equal(savedAccount.rows[0]?.phone, "0822222222");
      assert.equal(savedAccount.rows[0]?.tax_name, "บริษัทใหม่ จำกัด");
      assert.equal(savedAccount.rows[0]?.tax_id, "0105551111111");
      assert.equal(savedAccount.rows[0]?.property_type, "condo");
      assert.equal(savedAccount.rows[0]?.condo_floor, "8");

      const savedLead = await pool.query<{ tax_name: string; tax_id: string; property_type: string; condo_floor: string }>(
        "SELECT tax_name, tax_id, property_type, condo_floor FROM customer_leads WHERE id = $1",
        [leadId],
      );
      assert.equal(savedLead.rows[0]?.tax_name, "บริษัทใหม่ จำกัด");
      assert.equal(savedLead.rows[0]?.tax_id, "0105551111111");
      assert.equal(savedLead.rows[0]?.property_type, "condo");
      assert.equal(savedLead.rows[0]?.condo_floor, "8");

      const secondMessage = await fetch(`${route.url}/api/support/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message: "ชื่อภาษีใหม่: บริษัทยกเลิก จำกัด" }),
      });
      assert.equal(secondMessage.status, 200);
      const secondPending = await secondMessage.json() as { profileUpdate?: { status?: string } };
      assert.equal(secondPending.profileUpdate?.status, "confirmation_required");

      const cancelled = await fetch(`${route.url}/api/support/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message: "ยกเลิก" }),
      });
      assert.equal(cancelled.status, 200);
      const cancelResult = await cancelled.json() as { profileUpdate?: { status?: string } };
      assert.equal(cancelResult.profileUpdate?.status, "cancelled");
      const afterCancel = await pool.query<{ tax_name: string }>(
        "SELECT tax_name FROM customer_accounts WHERE id = $1",
        [accountId],
      );
      assert.equal(afterCancel.rows[0]?.tax_name, "บริษัทใหม่ จำกัด");

      const expiringMessage = await fetch(`${route.url}/api/support/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message: "ชื่อภาษีใหม่: บริษัทหมดอายุ จำกัด เบอร์โทร: 0833333333" }),
      });
      assert.equal(expiringMessage.status, 200);
      const expiringPending = await expiringMessage.json() as { profileUpdate?: { status?: string } };
      assert.equal(expiringPending.profileUpdate?.status, "confirmation_required");
      await pool.query(
        "UPDATE customer_profile_update_confirmations SET expires_at = NOW() - INTERVAL '1 second' WHERE account_id = $1",
        [accountId],
      );

      const expiredConfirmation = await fetch(`${route.url}/api/support/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message: "ยืนยัน" }),
      });
      assert.equal(expiredConfirmation.status, 200);
      const expiredResult = await expiredConfirmation.json() as { reply?: string; profileUpdate?: { status?: string } };
      assert.equal(expiredResult.profileUpdate, undefined);
      assert.match(expiredResult.reply ?? "", /ยังไม่มีข้อมูล/);
      const unchangedAfterExpiry = await pool.query<{ tax_name: string; phone: string }>(
        "SELECT tax_name, phone FROM customer_accounts WHERE id = $1",
        [accountId],
      );
      assert.equal(unchangedAfterExpiry.rows[0]?.tax_name, "บริษัทใหม่ จำกัด");
      assert.equal(unchangedAfterExpiry.rows[0]?.phone, "0822222222");
      const leadAfterExpiry = await pool.query<{ tax_name: string; phone: string }>(
        "SELECT tax_name, phone FROM customer_leads WHERE id = $1",
        [leadId],
      );
      assert.equal(leadAfterExpiry.rows[0]?.tax_name, "บริษัทใหม่ จำกัด");
      assert.equal(leadAfterExpiry.rows[0]?.phone, "0822222222");
    } finally {
      await route.close();
      await pool.query("DELETE FROM customer_leads WHERE id = $1", [leadId]);
      await pool.query("DELETE FROM customer_sessions WHERE account_id = $1", [accountId]);
      await pool.query("DELETE FROM customer_sessions WHERE account_id = $1", [secondAccountId]);
      await pool.query("DELETE FROM customer_accounts WHERE id = $1", [accountId]);
      await pool.query("DELETE FROM customer_accounts WHERE id = $1", [secondAccountId]);
      await pool.end();
    }
  });
});

describe("KnightSupport Hermes fallback", { skip: databaseSkip }, () => {
  const originalHermesUrl = process.env["HERMES_API_URL"];
  const originalHermesKey = process.env["HERMES_API_KEY"];

  afterEach(() => {
    mock.restoreAll();
    if (originalHermesUrl === undefined) delete process.env["HERMES_API_URL"];
    else process.env["HERMES_API_URL"] = originalHermesUrl;
    if (originalHermesKey === undefined) delete process.env["HERMES_API_KEY"];
    else process.env["HERMES_API_KEY"] = originalHermesKey;
  });

  it("routes an unmatched question from a logged-in customer to Hermes, with that customer's own quote in context", async () => {
    process.env["SESSION_SECRET"] ??= "support-route-test-secret";
    process.env["HERMES_API_URL"] = "https://hermes.test";
    process.env["HERMES_API_KEY"] = "test-hermes-key";
    const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
    const suffix = `${Date.now()}-${randomBytes(4).toString("hex")}`;
    const token = randomBytes(32).toString("base64url");
    const accountResult = await pool.query<{ id: number }>(
      `INSERT INTO customer_accounts (line_user_id, display_name, full_name) VALUES ($1, $2, $3) RETURNING id`,
      [`hermes-test-${suffix}`, "Hermes Test", "คุณเฮอร์มีส"],
    );
    const accountId = accountResult.rows[0]?.id;
    assert.ok(accountId);
    await pool.query(
      `INSERT INTO customer_sessions (account_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [accountId, createHash("sha256").update(token).digest("hex"), new Date(Date.now() + 60_000)],
    );
    const leadResult = await pool.query<{ id: number }>(
      `INSERT INTO customer_leads (lead_key, status, source, order_mode, quote_number, studio_data, product_skus, customer_account_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8) RETURNING id`,
      [`hermes-lead-${suffix}`, "quote_sent", "test", "quick-purchase", `Q-${suffix}`, JSON.stringify({ total: 20330 }), [], accountId],
    );
    const leadId = leadResult.rows[0]?.id;
    assert.ok(leadId);

    let capturedBody: Record<string, unknown> | undefined;
    mockHermesFetch((body) => {
      capturedBody = body;
      return new Response(JSON.stringify({
        choices: [{ message: { content: "ยินดีให้ข้อมูลค่ะ" } }],
      }), { status: 200 });
    });

    const route = await serveTypeScriptRoute("src/routes/support.ts");
    try {
      const response = await fetch(`${route.url}/api/support/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: sessionCookie(token) },
        body: JSON.stringify({ message: "ใบเสนอราคาของฉันสถานะเป็นยังไงบ้าง" }),
      });
      assert.equal(response.status, 200);
      const result = await response.json() as { reply?: string };
      assert.equal(result.reply, "ยินดีให้ข้อมูลค่ะ");

      assert.equal(capturedBody?.["user"], `hermes-test-${suffix}`);
      const messages = capturedBody?.["messages"] as Array<{ role: string; content: string }>;
      assert.ok(messages.some((m) => m.role === "system" && m.content.includes(`Q-${suffix}`)));
    } finally {
      await route.close();
      await pool.query("DELETE FROM customer_leads WHERE id = $1", [leadId]);
      await pool.query("DELETE FROM customer_sessions WHERE account_id = $1", [accountId]);
      await pool.query("DELETE FROM customer_accounts WHERE id = $1", [accountId]);
      await pool.end();
    }
  });

  it("falls back to the generic reply when Hermes errors, and never calls Hermes for anonymous customers", async () => {
    process.env["SESSION_SECRET"] ??= "support-route-test-secret";
    process.env["HERMES_API_URL"] = "https://hermes.test";
    process.env["HERMES_API_KEY"] = "test-hermes-key";
    let hermesCalls = 0;
    mockHermesFetch(() => {
      hermesCalls += 1;
      return new Response(JSON.stringify({ error: { message: "boom" } }), { status: 500 });
    });

    const route = await serveTypeScriptRoute("src/routes/support.ts");
    try {
      const anonymous = await fetch(`${route.url}/api/support/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "ใบเสนอราคาของฉันสถานะเป็นยังไงบ้าง" }),
      });
      assert.equal(anonymous.status, 200);
      const anonymousResult = await anonymous.json() as { reply?: string };
      assert.match(anonymousResult.reply ?? "", /ผมช่วยค้นหา/);
      assert.equal(hermesCalls, 0);
    } finally {
      await route.close();
    }
  });
});
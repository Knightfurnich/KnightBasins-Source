import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import pg from "pg";
import { serveTypeScriptRoute } from "./route-harness.ts";

function sessionCookie(token: string) {
  const payload = Buffer.from(JSON.stringify({ token })).toString("base64url");
  const signature = createHmac("sha256", process.env["SESSION_SECRET"] ?? "support-route-test-secret").update(payload).digest("hex");
  return `knight_line_session=${payload}.${signature}`;
}

describe("KnightSupport profile update confirmation", () => {
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
    await pool.query(
      `INSERT INTO customer_sessions (account_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [accountId, createHash("sha256").update(token).digest("hex"), new Date(Date.now() + 60_000)],
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
    } finally {
      await route.close();
      await pool.query("DELETE FROM customer_leads WHERE id = $1", [leadId]);
      await pool.query("DELETE FROM customer_sessions WHERE account_id = $1", [accountId]);
      await pool.query("DELETE FROM customer_accounts WHERE id = $1", [accountId]);
      await pool.end();
    }
  });
});
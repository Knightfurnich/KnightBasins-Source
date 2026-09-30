import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const leadsManagerSource = readFileSync(
  new URL("../src/admin/LeadsManager.tsx", import.meta.url),
  "utf8",
);

test("matched slips or a positive slip count lock the Lead delete action", () => {
  assert.match(leadsManagerSource, /type FinancialSafetyLead = CustomerLead & \{/);
  assert.match(
    leadsManagerSource,
    /const hasFinancialLock = lead\.hasMatchedSlip === true \|\| paymentSlipCount > 0;/,
  );
  assert.match(leadsManagerSource, /🔒 มีสลิป \{paymentSlipCount\} ใบ/);
  assert.match(leadsManagerSource, /data-testid=\{`badge-financial-lock-\$\{lead\.id\}`\}/);
  assert.match(leadsManagerSource, /disabled=\{hasFinancialLock\}/);
  assert.match(
    leadsManagerSource,
    /title=\{hasFinancialLock \? lockTooltip : undefined\}/,
  );
  assert.match(leadsManagerSource, /มีรายการเงินผูกอยู่ ไม่สามารถลบได้/);
});

test("delete controls are available in both table and card views", () => {
  assert.equal(
    (leadsManagerSource.match(/<LeadDeleteAction lead=\{lead\}/g) ?? []).length,
    2,
  );
  assert.match(leadsManagerSource, /data-testid=\{`button-delete-lead-\$\{lead\.id\}`\}/);
  assert.match(leadsManagerSource, /onClick=\{\(\) => onRequestDelete\(lead\)\}/);
});

test("the delete confirmation identifies the customer and job before allowing deletion", () => {
  assert.match(leadsManagerSource, /data-testid="dialog-confirm-delete-lead"/);
  assert.match(leadsManagerSource, /leadToDelete\?\.name/);
  assert.match(leadsManagerSource, /leadToDelete\?\.leadKey/);
  assert.match(leadsManagerSource, /การลบนี้ไม่สามารถเรียกคืนได้/);
  assert.match(leadsManagerSource, /onClick=\{\(\) => void confirmLeadDeletion\(\)\}/);
});

test("confirmed deletion sends authenticated DELETE, handles financial conflicts, and refreshes Leads", () => {
  assert.match(
    leadsManagerSource,
    /if \(lead\.hasMatchedSlip === true \|\| \(lead\.paymentSlipCount \?\? 0\) > 0\)/,
  );
  assert.match(
    leadsManagerSource,
    /fetch\(`\/api\/admin\/leads\/\$\{lead\.id\}`, \{\s*method: "DELETE",\s*credentials: "include",/,
  );
  assert.match(
    leadsManagerSource,
    /queryClient\.invalidateQueries\(\{ queryKey: \["\/api\/admin\/leads"\] \}\)/,
  );
  assert.match(leadsManagerSource, /toast\(\{ description: "ลบ Lead เรียบร้อยแล้ว" \}\)/);
  assert.match(leadsManagerSource, /variant: "destructive"/);
});
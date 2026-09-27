import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminSource = readFileSync(new URL("../src/admin/PortfolioGalleryPage.tsx", import.meta.url), "utf8");
const publicSource = readFileSync(new URL("../src/pages/PortfolioPage.tsx", import.meta.url), "utf8");

test("multi-select toggle opens and closes selection mode with a clearable toolbar", () => {
  assert.match(adminSource, /data-testid="button-portfolio-toggle-multiselect"/);
  assert.match(adminSource, /onClick=\{handleToggleMultiSelectMode\}/);
  assert.match(adminSource, /aria-pressed=\{multiSelectMode\}/);
  assert.match(adminSource, /data-testid="portfolio-multiselect-toolbar"/);

  const toggleHandler = adminSource.match(/const handleToggleMultiSelectMode = \(\) => \{([\s\S]*?)\n  \};/);
  assert.ok(toggleHandler, "The multi-select button must use a shared toggle handler");
  assert.match(toggleHandler?.[1] ?? "", /setMultiSelectMode\(false\)/);
  assert.match(toggleHandler?.[1] ?? "", /setSelectedBatchDeleteIds\(\[\]\)/);
  assert.match(toggleHandler?.[1] ?? "", /setMultiSelectMode\(true\)/);
});

test("each visible card has a checkbox and the selection controls show the count", () => {
  assert.match(adminSource, /multiSelectMode && \([\s\S]*?data-testid=\{`checkbox-portfolio-item-\$\{item\.id\}`\}/);
  assert.match(adminSource, /checked=\{selectedBatchDeleteIds\.includes\(item\.id\)\}/);
  assert.match(adminSource, /เลือกแล้ว \{selectedBatchDeleteIds\.length\} รายการ/);
  assert.match(adminSource, /data-testid="button-portfolio-batch-delete"[\s\S]*?ลบที่เลือก \(\$\{selectedBatchDeleteIds\.length\}\)/);
});

test("selection and select-all stay within the API limit of 50 items", () => {
  assert.match(adminSource, /const PORTFOLIO_BATCH_DELETE_LIMIT = 50/);
  assert.match(adminSource, /if \(current\.length >= PORTFOLIO_BATCH_DELETE_LIMIT\) return current/);
  assert.match(adminSource, /if \(next\.length >= PORTFOLIO_BATCH_DELETE_LIMIT\) break/);
  assert.match(adminSource, /ids\.length > PORTFOLIO_BATCH_DELETE_LIMIT/);
  assert.match(adminSource, /data-testid="button-portfolio-select-all-visible"/);
  assert.match(adminSource, /data-testid="button-portfolio-clear-selection"/);
});

test("batch deletion always opens a confirmation dialog before calling the mutation", () => {
  const openHandler = adminSource.match(/const openBatchDeleteConfirmation = \(\) => \{([\s\S]*?)\n  \};/);
  const confirmHandler = adminSource.match(/const confirmBatchDelete = \(\) => \{([\s\S]*?)\n  \};/);
  assert.ok(openHandler, "The batch delete button must open a confirmation dialog");
  assert.ok(confirmHandler, "Only the dialog confirmation handler should start deletion");
  assert.match(openHandler?.[1] ?? "", /setBatchDeleteDialogOpen\(true\)/);
  assert.doesNotMatch(openHandler?.[1] ?? "", /batchDeleteMutation\.mutate/);
  assert.match(confirmHandler?.[1] ?? "", /batchDeleteMutation\.mutate\(\[\.\.\.selectedBatchDeleteIds\]\)/);
  assert.match(adminSource, /open=\{batchDeleteDialogOpen\}/);
  assert.match(adminSource, /data-testid="button-confirm-batch-delete"/);
  assert.match(
    adminSource,
    /คุณต้องการลบรูปภาพที่เลือกจำนวน \{selectedBatchDeleteIds\.length\} รูปอย่างถาวรใช่หรือไม่\? รูปภาพและไฟล์จริงบนเซิร์ฟเวอร์จะถูกลบทันที/,
  );
});

test("sends selected IDs by POST and refreshes the portfolio and duplicate queries", () => {
  assert.match(adminSource, /fetch\("\/api\/admin\/portfolio\/batch-delete", \{\s*method: "POST",/);
  assert.match(adminSource, /body: JSON\.stringify\(\{ ids \}\)/);
  assert.match(adminSource, /queryClient\.invalidateQueries\(\{ queryKey: \["\/api\/portfolio"\] \}\)/);
  assert.match(adminSource, /queryClient\.invalidateQueries\(\{ queryKey: DUPLICATES_QUERY_KEY \}\)/);
  assert.match(adminSource, /ลบรูปภาพเรียบร้อยแล้ว \$\{result\.deletedIds\.length\} รายการ/);
});

test("batch-delete controls and admin API calls remain off the public portfolio page", () => {
  assert.doesNotMatch(publicSource, /\/api\/admin\/portfolio\/batch-delete/);
  assert.doesNotMatch(publicSource, /button-portfolio-toggle-multiselect|checkbox-portfolio-item|button-portfolio-batch-delete/);
});
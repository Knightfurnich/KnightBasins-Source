import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminSource = readFileSync(new URL("../src/admin/PortfolioGalleryPage.tsx", import.meta.url), "utf8");
const publicSource = readFileSync(new URL("../src/pages/PortfolioPage.tsx", import.meta.url), "utf8");

test("upload UI selects multiple images, captures per-image titles, and posts the API file field", () => {
  assert.match(adminSource, /data-testid="button-open-portfolio-upload"/);
  assert.match(adminSource, /data-testid="dialog-portfolio-upload"/);
  assert.match(adminSource, /accept="image\/\*"\s+multiple/);
  assert.match(adminSource, /onDrop=\{\(event\) => \{[\s\S]*?queueUploadFiles\(event\.dataTransfer\.files\)/);
  assert.match(adminSource, /data-testid="select-portfolio-upload-category"/);
  assert.match(adminSource, /data-testid=\{`input-portfolio-upload-title-\$\{draft\.id\}`\}/);
  assert.match(adminSource, /formData\.append\("file", draft\.file\)/);
  assert.match(adminSource, /fetch\("\/api\/admin\/portfolio\/upload", \{ method: "POST", body: formData \}\)/);
  assert.match(adminSource, /กำลังอัปโหลด… \(\{uploadProgress\}\/\{uploadMutation\.variables\?\.drafts\.length/);
  assert.match(adminSource, /invalidateQueries\(\{ queryKey: \["\/api\/portfolio"\] \}\)/);
});

test("all-category view requests the complete collection while category views stay scoped", () => {
  assert.match(adminSource, /async function fetchPortfolio\(\s*category: string,\s*offset = 0,\s*limit: number \| "all" = category === "all" \? "all" : 200/);
  assert.match(adminSource, /new URLSearchParams\(\{ limit: String\(limit\), includeHidden: "true" \}\)/);
  assert.match(adminSource, /if \(category !== "all"\) params\.set\("category", category\)/);
  assert.match(adminSource, /if \(offset > 0\) params\.set\("offset", String\(offset\)\)/);
  assert.match(adminSource, /queryFn: \(\) => fetchPortfolio\(selectedCategory\)/);
});

test("pagination shows loaded and total counts and offers the API-provided next page", () => {
  assert.match(adminSource, /hasMore\?: boolean/);
  assert.match(adminSource, /nextOffset\?: number \| null/);
  assert.match(adminSource, /fetchPortfolio\(category, offset, 200\)/);
  assert.match(adminSource, /queryClient\.setQueryData<PortfolioResponse>\(\["\/api\/portfolio", category\]/);
  assert.match(adminSource, /items: \[\.\.\.current\.items, \.\.\.page\.items\.filter\(\(item\) => !existingIds\.has\(item\.id\)\)\]/);
  assert.match(adminSource, /data-testid="status-portfolio-count"[\s\S]*?แสดง \{filteredItems\.length\} จาก \{portfolioQuery\.data\.count\} รายการ/);
  assert.match(adminSource, /portfolioQuery\.data\.hasMore === true && \([\s\S]*?data-testid="button-portfolio-load-more"/);
  assert.match(adminSource, /offset: nextOffset/);
});

test("search, visibility, and duplicate filters compose over the loaded portfolio items", () => {
  assert.match(adminSource, /const allItems = portfolioQuery\.data\?\.items \?\? \[\]/);
  assert.match(adminSource, /filterPortfolioItems\(allItems, searchQuery\)/);
  assert.match(adminSource, /filterPortfolioItemsByVisibility\(searchedItems, visibilityFilter\)/);
  assert.match(adminSource, /onlyDuplicates \? visibleItems\.filter\(\(item\) => duplicateIds\.has\(item\.id\)\) : visibleItems/);
});

test("card and lightbox deletion share a confirmation guard and the DELETE endpoint", () => {
  const confirmationText = "ลบรูปนี้ออกจากคลังผลงานถาวร? รูปจะหายจากหน้าเว็บและลบไฟล์ออกจากเซิร์ฟเวอร์";
  assert.ok(adminSource.includes(confirmationText));
  assert.match(adminSource, /fetch\(`\/api\/admin\/portfolio\/\$\{encodeURIComponent\(id\)\}`, \{ method: "DELETE" \}\)/);
  assert.match(adminSource, /data-testid=\{`button-delete-portfolio-item-\$\{item\.id\}`\}/);
  assert.match(adminSource, /data-testid=\{`button-delete-portfolio-item-lightbox-\$\{item\.id\}`\}/);

  const handler = adminSource.match(/const handleDeletePortfolioItem = \(item: PortfolioItem\) => \{([\s\S]*?)\n  \};/);
  assert.ok(handler, "Both delete buttons must use the shared confirmation handler");
  const guard = handler?.[1] ?? "";
  assert.ok(guard.indexOf("window.confirm(DELETE_CONFIRMATION_TEXT)") >= 0);
  assert.ok(guard.indexOf("window.confirm(DELETE_CONFIRMATION_TEXT)") < guard.indexOf("deleteMutation.mutate(item.id)"));
  assert.match(guard, /if \(!window\.confirm\(DELETE_CONFIRMATION_TEXT\)\) return/);
});

test("duplicate API groups mark matching cards and the duplicate-only filter narrows results", () => {
  assert.match(adminSource, /fetch\("\/api\/admin\/portfolio\/duplicates"\)/);
  assert.match(adminSource, /new Set\(\(duplicatesQuery\.data\?\.groups \?\? \[\]\)\.flatMap\(\(group\) => group\.itemIds\)\)/);
  assert.match(adminSource, /data-testid=\{`badge-portfolio-duplicate-\$\{item\.id\}`\}/);
  assert.match(adminSource, /data-testid="button-portfolio-filter-duplicates"/);
  assert.match(adminSource, /onlyDuplicates \? visibleItems\.filter\(\(item\) => duplicateIds\.has\(item\.id\)\) : visibleItems/);
});

test("public portfolio page contains no admin upload or delete controls or requests", () => {
  assert.doesNotMatch(publicSource, /\/api\/admin\/portfolio\//);
  assert.doesNotMatch(publicSource, /button-open-portfolio-upload|button-delete-portfolio-item/);
});
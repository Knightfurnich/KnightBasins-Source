import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

/**
 * job 443-B — an upload must not reach the record before the editor has seen the
 * picture next to the SKU it belongs to. The pure rules live in uploadSafety.ts
 * (imported and executed for real); the wiring is asserted against the component
 * source in the style this repo already uses.
 */
import {
  STANDARD_MIN_PX,
  isBelowStandard,
  minSide,
  pendingImageSummary,
  probeStandardHdImage,
  readImageSizeFromElement,
  sizeWarningText,
  standardHdImageUrl,
  standardHdIsReal,
} from "../src/admin/uploadSafety.ts";

const [fieldSource, managerSource, uploadSafety, appSource] = await Promise.all([
  readFile(new URL("../src/admin/BasinImageManagerField.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/admin/BasinsManager.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/admin/uploadSafety.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/App.tsx", import.meta.url), "utf8"),
]);

describe("standard HD image lookup is honest (443-B C)", () => {
  it("builds the stock path only from a clean SKU", () => {
    assert.equal(standardHdImageUrl("kf003"), "/kb/images/basin-hd/KF003.jpg");
    assert.equal(standardHdImageUrl(" KF006 "), "/kb/images/basin-hd/KF006.jpg");
    assert.equal(standardHdImageUrl(""), null);
    assert.equal(standardHdImageUrl(null), null);
    assert.equal(standardHdImageUrl("../../etc/passwd"), null, "never a path we did not build");
    assert.equal(standardHdImageUrl("a"), null);
  });

  it("counts only a real image response, and never guesses a missing file", async () => {
    assert.equal(standardHdIsReal({ status: 200, headers: { get: () => "image/jpeg" } }), true);
    assert.equal(standardHdIsReal({ status: 200, headers: { get: () => "text/html" } }), false, "SPA index.html is not a photo");
    assert.equal(standardHdIsReal({ status: 404, headers: { get: () => "image/jpeg" } }), false);

    const seen: string[] = [];
    const missing = await probeStandardHdImage("/nope.jpg", (async (url: string) => {
      seen.push(String(url));
      return { status: 404, headers: { get: () => "text/html" } };
    }) as unknown as typeof fetch);
    assert.equal(missing, false);
    assert.equal(seen.length, 2, "HEAD then a ranged GET, then give up honestly");

    const thrown = await probeStandardHdImage("/boom.jpg", (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch);
    assert.equal(thrown, false, "a failed probe means unknown, never 'found'");
  });
});

describe("small images warn instead of blocking, and unreadable is not invented (443-B D + 9)", () => {
  it("flags the shortest side under the catalogue minimum", () => {
    assert.equal(STANDARD_MIN_PX, 600);
    assert.equal(minSide({ width: 4000, height: 2667 }), 2667);
    assert.equal(isBelowStandard({ width: 2667, height: 599 }), true);
    assert.equal(isBelowStandard({ width: 2667, height: 600 }), false, "exactly at the minimum is fine");
    assert.equal(isBelowStandard(null), false, "unknown size is not 'small'");
  });

  it("the warning names the measurement it has, and says so when it has none", () => {
    const warn = sizeWarningText({ width: 900, height: 480 });
    assert.match(warn, /480 px/);
    assert.match(warn, /600/);
    assert.equal(sizeWarningText({ width: 1200, height: 900 }), "");
    assert.match(sizeWarningText(null), /วัดความกว้าง×ยาวไม่ได้/);
    assert.match(sizeWarningText({ width: 0, height: 0 }), /วัดความกว้าง×ยาวไม่ได้/, "zero is unreadable, not a size");
    assert.equal(readImageSizeFromElement({ naturalWidth: 0, naturalHeight: 0 }), null);
  });

  it("the summary line shows SKU, file and pixels", () => {
    assert.equal(
      pendingImageSummary({ sku: "KF003", label: "kitchen.jpg", size: { width: 4000, height: 2667 } }),
      "KF003 · kitchen.jpg · 4000×2667 px",
    );
    assert.match(pendingImageSummary({ sku: "", label: "x.jpg", size: null }), /ไม่ระบุรุ่น .* วัดขนาดไม่ได้/);
  });
});

describe("the upload path asks before it writes (443-B A + B)", () => {
  it("a picked file is staged, previewed and only then committed", () => {
    assert.match(fieldSource, /const stageFile = async \(file: File\)/);
    assert.match(fieldSource, /URL\.createObjectURL\(file\)/);
    assert.match(fieldSource, /loadImageSize\(src\)/);
    // the pick handler must not upload; the upload call belongs to the confirmed commit
    const pickHandler = /onChange=\{\(event\) => \{[\s\S]*?\}\}\s*\/>\s*\n\s*\{pending &&/.exec(fieldSource);
    assert.ok(pickHandler, "file input wired to the staging flow");
    assert.doesNotMatch(pickHandler![0], /uploadImageFile/, "no upload straight from the picker");
    assert.match(fieldSource, /const commitPending = async \(\) => \{[\s\S]*?await uploadImageFile\(chosen\.file\)/);
    assert.equal((fieldSource.match(/uploadImageFile\(/g) ?? []).length, 1, "exactly one place can write");
  });

  it("the confirm box shows the thumbnail next to the SKU, the file name and the size", () => {
    assert.match(fieldSource, /role="dialog"[\s\S]{0,400}data-testid="dialog-confirm-basin-image"/);
    assert.match(fieldSource, /data-testid="img-basin-pending-thumbnail"/);
    assert.match(fieldSource, /data-testid="text-basin-pending-summary"/);
    assert.match(fieldSource, /pendingImageSummary\(\{ sku, label: pending\.label, size: pending\.size \}\)/);
    assert.match(fieldSource, /data-testid="text-basin-image-size-warning"/);
    assert.match(fieldSource, /data-testid="button-confirm-basin-image"/);
    assert.match(fieldSource, /data-testid="button-cancel-basin-image"/);
    assert.match(fieldSource, /ยังไม่เขียนทับจนกว่าคุณจะกดยืนยัน/);
  });

  it("the manager hands the SKU down, so the preview can name the model", () => {
    assert.match(managerSource, /<BasinImageManagerField\s*\n?\s*sku=\{form\.watch\("sku"\)\}/);
    assert.match(fieldSource, /sku\?: string \| null;/);
  });

  it("standard HD button exists, checks existence, and reports 'missing' without guessing", () => {
    assert.match(fieldSource, /data-testid="button-basin-standard-hd"/);
    assert.match(fieldSource, /probeStandardHdImage\(url\)/);
    assert.match(fieldSource, /data-testid="text-basin-standard-hd-missing"/);
    assert.match(fieldSource, /ไม่พบภาพ HD มาตรฐานของรุ่นนี้/);
    assert.match(fieldSource, /เราไม่ใส่ภาพของรุ่นอื่นแทน/);
    assert.match(fieldSource, /min-h-\[44px\]/, "the new buttons stay tap-sized at narrow widths");
  });

  it("nothing masks overflow and job 416-B's upload rules stay alone in data/", () => {
    for (const [name, src] of Object.entries({ fieldSource, appSource })) {
      assert.ok(!/html\s*\{[^}]*overflow-x:\s*hidden/.test(src) && !/body\s*\{[^}]*overflow-x:\s*hidden/.test(src), name);
    }
    assert.doesNotMatch(uploadSafety, /imageUploadClient/, "no network writes from the pure helper file");
  });

  it("E: no shape wording is hard-coded, and the card still hides a null label (#511)", () => {
    assert.ok(!/หลุมสี่เหลี่ยม|หลุมวงรี/.test(appSource) && !/หลุมสี่เหลี่ยม|หลุมวงรี/.test(fieldSource));
    // the customer card gate from #511 must survive this job untouched
    const cardGate = /function ProductCard[\s\S]*?\{bowlShapeText\(product\) && \(/.exec(appSource);
    assert.ok(cardGate, "ProductCard still renders the bowl shape only when data provides one");
    assert.match(appSource, /const BOWL_SHAPE_KEYS = \["bowlShapeLabel"\] as const;/);
  });
});

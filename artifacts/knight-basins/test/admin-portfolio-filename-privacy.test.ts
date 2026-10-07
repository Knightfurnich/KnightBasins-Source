import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

// job-287: the rename has to be reachable from the admin gallery, because the API alone leaves the legacy LINE-album
// file names sitting in public URLs that a customer's name is already inside. The page is allowed to know nothing about
// naming - it asks, renders what the server reported, and repeats the count back - so lock exactly that shape.

const page = readFileSync(new URL("../src/admin/PortfolioGalleryPage.tsx", import.meta.url), "utf8");

describe("portfolio admin: filename privacy control (job-287)", () => {
  it("calls the admin privacy endpoint through the shared client path and never on mount", () => {
    assert.match(page, /fetch\("\/api\/admin\/portfolio\/filename-privacy"/, "the page must call the admin route");
    // definition + exactly the two operator-triggered calls; anything more means something is firing it by itself
    const calls = page.split("requestPortfolioFilenamePrivacy(").length - 1;
    assert.equal(calls, 3, `expected 1 definition + 2 operator-triggered calls, found ${calls}`);
    assert.equal(/useEffect\([^)]*requestPortfolioFilenamePrivacy/s.test(page), false, "the check must never run on mount");
  });

  it("never renames without the count the server just reported, and asks the operator first", () => {
    assert.match(page, /requestPortfolioFilenamePrivacy\("inspect"\)/);
    assert.match(page, /requestPortfolioFilenamePrivacy\("anonymize", count\)/);
    assert.match(page, /const count = filenamePrivacy\?\.flaggedCount \?\? 0;/, "the confirm count comes from the server's answer, not a guess");
    assert.match(page, /window\.confirm/, "renaming public URLs needs an explicit human confirmation");
  });

  it("states the consequence on screen instead of hiding it", () => {
    assert.match(page, /ลิงก์เดิมจะใช้ไม่ได้/);
    assert.match(page, /status-portfolio-filename-privacy/);
    assert.match(page, /button-portfolio-anonymize-filenames/);
  });
});

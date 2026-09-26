import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkCutoutJointClash,
  MIN_BASIN_CLEARANCE_MM,
  validateBasinClearance,
  validatePieceFabrication,
} from "../src/lib/fabrication-geometry.ts";

// ---- validateBasinClearance ------------------------------------------------

describe("validateBasinClearance", () => {
  it("passes when every side clears exactly 100mm (the boundary itself must pass)", () => {
    // Counter 2000x600, basin 600x400, placed so left=100, right=2000-(100+600)=1300,
    // front=100, back=600-(100+400)=100 -- min side is exactly 100.
    const result = validateBasinClearance(2000, 600, 600, 400, 100, 100);
    assert.equal(result.valid, true);
    assert.equal(result.minClearanceMm, 100);
  });

  it("fails when the tightest side is 99mm, just under the floor", () => {
    const result = validateBasinClearance(2000, 600, 600, 400, 99, 100);
    assert.equal(result.valid, false);
    assert.equal(result.minClearanceMm, 99);
  });

  it("passes comfortably when every side clears more than 100mm", () => {
    // Counter 2000x800, basin 600x400, placed at (300,200): left=300, right=1100, front=200, back=200.
    const result = validateBasinClearance(2000, 800, 600, 400, 300, 200);
    assert.equal(result.valid, true);
    assert.equal(result.minClearanceMm, 200);
  });

  it("reports the tightest of the 4 sides, not an average or the first checked", () => {
    // left=500, right=2000-(500+600)=900, front=500, back=600-(500+400)=-300 -- back is the binding (and negative) side.
    const result = validateBasinClearance(2000, 600, 600, 400, 500, 500);
    assert.equal(result.valid, false);
    assert.equal(result.minClearanceMm, -300);
  });

  it("never accepts a clearance under MIN_BASIN_CLEARANCE_MM, the hard company floor", () => {
    assert.equal(MIN_BASIN_CLEARANCE_MM, 100);
    const result = validateBasinClearance(2000, 600, 600, 400, MIN_BASIN_CLEARANCE_MM - 1, 100);
    assert.equal(result.valid, false);
  });

  it("comes back invalid (never throws) for non-finite inputs", () => {
    assert.doesNotThrow(() => validateBasinClearance(NaN, 600, 600, 400, 100, 100));
    const result = validateBasinClearance(NaN, 600, 600, 400, 100, 100);
    assert.equal(result.valid, false);
    assert.ok(Number.isNaN(result.minClearanceMm));
  });
});

// ---- checkCutoutJointClash --------------------------------------------------

describe("checkCutoutJointClash", () => {
  it("detects a clash when a joint point falls inside the cutout rectangle", () => {
    // Cutout spans x:[400,1000], y:[50,450]; joint sits well inside it.
    const clash = checkCutoutJointClash(400, 50, 600, 400, [{ x: 700, y: 250 }]);
    assert.equal(clash, true);
  });

  it("does not flag a clash when every joint is well outside the cutout", () => {
    const clash = checkCutoutJointClash(400, 50, 600, 400, [{ x: 50, y: 50 }, { x: 1500, y: 900 }]);
    assert.equal(clash, false);
  });

  it("treats a joint exactly on the cutout's edge as a clash (inclusive bounds, conservative)", () => {
    // Cutout spans x:[400,1000], y:[50,450]; joint sits exactly on the right edge.
    const clash = checkCutoutJointClash(400, 50, 600, 400, [{ x: 1000, y: 250 }]);
    assert.equal(clash, true);
  });

  it("returns false for an empty joints list", () => {
    assert.equal(checkCutoutJointClash(400, 50, 600, 400, []), false);
  });

  it("flags a clash if ANY joint in the list falls inside the cutout, not just the first", () => {
    const clash = checkCutoutJointClash(400, 50, 600, 400, [
      { x: 0, y: 0 },
      { x: 999999, y: 999999 },
      { x: 700, y: 250 },
    ]);
    assert.equal(clash, true);
  });
});

// ---- validatePieceFabrication -----------------------------------------------

describe("validatePieceFabrication", () => {
  it("accepts a normal I-shape piece", () => {
    const result = validatePieceFabrication({ shape: "I", runAMm: 2400, depthMm: 600 });
    assert.deepEqual(result, { valid: true });
  });

  it("accepts a normal L-shape piece with a valid runBMm", () => {
    const result = validatePieceFabrication({ shape: "L", runAMm: 2400, depthMm: 600, runBMm: 1200 });
    assert.deepEqual(result, { valid: true });
  });

  it("accepts a normal U-shape piece with valid runBMm and runCMm", () => {
    const result = validatePieceFabrication({ shape: "U", runAMm: 2400, depthMm: 600, runBMm: 1200, runCMm: 1500 });
    assert.deepEqual(result, { valid: true });
  });

  it("accepts shape given in lowercase, since fabrication data isn't guaranteed to be uppercase", () => {
    const result = validatePieceFabrication({ shape: "i", runAMm: 2400, depthMm: 600 });
    assert.equal(result.valid, true);
  });

  it("rejects an unknown shape", () => {
    const result = validatePieceFabrication({ shape: "Z", runAMm: 2400, depthMm: 600 });
    assert.equal(result.valid, false);
    assert.ok(result.reason?.includes("Unknown shape"));
  });

  it("rejects an L shape missing its required runBMm", () => {
    const result = validatePieceFabrication({ shape: "L", runAMm: 2400, depthMm: 600 });
    assert.equal(result.valid, false);
    assert.ok(result.reason?.includes("runBMm"));
  });

  it("rejects a U shape missing its required runCMm", () => {
    const result = validatePieceFabrication({ shape: "U", runAMm: 2400, depthMm: 600, runBMm: 1200 });
    assert.equal(result.valid, false);
    assert.ok(result.reason?.includes("runCMm"));
  });

  describe("run-length boundary (100mm - 10,000mm)", () => {
    it("rejects a run just under 100mm", () => {
      assert.equal(validatePieceFabrication({ shape: "I", runAMm: 99, depthMm: 600 }).valid, false);
    });
    it("accepts a run at exactly 100mm", () => {
      assert.equal(validatePieceFabrication({ shape: "I", runAMm: 100, depthMm: 600 }).valid, true);
    });
    it("accepts a run at exactly 10,000mm", () => {
      assert.equal(validatePieceFabrication({ shape: "I", runAMm: 10_000, depthMm: 600 }).valid, true);
    });
    it("rejects a run just over 10,000mm", () => {
      assert.equal(validatePieceFabrication({ shape: "I", runAMm: 10_001, depthMm: 600 }).valid, false);
    });
  });

  describe("depth boundary (100mm - 3,000mm)", () => {
    it("rejects a depth just under 100mm", () => {
      assert.equal(validatePieceFabrication({ shape: "I", runAMm: 2400, depthMm: 99 }).valid, false);
    });
    it("accepts a depth at exactly 100mm", () => {
      assert.equal(validatePieceFabrication({ shape: "I", runAMm: 2400, depthMm: 100 }).valid, true);
    });
    it("accepts a depth at exactly 3,000mm", () => {
      assert.equal(validatePieceFabrication({ shape: "I", runAMm: 2400, depthMm: 3_000 }).valid, true);
    });
    it("rejects a depth just over 3,000mm", () => {
      assert.equal(validatePieceFabrication({ shape: "I", runAMm: 2400, depthMm: 3_001 }).valid, false);
    });
  });

  it("rejects NaN/Infinity dimensions rather than throwing", () => {
    assert.doesNotThrow(() => validatePieceFabrication({ shape: "I", runAMm: NaN, depthMm: 600 }));
    assert.equal(validatePieceFabrication({ shape: "I", runAMm: NaN, depthMm: 600 }).valid, false);
    assert.equal(validatePieceFabrication({ shape: "I", runAMm: Infinity, depthMm: 600 }).valid, false);
  });

  it("rejects an L shape whose runBMm is itself out of the safe range", () => {
    const result = validatePieceFabrication({ shape: "L", runAMm: 2400, depthMm: 600, runBMm: 50 });
    assert.equal(result.valid, false);
    assert.ok(result.reason?.includes("runBMm"));
  });
});

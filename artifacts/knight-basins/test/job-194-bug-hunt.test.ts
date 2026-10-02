import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const viewerSource = readFileSync(new URL("../src/components/StoneSlabViewer.tsx", import.meta.url), "utf8");
const stylesheet = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

test(
  "saved Studio quote preserves the stone image URL when projecting notification items",
  { todo: "P2: saved.notification mapping currently drops imageUrl; activate after the approved logic fix" },
  () => {
    const projection = appSource.match(
      /saved\.notification\.items\.filter\([\s\S]*?\)\.map\(\(item\)\s*=>\s*\(\{([\s\S]*?)\}\)\)/,
    );
    assert.ok(projection, "Saved notification items should be projected into formal quote items");
    assert.match(projection[1], /^\s*imageUrl:\s*item\.imageUrl,\s*$/m);
  },
);

test(
  "stone slab dialog moves focus inside, traps tab navigation, and restores focus",
  { todo: "P2: modal currently has no focus management; activate after the approved accessibility fix" },
  () => {
    const modal = viewerSource.match(/function StoneSlabModal\([\s\S]*?\n\}/)?.[0] ?? "";
    assert.match(modal, /\.focus\(\)/, "Opening the dialog should move focus to a dialog control");
    assert.match(modal, /event\.key\s*===\s*["']Tab["']/, "Tab navigation should be contained in the dialog");
  },
);

test(
  "A4 US grand-total label remains readable without wrapping",
  { todo: "P3: the current PDF wraps the net-total label; activate after the approved print-layout fix" },
  () => {
    const printStyles = stylesheet.match(/@media print\s*\{([\s\S]*)/)?.[1] ?? "";
    assert.match(
      printStyles,
      /\.formal-grand-total\s*>\s*span\s*\{[^}]*white-space:\s*nowrap/,
      "The printed total label should stay together on one line",
    );
  },
);
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const viewerSource = readFileSync(new URL("../src/components/StoneSlabViewer.tsx", import.meta.url), "utf8");
const stylesheet = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

test(
  "saved Studio quote preserves the stone image URL when projecting notification items",
  () => {
    const mapStart = appSource.indexOf("saved.notification.items.filter");
    const mapEnd = appSource.indexOf("notificationKind: item.kind,", mapStart);
    assert.ok(mapStart >= 0 && mapEnd > mapStart, "Saved notification items should be projected into formal quote items");
    assert.match(appSource.slice(mapStart, mapEnd), /imageUrl:\s*item\.imageUrl,/);
  },
);

test(
  "stone slab dialog focuses its close button and restores focus to the trigger",
  () => {
    assert.match(viewerSource, /closeButtonRef\.current\?\.focus\(\)/, "Opening the dialog should focus the close button");
    assert.match(viewerSource, /ref={closeButtonRef}/, "The close button should own the modal focus target");
    assert.match(viewerSource, /return \(\) => onRestoreFocus\(\)/, "Closing the modal should restore trigger focus");
    assert.match(viewerSource, /openButtonRef\.current\?\.focus\(\)/, "Focus should return to the trigger button");
    assert.match(viewerSource, /ref={openButtonRef}/, "The trigger button should be retained as the return-focus target");
  },
);

test(
  "A4 US grand-total label remains readable without wrapping",
  () => {
    const printStyles = stylesheet.match(/@media print\s*\{([\s\S]*)/)?.[1] ?? "";
    assert.match(
      printStyles,
      /\.formal-grand-total\s*>\s*span\s*\{[^}]*white-space:\s*nowrap/,
      "The printed total label should stay together on one line",
    );
  },
);
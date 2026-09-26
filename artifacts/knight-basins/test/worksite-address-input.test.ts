import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../src/components/WorksiteAddressAutocomplete.tsx", import.meta.url),
  "utf8",
);

test("address input keeps the typed text while the parent form catches up", () => {
  // Regression guard: a controlled input whose parent lags a keystroke would
  // repaint an older value, so the visitor could not keep typing.
  assert.match(source, /const \[typedDraft, setTypedDraft\] = useState<string \| null>\(null\)/);
  assert.match(source, /const displayValue = typedDraft \?\? value/);
  assert.match(source, /value=\{displayValue\}/);
  assert.match(source, /setTypedDraft\(next\)/);
});

test("address panel never claims to be searching while the visitor is still typing", () => {
  // Regression guard: the 350ms debounce used to show the "กำลังค้นหาตำแหน่ง…"
  // spinner on every keystroke, which read as a hung field.
  assert.match(source, /const isWaitingForDebounce = !queryMatchesValue && !isFetching/);
  assert.match(source, /พิมพ์ต่อได้เลยครับ ระบบจะค้นหาให้เอง/);
  assert.doesNotMatch(source, /\{isFetching \|\| !queryMatchesValue \?/);
});

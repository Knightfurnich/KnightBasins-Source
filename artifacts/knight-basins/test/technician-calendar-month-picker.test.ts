import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const pageUrl = new URL("../src/admin/TechnicianCalendarPage.tsx", import.meta.url);
const pageSource = await readFile(pageUrl, "utf8");
const pageAst = ts.createSourceFile(
  fileURLToPath(pageUrl),
  pageSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const dateHelperNames = [
  "selectMonth",
  "selectYear",
  "shiftMonth",
  "addCalendarDays",
  "startOfWeekMonday",
] as const;

function loadDateHelpers() {
  const helpers = pageAst.statements.filter(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement)
      && Boolean(statement.name)
      && dateHelperNames.includes(statement.name!.text as (typeof dateHelperNames)[number]),
  );
  assert.equal(
    helpers.length,
    dateHelperNames.length,
    "The calendar page should declare every tested date helper",
  );
  const helperSource = helpers
    .map((helper) => pageSource.slice(helper.getStart(pageAst), helper.end).replace(/^export\s+/, ""))
    .join("\n");
  const exportList = dateHelperNames.map((name) => `${name}`).join(", ");
  const compiled = ts.transpileModule(
    `${helperSource}\nreturn { ${exportList} };`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
  ).outputText;
  return new Function(compiled)() as {
    selectMonth: (currentDate: Date, monthIndex: number) => Date;
    selectYear: (currentDate: Date, buddhistYear: number) => Date;
    shiftMonth: (currentDate: Date, amount: number) => Date;
    addCalendarDays: (currentDate: Date, amount: number) => Date;
    startOfWeekMonday: (currentDate: Date) => Date;
  };
}

const { selectMonth, selectYear, shiftMonth, addCalendarDays, startOfWeekMonday } = loadDateHelpers();

function calendarDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function dateParts(date: Date) {
  return [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()];
}

describe("technician calendar month and year picker", () => {
  it("selects a month while preserving the current day", () => {
    assert.deepEqual(dateParts(selectMonth(calendarDate(2026, 3, 31), 9)), [2026, 10, 31]);
  });

  it("clamps the day to the last valid day in the selected month", () => {
    assert.deepEqual(dateParts(selectMonth(calendarDate(2026, 1, 31), 1)), [2026, 2, 28]);
    assert.deepEqual(dateParts(selectMonth(calendarDate(2028, 1, 31), 1)), [2028, 2, 29]);
  });

  it("converts Buddhist Era years and preserves the month and day", () => {
    assert.deepEqual(dateParts(selectYear(calendarDate(2025, 10, 31), 2570)), [2027, 10, 31]);
  });

  it("clamps leap day when the selected Buddhist Era year is not a leap year", () => {
    assert.deepEqual(dateParts(selectYear(calendarDate(2024, 2, 29), 2569)), [2026, 2, 28]);
  });

  it("rejects invalid picker values instead of silently changing the date", () => {
    assert.throws(() => selectMonth(calendarDate(2026, 1, 1), 12), RangeError);
    assert.throws(() => selectMonth(calendarDate(2026, 1, 1), -1), RangeError);
    assert.throws(() => selectYear(calendarDate(2026, 1, 1), 2569.5), RangeError);
  });
});

describe("technician calendar weekly date navigation", () => {
  it("starts weeks on Monday, including dates at either end of a week", () => {
    assert.deepEqual(dateParts(startOfWeekMonday(calendarDate(2026, 10, 4))), [2026, 9, 28]);
    assert.deepEqual(dateParts(startOfWeekMonday(calendarDate(2026, 10, 5))), [2026, 10, 5]);
  });

  it("moves by calendar days across month and year boundaries", () => {
    const monday = startOfWeekMonday(calendarDate(2026, 12, 30));
    assert.deepEqual(dateParts(monday), [2026, 12, 28]);
    assert.deepEqual(dateParts(addCalendarDays(monday, 6)), [2027, 1, 3]);
  });

  it("preserves the current day while moving between months", () => {
    assert.deepEqual(dateParts(shiftMonth(calendarDate(2026, 1, 31), 1)), [2026, 2, 28]);
    assert.deepEqual(dateParts(shiftMonth(calendarDate(2026, 1, 31), -1)), [2025, 12, 31]);
  });
});
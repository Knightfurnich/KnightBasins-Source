import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const knightBasinsRoot = join(testDir, "..");
const componentPath = join(knightBasinsRoot, "src/admin/TechnicianCalendarPage.tsx");
const componentUrl = pathToFileURL(componentPath).href;
const tsxLoaderPath = join(knightBasinsRoot, "../../scripts/node_modules/tsx/dist/loader.mjs");

const day = {
  date: "2026-09-27",
  dayStatus: "busy",
  totalJobs: 3,
  teams: [
    {
      teamCode: "NORTH",
      teamName: "ทีมเหนือ",
      status: "moderate",
      jobCount: 2,
      jobs: [
        { id: 101, name: "ติดตั้งเคาน์เตอร์ห้องครัว", project: "โครงการ A", address: "99/1 ถนนสุขุมวิท" },
        { id: 102, name: "ซ่อมขอบหิน", project: null, address: null },
      ],
    },
    {
      teamCode: "SOUTH",
      teamName: "ทีมใต้",
      status: "moderate",
      jobCount: 1,
      jobs: [
        { id: 103, name: "วัดหน้างาน", project: "โครงการ B", address: "88 ถนนพระราม 4" },
      ],
    },
  ],
};

const emptyDay = {
  date: "2026-09-28",
  dayStatus: "available",
  totalJobs: 0,
  teams: [
    { teamCode: "NORTH", teamName: "ทีมเหนือ", status: "available", jobCount: 0, jobs: [] },
  ],
};

const weather = {
  icon: "🌧️",
  description: "ฝนฟ้าคะนอง",
  tempMax: 34,
  rainProb: 70,
  isRainy: true,
};

const HARNESS_SCRIPT = `
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const calendar = await import(${JSON.stringify(componentUrl)});
const day = ${JSON.stringify(day)};
const emptyDay = ${JSON.stringify(emptyDay)};
const weather = ${JSON.stringify(weather)};
const message = calendar.buildDailyScheduleMessage(day, weather, new Date("2026-09-27T02:15:00.000Z"));
const emptyMessage = calendar.buildDailyScheduleMessage(emptyDay, undefined, new Date("2026-09-27T02:15:00.000Z"));
const copied = [];
const notifications = [];
const copySucceeded = await calendar.copyDailyScheduleToClipboard(
  message,
  async (text) => { copied.push(text); },
  (options) => { notifications.push(options); },
);
const copyFailed = await calendar.copyDailyScheduleToClipboard(
  message,
  async () => { throw new Error("clipboard unavailable"); },
  (options) => { notifications.push(options); },
);
const buttonMarkup = renderToStaticMarkup(createElement(calendar.DailyScheduleCopyButton, { onClick: () => {} }));
process.stdout.write(JSON.stringify({
  message,
  emptyMessage,
  copied,
  notifications,
  copySucceeded,
  copyFailed,
  buttonMarkup,
}));
`;

type HarnessResult = {
  message: string;
  emptyMessage: string;
  copied: string[];
  notifications: Array<{ description: string; variant?: string }>;
  copySucceeded: boolean;
  copyFailed: boolean;
  buttonMarkup: string;
};

let harness: HarnessResult;
let tmpDir: string | undefined;

before(() => {
  if (!existsSync(tsxLoaderPath)) {
    throw new Error(`Expected tsx's loader at ${tsxLoaderPath}; run "pnpm install" at the repo root.`);
  }

  const overrideTsconfig = {
    extends: join(knightBasinsRoot, "tsconfig.json").replace(/\\/g, "/"),
    compilerOptions: { jsx: "react-jsx" },
  };
  tmpDir = mkdtempSync(join(knightBasinsRoot, "node_modules", ".admin-calendar-copy-schedule-test-"));
  const tsconfigPath = join(tmpDir, "tsconfig.override.json");
  const harnessPath = join(tmpDir, "harness.mjs");
  writeFileSync(tsconfigPath, JSON.stringify(overrideTsconfig), "utf8");
  writeFileSync(harnessPath, HARNESS_SCRIPT, "utf8");

  const stdout = execFileSync(
    process.execPath,
    ["--import", pathToFileURL(tsxLoaderPath).href, harnessPath],
    {
      cwd: knightBasinsRoot,
      env: { ...process.env, TSX_TSCONFIG_PATH: tsconfigPath },
      encoding: "utf8",
    },
  );
  harness = JSON.parse(stdout) as HarnessResult;
});

after(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("admin technician daily schedule LINE copy", () => {
  it("renders the copy button in the selected-day sheet", () => {
    assert.ok(harness.buttonMarkup.includes('data-testid="button-calendar-copy-daily-schedule"'));
    assert.ok(harness.buttonMarkup.includes("คัดลอกคิวงานส่ง LINE"));

    const source = readFileSync(componentPath, "utf8");
    assert.match(source, /<DailyScheduleCopyButton[\s\S]*?onClick=\{handleCopyDailySchedule\}/);
    assert.match(source, /<SheetContent[\s\S]*?data-testid="sheet-calendar-day-details"[\s\S]*?<DailyScheduleCopyButton/);
  });

  it("formats the Thai date and time, weather, and jobs grouped by technician team", () => {
    assert.deepEqual(harness.message.split("\n"), [
      "คิวช่างประจำวัน",
      "วันอาทิตย์ที่ 27 กันยายน 2569",
      "จัดทำเมื่อ 09:15 น.",
      "",
      "🌧️ สภาพอากาศหน้างาน: ฝนฟ้าคะนอง · สูงสุด 34°C · โอกาสฝน 70% · ⚠️ ระวังหินเปียกฝน",
      "",
      "ทีมช่าง: ทีมเหนือ",
      "1. ติดตั้งเคาน์เตอร์ห้องครัว",
      "   โครงการ: โครงการ A",
      "   สถานที่: 99/1 ถนนสุขุมวิท",
      "2. ซ่อมขอบหิน",
      "   โครงการ: ไม่ระบุ",
      "   สถานที่: ยังไม่ได้ระบุที่อยู่",
      "",
      "ทีมช่าง: ทีมใต้",
      "1. วัดหน้างาน",
      "   โครงการ: โครงการ B",
      "   สถานที่: 88 ถนนพระราม 4",
    ]);
  });

  it("states clearly when the selected day has no installation jobs", () => {
    assert.ok(harness.emptyMessage.includes("ไม่มีคิวงานติดตั้งในวันนี้"));
    assert.ok(!harness.emptyMessage.includes("ทีมช่าง:"));
  });

  it("copies the formatted message and shows the required success toast", () => {
    assert.equal(harness.copySucceeded, true);
    assert.deepEqual(harness.copied, [harness.message]);
    assert.deepEqual(harness.notifications[0], {
      description: "คัดลอกสรุปคิวงานส่ง LINE เรียบร้อยแล้ว",
    });
  });

  it("shows an error toast if the clipboard write fails", () => {
    assert.equal(harness.copyFailed, false);
    assert.deepEqual(harness.notifications[1], {
      description: "คัดลอกสรุปคิวงานส่ง LINE ไม่สำเร็จ",
      variant: "destructive",
    });
  });
});
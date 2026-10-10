import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const channelsSource = readFileSync(new URL("../src/data/contact-channels.ts", import.meta.url), "utf8");

function sourceBetween(startMarker: string, endMarker: string): string {
  const start = appSource.indexOf(startMarker);
  const end = appSource.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `Expected source section between ${startMarker} and ${endMarker}`);
  return appSource.slice(start, end);
}

function handlerBody(source: string, name: string): string {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`const ${escapedName} = \\(\\) => \\{([\\s\\S]*?)\\n\\s*\\};`));
  assert.ok(match, `Expected ${name} event handler`);
  return match?.[1] ?? "";
}

const appComponent = sourceBetween("function App()", "type NetworkBannerStatus");
const networkComponent = sourceBetween("function NetworkStatusBanner()", "type AppErrorBoundaryState");
const errorBoundary = sourceBetween("class AppErrorBoundary", "function RootEntry()");

test("offline event sets the warning state and preserves the Studio draft reassurance", () => {
  assert.match(networkComponent, /typeof navigator !== "undefined" && !navigator\.onLine/);
  assert.match(networkComponent, /window\.addEventListener\("offline", handleOffline\)/);
  assert.match(networkComponent, /ข้อมูลร่างใน Studio จะยังคงบันทึกไว้ในเครื่อง/);

  const calls: Array<[string, unknown?]> = [];
  const offlineHandler = new Function(
    "clearTimers",
    "setStatus",
    "setIsFading",
    `return () => {${handlerBody(networkComponent, "handleOffline")}};`,
  )(
    () => calls.push(["clearTimers"]),
    (status: string) => calls.push(["setStatus", status]),
    (isFading: boolean) => calls.push(["setIsFading", isFading]),
  ) as () => void;

  offlineHandler();
  assert.deepEqual(calls, [
    ["clearTimers"],
    ["setStatus", "offline"],
    ["setIsFading", false],
  ]);
  assert.match(networkComponent, /data-testid=\{isOffline \? "status-network-offline"/);
});

test("online event shows a green recovery message briefly, then fades it out", () => {
  assert.match(networkComponent, /window\.addEventListener\("online", handleOnline\)/);
  assert.match(networkComponent, /setStatus\("online"\)/);
  assert.match(networkComponent, /setIsFading\(true\), 2700\)/);
  assert.match(networkComponent, /setStatus\("hidden"\)[\s\S]*?\}, 3000\)/);
  assert.match(networkComponent, /เชื่อมต่ออินเทอร์เน็ตเรียบร้อยแล้ว/);
  assert.match(networkComponent, /border-emerald-300 bg-emerald-50 text-emerald-900/);
  assert.match(networkComponent, /transition-opacity duration-300/);
  assert.match(networkComponent, /window\.removeEventListener\("offline", handleOffline\)/);
  assert.match(networkComponent, /window\.removeEventListener\("online", handleOnline\)/);
});

test("Error Boundary switches to a Thai fallback with reload and support contact", () => {
  const derivedState = errorBoundary.match(
    /static getDerivedStateFromError\(_error: Error\): AppErrorBoundaryState \{([\s\S]*?)\n  \}/,
  );
  assert.ok(derivedState, "Error Boundary exposes React's render-error lifecycle");
  const nextState = new Function(derivedState?.[1] ?? "")() as { hasError: boolean };
  assert.deepEqual(nextState, { hasError: true });

  assert.match(errorBoundary, /componentDidCatch\(error: Error, errorInfo: ErrorInfo\)/);
  assert.match(errorBoundary, /data-testid="app-error-boundary-fallback"/);
  assert.match(errorBoundary, /ขออภัย เกิดข้อผิดพลาดในการแสดงหน้านี้/);
  assert.match(errorBoundary, /window\.location\.reload\(\)/);
  assert.match(errorBoundary, /🔄 โหลดหน้านี้ใหม่/);
  assert.match(errorBoundary, /href=\{telHref\(CONTACT_PHONE_PRIMARY\)\}/);
  // the digits must still be the sales line, just declared once, in the constants module
  assert.match(channelsSource, /export const CONTACT_PHONE_PRIMARY = "094-496-1949"/);
  assert.match(errorBoundary, /\{CONTACT_PHONE_PRIMARY\}|094-496-1949/);
  // the number itself is no longer typed in App.tsx -- prove the constant still says it
  assert.match(channelsSource, /export const CONTACT_PHONE_PRIMARY = "094-496-1949"/);
});

test("the Error Boundary and network status banner wrap every app route", () => {
  assert.match(
    appComponent,
    /<AppErrorBoundary>\s*(?:<RouteMeta[\s\S]*?\/>\s*)?<NetworkStatusBanner\s*\/>\s*<QueryClientProvider[\s\S]*?<Switch>/,
  );
  assert.match(appComponent, /<Toaster\s*\/>\s*<\/QueryClientProvider>\s*<\/AppErrorBoundary>/);
});
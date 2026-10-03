import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const supportSource = readFileSync(
  new URL("../src/components/KnightSupport.tsx", import.meta.url),
  "utf8",
);

describe("KnightSupport guest-scope UI", () => {
  it("shows the approved three-line welcome and distinguishes general from LINE mode", () => {
    assert.match(
      supportSource,
      /text: "สวัสดีค่ะ น้องไนท์ยินดีให้บริการค่ะ 💬\\nโหมดทั่วไป \(ยังไม่เข้าสู่ระบบ\): ค้นหาราคาอ่างล้างหน้า รหัสสีหิน ขนาด และวิดีโอ 3D 360° เช่น \\"KF001\\" \\"BW010\\"\\nเข้าสู่ระบบด้วย LINE เพื่อปรึกษาการออกแบบ การชำระเงิน การติดตามใบเสนอราคา และคุยกับน้องไนท์โหมดเต็มแบบเดียวกับใน LINE"/,
    );
  });

  it("shows a mode banner with the right status and a guest-only LINE login button", () => {
    assert.match(supportSource, /data-testid="knight-support-mode-banner"/);
    assert.match(
      supportSource,
      /lineAuthStatus\?\.authenticated \? "โหมดเต็ม \(เชื่อมต่อ LINE แล้ว\)" : "โหมดทั่วไป · ค้นหาสินค้าได้"/,
    );
    assert.match(
      supportSource,
      /!lineAuthStatus\?\.authenticated && <LineLoginButton compact testId="button-line-login-mode-banner" \/>/,
    );
  });

  it("shows LINE login below an assistant answer that requires authentication", () => {
    assert.match(supportSource, /loginRequired\?: boolean/);
    assert.match(
      supportSource,
      /const loginRequired = \(result as typeof result & \{ loginRequired\?: boolean \}\)\.loginRequired === true/,
    );
    assert.match(supportSource, /message\.loginRequired/);
    assert.match(supportSource, /button-line-login-required-/);
  });

  it("keeps the general-mode chat form available without LINE login", () => {
    assert.match(supportSource, /className="knight-support-form"/);
    assert.match(supportSource, /disabled=\{busy \|\| !draft\.trim\(\)\}/);
  });
});
/*
 * contrast-probe.js — ตัววัดคอนทราสต์ของข้อความทุกตัวบนหน้าเว็บ (WCAG 2.1)
 * ของเดวิด (Knight Basins) · ใช้ได้ 2 ทาง — ห้ามแก้ไฟล์นี้ในใบงาน (ให้คัดลอกก็ต่อเมื่อเดวิดสั่ง)
 *
 * ทางที่ 1 · ในเบราว์เซอร์ (Chrome/Edge)
 *   1) เปิดหน้าเว็บที่ต้องการวัด แล้วตั้งธีมให้ตรงกับที่จะวัด
 *      localStorage.setItem("knight-storefront-theme","dark");  // หรือ "light" แล้วโหลดใหม่
 *   2) F12 → Console → วางทั้งไฟล์นี้ → Enter → พิมพ์  contrastProbe()
 *      (ได้ตาราง selector · สีตัวอักษร · พื้นหลัง · ratio · เฉพาะจุดที่ต่ำกว่าเกณฑ์)
 *      ตัวเลือก: contrastProbe({limit: 30})  · contrastProbe({all: true})  · contrastProbe({min: 4.5})
 *
 * ทางที่ 2 · บรรทัดคำสั่ง (ต้องมี Chrome/Chromium)
 *   CHROME_BIN=/usr/bin/chromium node qa/tools/contrast-probe.js https://knightbasins.com/price-guide dark
 *   node qa/tools/contrast-probe.js / price-guide page ... (ได้หลายเส้นทางต่อการเรียกหนึ่งครั้ง)
 *   ตั้งค่าได้ด้วย env: CHROME_BIN (ปริยาย /repl/tools/bin/chromium → chrome → chromium) · BROWSER_TEST_BASE_URL
 *
 * เกณฑ์: 4.5 ตัวอักษรปกติ · 3.0 ตัวใหญ่ (≥24px หรือ ≥18.66px ตัวหนา)
 * หมายเหตุวิธีวัด: พื้นหลัง = องค์ประกอบแรกที่ทึบกว่า 50% ขึ้นไป (ข้ามพื้นที่มีรูปภาพ)
 *                ค่าพื้นหลังแบบโปร่งแสง (alpha < 1) จะหยุดที่องค์ประกอบนั้น แล้วเทียบกับค่านั้นตรง ๆ
 */
(function () {
  const PROBE_SOURCE = function (options) {
    const opt = Object.assign({ min: null, all: false, limit: 40 }, options || {});
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    const toRGBA = (color) => {
      if (!color) return null;
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    };
    const luminance = ([r, g, b]) => {
      const f = (v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : Math.pow((v / 255 + 0.055) / 1.055, 2.4));
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a, b) => {
      const l1 = luminance(a), l2 = luminance(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    const effectiveBg = (el) => {
      let node = el;
      while (node) {
        const style = getComputedStyle(node);
        if (style.backgroundImage && style.backgroundImage !== "none") return null; // พื้นรูปภาพ = วัดไม่ได้ด้วยวิธีนี้
        const c = toRGBA(style.backgroundColor);
        if (c && c[3] > 0.5) return c;
        node = node.parentElement;
      }
      return toRGBA(getComputedStyle(document.body).backgroundColor);
    };
    const selectorOf = (el) => {
      const parts = [];
      let node = el;
      while (node && node.tagName !== "HTML" && parts.length < 4) {
        let s = node.tagName.toLowerCase();
        if (node.dataset && node.dataset.testid) s += '[data-testid="' + node.dataset.testid + '"]';
        else if (typeof node.className === "string" && node.className.trim()) {
          const first = node.className.trim().split(/\s+/).filter((c) => !/^(dark|hover|sm|md|lg):/.test(c))[0];
          if (first) s += "." + first;
        }
        parts.unshift(s);
        node = node.parentElement;
      }
      return parts.join(" > ");
    };
    const rows = [];
    const all = [];
    document.querySelectorAll("body *").forEach((el) => {
      const ownText = Array.from(el.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim())
        .join(" ")
        .trim();
      if (ownText.length < 3) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none" || parseFloat(style.opacity) < 0.3) return;
      const fg = toRGBA(style.color);
      const bg = effectiveBg(el);
      if (!fg || !bg) return;
      const value = ratio(fg, bg);
      const size = parseFloat(style.fontSize);
      const bold = parseInt(style.fontWeight, 10) >= 700;
      const large = size >= 24 || (size >= 18.66 && bold);
      const threshold = large ? 3 : 4.5;
      const row = {
        ratio: Math.round(value * 100) / 100,
        threshold,
        large,
        selector: selectorOf(el),
        fg: "rgb(" + fg.slice(0, 3).join(",") + ")",
        bg: "rgb(" + bg.slice(0, 3).join(",") + (bg[3] < 1 ? " alpha " + bg[3].toFixed(2) : "") + ")",
        size: style.fontSize,
        text: ownText.slice(0, 40),
      };
      all.push(row);
      if (opt.min != null ? value < opt.min : value < threshold) rows.push(row);
    });
    rows.sort((a, b) => a.ratio - b.ratio);
    const shown = opt.all ? all.sort((a, b) => a.ratio - b.ratio).slice(0, opt.limit) : rows;
    return {
      url: location.href,
      theme: (function () {
        const root = document.querySelector(".storefront-theme-root");
        return root ? root.getAttribute("data-theme") : null;
      })(),
      checked: all.length,
      failed: rows.length,
      rows: shown,
      worst: all.sort((a, b) => a.ratio - b.ratio).slice(0, 5),
    };
  };

  const print = (report) => {
    console.log("URL: " + report.url + "   ธีม: " + report.theme + "   ตรวจ: " + report.checked + " จุด   ต่ำกว่าเกณฑ์: " + report.failed + " จุด");
    if (!report.rows.length) {
      console.log("  ✅ ไม่มีจุดที่ต่ำกว่าเกณฑ์");
      return;
    }
    console.log("  ratio | เกณฑ์ | สีตัวอักษร บน พื้นหลัง | ขนาด | selector | ข้อความ");
    report.rows.forEach((r) => {
      console.log(
        "  " + String(r.ratio).padEnd(6) + "| " + String(r.threshold).padEnd(5) + " | " + r.fg + " บน " + r.bg +
        " | " + r.size + " | " + r.selector + " | " + r.text
      );
    });
  };

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    window.contrastProbe = function (options) {
      const report = PROBE_SOURCE(options);
      if (typeof console.table === "function" && report.rows.length) console.table(report.rows);
      print(report);
      return report;
    };
    console.log('contrastProbe พร้อมใช้ — พิมพ์ contrastProbe()  หรือ contrastProbe({all:true, limit:80})');
    return;
  }

  // ---------- โหมดบรรทัดคำสั่ง (Node) ----------
  const { spawn } = require("node:child_process");
  const os = require("node:os");
  const fs = require("node:fs");
  const path = require("node:path");
  const http = require("node:http");

  const args = process.argv.slice(2);
  if (!args.length) {
    console.error("ใช้: node qa/tools/contrast-probe.js <url หรือ เส้นทาง> [dark|light] [เส้นทางอื่น ๆ ...]");
    process.exit(2);
  }
  const base = process.env.BROWSER_TEST_BASE_URL || "https://knightbasins.com";
  const candidates = [process.env.CHROME_BIN, "/repl/tools/bin/chromium", "chromium", "chromium-browser", "google-chrome", "google-chrome-stable"].filter(Boolean);
  const theme = args.find((a) => a === "dark" || a === "light") || "dark";
  const targets = args.filter((a) => a !== "dark" && a !== "light").map((a) => (/^https?:/.test(a) ? a : base + a));

  const chromeBin = candidates.find((c) => {
    try {
      const p = c.includes("/") ? c : require("node:child_process").execSync("command -v " + c, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
      return fs.existsSync(p) ? p : null;
    } catch {
      return null;
    }
  });
  if (!chromeBin) {
    console.error("ไม่พบ Chrome/Chromium — ตั้ง CHROME_BIN=<path> แล้วลองใหม่");
    process.exit(2);
  }

  const port = 9333 + (process.pid % 500);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "contrast-probe-"));
  const chrome = spawn(chromeBin, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
    "--remote-debugging-port=" + port, "--user-data-dir=" + profile, "about:blank",
  ], { stdio: "ignore" });

  const getJson = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    }).on("error", reject);
  });

  const waitForChrome = async () => {
    for (let i = 0; i < 60; i++) {
      try { return await getJson("http://127.0.0.1:" + port + "/json/list"); } catch { await new Promise((r) => setTimeout(r, 250)); }
    }
    throw new Error("Chrome ไม่ตอบที่พอร์ต " + port);
  };

  (async () => {
    let exitCode = 1;
    try {
      const list = await waitForChrome();
      const page = list.find((t) => t.type === "page") || list[0];
      const socket = new WebSocket(page.webSocketDebuggerUrl);
      let id = 0;
      const pending = new Map();
      socket.addEventListener("message", (event) => {
        const msg = JSON.parse(String(event.data));
        if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
      });
      await new Promise((r) => socket.addEventListener("open", r, { once: true }));
      const send = (method, params) => new Promise((resolve) => {
        const myId = ++id;
        pending.set(myId, resolve);
        socket.send(JSON.stringify({ id: myId, method, params: params || {} }));
      });
      await send("Page.enable");
      let totalFailed = 0;
      for (const url of targets) {
        await send("Page.navigate", { url });
        await new Promise((r) => setTimeout(r, 3500));
        await send("Runtime.evaluate", {
          expression: 'localStorage.setItem("knight-storefront-theme","' + theme + '"); location.reload();',
        });
        await new Promise((r) => setTimeout(r, 3500));
        const res = await send("Runtime.evaluate", {
          expression: "(" + PROBE_SOURCE.toString() + ")(" + JSON.stringify({}) + ")",
          returnByValue: true,
          awaitPromise: false,
        });
        const report = res.result && res.result.result && res.result.result.value;
        if (!report) { console.log("วัด " + url + " ไม่ได้: " + JSON.stringify(res).slice(0, 200)); continue; }
        print(report);
        totalFailed += report.failed;
        console.log("");
      }
      exitCode = totalFailed === 0 ? 0 : 1;
    } catch (error) {
      console.error("ผิดพลาด: " + (error && error.message));
    } finally {
      chrome.kill("SIGKILL");
      try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
      process.exit(exitCode);
    }
  })();
})();

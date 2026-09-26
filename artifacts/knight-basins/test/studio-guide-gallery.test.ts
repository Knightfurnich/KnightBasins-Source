import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  STUDIO_GUIDE_GALLERY,
  STUDIO_GUIDE_GALLERY_INTERVAL_MS,
} from "../src/data/studio-guide-gallery.ts";

const pageSource = readFile(
  new URL("../src/pages/StudioGuidePage.tsx", import.meta.url),
  "utf8",
);
const publicDir = fileURLToPath(new URL("../public", import.meta.url));

test("gallery ships every supplied shot exactly once", () => {
  assert.equal(STUDIO_GUIDE_GALLERY.length, 6);

  const paths = STUDIO_GUIDE_GALLERY.map((slide) => slide.src);
  assert.equal(new Set(paths).size, paths.length, "duplicate slide paths");

  for (const src of paths) {
    assert.match(src, /^\/guide\/[a-z0-9-]+\.webp$/, `unexpected slide path: ${src}`);
  }
});

test("every gallery image file really exists under public/ and is web-sized", () => {
  for (const slide of STUDIO_GUIDE_GALLERY) {
    const file = path.join(publicDir, slide.src);
    assert.ok(existsSync(file), `missing image file: ${slide.src}`);

    const bytes = statSync(file).size;
    assert.ok(bytes > 20_000, `${slide.src} looks too small (${bytes} bytes)`);
    assert.ok(bytes < 400_000, `${slide.src} is too heavy for mobile (${bytes} bytes)`);
  }
});

test("each slide carries readable copy for customers and screen readers", () => {
  for (const slide of STUDIO_GUIDE_GALLERY) {
    assert.ok(slide.tag.trim().length > 0, `empty tag on ${slide.src}`);
    assert.ok(slide.caption.trim().length >= 20, `caption too short on ${slide.src}`);
    assert.ok(slide.alt.trim().length >= 30, `alt text too short on ${slide.src}`);
  }
});

test("captions describe the picture instead of claiming company work", async () => {
  for (const slide of STUDIO_GUIDE_GALLERY) {
    assert.doesNotMatch(
      slide.caption,
      /ผลงานของเรา|ผลงานติดตั้งของเรา|งานที่เราติดตั้ง/,
      `slide ${slide.src} claims the shot is our own install`,
    );
  }

  const source = await pageSource;
  assert.match(source, /ภาพตัวอย่างเพื่อดูแนวทางผังและวัสดุ/);
});

test("auto-rotate interval is slow enough to read a slide", () => {
  assert.ok(Number.isInteger(STUDIO_GUIDE_GALLERY_INTERVAL_MS));
  assert.ok(STUDIO_GUIDE_GALLERY_INTERVAL_MS >= 3_000);
  assert.ok(STUDIO_GUIDE_GALLERY_INTERVAL_MS <= 8_000);
});

test("guide page renders the gallery and wires the rotation", async () => {
  const source = await pageSource;

  assert.match(
    source,
    /import\s*\{[^}]*STUDIO_GUIDE_GALLERY[^}]*\}\s*from\s*"@\/data\/studio-guide-gallery"/s,
  );
  assert.match(source, /<GuideGallery\s*\/>/);
  assert.match(source, /setInterval\(/);
  assert.match(source, /STUDIO_GUIDE_GALLERY_INTERVAL_MS/);
  assert.match(source, /clearInterval\(/);
  assert.match(source, /% slides\.length/);
});

test("rotation pauses on interaction and for reduced-motion users", async () => {
  const source = await pageSource;

  assert.match(source, /prefers-reduced-motion:\s*reduce/);
  assert.match(source, /onMouseEnter=\{\(\)\s*=>\s*setPaused\(true\)\}/);
  assert.match(source, /onMouseLeave=\{\(\)\s*=>\s*setPaused\(false\)\}/);
  assert.match(source, /onFocus=\{\(\)\s*=>\s*setPaused\(true\)\}/);
});

test("every slide has a dot with a reachable touch target and a label", async () => {
  const source = await pageSource;

  assert.match(source, /data-testid="section-studio-guide-gallery"/);
  assert.match(source, /data-testid="studio-guide-gallery-caption"/);
  assert.match(source, /data-testid=\{`button-studio-guide-gallery-dot-\$\{index\}`\}/);
  assert.match(source, /data-testid=\{`studio-guide-gallery-slide-\$\{index\}`\}/);
  assert.match(source, /aria-label=\{`ดูภาพที่ \$\{index \+ 1\}`\}/);
  assert.match(source, /className="grid h-11 w-6 place-items-center"/);
});

test("gallery path stays out of the shared stylesheet (index.css is frozen)", async () => {
  const css = await readFile(new URL("../src/index.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /studio-guide-gallery/);
});

test("slide 1 loads eagerly and the rest lazily", async () => {
  const source = await pageSource;
  assert.match(source, /loading=\{index === 0 \? "eager" : "lazy"\}/);
  assert.match(source, /decoding="async"/);
});

test("public image directory resolves where Vite copies static assets from", () => {
  const dir = path.join(publicDir, "guide");
  assert.ok(existsSync(dir), "public/guide directory is missing");
});
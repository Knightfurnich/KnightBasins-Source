import {
  accessSync,
  constants,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(scriptDirectory, "..");
const publicDirectory = path.join(appDirectory, "dist", "public");
const sitemapPath = path.join(appDirectory, "public", "sitemap.xml");
const expectedPageCount = 10;
const maximumBrowserOutputBytes = 50 * 1024 * 1024;

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, decimal) =>
      String.fromCodePoint(Number(decimal)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, hexadecimal) =>
      String.fromCodePoint(Number.parseInt(hexadecimal, 16)),
    );
}

function readPublicRoutes() {
  const sitemap = readFileSync(sitemapPath, "utf8");
  const locations = [...sitemap.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map(
    (match) => decodeEntities(match[1].trim()),
  );

  if (locations.length !== expectedPageCount) {
    throw new Error(
      `[prerender] Expected ${expectedPageCount} public URLs in ${sitemapPath}; found ${locations.length}.`,
    );
  }

  const origin = new URL(locations[0]).origin;
  const seenPaths = new Set();
  const routes = locations.map((location) => {
    const url = new URL(location);
    if (url.origin !== origin || url.protocol !== "https:") {
      throw new Error(`[prerender] Unexpected sitemap URL: ${location}`);
    }
    if (url.search || url.hash) {
      throw new Error(
        `[prerender] Sitemap URLs must not include a query or fragment: ${location}`,
      );
    }
    if (/^\/admin(?:\/|$)/i.test(url.pathname)) {
      throw new Error(
        `[prerender] Refusing to prerender a private admin route: ${url.pathname}`,
      );
    }
    if (seenPaths.has(url.pathname)) {
      throw new Error(`[prerender] Duplicate sitemap route: ${url.pathname}`);
    }

    seenPaths.add(url.pathname);
    return { path: url.pathname, canonical: url.href };
  });

  return { origin, routes };
}

function findExecutable(binary) {
  if (!binary) return null;
  if (binary.includes(path.sep)) {
    try {
      accessSync(binary, constants.X_OK);
      return binary;
    } catch {
      return null;
    }
  }

  const result = spawnSync("which", [binary], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function findChromium() {
  if (process.env.PRERENDER_FORCE_STATIC_FALLBACK === "1") return null;

  const configured = process.env.CHROMIUM_PATH || process.env.CHROME_BIN;
  if (configured) {
    const executable = findExecutable(configured);
    if (executable) return executable;
    throw new Error(
      `[prerender] Chromium was configured as "${configured}" but is not executable.`,
    );
  }

  for (const candidate of [
    "chromium",
    "chromium-browser",
    "google-chrome",
    "google-chrome-stable",
  ]) {
    const executable = findExecutable(candidate);
    if (executable) return executable;
  }

  return null;
}

function getAttribute(tag, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(
    new RegExp(
      `\\b${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
      "i",
    ),
  );
  return match?.slice(1).find((value) => value !== undefined) ?? null;
}

function findMetaContent(html, name) {
  const metaTag = [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map((match) => match[0])
    .find((tag) => getAttribute(tag, "name") === name);
  return metaTag ? getAttribute(metaTag, "content") : null;
}

function findCanonical(html) {
  const linkTag = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .find((tag) => getAttribute(tag, "rel") === "canonical");
  return linkTag ? getAttribute(linkTag, "href") : null;
}

function findTitle(html) {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(match[1].replace(/<[^>]*>/g, "").trim()) : null;
}

function htmlText(markup) {
  return decodeEntities(
    markup
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;|&#160;/gi, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function mainText(html) {
  const mainTag =
    html.match(
      /<main\b(?=[^>]*\bdata-testid=["']storefront-main["'])[^>]*>/i,
    ) ?? html.match(/<main\b[^>]*>/i);
  if (!mainTag || mainTag.index === undefined) return "";

  const contentStart = mainTag.index + mainTag[0].length;
  const contentEnd = html.indexOf("</main>", contentStart);
  return contentEnd < 0 ? "" : htmlText(html.slice(contentStart, contentEnd));
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function setAttributeValue(tag, name, value) {
  const attribute = new RegExp(
    `(\\b${name}\\s*=\\s*)(?:"[^"]*"|'[^']*'|[^\\s>]+)`,
    "i",
  );
  if (!attribute.test(tag)) return tag;
  return tag.replace(
    attribute,
    (_, prefix) => `${prefix}"${escapeHtml(value)}"`,
  );
}

function setMetaContent(html, selectorAttribute, selectorValue, content) {
  let replaced = false;
  return html.replace(/<meta\b[^>]*>/gi, (tag) => {
    if (replaced || getAttribute(tag, selectorAttribute) !== selectorValue) {
      return tag;
    }
    replaced = true;
    return setAttributeValue(tag, "content", content);
  });
}

function createStaticSeoShell(shell, route, metadata) {
  if (!metadata) {
    throw new Error(`[prerender] No route metadata is defined for ${route.path}.`);
  }

  let html = shell.replace(
    /<title\b[^>]*>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(metadata.title)}</title>`,
  );
  html = setMetaContent(html, "name", "description", metadata.description);
  html = setMetaContent(html, "property", "og:title", metadata.title);
  html = setMetaContent(html, "property", "og:description", metadata.description);
  html = setMetaContent(html, "property", "og:url", route.canonical);
  html = setMetaContent(html, "name", "twitter:title", metadata.title);
  html = setMetaContent(
    html,
    "name",
    "twitter:description",
    metadata.description,
  );
  html = html.replace(/<link\b[^>]*>/gi, (tag) =>
    getAttribute(tag, "rel") === "canonical"
      ? setAttributeValue(tag, "href", route.canonical)
      : tag,
  );

  const rootTag = html.match(/<div\b[^>]*\bid=["']root["'][^>]*>/i);
  if (!rootTag || rootTag.index === undefined) {
    throw new Error("[prerender] Static SEO shell is missing #root.");
  }
  const rootContent = `
    <main data-testid="storefront-main" style="max-width:72rem;margin:2rem auto;padding:1rem;line-height:1.6">
      <h1>${escapeHtml(metadata.title)}</h1>
      <p>${escapeHtml(metadata.description)}</p>
    </main>
  `;
  const insertionPoint = rootTag.index + rootTag[0].length;
  html = `${html.slice(0, insertionPoint)}${rootContent}${html.slice(insertionPoint)}`;

  return html;
}

function addRouteWebPageJsonLd(html, route, metadata) {
  if (!metadata) {
    throw new Error(`[prerender] No route metadata is defined for ${route.path}.`);
  }

  const pageData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${route.canonical}#webpage`,
    url: route.canonical,
    name: metadata.title,
    description: metadata.description,
    isPartOf: { "@id": `${new URL(route.canonical).origin}/#website` },
  }).replace(/</g, "\\u003c");

  if (!/<\/body>/i.test(html)) {
    throw new Error(`[prerender] Rendered HTML has no closing body for ${route.path}.`);
  }
  return html.replace(
    /<\/body>/i,
    `<script type="application/ld+json" data-prerender-webpage="true">${pageData}</script>\n</body>`,
  );
}

function wordCount(text) {
  return (text.match(/[\p{L}\p{N}]+/gu) ?? []).length;
}

async function reservePort() {
  const probe = createServer();
  await new Promise((resolveListen, rejectListen) => {
    probe.once("error", rejectListen);
    probe.listen(0, "127.0.0.1", resolveListen);
  });
  const address = probe.address();
  if (!address || typeof address === "string") {
    throw new Error("[prerender] Could not reserve a preview port.");
  }
  await new Promise((resolveClose, rejectClose) =>
    probe.close((error) =>
      error ? rejectClose(error) : resolveClose(),
    ),
  );
  return address.port;
}

function stopPreview(previewProcess) {
  if (previewProcess.exitCode !== null || previewProcess.signalCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolveStop) => {
    const forceStop = setTimeout(() => previewProcess.kill("SIGKILL"), 3_000);
    previewProcess.once("exit", () => {
      clearTimeout(forceStop);
      resolveStop();
    });
    previewProcess.kill("SIGTERM");
  });
}

async function startPreviewServer() {
  const port = await reservePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const viteCli = path.resolve(appDirectory, "node_modules/vite/bin/vite.js");
  const previewProcess = spawn(
    process.execPath,
    [
      viteCli,
      "preview",
      "--config",
      "vite.config.ts",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    {
      cwd: appDirectory,
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let serverLogs = "";
  const appendLog = (chunk) => {
    serverLogs = `${serverLogs}${chunk.toString()}`.slice(-8_000);
  };
  previewProcess.stdout.on("data", appendLog);
  previewProcess.stderr.on("data", appendLog);

  try {
    const deadline = Date.now() + 20_000;
    let lastRequestError;
    while (Date.now() < deadline) {
      if (previewProcess.exitCode !== null) {
        throw new Error(
          `[prerender] Vite preview exited with code ${previewProcess.exitCode}.\n${serverLogs}`,
        );
      }

      try {
        const response = await fetch(`${baseUrl}/`, {
          signal: AbortSignal.timeout(1_000),
        });
        if (response.ok && /<html\b/i.test(await response.text())) {
          return {
            baseUrl,
            close: () => stopPreview(previewProcess),
          };
        }
        lastRequestError = new Error(
          `Vite preview returned HTTP ${response.status}.`,
        );
      } catch (error) {
        lastRequestError = error;
      }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
    }

    throw new Error(
      `[prerender] Vite preview did not become ready: ${lastRequestError?.message ?? "timeout"}.\n${serverLogs}`,
    );
  } catch (error) {
    await stopPreview(previewProcess);
    throw error;
  }
}

function renderPage(chromium, url, route) {
  const profileDirectory = mkdtempSync(
    path.join(tmpdir(), "knight-basins-prerender-"),
  );

  try {
    const result = spawnSync(
      chromium,
      [
        "--headless=new",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-background-networking",
        "--disable-extensions",
        "--disable-sync",
        "--no-first-run",
        "--no-default-browser-check",
        "--hide-scrollbars",
        "--window-size=1440,1200",
        "--blink-settings=imagesEnabled=false",
        "--virtual-time-budget=8000",
        "--timeout=15000",
        "--dump-dom",
        `--user-data-dir=${profileDirectory}`,
        url,
      ],
      {
        encoding: "utf8",
        maxBuffer: maximumBrowserOutputBytes,
        timeout: 60_000,
      },
    );

    if (result.error || result.status !== 0) {
      const detail = result.error?.message ?? result.stderr?.slice(-4_000);
      throw new Error(
        `[prerender] Chromium failed to render ${route} (exit ${result.status ?? "unknown"}): ${detail}`,
      );
    }
    if (!/<body\b/i.test(result.stdout)) {
      throw new Error(`[prerender] Chromium returned no HTML body for ${route}.`);
    }

    return result.stdout;
  } finally {
    rmSync(profileDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const { origin, routes } = readPublicRoutes();
  const chromium = findChromium();
  const routeMetadata = (await import("../src/components/RouteMeta.logic.ts"))
    .ROUTE_META;
  const staticShell = chromium
    ? null
    : readFileSync(path.join(publicDirectory, "index.html"), "utf8");
  if (!chromium) {
    console.warn(
      "[prerender] Chromium/Chrome is unavailable; using the static SEO shell fallback.",
    );
  }
  const preview = chromium ? await startPreviewServer() : null;
  const renderedPages = [];

  try {
    for (const route of routes) {
      const metadata = routeMetadata[route.path];
      const renderedHtml = chromium
        ? renderPage(
            chromium,
            new URL(route.path, preview.baseUrl).href,
            route.path,
          )
        : createStaticSeoShell(staticShell, route, metadata);
      const html = addRouteWebPageJsonLd(renderedHtml, route, metadata);
      const title = findTitle(html);
      const description = findMetaContent(html, "description");
      const canonical = findCanonical(html);
      const content = mainText(html);
      const jsonLdCount =
        html.match(
          /<script\b(?=[^>]*\btype=["']application\/ld\+json["'])[^>]*>/gi,
        )?.length ?? 0;

      if (!title || !description || !canonical) {
        throw new Error(
          `[prerender] Missing title, description, or canonical on ${route.path}.`,
        );
      }
      if (canonical !== route.canonical) {
        throw new Error(
          `[prerender] Wrong canonical on ${route.path}: expected ${route.canonical}, got ${canonical}.`,
        );
      }
      if (wordCount(content) === 0) {
        throw new Error(
          `[prerender] Rendered main content is empty on ${route.path}.`,
        );
      }
      if (jsonLdCount === 0) {
        throw new Error(`[prerender] JSON-LD is missing on ${route.path}.`);
      }

      renderedPages.push({
        canonical,
        content,
        description,
        html,
        path: route.path,
        title,
      });
    }
  } finally {
    if (preview) await preview.close();
  }

  const uniqueTitles = new Set(renderedPages.map((page) => page.title));
  const uniqueDescriptions = new Set(
    renderedPages.map((page) => page.description),
  );
  const uniqueContent = new Set(renderedPages.map((page) => page.content));

  if (
    uniqueTitles.size !== routes.length ||
    uniqueDescriptions.size !== routes.length ||
    uniqueContent.size !== routes.length
  ) {
    throw new Error(
      `[prerender] Every public route must have unique title, description, and main content (origin ${origin}).`,
    );
  }

  for (const page of renderedPages) {
    const outputDirectory =
      page.path === "/"
        ? publicDirectory
        : path.join(publicDirectory, page.path.slice(1));
    mkdirSync(outputDirectory, { recursive: true });
    const outputPath = path.join(outputDirectory, "index.html");
    writeFileSync(outputPath, page.html, "utf8");
    console.log(
      `[prerender] ${page.path} -> ${path.relative(process.cwd(), outputPath)} (${Buffer.byteLength(page.html, "utf8")} bytes; ${wordCount(page.content)} words)`,
    );
  }

  console.log(
    `[prerender] OK: ${renderedPages.length} public pages rendered; no admin route was included.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

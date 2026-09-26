import { createHash } from "node:crypto";
import { Router, type IRouter } from "express";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { readMultipartForm, UPLOAD_DIR } from "../lib/image-upload";
import { createAdminAuthMiddleware, requireAnyAdminPermission } from "../middlewares/admin-auth";
import { createConcurrencyLimiter, createRateLimiter } from "../lib/rate-limit";
import {
  generatePortfolioFilename,
  generatePortfolioId,
  loadCatalog,
  portfolioExtensionForContentType,
  readImageDimensions,
  resolvePortfolioFilePath,
  saveCatalog,
  type PortfolioItem,
} from "../lib/portfolio-catalog";

const router: IRouter = Router();

const PORTFOLIO_VISIBILITY_PATH = join(UPLOAD_DIR, "portfolio", "visibility.json");
// A legacy knowledge-base copy the real VPS keeps outside UPLOAD_DIR entirely
// -- overridable so a test run (which has no business reading a real path on
// whatever machine happens to run it) can point this somewhere guaranteed
// not to exist, without changing the real production fallback at all.
const KNIGHT_DESIGN_KB_FEATURED_PATH = process.env["PORTFOLIO_FEATURED_KB_PATH"] ?? "/opt/data/knight-design-kb/portfolio_featured.json";

/** Public showcase categories, in the order the storefront should present them.
 * Bathroom work leads (basins are the hero product), the rest back it up as
 * proof of factory craftsmanship. */
const CATEGORY_ORDER = [
  "bathroom",
  "counter",
  "kitchen",
  "design",
  "stairs",
  "wall",
  "veined_pattern",
  "table",
  "dining_table",
  "meeting_table",
  "shelves",
  "pool",
  "door_frame",
  "flooring",
  "seamless_joint",
  "crate_shipping",
  "site_prep",
];

/** Thai display name + emoji icon per category slug, used to label a brand-new
 * upload's catalog entry (an existing item's own fields are used for display
 * everywhere else, via the "sample item" lookup already in GET /portfolio). */
const CATEGORY_METADATA: Record<string, { name: string; icon: string }> = {
  bathroom: { name: "ห้องน้ำ", icon: "🛁" },
  counter: { name: "เคาน์เตอร์", icon: "🧱" },
  kitchen: { name: "ครัว", icon: "🍳" },
  design: { name: "ดีไซน์", icon: "🎨" },
  stairs: { name: "บันได", icon: "🪜" },
  wall: { name: "ผนัง", icon: "🧱" },
  veined_pattern: { name: "ลายหินอ่อน", icon: "🌊" },
  table: { name: "โต๊ะ", icon: "🪑" },
  dining_table: { name: "โต๊ะทานอาหาร", icon: "🍽️" },
  meeting_table: { name: "โต๊ะประชุม", icon: "🗂️" },
  shelves: { name: "ชั้นวาง", icon: "📚" },
  pool: { name: "สระว่ายน้ำ", icon: "🏊" },
  door_frame: { name: "วงกบประตู", icon: "🚪" },
  flooring: { name: "พื้น", icon: "🪵" },
  seamless_joint: { name: "รอยต่อไร้รอยต่อ", icon: "✨" },
  crate_shipping: { name: "บรรจุหีบห่อขนส่ง", icon: "📦" },
  site_prep: { name: "เตรียมหน้างาน", icon: "🏗️" },
};

const portfolioUploadRateLimit = createRateLimiter({ name: "admin-portfolio-upload", max: 60, windowMs: 10 * 60 * 1000 });
const portfolioUploadConcurrency = createConcurrencyLimiter("Portfolio upload", 4);

/**
 * Public-safe allowlist produced by the visual curation pass over every
 * imported photo. Most of the raw import is factory/work-in-progress footage
 * (basin shells on moulds, bare frames, cement bags, protective film, workers)
 * and must never reach the public storefront. When this file is absent the
 * gallery falls back to showing everything, so a missing file degrades to the
 * previous behaviour rather than an empty page.
 */
const PORTFOLIO_ALLOWLIST_PATH = join(UPLOAD_DIR, "portfolio", "public.json");

async function loadAllowlist(): Promise<Set<string> | null> {
  const candidatePaths = [
    PORTFOLIO_ALLOWLIST_PATH,
    join(UPLOAD_DIR, "portfolio_public.json"),
  ];
  for (const p of candidatePaths) {
    try {
      const raw = await readFile(p, "utf8");
      const parsed = JSON.parse(raw) as { approved?: Array<{ id?: unknown }> };
      if (Array.isArray(parsed.approved)) {
        const ids = parsed.approved
          .map((entry) => entry?.id)
          .filter((id): id is string => typeof id === "string" && id.length > 0);
        if (ids.length > 0) return new Set(ids);
      }
    } catch {
      // try the next candidate path
    }
  }
  return null;
}

/** id -> visible. An item with no entry here is visible by default -- this
 * file only ever needs to record the photos an admin has explicitly hidden
 * (or re-shown after hiding), not every item in the catalog. */
type PortfolioVisibilityMap = Record<string, boolean>;

async function loadVisibilityMap(): Promise<PortfolioVisibilityMap> {
  try {
    const raw = await readFile(PORTFOLIO_VISIBILITY_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const map: PortfolioVisibilityMap = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "boolean") map[id] = value;
    }
    return map;
  } catch {
    return {};
  }
}

/** Ensures the portfolio/ directory exists before writing -- on a fresh
 * environment (a new deploy, or this local test harness) it may not have
 * been created yet, which would otherwise fail the write with ENOENT and
 * surface as a 500 on an admin toggling one photo's visibility. */
async function saveVisibilityMap(map: PortfolioVisibilityMap): Promise<void> {
  await mkdir(dirname(PORTFOLIO_VISIBILITY_PATH), { recursive: true });
  await writeFile(PORTFOLIO_VISIBILITY_PATH, JSON.stringify(map), "utf8");
}

function isVisible(visibilityMap: PortfolioVisibilityMap, itemId: string): boolean {
  return visibilityMap[itemId] !== false;
}

/**
 * Distributes items fairly across categories when the caller asked for
 * "everything" (no category filter): one item per category per round, in
 * CATEGORY_ORDER sequence, instead of grouping all of one category
 * together first. This is what actually fixes the "หมวดอื่นไม่เคยขึ้นเลย" bug
 * -- bathroom having 312 items no longer means the first `limit` items (a
 * simple contiguous slice) are 100% bathroom, since every category gets a
 * turn before bathroom's 2nd item is ever placed. Each category's own
 * items are id-sorted first so the result is stable and reproducible
 * across calls, per job-105's tiebreak requirement.
 */
function distributeFairlyAcrossCategories(items: PortfolioItem[]): PortfolioItem[] {
  const buckets = new Map<string, PortfolioItem[]>();
  for (const item of items) {
    const bucket = buckets.get(item.category);
    if (bucket) bucket.push(item);
    else buckets.set(item.category, [item]);
  }
  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => a.id.localeCompare(b.id));
  }
  const categorySlugs = [
    ...CATEGORY_ORDER.filter((slug) => buckets.has(slug)),
    ...[...buckets.keys()].filter((slug) => !CATEGORY_ORDER.includes(slug)).sort(),
  ];

  const result: PortfolioItem[] = [];
  for (let round = 0; result.length < items.length; round += 1) {
    for (const slug of categorySlugs) {
      const bucket = buckets.get(slug)!;
      if (round < bucket.length) result.push(bucket[round]!);
    }
  }
  return result;
}

/** Same CATEGORY_ORDER-then-id ordering GET /portfolio has always used when a specific category is requested -- kept byte-for-byte so that path's behavior never changes (job-105 explicitly forbids it). */
function orderWithinCategoryOrder(items: PortfolioItem[]): PortfolioItem[] {
  return [...items].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category);
    const bi = CATEGORY_ORDER.indexOf(b.category);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

/** Portfolio has 647 real items as of this writing; 2000 comfortably covers "give me everything" without an unbounded response. `limit=all` is shorthand for this same ceiling. */
const PORTFOLIO_MAX_LIMIT = 2000;
const PORTFOLIO_DEFAULT_LIMIT = 60;

/**
 * GET /api/portfolio
 * Public read-only gallery of real completed installation photos.
 * Never exposes customer names, job codes, or internal notes — only the image
 * URL, its work category and a generic title.
 */
router.get("/portfolio", async (req, res, next) => {
  try {
    const catalog = await loadCatalog(UPLOAD_DIR);
    const visibilityMap = await loadVisibilityMap();
    const allowlist = await loadAllowlist();
    const includeHidden = req.query["includeHidden"] === "true" || req.query["includeHidden"] === "1";
    const categoryFilter = typeof req.query["category"] === "string" ? req.query["category"].trim() : "";
    const searchQuery = typeof req.query["q"] === "string" ? req.query["q"].trim().toLowerCase() : "";
    const rawLimit = req.query["limit"];
    const wantsEverything = typeof rawLimit === "string" && rawLimit.trim().toLowerCase() === "all";
    const limitRaw = Number(rawLimit);
    const limit = wantsEverything
      ? PORTFOLIO_MAX_LIMIT
      : Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.floor(limitRaw), PORTFOLIO_MAX_LIMIT)
        : PORTFOLIO_DEFAULT_LIMIT;
    const offsetRaw = Number(req.query["offset"]);
    const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? Math.floor(offsetRaw) : 0;

    // Two independent gates decide what a public visitor may see:
    //   1. the curation allowlist -- the raw import is mostly factory and
    //      work-in-progress footage, and only the visually reviewed subset is
    //      safe for customers;
    //   2. the per-photo visibility map an admin toggles in /admin/portfolio.
    // The admin gallery passes ?includeHidden=true and bypasses both.
    const allowlisted = !allowlist || includeHidden
      ? catalog.items
      : catalog.items.filter((item) => allowlist.has(item.id));
    const visibleItems = includeHidden ? allowlisted : allowlisted.filter((item) => isVisible(visibilityMap, item.id));

    const byCategory = categoryFilter
      ? visibleItems.filter((item) => item.category === categoryFilter)
      : visibleItems;

    // ?q= matches captionTh (this catalog's equivalent field is `title`),
    // category, and id -- case-insensitive substring, same as the admin
    // gallery's own client-side search (filterPortfolioItems).
    const filtered = searchQuery
      ? byCategory.filter((item) =>
          item.title.toLowerCase().includes(searchQuery)
          || item.category.toLowerCase().includes(searchQuery)
          || item.id.toLowerCase().includes(searchQuery),
        )
      : byCategory;

    // With a specific category requested, every item already shares that
    // one category -- keep the exact prior ordering unchanged. Without one,
    // a plain CATEGORY_ORDER sort would group all of bathroom's 312 items
    // before any other category ever appears; distribute round-robin
    // instead so every category gets fair representation on page 1.
    const ordered = categoryFilter ? orderWithinCategoryOrder(filtered) : distributeFairlyAcrossCategories(filtered);

    const counts = new Map<string, number>();
    for (const item of visibleItems) {
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    }
    const categories = CATEGORY_ORDER
      .filter((slug) => counts.has(slug))
      .map((slug) => {
        const sample = visibleItems.find((item) => item.category === slug);
        return {
          slug,
          name: sample?.categoryName ?? slug,
          icon: sample?.icon ?? "📸",
          count: counts.get(slug) ?? 0,
        };
      });

    const page = ordered.slice(offset, offset + limit);
    const hasMore = offset + page.length < ordered.length;

    res.setHeader("Cache-Control", includeHidden ? "no-store" : "public, max-age=600");
    res.json({
      updatedAt: catalog.updatedAt,
      total: visibleItems.length,
      categories,
      count: ordered.length,
      hasMore,
      nextOffset: hasMore ? offset + page.length : null,
      items: page.map((item) => ({
        id: item.id,
        category: item.category,
        categoryName: item.categoryName,
        icon: item.icon,
        url: item.url,
        width: item.width,
        height: item.height,
        title: item.title,
        visible: isVisible(visibilityMap, item.id),
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/portfolio/:id/visibility
 * Show/hide one photo on the public portfolio (GET /portfolio) without
 * deleting it from the catalog. Admin/owner only.
 */
router.patch("/admin/portfolio/:id/visibility", createAdminAuthMiddleware(), requireAnyAdminPermission(["leads", "basins"]), async (req, res, next) => {
  try {
    const rawId = req.params["id"];
    const id = typeof rawId === "string" ? rawId : "";
    const visible = (req.body as { visible?: unknown } | undefined)?.visible;
    if (typeof visible !== "boolean") {
      return res.status(400).json({ message: "visible must be a boolean" });
    }

    const catalog = await loadCatalog(UPLOAD_DIR);
    if (!catalog.items.some((item) => item.id === id)) {
      return res.status(404).json({ message: "Portfolio item not found" });
    }

    const visibilityMap = await loadVisibilityMap();
    visibilityMap[id] = visible;
    await saveVisibilityMap(visibilityMap);

    return res.json({ id, visible });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/portfolio/featured
 * Curated top 10 finished showcase photos for the storefront infinite loop marquee.
 */
router.get("/portfolio/featured", async (_req, res, next) => {
  try {
    const candidatePaths = [
      join(UPLOAD_DIR, "portfolio", "featured.json"),
      join(UPLOAD_DIR, "portfolio_featured.json"),
      KNIGHT_DESIGN_KB_FEATURED_PATH,
    ];

    let featured: { updatedAt?: string; items?: unknown[] } | null = null;
    for (const p of candidatePaths) {
      try {
        const raw = await readFile(p, "utf8");
        const parsed = JSON.parse(raw) as { updatedAt?: string; items?: unknown[] };
        if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
          featured = parsed;
          break;
        }
      } catch {
        // try next path
      }
    }

    if (!featured) {
      const catalog = await loadCatalog(UPLOAD_DIR);
      featured = {
        updatedAt: catalog.updatedAt,
        items: catalog.items.slice(0, 10).map((it, idx) => ({
          id: it.id,
          category: it.category,
          filename: it.filename,
          url: it.url,
          rank: idx + 1,
          captionTh: it.title,
          reason: "Featured catalog showcase item",
        })),
      };
    }

    res.setHeader("Cache-Control", "public, max-age=600");
    return res.json(featured);
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/admin/portfolio/upload
 * Adds a new photo to the catalog without SFTP -- the same magic-byte/size
 * validation as /leads/sketch (via readMultipartForm), a server-generated
 * filename (never the client's own, closing off path traversal at the
 * write site too), and an atomic catalog.json write.
 */
router.post(
  "/admin/portfolio/upload",
  createAdminAuthMiddleware(),
  requireAnyAdminPermission(["leads", "basins"], "edit"),
  portfolioUploadRateLimit,
  portfolioUploadConcurrency,
  async (req, res, next) => {
    try {
      const { media, fields } = await readMultipartForm(req, "image", { maxFiles: 1 });
      const file = media[0];
      if (!file) return res.status(400).json({ message: "Choose an image file" });

      const category = typeof fields["category"] === "string" ? fields["category"].trim() : "";
      if (!CATEGORY_ORDER.includes(category)) {
        return res.status(400).json({ message: `category must be one of: ${CATEGORY_ORDER.join(", ")}` });
      }
      const title = typeof fields["title"] === "string" && fields["title"].trim()
        ? fields["title"].trim()
        : CATEGORY_METADATA[category]?.name ?? category;

      const extension = portfolioExtensionForContentType(file.contentType);
      if (!extension) return res.status(400).json({ message: "Unsupported image type" });

      const catalog = await loadCatalog(UPLOAD_DIR);
      const existingIds = new Set(catalog.items.map((item) => item.id));
      const filename = generatePortfolioFilename(category, extension);
      const filePath = resolvePortfolioFilePath(UPLOAD_DIR, category, filename);
      if (!filePath) return res.status(400).json({ message: "Could not resolve a safe upload path" });

      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, file.buffer);

      const dimensions = readImageDimensions(file.buffer, file.contentType) ?? { width: 0, height: 0 };
      const metadata = CATEGORY_METADATA[category];
      const item: PortfolioItem = {
        id: generatePortfolioId(category, existingIds),
        category,
        categoryName: metadata?.name ?? category,
        icon: metadata?.icon ?? "📸",
        filename,
        url: `/api/uploads/portfolio/${category}/${filename}`,
        width: dimensions.width,
        height: dimensions.height,
        bytes: file.buffer.length,
        title,
      };

      catalog.items.push(item);
      await saveCatalog(UPLOAD_DIR, { updatedAt: new Date().toISOString(), total: catalog.items.length, items: catalog.items });

      return res.status(201).json(item);
    } catch (error) {
      if (error instanceof Error && /required|invalid|choose|allowed|large/i.test(error.message)) {
        return res.status(400).json({ message: error.message });
      }
      return next(error);
    }
  },
);

/**
 * DELETE /api/admin/portfolio/:id
 * Removes a catalog entry, its file on disk, and its visibility.json entry
 * (if any). If the item's own category/filename can't be safely resolved
 * under uploads/portfolio/ (a corrupted or tampered catalog entry), the
 * catalog entry is still removed but the file delete step is refused
 * outright -- never touching anything outside that directory, no matter
 * what the stored data says.
 */
router.delete(
  "/admin/portfolio/:id",
  createAdminAuthMiddleware(),
  requireAnyAdminPermission(["leads", "basins"], "delete"),
  async (req, res, next) => {
    try {
      const rawId = req.params["id"];
      const id = typeof rawId === "string" ? rawId : "";
      const catalog = await loadCatalog(UPLOAD_DIR);
      const index = catalog.items.findIndex((item) => item.id === id);
      if (index === -1) return res.status(404).json({ message: "Portfolio item not found" });
      const [removed] = catalog.items.splice(index, 1) as [PortfolioItem];

      let fileRemoved = false;
      const filePath = resolvePortfolioFilePath(UPLOAD_DIR, removed.category, removed.filename);
      if (filePath) {
        try {
          await unlink(filePath);
          fileRemoved = true;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      } else {
        console.warn("Portfolio delete: refusing to touch a file outside uploads/portfolio/", {
          id,
          category: removed.category,
          filename: removed.filename,
        });
      }

      await saveCatalog(UPLOAD_DIR, { updatedAt: new Date().toISOString(), total: catalog.items.length, items: catalog.items });

      const visibilityMap = await loadVisibilityMap();
      if (id in visibilityMap) {
        delete visibilityMap[id];
        await saveVisibilityMap(visibilityMap);
      }

      console.info("Portfolio item deleted", {
        id,
        admin: req.adminMember?.displayName ?? "owner",
        at: new Date().toISOString(),
        fileRemoved,
      });

      return res.json({ id, deleted: true, fileRemoved });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * GET /api/admin/portfolio/duplicates
 * Flags likely-duplicate photos two ways: (a) byte-identical files (MD5),
 * and (b) same width/height/bytes (a strong signal the same photo was
 * imported twice under different ids), so an admin can bulk-delete them.
 */
router.get(
  "/admin/portfolio/duplicates",
  createAdminAuthMiddleware(),
  requireAnyAdminPermission(["leads", "basins"]),
  async (_req, res, next) => {
    try {
      const catalog = await loadCatalog(UPLOAD_DIR);

      const byMd5 = new Map<string, string[]>();
      for (const item of catalog.items) {
        const filePath = resolvePortfolioFilePath(UPLOAD_DIR, item.category, item.filename);
        if (!filePath) continue;
        let buffer: Buffer;
        try {
          buffer = await readFile(filePath);
        } catch {
          continue;
        }
        const hash = createHash("md5").update(buffer).digest("hex");
        const ids = byMd5.get(hash) ?? [];
        ids.push(item.id);
        byMd5.set(hash, ids);
      }

      const byDimensions = new Map<string, string[]>();
      for (const item of catalog.items) {
        if (item.width <= 0 || item.height <= 0 || item.bytes <= 0) continue;
        const key = `${item.width}x${item.height}:${item.bytes}`;
        const ids = byDimensions.get(key) ?? [];
        ids.push(item.id);
        byDimensions.set(key, ids);
      }

      const groups = [
        ...[...byMd5.values()].filter((ids) => ids.length > 1).map((itemIds) => ({ reason: "md5" as const, itemIds })),
        ...[...byDimensions.values()].filter((ids) => ids.length > 1).map((itemIds) => ({ reason: "dimensions" as const, itemIds })),
      ];

      return res.json({ groups });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;

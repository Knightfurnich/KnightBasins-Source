import { Router, type IRouter } from "express";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { UPLOAD_DIR } from "../lib/image-upload";
import { createAdminAuthMiddleware, requireAnyAdminPermission } from "../middlewares/admin-auth";

const router: IRouter = Router();

const PORTFOLIO_CATALOG_PATH = join(UPLOAD_DIR, "portfolio", "catalog.json");
const PORTFOLIO_VISIBILITY_PATH = join(UPLOAD_DIR, "portfolio", "visibility.json");

type PortfolioItem = {
  id: string;
  category: string;
  categoryName: string;
  icon: string;
  filename: string;
  url: string;
  width: number;
  height: number;
  bytes: number;
  title: string;
};

type PortfolioCatalog = { updatedAt: string; total: number; items: PortfolioItem[] };

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

async function loadCatalog(): Promise<PortfolioCatalog> {
  const raw = await readFile(PORTFOLIO_CATALOG_PATH, "utf8");
  const parsed = JSON.parse(raw) as Partial<PortfolioCatalog>;
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  // The import contains a handful of duplicate ids (two files ingested under
  // the same id, e.g. counter_001). Ids drive the allowlist, the visibility
  // map and the React keys, so a repeated id renders the same photo twice and
  // inflates the public count. Keep the first occurrence of each id.
  const seen = new Set<string>();
  const uniqueItems = items.filter((item) => {
    if (!item || typeof item.id !== "string" || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  return {
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    total: uniqueItems.length,
    items: uniqueItems,
  };
}

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

async function saveVisibilityMap(map: PortfolioVisibilityMap): Promise<void> {
  await writeFile(PORTFOLIO_VISIBILITY_PATH, JSON.stringify(map), "utf8");
}

function isVisible(visibilityMap: PortfolioVisibilityMap, itemId: string): boolean {
  return visibilityMap[itemId] !== false;
}

/**
 * GET /api/portfolio
 * Public read-only gallery of real completed installation photos.
 * Never exposes customer names, job codes, or internal notes — only the image
 * URL, its work category and a generic title.
 */
router.get("/portfolio", async (req, res, next) => {
  try {
    const catalog = await loadCatalog();
    const visibilityMap = await loadVisibilityMap();
    const allowlist = await loadAllowlist();
    const includeHidden = req.query["includeHidden"] === "true" || req.query["includeHidden"] === "1";
    const categoryFilter = typeof req.query["category"] === "string" ? req.query["category"].trim() : "";
    const searchQuery = typeof req.query["q"] === "string" ? req.query["q"].trim().toLowerCase() : "";
    const limitRaw = Number(req.query["limit"]);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 600) : 60;
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

    const ordered = [...filtered].sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a.category);
      const bi = CATEGORY_ORDER.indexOf(b.category);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

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

    res.setHeader("Cache-Control", includeHidden ? "no-store" : "public, max-age=600");
    res.json({
      updatedAt: catalog.updatedAt,
      total: visibleItems.length,
      categories,
      count: ordered.length,
      items: ordered.slice(offset, offset + limit).map((item) => ({
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

    const catalog = await loadCatalog();
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
      "/opt/data/knight-design-kb/portfolio_featured.json",
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
      const catalog = await loadCatalog();
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

export default router;

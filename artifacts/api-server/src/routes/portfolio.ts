import { Router, type IRouter } from "express";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { UPLOAD_DIR } from "../lib/image-upload";

const router: IRouter = Router();

const PORTFOLIO_CATALOG_PATH = join(UPLOAD_DIR, "portfolio", "catalog.json");

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
  return {
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    total: items.length,
    items,
  };
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
    const categoryFilter = typeof req.query["category"] === "string" ? req.query["category"].trim() : "";
    const limitRaw = Number(req.query["limit"]);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 60;

    const filtered = categoryFilter
      ? catalog.items.filter((item) => item.category === categoryFilter)
      : catalog.items;

    const ordered = [...filtered].sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a.category);
      const bi = CATEGORY_ORDER.indexOf(b.category);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    const counts = new Map<string, number>();
    for (const item of catalog.items) {
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    }
    const categories = CATEGORY_ORDER
      .filter((slug) => counts.has(slug))
      .map((slug) => {
        const sample = catalog.items.find((item) => item.category === slug);
        return {
          slug,
          name: sample?.categoryName ?? slug,
          icon: sample?.icon ?? "📸",
          count: counts.get(slug) ?? 0,
        };
      });

    res.setHeader("Cache-Control", "public, max-age=600");
    res.json({
      updatedAt: catalog.updatedAt,
      total: catalog.total,
      categories,
      count: ordered.length,
      items: ordered.slice(0, limit).map((item) => ({
        id: item.id,
        category: item.category,
        categoryName: item.categoryName,
        icon: item.icon,
        url: item.url,
        width: item.width,
        height: item.height,
        title: item.title,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;

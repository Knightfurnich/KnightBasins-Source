import { db, basinCategories, basinPrices, installedStonePrices, sheetStonePrices, sitePhotos } from "@workspace/db";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { PRODUCTS, STONE_COLORS } from "../../../knight-basins/src/data/catalog";
import { canonicalMediaUrl, normalizeBasinFields, withBasinCategory, withBasinMedia, withStoneMedia } from "../lib/catalog-media";
import { commercialConstants, sheetTierPrices } from "../lib/commercial-constants";

const router: IRouter = Router();

let seedPromise: Promise<void> | null = null;

export async function seedCatalogIfEmpty() {
  if (!seedPromise) {
    seedPromise = (async () => {
      await db.transaction(async (tx) => {
        await tx.insert(basinCategories).values([
          { name: "counter basin", sortOrder: 0 },
          { name: "tall vertical washbasin", sortOrder: 1 },
        ]).onConflictDoNothing();

        const categories = await tx.select().from(basinCategories);
        for (const category of categories) {
          await tx.update(basinPrices)
            .set({ categoryId: category.id })
            .where(and(isNull(basinPrices.categoryId), eq(basinPrices.category, category.name)));
        }
        const categoryIds = new Map(categories.map((category) => [category.name, category.id]));

        await tx.insert(basinPrices).values(
            PRODUCTS.map((product, index) => {
              const normalized = normalizeBasinFields(product);
              return {
                ...product,
                categoryId: categoryIds.get(product.category) ?? null,
                dimensions: normalized.dimensions,
                basinDimensions: normalized.basinDimensions,
                bowlMm: normalized.bowlMm,
                sortOrder: index,
              };
            }),
          ).onConflictDoNothing();

        await tx.insert(installedStonePrices).values(
            STONE_COLORS.flatMap((stone, index) =>
              stone.installedPriceTHB === null
                ? []
                : [{
                    code: stone.code,
                    name: stone.name,
                    pricePerSqmTHB: stone.installedPriceTHB,
                    tone: stone.tone,
                    aliases: stone.documentCodes,
                    sortOrder: index,
                  }],
            ),
          ).onConflictDoNothing();

        await tx.insert(sheetStonePrices).values(
            STONE_COLORS.flatMap((stone, index) => {
              if (stone.sheetPriceTHB === null) return [];
              return [{
                code: stone.code,
                name: stone.name,
                basePriceTHB: stone.sheetPriceTHB,
                ...sheetTierPrices(stone.code, stone.sheetPriceTHB),
                tone: stone.tone,
                aliases: stone.documentCodes,
                sortOrder: index,
              }];
            }),
          ).onConflictDoNothing();
      });
    })().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  await seedPromise;
}

export async function getCatalogData(activeOnly = true) {
  await seedCatalogIfEmpty();
  const active = activeOnly ? eq(basinPrices.active, true) : undefined;
  const installedActive = activeOnly ? eq(installedStonePrices.active, true) : undefined;
  const sheetActive = activeOnly ? eq(sheetStonePrices.active, true) : undefined;
  const [basins, categories, installedStones, sheetStones] = await Promise.all([
    db.select().from(basinPrices).where(active).orderBy(asc(basinPrices.sortOrder), asc(basinPrices.id)),
    db.select().from(basinCategories).where(activeOnly ? eq(basinCategories.active, true) : undefined).orderBy(asc(basinCategories.sortOrder), asc(basinCategories.id)),
    db.select().from(installedStonePrices).where(installedActive).orderBy(asc(installedStonePrices.sortOrder), asc(installedStonePrices.id)),
    db.select().from(sheetStonePrices).where(sheetActive).orderBy(asc(sheetStonePrices.sortOrder), asc(sheetStonePrices.id)),
  ]);
  return {
    basins: basins.map((basin) => withBasinCategory(withBasinMedia(basin), categories)),
    categories,
    installedStones: installedStones.map(withStoneMedia),
    sheetStones: sheetStones.map(withStoneMedia),
  };
}

router.get("/catalog", async (_req, res, next) => {
  try {
    // The storefront polls this endpoint to keep other tabs and sessions fresh.
    // Never let an intermediary replay an older active/archived catalog response.
    res.setHeader("Cache-Control", "no-store, max-age=0");
    // Job 405-C: the trade constants the app prices with ride along, so the knowledge base can follow the app. Added keys only.
    res.json({ ...(await getCatalogData(true)), ...commercialConstants() });
  } catch (error) {
    next(error);
  }
});

/**
 * Public "real installation" showcase for the storefront.
 *
 * Deliberately returns a curated, anonymised payload: only the photo URL and a
 * short public caption. Sender names, internal job codes, lead ids and free-form
 * staff notes are never exposed publicly (see the no-internal-data-on-public-pages
 * rule), so this route selects columns explicitly instead of spreading the row.
 */
router.get("/site-photos/showcase", async (req, res, next) => {
  try {
    const requested = Number(req.query.limit ?? 6);
    const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), 12) : 6;
    const rows = await db
      .select({
        id: sitePhotos.id,
        imageUrl: sitePhotos.imageUrl,
        caption: sitePhotos.description,
        stage: sitePhotos.stage,
      })
      .from(sitePhotos)
      // Only photos the crew/admin confirmed as a finished installation belong on
      // the public storefront: survey and in-progress shots (marker drawings,
      // building debris) undercut credibility instead of building it.
      .where(eq(sitePhotos.stage, "completed"))
      .orderBy(desc(sitePhotos.capturedAt), desc(sitePhotos.id))
      .limit(limit);

    res.setHeader("Cache-Control", "public, max-age=600");
    res.json(
      rows
        // A photo without a usable caption adds no credibility — drop it rather
        // than publishing an unexplained image.
        .filter((row) => Boolean(row.imageUrl) && Boolean(row.caption?.trim()))
        .map((row) => ({ id: row.id, imageUrl: canonicalMediaUrl(row.imageUrl), caption: row.caption?.trim() ?? null })),
    );
  } catch (error) {
    next(error);
  }
});

export default router;
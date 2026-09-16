import { db, basinCategories, basinPrices, installedStonePrices, sheetStonePrices } from "@workspace/db";
import { and, asc, eq, isNull } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { PRODUCTS, STONE_COLORS } from "../../../knight-basins/src/data/catalog";
import { normalizeBasinFields, withBasinCategory, withBasinMedia, withStoneMedia } from "../lib/catalog-media";

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
              const excluded = ["BW010", "NW013"].includes(stone.code);
              return [{
                code: stone.code,
                name: stone.name,
                basePriceTHB: stone.sheetPriceTHB,
                price10PlusTHB: excluded ? stone.sheetPriceTHB : Math.max(0, stone.sheetPriceTHB - 200),
                price50PlusTHB: excluded ? stone.sheetPriceTHB : Math.round(stone.sheetPriceTHB * 0.95),
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
    res.json(await getCatalogData(true));
  } catch (error) {
    next(error);
  }
});

export default router;
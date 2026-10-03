// Shared fixtures for the tests that post or read a quote through the leads router (job-226).
//
// Since job-226 the server prices every studio / quick-purchase quote itself, from the pricing tables in the
// database, and refuses a payload it cannot reproduce. A test that only needs "a quote that totals N baht"
// therefore needs two things: a payload the server can price, and a (fake) database that answers the three
// pricing-table queries. This file provides both, so those tests keep asserting the same totals as before.

/** The totals the older route tests use as opaque numbers; each gets one basin priced at exactly that amount. */
export const FIXTURE_TOTALS_THB = [15000, 20000, 25000, 60990] as const;

export function fixtureBasinSku(priceTHB: number) {
  return `TESTB-${priceTHB}`;
}

/** Active basin rows as the database returns them, one per fixture total. */
export const FIXTURE_BASIN_ROWS = FIXTURE_TOTALS_THB.map((priceTHB, index) => ({
  id: index + 1,
  sku: fixtureBasinSku(priceTHB),
  colorCode: "WHITE",
  colorName: "White",
  priceTHB,
  category: "Fixture",
  categoryId: null,
  dimensions: "500 x 400 mm",
  basinDimensions: "450 x 350 mm",
  bowlMm: null,
  imageTone: "light",
  imageUrl: null,
  galleryImageUrls: [],
  quoteImageUrl: null,
  videoUrl: null,
  topViewImageUrl: null,
  active: true,
  sortOrder: index,
}));

function stoneRow(id: number, code: string, extra: Record<string, unknown>) {
  return {
    id,
    code,
    name: `Stone ${code}`,
    tone: "light",
    imageUrl: null,
    galleryImageUrls: [],
    quoteImageUrl: null,
    slabImageUrl: null,
    aliases: [],
    active: true,
    sortOrder: id,
    ...extra,
  };
}

/** TEST-ST1: priced both ways (8,000 per m2 installed, 5,000 per sheet). TEST-SHEET: sold by the sheet only, no installed price. */
export const FIXTURE_INSTALLED_STONE_ROWS = [stoneRow(1, "TEST-ST1", { pricePerSqmTHB: 8000 })];
export const FIXTURE_SHEET_STONE_ROWS = [
  stoneRow(1, "TEST-ST1", { basePriceTHB: 5000, price10PlusTHB: 4800, price50PlusTHB: 4500 }),
  stoneRow(2, "TEST-SHEET", { basePriceTHB: 3000, price10PlusTHB: 2800, price50PlusTHB: 2500 }),
];

export type PricingTableRows = {
  basin_prices?: Array<Record<string, unknown>>;
  installed_stone_prices?: Array<Record<string, unknown>>;
  sheet_stone_prices?: Array<Record<string, unknown>>;
};

const DEFAULT_PRICING_TABLES: Required<PricingTableRows> = {
  basin_prices: FIXTURE_BASIN_ROWS,
  installed_stone_prices: FIXTURE_INSTALLED_STONE_ROWS,
  sheet_stone_prices: FIXTURE_SHEET_STONE_ROWS,
};

// drizzle keeps a table's SQL name under a global symbol, so this works however many copies of drizzle the route bundle holds.
const DRIZZLE_TABLE_NAME = Symbol.for("drizzle:Name");

function pricingTableRows(table: unknown, tables: Required<PricingTableRows>): Array<Record<string, unknown>> | null {
  const name = (table as Record<symbol, unknown> | null | undefined)?.[DRIZZLE_TABLE_NAME];
  return typeof name === "string" && name in tables ? (tables[name as keyof PricingTableRows] ?? null) : null;
}

/** A thenable query builder for the pricing tables: where / orderBy / limit all return it, awaiting it yields the rows. */
function catalogBuilder(rows: Array<Record<string, unknown>>) {
  const builder: Record<string, unknown> = {
    where: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(rows.map((row) => ({ ...row }))).then(resolve, reject),
  };
  return builder;
}

/**
 * Wraps a route test's fake database so that select().from(<pricing table>) answers with the fixture catalog while
 * every other query goes to the fake exactly as before.
 */
export function withPricingCatalog<T extends { select: (...args: any[]) => any }>(database: T, override: PricingTableRows = {}): T {
  const tables: Required<PricingTableRows> = { ...DEFAULT_PRICING_TABLES, ...override } as Required<PricingTableRows>;
  return new Proxy(database, {
    get(target, property, receiver) {
      if (property !== "select") return Reflect.get(target, property, receiver);
      return (...args: unknown[]) => {
        const inner = target.select(...args);
        return new Proxy(inner, {
          get(innerTarget, innerProperty, innerReceiver) {
            if (innerProperty !== "from") return Reflect.get(innerTarget, innerProperty, innerReceiver);
            return (table: unknown) => {
              const rows = pricingTableRows(table, tables);
              return rows ? catalogBuilder(rows) : innerTarget.from(table);
            };
          },
        });
      };
    },
  });
}

/**
 * A quick-purchase studioData the server can price: one basin line priced at `priceTHB` (use one of FIXTURE_TOTALS_THB),
 * no VAT, no installation, shaped like the lines the storefront sends. `extra` is merged on top (extra keys never affect the price).
 */
export function quickPurchaseData(priceTHB: number, extra: Record<string, unknown> = {}) {
  return {
    kind: "quick-purchase",
    items: [
      {
        code: fixtureBasinSku(priceTHB),
        description: "Fixture basin",
        quantity: 1,
        unit: "ชุด",
        unitPrice: priceTHB,
        total: priceTHB,
        notificationKind: "basin",
      },
    ],
    grossSubtotal: priceTHB,
    discountAmount: 0,
    subtotal: priceTHB,
    vatAmount: 0,
    total: priceTHB,
    vat: false,
    ...extra,
  };
}

/** A database that only knows the pricing tables, for tests of the price check itself. */
export function pricingOnlyDatabase(override: PricingTableRows = {}) {
  const base = {
    select: () => ({
      from: () => {
        throw new Error("pricingOnlyDatabase: only the pricing tables can be queried");
      },
    }),
  };
  return withPricingCatalog(base, override);
}

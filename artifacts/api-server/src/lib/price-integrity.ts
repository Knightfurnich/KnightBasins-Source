// Server-side price integrity guard (Zero-Trust for client-submitted
// numbers): the studio calculator that produces `total`/`studioData` runs
// entirely in the browser, so this file never trusts those numbers at face
// value. A tampered payload -- a negative total, NaN/Infinity smuggled
// through JSON as a string, or an absurdly large number no real quote could
// reach -- is caught here before it ever reaches the database or a
// payment/notification flow.

import { basinPrices, installedStonePrices, sheetStonePrices } from "@workspace/db/schema";
import { asc, eq } from "drizzle-orm";
// The same pure pricing code the storefront runs in the browser: the server prices a quote with the very
// functions the customer's screen used, fed from the database instead of from the customer's payload.
import {
  INSTALLATION_PRICE,
  STONE_COLORS,
  VAT_RATE,
  basinProductFromCatalog,
  stoneColorsFromCatalog,
  stoneInstalledUnitPrice,
  stoneSheetUnitPrice,
  type BasinProduct,
  type StoneColor,
} from "../../../knight-basins/src/data/catalog.ts";
import { studioEstimate, type StudioState } from "../../../knight-basins/src/data/studio-model.ts";

/** A quote of exactly 0 THB is unusual but not a tamper signal by itself; only a negative total is. */
const MIN_QUOTE_TOTAL_THB = 0;
/** No real Knight Basins order approaches this figure -- past it is either a bug upstream or a deliberately forged payload, never a legitimate large order. */
const MAX_QUOTE_TOTAL_THB = 50_000_000;
/** 50 meters -- far beyond any real counter/basin run. Guards against a client sending a dimension that's off by orders of magnitude (unit-confusion or a deliberately huge number), the same class of bug documented for parseDimensionToMm in sketch-vision.ts. */
const MAX_DIMENSION_MM = 50_000;

export type QuoteTotalVerification = {
  verifiedTotal: number | null;
  isTampered: boolean;
};

/**
 * Reads the same total-shaped fields `quoteTotalTHB` in routes/leads.ts does
 * (top-level `total`, or the nested `notification`/`quickQuote`/`estimate`
 * variants different studio flows write), but treats an out-of-range or
 * non-numeric result as tampering rather than silently trusting it.
 *
 * `verifiedTotal` is null whenever no *safe* number was found -- either
 * nothing was present, or the only value present was tampered -- never a
 * clamped or best-effort guess, so a caller can't mistake a rejected value
 * for a real quote total.
 */
export function verifyAndSanitizeQuoteTotal(studioData: unknown): QuoteTotalVerification {
  if (!studioData || typeof studioData !== "object") return { verifiedTotal: null, isTampered: false };

  const data = studioData as {
    total?: unknown;
    notification?: { total?: unknown };
    quickQuote?: { total?: unknown };
    estimate?: { totalTHB?: unknown };
  };
  const rawValue = data.notification?.total ?? data.total ?? data.quickQuote?.total ?? data.estimate?.totalTHB;
  if (rawValue === undefined || rawValue === null) return { verifiedTotal: null, isTampered: false };

  // A string, boolean, NaN, or +/-Infinity could never come from the real
  // studio calculator, which always writes a finite number -- that's a
  // tamper signal, not just "missing data".
  if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
    return { verifiedTotal: null, isTampered: true };
  }
  if (rawValue < MIN_QUOTE_TOTAL_THB || rawValue > MAX_QUOTE_TOTAL_THB) {
    return { verifiedTotal: null, isTampered: true };
  }
  return { verifiedTotal: Math.round(rawValue), isTampered: false };
}

/**
 * True only when both dimensions are finite, strictly positive, and within
 * a sane real-world ceiling for a single stone/basin panel run. Used
 * wherever a client-supplied width/depth feeds a price or layout
 * calculation server-side.
 */
export function validateNumericDimensions(widthMm: number, depthMm: number): boolean {
  return [widthMm, depthMm].every(
    (value) => typeof value === "number" && Number.isFinite(value) && value > 0 && value <= MAX_DIMENSION_MM,
  );
}

// ---- job-226: the server prices the quote itself --------------------------
//
// Everything above only checks that a submitted total is a sane number. That is not enough: the studio
// page also lets the customer type a discount and an open-edge price, so a total could be "consistent"
// with a payload the customer wrote entirely themselves. From here on the server recomputes the total
// from the database prices and compares:
//   * discountTHB is always 0 and openEdgePricePerMTHB is always the standard (none) -- public
//     customers do not get to set either (boss's decision, job-226);
//   * a basin's price, a stone's price per m2 / per sheet, installation and VAT come from the database
//     (or from the shared pricing model for the constants it already owns), never from the payload;
//   * every total the payload claims (notification.total, total, quickQuote.total, estimate.totalTHB)
//     must agree with the server's number to within PRICE_TOLERANCE_THB.

/** Rounding slack between the server's number and the browser's (the browser sums floating-point areas). */
export const PRICE_TOLERANCE_THB = 1;

export const PRICE_VERIFICATION_FAILED_ERROR = "PRICE_VERIFICATION_FAILED";
export const PRICE_VERIFICATION_FAILED_MESSAGE = "ยอดเงินไม่ตรงกับราคาที่คำนวณจริงจากระบบ กรุณาติดต่อเจ้าหน้าที่";
export const PRICE_TAMPER_AUDIT_ACTION = "quote.price_tamper_detected";

/** Key under studioData that only the server writes: the total it verified when the quote was saved. */
export const SERVER_PRICING_KEY = "serverPricing";

/** Safety valves on what a single (already size-limited) payload may ask the server to price. */
const MAX_QUICK_PURCHASE_ITEMS = 200;
const MAX_ITEM_QUANTITY = 100_000;

export type PricingCatalog = {
  products: ReadonlyArray<BasinProduct>;
  stoneColors: ReadonlyArray<StoneColor>;
};

/** The part of the database the price check needs; the routers' own database handle satisfies it. */
export type PricingDatabase = { select: (...args: any[]) => any };

export type QuoteRecalculation = {
  /** The server's total, or null when the payload could not be priced (see `reason`) or carried no total at all. */
  calculatedTotal: number | null;
  isTampered: boolean;
  reason?: string;
  /** Every total the payload claimed, by field name. */
  claimedTotals: Record<string, number>;
  /** The discount the customer tried to apply; always ignored. */
  discountIgnoredTHB: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPricingCatalog(value: unknown): value is PricingCatalog {
  return isRecord(value) && Array.isArray(value["products"]) && Array.isArray(value["stoneColors"]);
}

/**
 * Active basins and stones from the database, in the order the storefront receives them from /api/catalog
 * (sort order, then id -- the first stone is what an unknown colour name falls back to in the shared model).
 */
export async function loadPricingCatalog(database: PricingDatabase): Promise<PricingCatalog> {
  const [basins, installedStones, sheetStones] = await Promise.all([
    database.select().from(basinPrices).where(eq(basinPrices.active, true)).orderBy(asc(basinPrices.sortOrder), asc(basinPrices.id)),
    database.select().from(installedStonePrices).where(eq(installedStonePrices.active, true)).orderBy(asc(installedStonePrices.sortOrder), asc(installedStonePrices.id)),
    database.select().from(sheetStonePrices).where(eq(sheetStonePrices.active, true)).orderBy(asc(sheetStonePrices.sortOrder), asc(sheetStonePrices.id)),
  ]);
  return {
    products: (basins as Array<Parameters<typeof basinProductFromCatalog>[0]>).map(basinProductFromCatalog),
    stoneColors: stoneColorsFromCatalog(installedStones, sheetStones),
  };
}

/** Every total-shaped field a payload carries (the same fields quoteTotalTHB can read), by name. A non-number is reported as NaN. */
function readClaimedTotals(studioData: Record<string, unknown>): Record<string, number> {
  const claims: Record<string, unknown> = {};
  const notification = studioData["notification"];
  const quickQuote = studioData["quickQuote"];
  const estimate = studioData["estimate"];
  if (isRecord(notification) && notification["total"] != null) claims["notification.total"] = notification["total"];
  if (studioData["total"] != null) claims["total"] = studioData["total"];
  if (isRecord(quickQuote) && quickQuote["total"] != null) claims["quickQuote.total"] = quickQuote["total"];
  if (isRecord(estimate) && estimate["totalTHB"] != null) claims["estimate.totalTHB"] = estimate["totalTHB"];
  return Object.fromEntries(
    Object.entries(claims).map(([field, value]) => [field, typeof value === "number" && Number.isFinite(value) ? value : Number.NaN]),
  );
}

/**
 * The shared pricing model reads stone prices from the module-level STONE_COLORS list (the storefront
 * fills it from /api/catalog in place). Do the same for the duration of one synchronous calculation and put
 * the previous contents back -- there is no await inside, so no other request can observe the swap.
 */
function withStoneCatalog<T>(stoneColors: ReadonlyArray<StoneColor>, calculate: () => T): T {
  const previous = STONE_COLORS.slice();
  STONE_COLORS.splice(0, STONE_COLORS.length, ...stoneColors);
  try {
    return calculate();
  } finally {
    STONE_COLORS.splice(0, STONE_COLORS.length, ...previous);
  }
}

/** The discount a studio payload tried to apply (for the audit trail only; it is never used). */
function attemptedDiscountTHB(studioData: Record<string, unknown>): number {
  const state = studioData["state"];
  const discount = isRecord(state) ? state["discountTHB"] : undefined;
  return typeof discount === "number" && Number.isFinite(discount) && discount > 0 ? Math.round(discount) : 0;
}

/**
 * The state as the server prices it: no customer discount and no customer-set open-edge price.
 * (The standard open-edge price is none: the studio's own initial state has openEdgePricePerMTHB: null.)
 */
function canonicalStudioState(state: Record<string, unknown>): StudioState {
  return { ...state, discountTHB: 0, openEdgePricePerMTHB: null } as unknown as StudioState;
}

type Priced = { total: number } | { reason: string };

function priceStudioQuote(studioData: Record<string, unknown>, catalog: PricingCatalog): Priced {
  const state = studioData["state"];
  if (!isRecord(state)) return { reason: "studio-state-missing" };
  try {
    const estimate = withStoneCatalog(catalog.stoneColors, () => studioEstimate(canonicalStudioState(state), catalog.products));
    return Number.isFinite(estimate.totalTHB) ? { total: estimate.totalTHB } : { reason: "studio-total-not-finite" };
  } catch {
    return { reason: "studio-state-invalid" };
  }
}

/** Same arithmetic as calculateFormalQuoteTotals in the storefront's quote-utils (a parity test keeps them identical). */
function formalQuoteTotal(parts: { basinSubtotal: number; requestedInstallation: number; basinSets: number; stoneTotal: number; vat: boolean }) {
  const installationDiscount = parts.basinSets >= 3 ? parts.requestedInstallation : 0;
  const grossSubtotal = parts.basinSubtotal + parts.requestedInstallation + parts.stoneTotal;
  const subtotal = grossSubtotal - installationDiscount;
  const vatAmount = parts.vat ? Math.round(subtotal * VAT_RATE) : 0;
  return subtotal + vatAmount;
}

function withinTolerance(claimed: unknown, expected: number) {
  return typeof claimed === "number" && Number.isFinite(claimed) && Math.abs(claimed - expected) <= PRICE_TOLERANCE_THB;
}

/**
 * Quick-purchase payloads carry the formal quote lines (code, quantity, unit), not the customer's cart. Each
 * line is priced from the database by its code; the prices written on the lines are only checked, never used.
 */
function priceQuickPurchaseQuote(studioData: Record<string, unknown>, catalog: PricingCatalog): Priced {
  const items = studioData["items"];
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_QUICK_PURCHASE_ITEMS) return { reason: "quick-purchase-items-invalid" };

  let basinSubtotal = 0;
  let basinSets = 0;
  let installationSets = 0;
  let installationItemTotal: unknown = undefined;
  let stoneTotal = 0;

  for (const item of items) {
    if (!isRecord(item)) return { reason: "quick-purchase-item-invalid" };
    const code = typeof item["code"] === "string" ? item["code"].trim() : "";
    const quantity = item["quantity"];
    if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0 || quantity > MAX_ITEM_QUANTITY) {
      return { reason: `quick-purchase-quantity-invalid:${code.slice(0, 32)}` };
    }

    if (code === "INSTALL") {
      if (!Number.isInteger(quantity)) return { reason: "quick-purchase-installation-quantity-invalid" };
      installationSets += quantity;
      installationItemTotal = item["total"];
      continue;
    }

    const product = catalog.products.find((candidate) => candidate.sku === code);
    if (product) {
      if (!Number.isInteger(quantity)) return { reason: `quick-purchase-quantity-invalid:${code.slice(0, 32)}` };
      const lineTotal = product.priceTHB * quantity;
      if (item["total"] != null && !withinTolerance(item["total"], lineTotal)) return { reason: `quick-purchase-line-total-mismatch:${code.slice(0, 32)}` };
      basinSubtotal += lineTotal;
      basinSets += quantity;
      continue;
    }

    const stone = catalog.stoneColors.find((candidate) => candidate.code === code);
    if (stone) {
      const unit = item["unit"];
      let unitPrice: number | null;
      if (unit === "แผ่น") unitPrice = stoneSheetUnitPrice(stone.code, quantity, catalog.stoneColors);
      else if (unit === "ตร.ม.") unitPrice = stoneInstalledUnitPrice(stone.code, catalog.stoneColors);
      else return { reason: `quick-purchase-stone-unit-invalid:${code.slice(0, 32)}` };
      if (unitPrice === null) return { reason: `quick-purchase-stone-not-priced:${code.slice(0, 32)}` };
      const lineTotal = unitPrice * quantity;
      if (item["total"] != null && !withinTolerance(item["total"], lineTotal)) return { reason: `quick-purchase-line-total-mismatch:${code.slice(0, 32)}` };
      stoneTotal += lineTotal;
      continue;
    }

    return { reason: `quick-purchase-unknown-item:${code.slice(0, 32)}` };
  }

  if (installationSets > basinSets) return { reason: "quick-purchase-installation-exceeds-basins" };
  const requestedInstallation = INSTALLATION_PRICE * installationSets;
  if (installationItemTotal != null && !withinTolerance(installationItemTotal, requestedInstallation)) return { reason: "quick-purchase-line-total-mismatch:INSTALL" };

  return { total: formalQuoteTotal({ basinSubtotal, requestedInstallation, basinSets, stoneTotal, vat: studioData["vat"] === true }) };
}

/**
 * Prices a studio / quick-purchase quote on the server and checks it against every total the payload claims.
 * `source` is either the database (the catalog is read from it) or an already loaded catalog.
 *
 *  - no total claimed at all  -> not tampered, calculatedTotal null (nothing to verify)
 *  - cannot be priced          -> tampered ("reason" says why): a payload the server cannot reproduce is not trusted
 *  - a claimed total differs from the server's by more than PRICE_TOLERANCE_THB -> tampered
 */
export async function verifyAndRecalculateQuoteTotal(
  orderMode: string,
  payload: unknown,
  source: PricingDatabase | PricingCatalog,
): Promise<QuoteRecalculation> {
  const none: QuoteRecalculation = { calculatedTotal: null, isTampered: false, claimedTotals: {}, discountIgnoredTHB: 0 };
  if (orderMode !== "studio" && orderMode !== "quick-purchase") return { ...none, reason: "order-mode-not-priced" };
  if (!isRecord(payload)) return { ...none, reason: "no-claimed-total" };

  const claimedTotals = readClaimedTotals(payload);
  const discountIgnoredTHB = orderMode === "studio" ? attemptedDiscountTHB(payload) : 0;
  if (Object.keys(claimedTotals).length === 0) return { ...none, discountIgnoredTHB, reason: "no-claimed-total" };
  const base = { claimedTotals, discountIgnoredTHB };
  if (Object.values(claimedTotals).some((value) => Number.isNaN(value))) {
    return { calculatedTotal: null, isTampered: true, reason: "claimed-total-not-a-number", ...base };
  }

  const catalog = isPricingCatalog(source) ? source : await loadPricingCatalog(source);
  const priced = orderMode === "studio" ? priceStudioQuote(payload, catalog) : priceQuickPurchaseQuote(payload, catalog);
  if ("reason" in priced) return { calculatedTotal: null, isTampered: true, reason: priced.reason, ...base };

  const mismatch = Object.entries(claimedTotals).find(([, value]) => Math.abs(value - priced.total) > PRICE_TOLERANCE_THB);
  if (mismatch) return { calculatedTotal: priced.total, isTampered: true, reason: `total-mismatch:${mismatch[0]}`, ...base };
  return { calculatedTotal: priced.total, isTampered: false, ...base };
}

/** studioData as it is stored for a verified quote: no customer discount or open-edge price, and no client-supplied serverPricing. */
export function canonicalStudioData(orderMode: string, studioData: Record<string, unknown>): Record<string, unknown> {
  const { [SERVER_PRICING_KEY]: _clientSupplied, ...rest } = studioData;
  const state = rest["state"];
  if (orderMode === "studio" && isRecord(state)) {
    return { ...rest, state: { ...state, discountTHB: 0, openEdgePricePerMTHB: null } };
  }
  return rest;
}

/** Drops a client-supplied serverPricing: that key is the server's alone. */
export function stripServerPricing(studioData: unknown): unknown {
  if (!isRecord(studioData) || !(SERVER_PRICING_KEY in studioData)) return studioData;
  const { [SERVER_PRICING_KEY]: _clientSupplied, ...rest } = studioData;
  return rest;
}

/** Stamps the total the server verified, so the quote keeps its price if the catalog changes later. */
export function withServerPricing(studioData: Record<string, unknown>, verifiedTotal: number): Record<string, unknown> {
  return { ...studioData, [SERVER_PRICING_KEY]: { verifiedTotalTHB: Math.round(verifiedTotal), verifiedAt: new Date().toISOString() } };
}

function serverVerifiedTotal(studioData: Record<string, unknown>): number | null {
  const stamp = studioData[SERVER_PRICING_KEY];
  const total = isRecord(stamp) ? stamp["verifiedTotalTHB"] : undefined;
  return typeof total === "number" && Number.isFinite(total) ? total : null;
}

export type QuotePaymentCheck =
  | { ok: true; total: number }
  | { ok: false; reason: string; claimedTotals: Record<string, number>; calculatedTotal: number | null; discountIgnoredTHB: number };

/**
 * The check in front of a payment QR. A quote saved after job-226 carries the total the server verified, so it
 * keeps its price for its 45-day life even if the catalog changes; a quote saved before that (or one whose totals
 * no longer match the stamp) is priced again from the current database.
 */
export async function checkQuoteBeforePayment(
  lead: { orderMode: string; studioData: unknown },
  source: PricingDatabase | PricingCatalog,
): Promise<QuotePaymentCheck> {
  const studioData = lead.studioData;
  if (!isRecord(studioData)) return { ok: false, reason: "no-studio-data", claimedTotals: {}, calculatedTotal: null, discountIgnoredTHB: 0 };

  const claimedTotals = readClaimedTotals(studioData);
  const stamped = serverVerifiedTotal(studioData);
  const claimed = Object.values(claimedTotals);
  if (stamped !== null && claimed.length > 0 && claimed.every((value) => Math.abs(value - stamped) <= PRICE_TOLERANCE_THB)) {
    return { ok: true, total: Math.round(stamped) };
  }

  const result = await verifyAndRecalculateQuoteTotal(lead.orderMode, studioData, source);
  if (result.isTampered || result.calculatedTotal === null) {
    return {
      ok: false,
      reason: result.reason ?? "no-calculated-total",
      claimedTotals: result.claimedTotals,
      calculatedTotal: result.calculatedTotal,
      discountIgnoredTHB: result.discountIgnoredTHB,
    };
  }
  return { ok: true, total: Math.round(result.calculatedTotal) };
}

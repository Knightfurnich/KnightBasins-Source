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
import { studioEstimate, type StudioEstimate, type StudioState } from "../../../knight-basins/src/data/studio-model.ts";

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
 * Pricing levers only a signed-in staff member may set (job-229): a discount in baht and an open-edge price per metre.
 * Public customers never have any: for them both stay at their standard value.
 */
export type StaffPricingLevers = {
  staffDiscountTHB: number;
  staffOpenEdgePricePerMTHB: number | null;
};

/**
 * The state as the server prices it. With no staff levers (every public customer): no discount and no open-edge price
 * (the standard is none: the studio's own initial state has openEdgePricePerMTHB: null). With staff levers, the
 * discount and open-edge price the signed-in staff member authorised.
 */
function canonicalStudioState(state: Record<string, unknown>, staff?: StaffPricingLevers | null): StudioState {
  return {
    ...state,
    discountTHB: staff?.staffDiscountTHB ?? 0,
    openEdgePricePerMTHB: staff?.staffOpenEdgePricePerMTHB ?? null,
  } as unknown as StudioState;
}

/** The shared pricing model's estimate for `state`, with the database's catalog loaded into it. Throws if the state cannot be priced. */
function studioEstimateWithCatalog(state: Record<string, unknown>, catalog: PricingCatalog, staff?: StaffPricingLevers | null): StudioEstimate {
  return withStoneCatalog(catalog.stoneColors, () => studioEstimate(canonicalStudioState(state, staff), catalog.products));
}

type Priced = { total: number } | { reason: string };

function priceStudioQuote(studioData: Record<string, unknown>, catalog: PricingCatalog): Priced {
  const state = studioData["state"];
  if (!isRecord(state)) return { reason: "studio-state-missing" };
  try {
    const estimate = studioEstimateWithCatalog(state, catalog);
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

/**
 * Stamps the total the server verified, so the quote keeps its price if the catalog changes later.
 * `extra` carries what a staff member authorised (see repriceStudioQuoteAsStaff); customers' quotes never have any.
 */
export function withServerPricing(studioData: Record<string, unknown>, verifiedTotal: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...studioData, [SERVER_PRICING_KEY]: { ...extra, verifiedTotalTHB: Math.round(verifiedTotal), verifiedAt: new Date().toISOString() } };
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

// ---- job-229: staff discounts ------------------------------------------------
//
// A public customer's discount is always 0 (above). A signed-in staff member may give one, and set the open-edge price,
// through PATCH /api/admin/leads/:id -- a route that already requires the leads:edit permission. That route calls
// repriceStudioQuoteAsStaff(): the server prices the quote with exactly the levers the staff member set (and the
// database's prices for everything else), rewrites every total the quote carries so that the quote page, the QR and the
// balance all agree, and stamps the result. The stamp is what the payment-QR check trusts, so a discounted quote can be
// paid by QR. Staff cannot enter an arbitrary total: only the two levers, on top of database prices.

export type StaffAuthorization = {
  /** Set only for a signed-in team member; null for the owner's password login. Never a name: the quote can be read by the customer. */
  memberId: number | null;
};

export type StaffRepriceResult =
  | { ok: true; studioData: Record<string, unknown>; total: number; levers: StaffPricingLevers | null }
  | { ok: false; reason: string };

/** The discount and open-edge price a studio payload asks for, or null when it asks for neither. */
export function staffLeversFromState(studioData: unknown): StaffPricingLevers | null {
  const state = isRecord(studioData) ? studioData["state"] : undefined;
  if (!isRecord(state)) return null;
  const discount = state["discountTHB"];
  const openEdge = state["openEdgePricePerMTHB"];
  const staffDiscountTHB = typeof discount === "number" && Number.isFinite(discount) && discount > 0 ? discount : 0;
  const staffOpenEdgePricePerMTHB = typeof openEdge === "number" && Number.isFinite(openEdge) ? openEdge : null;
  return staffDiscountTHB > 0 || staffOpenEdgePricePerMTHB !== null ? { staffDiscountTHB, staffOpenEdgePricePerMTHB } : null;
}

/** The levers a staff member authorised earlier, as recorded in the stamp (null for a quote that never had any). */
export function staffLeversFromStamp(studioData: unknown): StaffPricingLevers | null {
  const stamp = isRecord(studioData) ? studioData[SERVER_PRICING_KEY] : undefined;
  if (!isRecord(stamp)) return null;
  const discount = stamp["staffDiscountTHB"];
  const openEdge = stamp["staffOpenEdgePricePerMTHB"];
  const staffDiscountTHB = typeof discount === "number" && Number.isFinite(discount) && discount > 0 ? discount : 0;
  const staffOpenEdgePricePerMTHB = typeof openEdge === "number" && Number.isFinite(openEdge) ? openEdge : null;
  return staffDiscountTHB > 0 || staffOpenEdgePricePerMTHB !== null ? { staffDiscountTHB, staffOpenEdgePricePerMTHB } : null;
}

/**
 * Prices a studio quote for a signed-in staff member with the given levers (null = none, i.e. the standard price) and
 * returns studioData rewritten to match: the state carries the levers as priced, the estimate and the notification's
 * gross / discount / subtotal / VAT / total are the server's, and the stamp records the total and what was authorised.
 * Refuses a state it cannot price and levers the pricing model rejects (a discount above the amount it applies to, a
 * negative or over-precise open-edge price).
 */
export async function repriceStudioQuoteAsStaff(
  studioData: Record<string, unknown>,
  source: PricingDatabase | PricingCatalog,
  levers: StaffPricingLevers | null,
  authorization: StaffAuthorization,
): Promise<StaffRepriceResult> {
  const state = studioData["state"];
  if (!isRecord(state)) return { ok: false, reason: "studio-state-missing" };

  const catalog = isPricingCatalog(source) ? source : await loadPricingCatalog(source);
  let estimate: StudioEstimate;
  try {
    estimate = studioEstimateWithCatalog(state, catalog, levers);
  } catch {
    return { ok: false, reason: "studio-state-invalid" };
  }
  if (!Number.isFinite(estimate.totalTHB)) return { ok: false, reason: "studio-total-not-finite" };
  if (estimate.discountInvalid) return { ok: false, reason: "discount-invalid" };
  if (estimate.openEdgePriceInvalid) return { ok: false, reason: "open-edge-price-invalid" };

  const staffDiscountTHB = levers?.staffDiscountTHB ?? 0;
  const staffOpenEdgePricePerMTHB = levers?.staffOpenEdgePricePerMTHB ?? null;
  const discountApplied = estimate.discountTHB;
  const rewritten: Record<string, unknown> = {
    ...studioData,
    state: { ...state, discountTHB: discountApplied, openEdgePricePerMTHB: staffOpenEdgePricePerMTHB },
    estimate,
  };
  // The studio page spreads its state into studioData too: keep those copies in step.
  if ("discountTHB" in rewritten) rewritten["discountTHB"] = discountApplied;
  if ("openEdgePricePerMTHB" in rewritten) rewritten["openEdgePricePerMTHB"] = staffOpenEdgePricePerMTHB;
  if (isRecord(rewritten["notification"])) {
    rewritten["notification"] = {
      ...rewritten["notification"],
      grossSubtotal: estimate.grossSubtotalTHB,
      discountAmount: estimate.grossSubtotalTHB - estimate.subtotalTHB,
      subtotal: estimate.subtotalTHB,
      vatAmount: estimate.vatAmountTHB,
      total: estimate.totalTHB,
    };
  }
  if (rewritten["total"] != null) rewritten["total"] = estimate.totalTHB;
  if (isRecord(rewritten["quickQuote"]) && rewritten["quickQuote"]["total"] != null) {
    rewritten["quickQuote"] = { ...rewritten["quickQuote"], total: estimate.totalTHB };
  }

  const staffStamp = levers
    ? { staffDiscountTHB, staffOpenEdgePricePerMTHB, authorizedByMemberId: authorization.memberId, authorizedAt: new Date().toISOString() }
    : {};
  return { ok: true, studioData: withServerPricing(rewritten, estimate.totalTHB, staffStamp), total: estimate.totalTHB, levers };
}

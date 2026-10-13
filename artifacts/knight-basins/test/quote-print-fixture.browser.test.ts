// Run the existing A4 case against an in-memory API: no catalogue network dependency,
// customer data, notifications, production writes, or changes to the printing code.
import http from "node:http";
import { after } from "node:test";
import { BASIN_PRODUCTS, STONE_COLORS } from "../src/data/catalog.ts";

const preview = process.env["BROWSER_TEST_BASE_URL"] ?? "http://127.0.0.1:5173";
const printBasins = [
  ...BASIN_PRODUCTS.filter(p => ["KF001", "KF002"].includes(p.sku)),
  // The offline catalogue excludes tall models; use the public KF019 record
  // captured for this test. This is fixture data, never a catalogue update.
  { sku: "KF019", colorCode: "VD345", colorName: "Dusk", priceTHB: 24000,
    category: "tall vertical washbasin", categoryLabel: "ทรงสูง",
    dimensions: "400 × 400 × 850 mm", basinDimensions: "350 × 350 × 150 mm", imageTone: "#717779" },
];
const basins = printBasins
  .map((p, i) => ({ ...p, id: i + 1, active: true, sortOrder: i, imageUrl: null }));
const stones = STONE_COLORS.filter(p => ["BW010", "MU010", "EG501"].includes(p.code));
const catalogue = {
  basins,
  categories: [...new Set(basins.map(p => p.category))].map((name, i) => ({ id: i + 1, name, active: true, sortOrder: i })),
  installedStones: stones.map((p, i) => ({ id: i + 1, code: p.code, name: p.name, tone: p.tone, pricePerSqmTHB: p.installedPriceTHB, active: true, sortOrder: i })),
  sheetStones: stones.map((p, i) => ({ id: i + 1, code: p.code, name: p.name, tone: p.tone, basePriceTHB: p.sheetPriceTHB, price10PlusTHB: p.sheetPriceTHB, price50PlusTHB: p.sheetPriceTHB, active: true, sortOrder: i })),
};
let savedLead: Record<string, unknown> | null = null;
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://fixture");
    const json = (status: number, data: unknown) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(data)); };
    if (url.pathname === "/api/catalog") return json(200, catalogue);
    if (url.pathname === "/api/leads" && req.method === "POST") {
      let body = ""; for await (const chunk of req) body += chunk;
      const input = JSON.parse(body);
      const lead = { ...input, id: 1, quoteNumber: "QT-A4-FIXTURE", publicQuoteToken: "a4-test-fixture-not-a-real-token",
        createdAt: "2026-10-13T00:00:00.000Z", updatedAt: "2026-10-13T00:00:00.000Z" };
      if (input.status === "quote_requested") {
        // This is a PRINT fixture, not acceptance of quote editing or server pricing.
        // Always return the six-row mixed catalogue document the original print case
        // asserts, irrespective of which stone selection the editor persisted.
        const items = [...basins.map(p => ({ code: p.sku, description: `${p.colorName} · fixture อ่าง · ${p.dimensions}`,
          quantity: 1, unit: "ชุด", unitPrice: p.priceTHB, total: p.priceTHB, notificationKind: "basin",
          dimensions: p.dimensions, cutoutDimensions: p.basinDimensions })),
          ...stones.map(p => ({ code: p.code, description: `${p.name} · fixture แผ่นหิน`, quantity: 1,
            unit: "แผ่น", unitPrice: p.sheetPriceTHB, total: p.sheetPriceTHB, notificationKind: "stone" }))];
        const grossSubtotal = items.reduce((sum, item) => sum + item.total, 0);
        const discountAmount = input.studioData.discountAmount;
        const subtotal = grossSubtotal - discountAmount;
        const vatAmount = input.studioData.vat ? Math.round(subtotal * 0.07 * 100) / 100 : 0;
        lead.studioData = { ...input.studioData, items, grossSubtotal, discountAmount, subtotal, vatAmount, total: subtotal + vatAmount };
        savedLead = lead;
        console.log(`A4 fixture document: ${items.length} rows (${items.map(item => item.code).join(", ")})`);
      }
      return json(200, lead);
    }
    if (url.pathname === "/api/quotes") {
      console.log(`A4 fixture GET: ${savedLead ? "saved test document" : "not saved"}`);
      return savedLead ? json(200, savedLead) : json(404, { error: "No fixture quote" });
    }
    if (url.pathname === "/api/auth/line/status") return json(200, { authenticated: false, configured: false });
    if (url.pathname === "/api/customer/profile") return json(401, { error: "Guest fixture" });
    if (url.pathname === "/api/public/site-settings") return json(200, {});
    if (url.pathname === "/api/installation-showcase") return json(200, []);
    if (url.pathname.startsWith("/api/")) return json(404, { error: `Unmocked API: ${url.pathname}` });
    const upstream = await fetch(preview + (req.url ?? "/"));
    res.writeHead(upstream.status, { "content-type": upstream.headers.get("content-type") ?? "text/html" });
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    res.writeHead(500, { "content-type": "text/plain" }); res.end(String(error));
  }
});
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw Error("Fixture API failed to start");
process.env["BROWSER_TEST_BASE_URL"] = `http://127.0.0.1:${address.port}`;
after(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
});
console.log("A4 fixture: local catalogue + in-memory leads/quotes; no production API requests.");
await import("./quote-print.browser.test.ts");

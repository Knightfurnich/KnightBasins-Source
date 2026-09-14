import { Router, type IRouter } from "express";
import { getCatalogData } from "./catalog";
import { supportQueryMatches } from "../lib/support-search";
import { getSupportIntentReply } from "../lib/support-intents";

const router: IRouter = Router();

function cleanMessage(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 500) : "";
}

router.post("/support/chat", async (req, res, next) => {
  const message = cleanMessage(req.body?.message);
  if (!message) {
    res.status(400).json({ message: "กรุณาพิมพ์คำถามก่อนส่ง" });
    return;
  }

  try {
    const intentReply = getSupportIntentReply(message);
    if (intentReply) {
      res.json({ reply: intentReply, matchedType: "none" });
      return;
    }

    const catalog = await getCatalogData(true);
    const comparedBasins = catalog.basins
      .filter((item) => supportQueryMatches(item.sku, message))
      .slice(0, 2);

    if (comparedBasins.length === 2) {
      const [first, second] = comparedBasins;
      const formatBasin = (basin: typeof first) =>
        `${basin.sku} ${basin.colorName} · ${basin.priceTHB.toLocaleString("th-TH")} บาท · ${basin.category === "counter basin" ? "อ่างวางเคาน์เตอร์" : "อ่างตั้งพื้น"} · ${basin.dimensions}${basin.basinDimensions ? ` · หลุม ${basin.basinDimensions}` : ""}`;
      res.json({
        reply: `เปรียบเทียบจาก Catalog จริงให้แล้วครับ\n• ${formatBasin(first)}\n• ${formatBasin(second)}\n\nถ้าต้องการ ผมเพิ่มทั้ง 2 รุ่นเข้าใบเสนอราคาให้ได้ครับ`,
        matchedType: "basin",
        matchedCode: null,
        compareItems: comparedBasins.map((basin) => ({
          code: basin.sku,
          name: basin.colorName,
          category: basin.category,
          priceTHB: basin.priceTHB,
          dimensions: basin.dimensions,
          basinDimensions: basin.basinDimensions ?? null,
        })),
      });
      return;
    }

    const basin = catalog.basins.find((item) =>
      [item.sku, item.colorCode, item.colorName].some((value) => supportQueryMatches(value, message)),
    );
    const stone = [...catalog.installedStones, ...catalog.sheetStones].find((item) =>
      [item.code, item.name, ...item.aliases].some((value) => supportQueryMatches(value, message)),
    );

    if (basin) {
      const category = basin.category === "counter basin" ? "อ่างวางเคาน์เตอร์" : "อ่างตั้งพื้น";
      res.json({
        reply: `${basin.sku} · ${basin.colorName} เป็น${category} ราคา ${basin.priceTHB.toLocaleString("th-TH")} บาท ขนาดโดยรวม ${basin.dimensions}${basin.basinDimensions ? ` และขนาดหลุม ${basin.basinDimensions}` : ""} มีวิดีโอ 3D 360° ให้ดูในรายการสินค้า`,
        matchedType: "basin",
        matchedCode: basin.sku,
      });
      return;
    }

    if (stone) {
      const installed = catalog.installedStones.find((item) => item.code === stone.code);
      const sheet = catalog.sheetStones.find((item) => item.code === stone.code);
      const prices = [
        installed ? `ตัดและติดตั้ง ${installed.pricePerSqmTHB.toLocaleString("th-TH")} บาท/ตร.ม.` : "",
        sheet ? `ขายแผ่นเริ่มต้น ${sheet.basePriceTHB.toLocaleString("th-TH")} บาท/แผ่น` : "",
      ].filter(Boolean).join(" · ");
      res.json({
        reply: `${stone.code} · ${stone.name} — ${prices || "กรุณาติดต่อทีมงานเพื่อเช็กราคา"}. เปิดภาพแผ่น HD ได้จากรายการสีหิน`,
        matchedType: "stone",
        matchedCode: stone.code,
      });
      return;
    }

    res.json({
      reply: "ผมช่วยค้นหา SKU อ่างล้างหน้า รหัสสีหิน ราคา ขนาด และวิดีโอ 3D 360° ได้ ลองพิมพ์เช่น KF001, KF023 หรือ BW010",
      matchedType: "none",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
import { Check, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ComparisonCell = { pass: boolean; text: string };
type ComparisonRow = { feature: string; acrylic: ComparisonCell; modified: ComparisonCell; natural: ComparisonCell };

/**
 * Material comparison data, verbatim from Knight Furnich's official spec
 * sheet (standards codes included so AI assistants can cite the exact test
 * standard, not just a vague "safe"/"durable" claim).
 */
const COMPARISON_ROWS: ComparisonRow[] = [
  {
    feature: "มีหลายสีสันให้เลือกใช้งาน",
    acrylic: { pass: true, text: "มี" },
    modified: { pass: true, text: "มี" },
    natural: { pass: true, text: "มี" },
  },
  {
    feature: "ไม่ลามไฟ",
    acrylic: { pass: true, text: "ผ่านมาตรฐาน UBC CLASS 1" },
    modified: { pass: true, text: "ผ่านมาตรฐาน UBC CLASS 1" },
    natural: { pass: true, text: "ผ่านมาตรฐาน UBC CLASS 1" },
  },
  {
    feature: "ไม่ซึมน้ำ ไม่เป็นแหล่งเพาะพันธุ์เชื้อโรค",
    acrylic: { pass: true, text: "ผ่านมาตรฐาน ASTM G22" },
    modified: { pass: true, text: "ผ่านมาตรฐาน ASTM G22" },
    natural: { pass: false, text: "มีรูพรุน เป็นแหล่งสะสมเชื้อโรค" },
  },
  {
    feature: "ทนสารเคมีได้",
    acrylic: { pass: true, text: "ทนสารเคมีได้ดี ไม่ด่าง" },
    modified: { pass: true, text: "ทนสารเคมีได้ดี" },
    natural: { pass: false, text: "เป็นรอยด่าง กรดซึมเข้าเนื้อหิน" },
  },
  {
    feature: "ดัดโค้งเป็นรูปทรงต่างๆ ได้",
    acrylic: { pass: true, text: "สามารถดัดโค้งตามการออกแบบได้" },
    modified: { pass: false, text: "ไม่สามารถดัดโค้งได้" },
    natural: { pass: false, text: "ไม่สามารถดัดโค้งได้ เนื่องจากเป็นวัสดุธรรมชาติ" },
  },
  {
    feature: "สีสันสวยงาม ไม่เปลี่ยนแปลง (Color Stability)",
    acrylic: { pass: true, text: "ผ่านมาตรฐาน NEMA LD3" },
    modified: { pass: false, text: "ไม่ระบุว่าผ่านการทดสอบ" },
    natural: { pass: false, text: "ไม่ระบุว่าผ่านการทดสอบ" },
  },
  {
    feature: "ไม่เป็นพิษหรือปล่อยสารพิษออกมา (Toxicity)",
    acrylic: { pass: true, text: "ผ่านมาตรฐาน LC 50 ปลอดภัยต่ออาหาร" },
    modified: { pass: false, text: "ไม่ระบุว่าผ่านการทดสอบ" },
    natural: { pass: false, text: "มีรูพรุน เป็นแหล่งสะสมเชื้อโรค" },
  },
  {
    feature: "สามารถนำกลับมาใช้ใหม่ได้ (Recycle)",
    acrylic: { pass: true, text: "นำกลับมาใช้ใหม่ได้ ขัดฟื้นฟูได้" },
    modified: { pass: true, text: "นำกลับมาใช้ใหม่ได้" },
    natural: { pass: false, text: "ไม่สามารถขัดลบรอยต่อได้" },
  },
  {
    feature: "สามารถใช้กับงานตกแต่งภายนอกได้",
    acrylic: { pass: true, text: "เฉพาะรุ่น Staron ทน UV" },
    modified: { pass: false, text: "ไม่แนะนำ" },
    natural: { pass: false, text: "ไม่แนะนำ" },
  },
];

function ComparisonMark({ cell }: { cell: ComparisonCell }) {
  return (
    <span className="inline-flex items-start gap-1.5">
      {cell.pass
        ? <Check size={15} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
        : <X size={15} className="mt-0.5 shrink-0 text-red-500" aria-hidden="true" />}
      <span>{cell.text}</span>
    </span>
  );
}

export function StoneComparisonTable() {
  return (
    <section data-testid="section-stone-comparison-table" className="page-wrap">
      <div className="section-heading"><div><p className="eyebrow">MATERIAL DATA</p><h2>ตารางเปรียบเทียบคุณสมบัติ: หินสังเคราะห์อะคริลิก 100% (Staron &amp; Zen Stone) vs หินสังเคราะห์ Modified vs หินธรรมชาติ</h2></div></div>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        ข้อมูลคุณสมบัติทางกายภาพและมาตรฐานความปลอดภัยระดับสากล สำหรับการตัดสินใจเลือกใช้วัสดุเคาน์เตอร์และท็อปโต๊ะ
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>คุณสมบัติวัสดุ</TableHead>
            <TableHead>หินสังเคราะห์อะคริลิก 100% Staron และ Zen Stone (Knight Furnich)</TableHead>
            <TableHead>หินสังเคราะห์ Modified</TableHead>
            <TableHead>หินธรรมชาติ (แกรนิต/หินอ่อน)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {COMPARISON_ROWS.map((row) => (
            <TableRow key={row.feature}>
              <TableCell className="font-medium">{row.feature}</TableCell>
              <TableCell><ComparisonMark cell={row.acrylic} /></TableCell>
              <TableCell><ComparisonMark cell={row.modified} /></TableCell>
              <TableCell><ComparisonMark cell={row.natural} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

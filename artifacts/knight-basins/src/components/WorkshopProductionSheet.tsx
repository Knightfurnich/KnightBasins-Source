import type { CustomerDetails } from "@/data/catalog";
import { formatThaiDate } from "@/data/date-time";
import { quoteQrImageUrl } from "@/data/quote-utils";
import knightFurnichLogo from "/knight-furnich-logo.png";
import { CheckSquare, QrCode } from "lucide-react";

export type ProductionItem = {
  code: string;
  description: string;
  quantity: number;
  unit: string;
  workQuantity?: number | null;
  workUnit?: string;
  areaSqM?: number | null;
  dimensions?: string;
  cutoutDimensions?: string;
  videoUrl?: string;
  notificationKind?: "basin" | "stone" | "service";
};

const COMPANY_DETAILS = {
  name: "บริษัท ไนท์ เฟอร์นิช จำกัด (ฝ่ายผลิต / โรงงาน)",
  taxId: "0135553014114",
  address: "224/26 ถนนติวานนท์ ตำบลบางพูด อำเภอปากเกร็ด จังหวัดนนทบุรี 11120",
  phones: "02-583-0599, 080-606-4444",
};

function safeFormatThaiDate(date: unknown) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(String(date));
  if (Number.isNaN(d.getTime())) return "";
  return formatThaiDate(d);
}

export function WorkshopProductionSheet({
  quoteNumber,
  issueDate,
  customer,
  items,
  sitePhotos = [],
}: {
  quoteNumber: string;
  issueDate: Date;
  customer: CustomerDetails;
  items: ProductionItem[];
  sitePhotos?: string[];
}) {
  return (
    <section className="workshop-production-sheet" data-testid="workshop-production-sheet">
      <header className="workshop-sheet-header">
        <div className="workshop-document-label">
          <strong>ใบสั่งผลิตสำหรับฝ่ายผลิต / ช่าง</strong>
          <span>(Workshop Production Order)</span>
          <small>Knight Furnich Factory Specification</small>
        </div>
        <div className="workshop-company">
          <div>
            <h2>{COMPANY_DETAILS.name}</h2>
            <p>{COMPANY_DETAILS.address}</p>
            <p>เบอร์ติดต่อโรงงาน: {COMPANY_DETAILS.phones}</p>
          </div>
          <img src={knightFurnichLogo} alt="Knight Furnich" className="workshop-company-logo" />
        </div>
        <div className="workshop-quote-meta">
          <p className="eyebrow">เอกสารสั่งผลิต / โรงงาน</p>
          <strong>{quoteNumber}</strong>
          <span>วันที่สั่งงาน: {safeFormatThaiDate(issueDate)}</span>
          {customer.expectedInstallationDate && (
            <span className="install-deadline">
              กำหนดส่ง/ติดตั้ง: <b>{safeFormatThaiDate(customer.expectedInstallationDate)}</b>
            </span>
          )}
        </div>
      </header>

      <div className="workshop-site-grid">
        <div>
          <span>โครงการ / หน่วยงาน</span>
          <strong>{customer.project || "—"}</strong>
        </div>
        <div>
          <span>สถานที่ติดตั้ง (SITE)</span>
          <strong className="text-accent">{customer.site || "—"}</strong>
        </div>
        <div>
          <span>ผู้ติดต่อหน้างาน / ลูกค้า</span>
          <strong>{customer.name || customer.company || "—"}</strong>
        </div>
        <div>
          <span>โทรศัพท์ติดต่อ</span>
          <strong>{customer.phone || "—"}</strong>
        </div>
        <div className="workshop-site-wide">
          <span>ที่อยู่จัดส่ง / ติดตั้ง</span>
          <strong>{customer.address || "—"}</strong>
        </div>
        {customer.notes && (
          <div className="workshop-site-wide workshop-special-notes">
            <span>⚠️ หมายเหตุพิเศษสำหรับช่าง / ฝ่ายผลิต</span>
            <strong>{customer.notes}</strong>
          </div>
        )}
      </div>

      <div className="workshop-table-wrap">
        <table className="workshop-table" data-testid="table-workshop-production">
          <thead>
            <tr>
              <th className="col-idx">ลำดับ</th>
              <th className="col-code">รหัสสินค้า / สี</th>
              <th className="col-desc">รายละเอียดงานและสเปกการผลิต</th>
              <th className="col-qty">จำนวนงาน</th>
              <th className="col-qr"><QrCode size={14} /> 3D สเปก</th>
              <th className="col-check">ตรวจขนาด</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const detailLines = (item.description || "").split(" · ").filter(Boolean);
              return (
                <tr key={`${item.code}-${index}`}>
                  <td className="col-idx">{index + 1}</td>
                  <td className="col-code">
                    <strong className="workshop-code">{item.code}</strong>
                  </td>
                  <td className="col-desc">
                    <div className="workshop-item-details">
                      <strong>{detailLines[0] || item.description}</strong>
                      {detailLines.slice(1).map((line, idx) => (
                        <span key={idx} className="workshop-sub-detail">
                          • {line}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="col-qty">
                    <strong>
                      {item.workQuantity ?? item.quantity} {item.workUnit || item.unit}
                    </strong>
                    {item.areaSqM ? <small>({item.areaSqM.toFixed(2)} ตร.ม.)</small> : null}
                  </td>
                  <td className="col-qr">
                    {item.videoUrl && (
                      <div className="workshop-qr-cell">
                        <img src={quoteQrImageUrl(item.videoUrl)} alt={`QR ${item.code}`} />
                        <small>สแกนดู 3D</small>
                      </div>
                    )}
                  </td>
                  <td className="col-check">
                    <div className="workshop-row-checkbox">
                      <span className="box" />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sitePhotos.length > 0 && (
        <div className="workshop-photos-section">
          <h3>ภาพถ่ายหน้างานจริง / แปลนประกอบการผลิต</h3>
          <div className="workshop-photos-grid">
            {sitePhotos.map((url, idx) => (
              <div key={idx} className="workshop-photo-card">
                <img src={url} alt={`ภาพหน้างาน ${idx + 1}`} />
                <span>ภาพที่ {idx + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="workshop-bottom">
        <div className="workshop-checklist">
          <h3>
            <CheckSquare size={16} /> รายการตรวจสอบคุณภาพงานผลิต (QC Checklist)
          </h3>
          <div className="workshop-check-items">
            <label>
              <span className="box" /> ตรวจสอบรหัสสีและลายหินสังเคราะห์ตามเอกสารสั่งผลิต
            </label>
            <label>
              <span className="box" /> ตรวจวัดขนาดแผ่นตัด กว้าง × ยาว และเผื่อระยะตัดตามแบบ
            </label>
            <label>
              <span className="box" /> ตรวจสอบรุ่นอ่าง ขนาดตัวอ่าง และขนาดหลุมเจาะตรงสเปก
            </label>
            <label>
              <span className="box" /> ตรวจสอบงานลบมุม ลบเหลี่ยม ขอบเปิด และบัวกันน้ำ
            </label>
            <label>
              <span className="box" /> ตรวจสอบสภาพผิวหน้าหิน ไร้รอยขีดข่วน ทำความสะอาดก่อนแพ็ค
            </label>
          </div>
        </div>

        <div className="workshop-signatures">
          <div className="sig-box">
            <span>ผู้สั่งผลิต (ฝ่ายขาย)</span>
            <div className="sig-line" />
            <small>วันที่: _____ / _____ / ________</small>
          </div>
          <div className="sig-box">
            <span>ช่างผู้ผลิต (โรงงาน)</span>
            <div className="sig-line" />
            <small>วันที่: _____ / _____ / ________</small>
          </div>
          <div className="sig-box">
            <span>ผู้ตรวจสอบคุณภาพ (QC)</span>
            <div className="sig-line" />
            <small>วันที่: _____ / _____ / ________</small>
          </div>
        </div>
      </div>
    </section>
  );
}

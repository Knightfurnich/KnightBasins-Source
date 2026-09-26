import { useQuery } from "@tanstack/react-query";
import { BarChart3, Clock3, Coins, Database, RefreshCw, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { useState, type ReactNode } from "react";

type AiCostPeriod = "today" | "7d" | "30d" | "all";

type AiCostService = {
  id: string;
  name: string;
  requests: number;
  tokens: number;
  costThb: number;
  status: "active" | "no-data";
};

type AiCostModel = {
  model: string;
  requests: number;
  costThb: number;
};

type AiCostCenterResponse = {
  period: string;
  updatedAt: string;
  totalCostThb: number;
  totalRequests: number;
  totalTokens: number;
  services: AiCostService[];
  modelBreakdown: AiCostModel[];
};

const periods: Array<{ value: AiCostPeriod; label: string; helper: string }> = [
  { value: "today", label: "วันนี้", helper: "ตั้งแต่ 00:00 น." },
  { value: "7d", label: "7 วัน", helper: "ย้อนหลัง 7 วัน" },
  { value: "30d", label: "30 วัน", helper: "ย้อนหลัง 30 วัน" },
  { value: "all", label: "ทั้งหมด", helper: "ตั้งแต่เริ่มบันทึก" },
];

const countFormatter = new Intl.NumberFormat("th-TH");
const thbFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const decimalFormatter = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function useAiCostCenter(period: AiCostPeriod) {
  return useQuery<AiCostCenterResponse>({
    queryKey: ["/api/admin/ai-cost-center", period],
    queryFn: () =>
      customFetch<AiCostCenterResponse>(
        `/api/admin/ai-cost-center?period=${encodeURIComponent(period)}`,
        {
          method: "GET",
          credentials: "include",
          responseType: "json",
        },
      ),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });
}

function formatThb(value: number) {
  return thbFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatCount(value: number) {
  return countFormatter.format(Number.isFinite(value) ? Math.max(0, value) : 0);
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "เวลาอัปเดตไม่พร้อมใช้งาน";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`ai-cost-panel ${className}`}>{children}</section>;
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  accent,
  testId,
}: {
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  accent: "gold" | "blue" | "teal" | "rose";
  testId: string;
}) {
  return (
    <article className={`ai-cost-metric ai-cost-metric--${accent}`} data-testid={testId}>
      <div className="ai-cost-metric__topline">
        <span className="ai-cost-metric__icon" aria-hidden="true">
          <Icon size={17} strokeWidth={1.8} />
        </span>
        <span className="ai-cost-metric__label">{title}</span>
      </div>
      <strong className="ai-cost-metric__value" data-testid={`${testId}-value`}>
        {value}
      </strong>
      <span className="ai-cost-metric__detail">{detail}</span>
    </article>
  );
}

function AiCostSkeleton() {
  return (
    <div className="ai-cost-skeleton" data-testid="ai-cost-loading" aria-label="กำลังโหลดสรุปต้นทุน AI">
      <div className="ai-cost-skeleton__headline" />
      <div className="ai-cost-skeleton__metrics">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="ai-cost-skeleton__metric" key={index} />
        ))}
      </div>
      <div className="ai-cost-skeleton__body" />
      <div className="ai-cost-skeleton__body ai-cost-skeleton__body--short" />
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Panel className="ai-cost-state ai-cost-state--error" >
      <span className="ai-cost-state__mark" aria-hidden="true">
        <TriangleAlert size={22} />
      </span>
      <p className="ai-cost-kicker">DATA CONNECTION</p>
      <h2>ยังโหลดสรุปต้นทุนไม่ได้</h2>
      <p>ระบบไม่สามารถดึงข้อมูลช่วงเวลานี้ได้ กรุณาลองใหม่อีกครั้ง</p>
      <button type="button" className="ai-cost-button ai-cost-button--primary" onClick={onRetry} data-testid="button-ai-cost-retry">
        <RefreshCw size={15} aria-hidden="true" />
        ลองใหม่
      </button>
    </Panel>
  );
}

function EmptyTable({ message }: { message: string }) {
  return <p className="ai-cost-table__empty">{message}</p>;
}

function ServiceStatus({ status }: { status: AiCostService["status"] }) {
  const active = status === "active";
  return (
    <span className={`ai-cost-status ${active ? "ai-cost-status--active" : "ai-cost-status--empty"}`}>
      <span className="ai-cost-status__dot" aria-hidden="true" />
      {active ? "ทำงานอยู่" : "ไม่มีข้อมูล"}
    </span>
  );
}

export default function AiCostCenterPage() {
  const [period, setPeriod] = useState<AiCostPeriod>("30d");
  const { data, isError, isFetching, isLoading, refetch } = useAiCostCenter(period);
  const selectedPeriod = periods.find((item) => item.value === period) ?? periods[2];
  const averageSatang = data && data.totalRequests > 0
    ? (data.totalCostThb * 100) / data.totalRequests
    : 0;

  return (
    <div className="ai-cost-page" data-testid="ai-cost-page">
      <header className="ai-cost-hero">
        <div className="ai-cost-hero__copy">
          <div className="ai-cost-hero__eyebrow">
            <span className="ai-cost-signal" aria-hidden="true" />
            KNIGHT ADMIN / BUSINESS SYSTEMS
          </div>
          <h1>ต้นทุน AI</h1>
          <p className="ai-cost-hero__lede">
            ภาพรวมการใช้งาน AI รวมทั้งบริษัท เพื่อช่วยตัดสินใจเรื่องงบประมาณได้อย่างมั่นใจ
          </p>
          <div className="ai-cost-hero__assurance">
            <ShieldCheck size={15} aria-hidden="true" />
            <span>แสดงเฉพาะยอดรวม · ไม่เปิดเผยข้อมูลลูกค้าหรือข้อมูลรับรองผู้ให้บริการ</span>
          </div>
        </div>
        <div className="ai-cost-hero__aside">
          <div className="ai-cost-hero__aside-mark" aria-hidden="true">
            <BarChart3 size={24} strokeWidth={1.5} />
          </div>
          <div>
            <span className="ai-cost-hero__aside-label">CONTROLLED SPEND VIEW</span>
            <strong>รวมทุกบริการในจุดเดียว</strong>
          </div>
        </div>
      </header>

      <div className="ai-cost-toolbar">
        <div className="ai-cost-periods" role="tablist" aria-label="ช่วงเวลาสรุปต้นทุน AI">
          {periods.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={period === item.value}
              className={`ai-cost-period ${period === item.value ? "is-active" : ""}`}
              onClick={() => setPeriod(item.value)}
              data-testid={`tab-ai-cost-period-${item.value}`}
            >
              <span>{item.label}</span>
              <small>{item.helper}</small>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="ai-cost-button ai-cost-button--refresh"
          onClick={() => void refetch()}
          disabled={isFetching}
          data-testid="button-ai-cost-refresh"
        >
          <RefreshCw size={15} className={isFetching ? "ai-cost-spin" : ""} aria-hidden="true" />
          {isFetching ? "กำลังอัปเดต" : "รีเฟรช"}
        </button>
      </div>

      {isLoading ? (
        <AiCostSkeleton />
      ) : isError || !data ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <>
          <div className="ai-cost-context-line">
            <span className="ai-cost-context-line__period">
              <Clock3 size={14} aria-hidden="true" />
              ช่วงข้อมูล: <strong>{selectedPeriod.label}</strong>
            </span>
            <span className="ai-cost-context-line__updated">
              {isFetching ? "กำลังตรวจสอบข้อมูลล่าสุด…" : `อัปเดตล่าสุด ${formatUpdatedAt(data.updatedAt)}`}
            </span>
          </div>

          <section className="ai-cost-metrics" aria-label="ตัวชี้วัดต้นทุน AI">
            <MetricCard
              title="ต้นทุนรวม (บาท)"
              value={formatThb(data.totalCostThb)}
              detail="รวมทุกบริการ AI"
              icon={Coins}
              accent="gold"
              testId="card-ai-cost-total"
            />
            <MetricCard
              title="จำนวนคำขอทั้งหมด"
              value={formatCount(data.totalRequests)}
              detail="คำขอที่บันทึกในช่วงนี้"
              icon={Sparkles}
              accent="blue"
              testId="card-ai-cost-requests"
            />
            <MetricCard
              title="โทเค็นรวม"
              value={formatCount(data.totalTokens)}
              detail="อินพุตและเอาต์พุตรวม"
              icon={Database}
              accent="teal"
              testId="card-ai-cost-tokens"
            />
            <MetricCard
              title="ต้นทุนเฉลี่ยต่อคำขอ"
              value={`${decimalFormatter.format(averageSatang)} สตางค์`}
              detail="คำนวณจากคำขอทั้งหมด"
              icon={BarChart3}
              accent="rose"
              testId="card-ai-cost-average"
            />
          </section>

          <div className="ai-cost-grid">
            <Panel className="ai-cost-table-panel">
              <div className="ai-cost-panel-heading">
                <div>
                  <p className="ai-cost-kicker">SERVICE LEDGER</p>
                  <h2>สรุปแยกตามบริการ</h2>
                  <p>เห็นภาพรวมการใช้งานของแต่ละระบบ โดยไม่แสดงรายละเอียดที่ระบุตัวตนได้</p>
                </div>
                <span className="ai-cost-panel-index">01</span>
              </div>
              <div className="ai-cost-table-wrap">
                <table className="ai-cost-table" data-testid="table-ai-cost-services">
                  <thead>
                    <tr>
                      <th scope="col">บริการ</th>
                      <th scope="col" className="is-number">จำนวนคำขอ</th>
                      <th scope="col" className="is-number">โทเค็น</th>
                      <th scope="col" className="is-number">ต้นทุน (บาท)</th>
                      <th scope="col">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.services.length > 0 ? data.services.map((service) => (
                      <tr key={service.id}>
                        <th scope="row">
                          <span className="ai-cost-service-name">{service.name}</span>
                        </th>
                        <td className="is-number">{formatCount(service.requests)}</td>
                        <td className="is-number">{formatCount(service.tokens)}</td>
                        <td className="is-number ai-cost-money">{formatThb(service.costThb)}</td>
                        <td><ServiceStatus status={service.status} /></td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5}><EmptyTable message="ยังไม่มีข้อมูลบริการในช่วงเวลานี้" /></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel className="ai-cost-table-panel ai-cost-model-panel">
              <div className="ai-cost-panel-heading">
                <div>
                  <p className="ai-cost-kicker">MODEL MIX</p>
                  <h2>แยกตามโมเดล</h2>
                  <p>สัดส่วนคำขอและต้นทุนจากโมเดลที่มีการบันทึก</p>
                </div>
                <span className="ai-cost-panel-index">02</span>
              </div>
              <div className="ai-cost-table-wrap">
                <table className="ai-cost-table" data-testid="table-ai-cost-models">
                  <thead>
                    <tr>
                      <th scope="col">โมเดล</th>
                      <th scope="col" className="is-number">จำนวนคำขอ</th>
                      <th scope="col" className="is-number">ต้นทุน (บาท)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.modelBreakdown.length > 0 ? data.modelBreakdown.map((item) => (
                      <tr key={item.model}>
                        <th scope="row"><span className="ai-cost-model-name">{item.model}</span></th>
                        <td className="is-number">{formatCount(item.requests)}</td>
                        <td className="is-number ai-cost-money">{formatThb(item.costThb)}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={3}><EmptyTable message="ยังไม่มีข้อมูลโมเดลในช่วงเวลานี้" /></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
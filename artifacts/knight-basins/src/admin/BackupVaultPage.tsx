import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpRight,
  Bath,
  CheckCircle2,
  Database,
  ImagePlus,
  Loader2,
  ShieldCheck,
  Users,
} from "lucide-react";

type UnknownRecord = Record<string, unknown>;

type DatabaseStatus = "checking" | "connected" | "disconnected" | "unknown";
type SitePhotoStatus = "checking" | "loaded" | "error";

type BackupInfo = { latest: string; bytes: number; count: number };

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

export function BackupVaultPage() {
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus>("checking");
  const [sitePhotoStatus, setSitePhotoStatus] = useState<SitePhotoStatus>("checking");
  const [sitePhotoCount, setSitePhotoCount] = useState(0);
  const [backupInfo, setBackupInfo] = useState<BackupInfo | null>(null);

  useEffect(() => {
    let active = true;

    const loadBackupInfo = async () => {
      try {
        const response = await fetch("/api/admin/backup/database-dump?list=1", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = asRecord(await response.json() as unknown);
        const latest = typeof payload.latest === "string" ? payload.latest : null;
        if (!latest) return;

        const dumps = Array.isArray(payload.dumps) ? payload.dumps : [];
        const newest = dumps
          .map(asRecord)
          .find((dump) => dump.name === latest);

        if (!active) return;
        setBackupInfo({
          latest,
          bytes: typeof newest?.bytes === "number" ? newest.bytes : 0,
          count: typeof payload.count === "number" ? payload.count : dumps.length,
        });
      } catch {
        // The newest-dump caption is a convenience; a failure here must not make
        // the whole database card look broken, so we simply omit it.
      }
    };

    void loadBackupInfo();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const checkDatabase = async () => {
      try {
        const response = await fetch("/api/healthz", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        const payload: unknown = await response.json();
        const database = asRecord(asRecord(payload).database);

        if (!active) return;
        setDatabaseStatus(
          database.connected === true
            ? "connected"
            : database.connected === false
              ? "disconnected"
              : "unknown",
        );
      } catch {
        if (active) setDatabaseStatus("unknown");
      }
    };

    void checkDatabase();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadSitePhotoCount = async () => {
      try {
        const response = await fetch("/api/admin/site-photos", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Could not load site photos");
        const payload: unknown = await response.json();
        if (!Array.isArray(payload)) throw new Error("Unexpected site photo response");

        if (active) {
          setSitePhotoCount(payload.length);
          setSitePhotoStatus("loaded");
        }
      } catch {
        if (active) setSitePhotoStatus("error");
      }
    };

    void loadSitePhotoCount();
    return () => {
      active = false;
    };
  }, []);

  const databaseStatusView = {
    checking: {
      label: "กำลังตรวจสอบ",
      description: "กำลังตรวจสอบการเชื่อมต่อฐานข้อมูล",
      className: "text-[var(--ink-soft)]",
      icon: <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />,
    },
    connected: {
      label: "เชื่อมต่อปกติ",
      description: "ฐานข้อมูลตอบสนองตามปกติ",
      className: "text-emerald-700",
      icon: <CheckCircle2 className="h-5 w-5" aria-hidden="true" />,
    },
    disconnected: {
      label: "ไม่สามารถเชื่อมต่อได้",
      description: "ควรตรวจสอบระบบฐานข้อมูลและข้อมูลสำรองล่าสุด",
      className: "text-red-700",
      icon: <AlertTriangle className="h-5 w-5" aria-hidden="true" />,
    },
    unknown: {
      label: "ตรวจสอบสถานะไม่ได้",
      description: "ลองตรวจสอบอีกครั้ง หรือติดต่อผู้ดูแลระบบ",
      className: "text-amber-800",
      icon: <AlertTriangle className="h-5 w-5" aria-hidden="true" />,
    },
  }[databaseStatus];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8" data-testid="admin-backup-vault">
      <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--ink-soft)]">ADMIN / DATA SAFETY</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink)]">สำรองข้อมูล</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-soft)]">
            ดาวน์โหลดข้อมูลสำคัญ ตรวจดูภาพหน้างาน และตรวจสอบสถานะฐานข้อมูลจากจุดเดียว
          </p>
        </div>
        <div
          className="inline-flex w-fit items-center gap-2 border border-[var(--line)] bg-[var(--card-paper)] px-3 py-2 text-xs font-medium text-[var(--ink)]"
          data-testid="backup-access-badge"
        >
          <ShieldCheck className="h-4 w-4 text-[var(--saffron)]" aria-hidden="true" />
          <span>🛡️ เข้าถึงโดย: ผู้ดูแลระบบ (Admin / Owner)</span>
        </div>
      </header>

      <section aria-label="หมวดหมู่การสำรองข้อมูล" className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <article className="flex h-full flex-col border border-[var(--line)] bg-[var(--card-paper)] p-5 shadow-sm" data-testid="backup-card-leads">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-[var(--line)] bg-white text-[var(--ink)]">
              <Users className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-[var(--ink-soft)]">Customer Leads</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">ข้อมูลลูกค้าและคำสั่งซื้อ</h2>
            </div>
          </div>
          <p className="mt-4 flex-1 text-sm leading-6 text-[var(--ink-soft)]">
            ดาวน์โหลดรายชื่อลูกค้า รายละเอียดงาน และข้อมูลคำสั่งซื้อในรูปแบบ CSV ที่เปิดด้วย Excel ได้
          </p>
          <a
            href="/api/admin/backup/leads-export"
            download
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
            data-testid="link-backup-leads-download"
          >
            <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
            ดาวน์โหลด CSV (Excel)
          </a>
        </article>

        <article className="flex h-full flex-col border border-[var(--line)] bg-[var(--card-paper)] p-5 shadow-sm" data-testid="backup-card-photos">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-[var(--line)] bg-white text-[var(--ink)]">
              <ImagePlus className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-[var(--ink-soft)]">SITE PHOTOS</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">ภาพถ่ายหน้างานจริง</h2>
            </div>
          </div>
          <p className="mt-4 flex-1 text-sm leading-6 text-[var(--ink-soft)]">
            {sitePhotoStatus === "checking"
              ? "กำลังนับภาพในคลังหน้างาน"
              : sitePhotoStatus === "error"
                ? "โหลดสถิติภาพไม่สำเร็จ ลองเปิดหน้านี้อีกครั้ง"
                : `มีภาพหน้างาน ${sitePhotoCount.toLocaleString("th-TH")} ภาพ`}
          </p>
          <a
            href="/admin/site-photos"
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
            data-testid="link-backup-site-photos"
          >
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            เปิดคลังภาพหน้างาน
          </a>
        </article>

        <article className="flex h-full flex-col border border-[var(--line)] bg-[var(--card-paper)] p-5 shadow-sm" data-testid="backup-card-basins">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-[var(--line)] bg-white text-[var(--ink)]">
              <Bath className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-[var(--ink-soft)]">BASINS CATALOG</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">แคตตาล็อกอ่าง 30 รุ่นและราคา</h2>
            </div>
          </div>
          <p className="mt-4 flex-1 text-sm leading-6 text-[var(--ink-soft)]">
            สำรองรหัส ชื่อรุ่น และราคาของอ่างล้างหน้าเป็นไฟล์ CSV
          </p>
          <a
            href="/api/admin/backup/basins-export"
            download
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
            data-testid="link-backup-basins-download"
          >
            <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
            ดาวน์โหลดข้อมูลอ่าง CSV
          </a>
        </article>

        <article className="flex h-full flex-col border border-[var(--line)] bg-[var(--card-paper)] p-5 shadow-sm" data-testid="backup-card-database">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-[var(--line)] bg-white text-[var(--ink)]">
              <Database className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-[var(--ink-soft)]">DATABASE STATUS</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">ฐานข้อมูลระบบ</h2>
            </div>
          </div>
          <div className={`mt-4 flex items-center gap-2 text-sm font-semibold ${databaseStatusView.className}`} aria-live="polite">
            {databaseStatusView.icon}
            <span>{databaseStatusView.label}</span>
          </div>
          <p className="mt-2 flex-1 text-sm leading-6 text-[var(--ink-soft)]">
            {databaseStatusView.description}
          </p>
          {backupInfo && (
            <p className="mt-3 text-xs leading-5 text-[var(--ink-soft)]" data-testid="backup-dump-latest">
              ไฟล์สำรองล่าสุด: <span className="font-mono">{backupInfo.latest}</span>
              <br />
              ขนาด {(backupInfo.bytes / 1024).toFixed(0)} KB · เก็บไว้ทั้งหมด {backupInfo.count} ชุด
            </p>
          )}
          <a
            href="/api/admin/backup/database-dump"
            download
            className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
            data-testid="link-backup-database-download"
          >
            <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
            ดาวน์โหลดฐานข้อมูล (.sql.gz)
          </a>
          <div className="mt-5 border-t border-[var(--line)] pt-3 text-xs leading-5 text-[var(--ink-soft)]">
            ไฟล์สำรองสร้างอัตโนมัติทุกคืน และเก็บย้อนหลัง 14 ชุด ล่าสุดกดดาวน์โหลดได้ทันที
            หากระบบขัดข้อง ให้ติดต่อ Owner ก่อนกู้คืนข้อมูล
          </div>
        </article>
      </section>
    </div>
  );
}
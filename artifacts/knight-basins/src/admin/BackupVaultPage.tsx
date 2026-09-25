import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpRight,
  Bath,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
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
  const [showRestoreGuide, setShowRestoreGuide] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2500);
  };

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

      {/* SLA <= 4 Hours Disaster Recovery Hero Card */}
      <section
        className="rounded-none border-2 border-[#a24439] bg-[#a24439]/5 p-6 shadow-sm"
        aria-label="ชุดกู้ชีพฉุกเฉินระดับ SLA"
        data-testid="backup-card-disaster-recovery"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-[#a24439] px-2 py-0.5 text-xs font-bold text-white uppercase tracking-wider">
                Disaster Recovery · SLA ≤ 4 Hours
              </span>
              <span className="text-xs font-semibold text-[#a24439]">
                กู้ชีพฉุกเฉินฟื้นคืนระบบ 100% ภายใน 15 นาที
              </span>
            </div>
            <h2 className="text-xl font-bold text-[var(--ink)]">
              ชุดสำรองกู้ชีพฉุกเฉินทั้งระบบ (Full Disaster Recovery Bundle)
            </h2>
            <p className="max-w-3xl text-sm leading-relaxed text-[var(--ink-soft)]">
              ก้อนเดียวจบ: รวมฐานข้อมูล 18 ตาราง + ไฟล์รูปภาพหน้างานจริง + ภาพ Top View 30 รุ่น + สคริปต์คำสั่งเดียวกู้ชีพทั้งระบบ (<code className="bg-black/5 px-1 py-0.5">disaster_recovery_restore.sh</code>) สามารถชุบชีวิตระบบบนเครื่องเซิร์ฟเวอร์ใหม่ได้ทันทีแม้ศูนย์ข้อมูลหรือดิสก์เดิมพังถาวร
            </p>
          </div>
          <div className="shrink-0 flex flex-col gap-2 items-start lg:items-end">
            <a
              href="/api/admin/backup/disaster-recovery-bundle"
              download
              className="inline-flex min-h-12 items-center justify-center gap-2 border border-[#a24439] bg-[#a24439] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#88362d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a24439]"
              data-testid="link-backup-disaster-recovery-download"
            >
              <ArrowDownToLine className="h-5 w-5" aria-hidden="true" />
              ดาวน์โหลดชุดกู้ชีพฉุกเฉิน (.tar.gz ~46 MB)
            </a>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-[var(--ink-soft)]">
                สร้างอัตโนมัติพร้อมฐานข้อมูลล่าสุด · ปลอดภัยระดับสูงสุด
              </span>
              <button
                type="button"
                onClick={() => setShowRestoreGuide((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#a24439] hover:underline"
                data-testid="button-toggle-restore-guide"
              >
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                {showRestoreGuide ? "ซ่อนขั้นตอนกู้ระบบ ▲" : "📖 ดูขั้นตอนกู้ระบบฉุกเฉิน ▼"}
              </button>
            </div>
          </div>
        </div>

        {/* Collapsible Step-by-Step Recovery Runbook */}
        {showRestoreGuide && (
          <div className="mt-6 border-t border-[#a24439]/20 pt-5 text-sm text-[var(--ink)] space-y-4" data-testid="disaster-recovery-guide-content">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-black/5 pb-2">
              <h3 className="font-bold text-base flex items-center gap-2 text-[#a24439]">
                <span>🛠️</span> 3 ขั้นตอนชุบชีวิตระบบบน VPS เครื่องใหม่ (จบใน 15 นาที)
              </h3>
              <a
                href="https://github.com/Knightfurnich/KnightBasins-Source/blob/main/docs/DISASTER_RECOVERY.md"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ink-soft)] hover:text-[#a24439] underline"
              >
                เปิดคู่มือฉบับเต็มบน GitHub <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded border border-[var(--line)] bg-white p-3.5 space-y-2">
                <div className="font-bold text-xs uppercase tracking-wider text-[#a24439]">ขั้นตอนที่ 1 (~3 นาที)</div>
                <div className="font-semibold text-xs">ติดตั้ง Docker บนเครื่องใหม่</div>
                <div className="relative">
                  <pre className="overflow-x-auto rounded bg-zinc-900 p-2 text-[11px] text-zinc-100 font-mono">
                    curl -fsSL https://get.docker.com | sh
                  </pre>
                  <button
                    type="button"
                    onClick={() => copyToClipboard("curl -fsSL https://get.docker.com | sh", "cmd1")}
                    className="absolute right-1 top-1 p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded"
                    title="คัดลอกคำสั่ง"
                  >
                    {copiedCmd === "cmd1" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>

              <div className="rounded border border-[var(--line)] bg-white p-3.5 space-y-2">
                <div className="font-bold text-xs uppercase tracking-wider text-[#a24439]">ขั้นตอนที่ 2 (~2 นาที)</div>
                <div className="font-semibold text-xs">ดึงโค้ด + นำไฟล์กู้ชีพขึ้นเครื่อง</div>
                <div className="relative">
                  <pre className="overflow-x-auto rounded bg-zinc-900 p-2 text-[11px] text-zinc-100 font-mono">
git clone https://github.com/Knightfurnich/KnightBasins-Source.git /docker/knightbasins
cd /docker/knightbasins
                  </pre>
                  <button
                    type="button"
                    onClick={() => copyToClipboard("git clone https://github.com/Knightfurnich/KnightBasins-Source.git /docker/knightbasins && cd /docker/knightbasins", "cmd2")}
                    className="absolute right-1 top-1 p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded"
                    title="คัดลอกคำสั่ง"
                  >
                    {copiedCmd === "cmd2" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>

              <div className="rounded border border-[var(--line)] bg-white p-3.5 space-y-2">
                <div className="font-bold text-xs uppercase tracking-wider text-[#a24439]">ขั้นตอนที่ 3 (~2 นาที)</div>
                <div className="font-semibold text-xs">สั่งคำสั่งเดียวกู้คืนทั้งระบบ</div>
                <div className="relative">
                  <pre className="overflow-x-auto rounded bg-zinc-900 p-2 text-[11px] text-zinc-100 font-mono">
bash backups/disaster_recovery_restore.sh knight_basins_disaster_recovery_*.tar.gz
                  </pre>
                  <button
                    type="button"
                    onClick={() => copyToClipboard("bash backups/disaster_recovery_restore.sh knight_basins_disaster_recovery_*.tar.gz", "cmd3")}
                    className="absolute right-1 top-1 p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded"
                    title="คัดลอกคำสั่ง"
                  >
                    {copiedCmd === "cmd3" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white/60 p-2.5 rounded border border-[var(--line)] text-xs text-[var(--ink-soft)] flex items-center justify-between">
              <span>🌐 <strong>ขั้นตอนสุดท้าย:</strong> เปลี่ยน A Record ของโดเมนใน Cloudflare/Hostinger ให้ชี้มาที่ IP ของ VPS เครื่องใหม่ ระบบกลับมาออนไลน์ 100% ทันที</span>
            </div>
          </div>
        )}
      </section>

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
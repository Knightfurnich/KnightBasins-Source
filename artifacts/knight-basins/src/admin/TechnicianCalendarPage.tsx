import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  MapPin,
  MapPinned,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type CalendarStatus = "available" | "moderate" | "busy";

export interface CalendarDay {
  date: string;
  dayStatus: CalendarStatus;
  totalJobs: number;
  teams: Array<{
    teamCode: string;
    teamName: string;
    status: CalendarStatus;
    jobCount: number;
    jobs: Array<{
      id: number;
      name: string;
      project: string | null;
      address: string | null;
    }>;
  }>;
}

const TEAM_CODES = ["TP", "PP", "ST", "CM", "KF", "PA", "PM", "TJ", "AM", "CL"] as const;
const WEEKDAYS = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
const FULL_WEEKDAYS = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];
const JOB_TEMPLATES = ["ติดตั้งอ่างล้างหน้า", "ติดตั้งท็อปหิน", "ตรวจวัดหน้างาน"];
const DEMO_ADDRESSES = [
  "เขตวัฒนา, กรุงเทพมหานคร (ข้อมูลตัวอย่าง)",
  "เขตสวนหลวง, กรุงเทพมหานคร (ข้อมูลตัวอย่าง)",
  "อำเภอเมืองนนทบุรี, นนทบุรี (ข้อมูลตัวอย่าง)",
];

const monthFormatter = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  month: "long",
  year: "numeric",
});
const dateFormatter = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const countFormatter = new Intl.NumberFormat("th-TH");

const statusPresentation: Record<
  CalendarStatus,
  { label: string; shortLabel: string; dot: string; badge: string; accent: string; description: string }
> = {
  available: {
    label: "คิวว่าง",
    shortLabel: "ว่าง",
    dot: "bg-[#17816d]",
    badge: "border-[#17816d]/30 bg-[#17816d]/5 text-[#17816d]",
    accent: "border-t-[#17816d]",
    description: "0 งาน",
  },
  moderate: {
    label: "มีงาน",
    shortLabel: "ปานกลาง",
    dot: "bg-[#b78320]",
    badge: "border-[#b78320]/30 bg-[#b78320]/5 text-[#8a6318]",
    accent: "border-t-[#b78320]",
    description: "มีงาน 1–3 งาน",
  },
  busy: {
    label: "คิวเต็ม",
    shortLabel: "เต็ม",
    dot: "bg-[#a24439]",
    badge: "border-[#a24439]/30 bg-[#a24439]/5 text-[#a24439]",
    accent: "border-t-[#a24439]",
    description: "ตั้งแต่ 4 งาน หรือมีทีมคิวแน่น",
  },
};

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createMockMonth(year: number, month: number): CalendarDay[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const dayNumber = index + 1;
    const date = toLocalDateKey(new Date(year, month, dayNumber, 12));
    const totalJobs =
      dayNumber % 13 === 0 ? 4 :
      dayNumber % 9 === 0 ? 3 :
      dayNumber % 5 === 0 ? 2 :
      dayNumber % 3 === 0 ? 1 : 0;
    const jobCounts = TEAM_CODES.map(() => 0);

    if (dayNumber % 13 === 0) {
      jobCounts[dayNumber % TEAM_CODES.length] = totalJobs;
    } else {
      for (let jobIndex = 0; jobIndex < totalJobs; jobIndex += 1) {
        jobCounts[(dayNumber + jobIndex * 3) % TEAM_CODES.length] += 1;
      }
    }

    const teams = TEAM_CODES.map((teamCode, teamIndex) => {
      const jobCount = jobCounts[teamIndex];
      const jobs = Array.from({ length: jobCount }, (_, jobIndex) => {
        const dateDigits = Number(date.replaceAll("-", ""));
        return {
          id: dateDigits * 1000 + teamIndex * 10 + jobIndex,
          name: JOB_TEMPLATES[(dayNumber + teamIndex + jobIndex) % JOB_TEMPLATES.length],
          project: `DEMO-${date.replaceAll("-", "")}-${teamCode}-${jobIndex + 1}`,
          address: DEMO_ADDRESSES[(dayNumber + teamIndex) % DEMO_ADDRESSES.length],
        };
      });

      return {
        teamCode,
        teamName: `ทีมช่าง ${teamCode}`,
        status: jobCount >= 4 ? "busy" as const : jobCount > 0 ? "moderate" as const : "available" as const,
        jobCount,
        jobs,
      };
    });

    const dayStatus: CalendarStatus =
      totalJobs >= 4 || teams.some((team) => team.status === "busy")
        ? "busy"
        : totalJobs > 0
          ? "moderate"
          : "available";

    return { date, dayStatus, totalJobs, teams };
  });
}

function shiftMonth(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);
}

function googleMapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function StatusBadge({ status, compact = false, testId }: { status: CalendarStatus; compact?: boolean; testId?: string }) {
  const presentation = statusPresentation[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 border font-semibold ${compact ? "px-1.5 py-1 text-[9px]" : "px-2 py-1 text-[10px]"} ${presentation.badge}`}
      data-testid={testId}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${presentation.dot}`} aria-hidden="true" />
      <span>{compact ? presentation.shortLabel : presentation.label}</span>
    </span>
  );
}

function JobCard({ job }: { job: CalendarDay["teams"][number]["jobs"][number] }) {
  return (
    <li className="border border-[var(--line)] bg-[var(--paper)] p-3" data-testid={`calendar-job-${job.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <p className="text-xs font-semibold leading-relaxed text-[var(--ink)]">{job.name}</p>
        <span className="border border-[var(--line)] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-[var(--ink-soft)]">
          ตัวอย่าง
        </span>
      </div>
      {job.project && <p className="mt-1 font-mono text-[10px] text-[var(--brand-blue)]">{job.project}</p>}
      <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
        <p className="flex min-w-0 items-start gap-1.5 text-[10px] leading-relaxed text-[var(--ink-soft)]">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{job.address ?? "ยังไม่ได้ระบุที่อยู่"}</span>
        </p>
        {job.address && (
          <a
            href={googleMapsUrl(job.address)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 shrink-0 items-center gap-1.5 border border-[var(--line)] bg-[var(--card-paper)] px-2.5 text-[10px] font-semibold text-[var(--ink)] transition-colors hover:border-[var(--brand-blue)] hover:text-[var(--brand-blue)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]"
            data-testid={`link-calendar-map-${job.id}`}
          >
            <MapPinned className="h-3.5 w-3.5" aria-hidden="true" />
            แผนที่
          </a>
        )}
      </div>
    </li>
  );
}

function TeamQueue({ team }: { team: CalendarDay["teams"][number] }) {
  return (
    <article
      className="grid gap-3 border-b border-[var(--line)] px-3 py-3.5 last:border-b-0 sm:grid-cols-[9.5rem_5.75rem_minmax(0,1fr)] sm:gap-3.5 sm:px-3"
      role="listitem"
      data-testid={`calendar-team-${team.teamCode}`}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="grid h-9 w-11 shrink-0 place-items-center border border-[var(--line)] bg-[var(--paper)] font-mono text-xs font-semibold text-[var(--ink)]">
          {team.teamCode}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--ink)]">{team.teamName}</p>
          <p className="mt-0.5 text-[11px] text-[var(--ink-soft)]">
            {countFormatter.format(team.jobCount)} งานในคิว
          </p>
        </div>
      </div>
      <div className="flex items-center sm:items-start">
        <StatusBadge status={team.status} compact testId={`calendar-team-status-${team.teamCode}`} />
      </div>
      <div className="min-w-0">
        {team.jobs.length > 0 ? (
          <ul className="space-y-2">
            {team.jobs.map((job) => <JobCard key={job.id} job={job} />)}
          </ul>
        ) : (
          <p className="py-1 text-[11px] text-[var(--ink-soft)]">ยังไม่มีงานในคิววันนี้</p>
        )}
      </div>
    </article>
  );
}

export function TechnicianCalendarPage() {
  const today = new Date();
  const todayKey = toLocalDateKey(today);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1, 12),
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const monthDays = useMemo(
    () => createMockMonth(visibleMonth.getFullYear(), visibleMonth.getMonth()),
    [visibleMonth],
  );
  const monthOffset = (new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).getDay() + 6) % 7;
  const calendarCells = useMemo<(CalendarDay | null)[]>(() => {
    const cells: (CalendarDay | null)[] = [
      ...Array.from({ length: monthOffset }, () => null),
      ...monthDays,
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [monthDays, monthOffset]);
  const selectedDay = monthDays.find((day) => day.date === selectedDate) ?? null;

  const monthStats = useMemo(() => ({
    totalJobs: monthDays.reduce((sum, day) => sum + day.totalJobs, 0),
    availableDays: monthDays.filter((day) => day.dayStatus === "available").length,
    busyDays: monthDays.filter((day) => day.dayStatus === "busy").length,
  }), [monthDays]);

  const changeMonth = (amount: number) => {
    setVisibleMonth((current) => shiftMonth(current, amount));
    setSelectedDate(null);
    setIsDetailOpen(false);
  };

  const goToToday = () => {
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1, 12));
    setSelectedDate(todayKey);
    setIsDetailOpen(false);
  };

  const openDay = (day: CalendarDay) => {
    setSelectedDate(day.date);
    setIsDetailOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5" data-testid="technician-calendar-page">
      <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--brand-blue)]">Dispatch / calendar</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">
            ปฏิทินคิวช่าง
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--ink-soft)]">
            ตารางรายเดือนสำหรับวางแผนงานติดตั้งของทีมช่างทั้ง 10 ทีม เลือกวันที่เพื่อเปิดคิวรายละเอียด
          </p>
        </div>
        <div
          className="flex max-w-sm items-start gap-2 border border-[var(--saffron)]/40 bg-[var(--saffron)]/5 px-3 py-2.5 text-xs leading-relaxed text-[var(--ink)]"
          data-testid="calendar-demo-notice"
          role="note"
        >
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[var(--saffron-dark)]" aria-hidden="true" />
          <span><strong>โหมดข้อมูลตัวอย่าง</strong><br />หน้านี้ยังไม่เชื่อมต่อ API และไม่ใช่คิวงานจริง</span>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-3" aria-label="สรุปคิวประจำเดือน">
        <div className="bg-[var(--card-paper)] p-3.5 sm:p-4" data-testid="calendar-month-total">
          <p className="text-[10px] uppercase tracking-wider text-[var(--ink-soft)]">งานตัวอย่างในเดือน</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--ink)]">{countFormatter.format(monthStats.totalJobs)}</p>
          <p className="mt-1 text-[10px] text-[var(--ink-soft)]">รวมทุกทีมช่าง</p>
        </div>
        <div className="bg-[var(--card-paper)] p-3.5 sm:p-4" data-testid="calendar-month-available">
          <p className="text-[10px] uppercase tracking-wider text-[var(--ink-soft)]">วันที่คิวว่าง</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[#17816d]">{countFormatter.format(monthStats.availableDays)}</p>
          <p className="mt-1 text-[10px] text-[var(--ink-soft)]">ไม่มีงานตัวอย่าง</p>
        </div>
        <div className="bg-[var(--card-paper)] p-3.5 sm:p-4" data-testid="calendar-month-busy">
          <p className="text-[10px] uppercase tracking-wider text-[var(--ink-soft)]">วันที่คิวเต็ม</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[#a24439]">{countFormatter.format(monthStats.busyDays)}</p>
          <p className="mt-1 text-[10px] text-[var(--ink-soft)]">ตั้งแต่ 4 งานหรือมีทีมเต็ม</p>
        </div>
      </section>

      <section className="border border-[var(--line)] bg-[var(--card-paper)]" aria-label="ปฏิทินรายเดือน">
        <div className="space-y-4 border-b border-[var(--line)] p-3.5 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-none px-2.5 sm:px-3"
                onClick={() => changeMonth(-1)}
                aria-label="เดือนก่อนหน้า"
                data-testid="button-calendar-previous-month"
              >
                <ArrowLeft className="h-4 w-4 sm:mr-1.5" aria-hidden="true" />
                <span className="hidden sm:inline">ก่อนหน้า</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-none px-2.5 sm:px-3"
                onClick={() => changeMonth(1)}
                aria-label="เดือนถัดไป"
                data-testid="button-calendar-next-month"
              >
                <span className="hidden sm:inline">ถัดไป</span>
                <ArrowRight className="h-4 w-4 sm:ml-1.5" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 rounded-none px-2.5"
                onClick={goToToday}
                data-testid="button-calendar-today"
              >
                วันนี้
              </Button>
            </div>
            <h2
              className="order-first w-full text-center text-lg font-semibold text-[var(--ink)] sm:order-none sm:w-auto sm:text-xl"
              aria-live="polite"
              data-testid="calendar-month-title"
            >
              {monthFormatter.format(visibleMonth)}
            </h2>
            <span className="hidden items-center gap-1.5 text-[10px] text-[var(--ink-soft)] sm:inline-flex">
              <Users className="h-3.5 w-3.5" aria-hidden="true" /> 10 ทีมช่าง
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="คำอธิบายสถานะคิว">
            {(Object.entries(statusPresentation) as Array<[CalendarStatus, (typeof statusPresentation)[CalendarStatus]]>).map(([status, presentation]) => (
              <span key={status} className="inline-flex items-center gap-1.5 text-[10px] text-[var(--ink-soft)] sm:text-xs" data-testid={`calendar-legend-${status}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${presentation.dot}`} aria-hidden="true" />
                <span>{presentation.label} · {presentation.description}</span>
              </span>
            ))}
            <span className="text-[10px] text-[var(--ink-soft)] sm:ml-auto sm:text-xs">กดวันที่เพื่อดูทีมและงาน</span>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-[var(--line)] bg-[var(--paper)]" aria-label="วันในสัปดาห์">
          {WEEKDAYS.map((weekday, index) => (
            <div
              key={weekday}
              className={`py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-soft)] sm:py-3 sm:text-xs ${index >= 5 ? "text-[var(--brand-blue)]" : ""}`}
              data-testid={`calendar-weekday-${index}`}
            >
              <span className="sm:hidden">{weekday}</span>
              <span className="hidden sm:inline">{FULL_WEEKDAYS[index]}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-[var(--line)]" data-testid="calendar-month-grid">
          {calendarCells.map((day, cellIndex) => {
            if (!day) {
              return <div key={`empty-${cellIndex}`} className="min-h-[82px] bg-[var(--card-paper)] sm:min-h-[122px]" aria-hidden="true" />;
            }

            const dayNumber = Number(day.date.slice(-2));
            const isToday = day.date === todayKey;
            const isSelected = day.date === selectedDate;
            const presentation = statusPresentation[day.dayStatus];

            return (
              <button
                key={day.date}
                type="button"
                className={`group flex min-h-[82px] flex-col items-stretch border-t-2 bg-[var(--card-paper)] p-1.5 text-left transition-colors hover:bg-[var(--paper)] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-blue)] sm:min-h-[122px] sm:p-2.5 ${presentation.accent} ${isSelected ? "ring-2 ring-inset ring-[var(--brand-blue)]" : ""}`}
                onClick={() => openDay(day)}
                aria-label={`${dateFormatter.format(new Date(`${day.date}T12:00:00`))}, ${countFormatter.format(day.totalJobs)} งาน, ${presentation.label}`}
                aria-pressed={isSelected}
                data-testid={`calendar-day-${day.date}`}
              >
                <span className={`grid h-6 w-6 place-items-center text-xs font-semibold tabular-nums sm:h-7 sm:w-7 sm:text-sm ${isToday ? "bg-[var(--ink)] text-[var(--paper)]" : "text-[var(--ink)]"}`}>
                  {dayNumber}
                </span>
                <span className="mt-2 flex items-center gap-1.5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${presentation.dot}`} aria-hidden="true" />
                  <span className="truncate text-[9px] font-medium tabular-nums text-[var(--ink-soft)] sm:text-xs">
                    {day.totalJobs === 0 ? "ว่าง" : `${countFormatter.format(day.totalJobs)} งาน`}
                  </span>
                </span>
                <span className={`mt-auto hidden pt-2 text-[10px] font-semibold sm:block ${day.dayStatus === "busy" ? "text-[#a24439]" : day.dayStatus === "moderate" ? "text-[#8a6318]" : "text-[#17816d]"}`}>
                  {presentation.label}
                </span>
                <ChevronRight className="ml-auto mt-auto hidden h-3.5 w-3.5 text-[var(--ink-soft)] opacity-0 transition-opacity group-hover:opacity-100 sm:block" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </section>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-[var(--ink-soft)]">
        <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>สถานะใช้ทั้งสีและข้อความกำกับ สีแดงหมายถึงมีงานรวมตั้งแต่ 4 งานขึ้นไปหรือมีทีมที่คิวเต็ม</span>
      </p>

      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent
          side="right"
          className="inset-0 h-[100dvh] w-full max-w-none overflow-hidden rounded-none border-[var(--line)] bg-[var(--card-paper)] p-0 sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[min(680px,calc(100vw-2rem))] sm:max-w-[680px]"
          data-testid="sheet-calendar-day-details"
        >
          {selectedDay && (
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-[var(--line)] bg-[var(--paper)] px-5 pb-4 pt-6 pr-14 sm:px-6 sm:pr-14">
                <SheetHeader className="space-y-1 text-left">
                  <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--brand-blue)]">Daily dispatch / demo</p>
                  <SheetTitle className="text-xl font-semibold text-[var(--ink)]" data-testid="calendar-detail-date">
                    {dateFormatter.format(new Date(`${selectedDay.date}T12:00:00`))}
                  </SheetTitle>
                  <SheetDescription className="text-xs text-[var(--ink-soft)]">
                    {countFormatter.format(selectedDay.totalJobs)} งานตัวอย่าง · ทีมช่าง {countFormatter.format(selectedDay.teams.length)} ทีม
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={selectedDay.dayStatus} testId="calendar-detail-day-status" />
                  <span className="text-[10px] text-[var(--ink-soft)]">ข้อมูลชั่วคราว ไม่ใช่คิวจริง</span>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6" data-testid="calendar-detail-team-list">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--ink)]">คิวทีมช่างประจำวัน</h3>
                    <p className="mt-1 text-[10px] text-[var(--ink-soft)]">รายละเอียดงาน โครงการ ที่อยู่ และแผนที่</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-[var(--ink-soft)]">10 ทีม</span>
                </div>

                <div className="hidden border-y border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-soft)] sm:grid sm:grid-cols-[9.5rem_5.75rem_minmax(0,1fr)] sm:gap-3.5" aria-hidden="true">
                  <span>ทีมช่าง</span>
                  <span>สถานะ</span>
                  <span>งาน / ที่อยู่</span>
                </div>
                <div className="border-y border-[var(--line)] sm:border-t-0" role="list" aria-label="รายการคิวทีมช่างประจำวัน">
                  {selectedDay.teams.map((team) => <TeamQueue key={team.teamCode} team={team} />)}
                </div>
              </div>

              <div className="border-t border-[var(--line)] bg-[var(--paper)] px-4 py-3 text-[10px] leading-relaxed text-[var(--ink-soft)] sm:px-6">
                หน้านี้ใช้ข้อมูลตัวอย่างแบบกำหนดตายตัวระหว่างรอ API หลังบ้าน กรุณาอย่านำไปใช้จัดคิวงานจริง
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
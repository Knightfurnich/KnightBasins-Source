import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  Flame,
  LayoutGrid,
  MapPin,
  MapPinned,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAdminDashboardStatsQueryKey,
  getGetAdminTechnicianCalendarQueryKey,
  useListAdminTechnicianTeams,
  useGetAdminTechnicianCalendar,
  useUpdateAdminLeadTechnician,
  type AdminLeadTechnicianUpdateInput,
  type TechnicianTeam,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type CalendarStatus = "available" | "moderate" | "busy";

type TechnicianTeamCode = NonNullable<AdminLeadTechnicianUpdateInput["technicianTeamCode"]>;

export interface CalendarDay {
  date: string;
  dayStatus: CalendarStatus;
  totalJobs: number;
  teams: Array<{
    teamCode: TechnicianTeamCode;
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

const WEEKDAYS = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
const FULL_WEEKDAYS = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];

const BANGKOK_TIME_ZONE = "Asia/Bangkok";
const bangkokDateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BANGKOK_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const monthFormatter = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  timeZone: BANGKOK_TIME_ZONE,
  month: "long",
  year: "numeric",
});
const dateFormatter = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  timeZone: BANGKOK_TIME_ZONE,
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

function toBangkokDateKey(date: Date) {
  const parts = bangkokDateKeyFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")!.value;
  const month = parts.find((part) => part.type === "month")!.value;
  const day = parts.find((part) => part.type === "day")!.value;
  return `${year}-${month}-${day}`;
}

function monthStartFromBangkokDateKey(dateKey: string) {
  const [year, month] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1, 12));
}

function dateFromBangkokDateKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00+07:00`);
}

function shiftMonth(date: Date, amount: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1, 12));
}

function googleMapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function StatusBadge({ status, compact = false, testId }: { status: CalendarStatus; compact?: boolean; testId?: string }) {
  const presentation = statusPresentation[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 border font-semibold ${compact ? "px-1.5 py-1 text-[14px]" : "px-2 py-1 text-[14px]"} ${presentation.badge}`}
      data-testid={testId}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${presentation.dot}`} aria-hidden="true" />
      <span>{compact ? presentation.shortLabel : presentation.label}</span>
    </span>
  );
}

function JobCard({
  job,
  teamCode,
  technicianTeams,
  installationDate,
  isLive,
  isUpdating,
  updateError,
  onTeamChange,
  onReschedule,
}: {
  job: CalendarDay["teams"][number]["jobs"][number];
  teamCode: TechnicianTeamCode;
  technicianTeams: TechnicianTeam[];
  installationDate: string;
  isLive: boolean;
  isUpdating: boolean;
  updateError: string | null;
  onTeamChange: (jobId: number, teamCode: TechnicianTeamCode | null) => void;
  onReschedule: (jobId: number, date: string) => Promise<void>;
}) {
  const [dateValue, setDateValue] = useState(installationDate);

  useEffect(() => {
    setDateValue(installationDate);
  }, [installationDate]);

  const handleDateChange = (date: string) => {
    if (!date) {
      setDateValue(installationDate);
      return;
    }
    setDateValue(date);
    void onReschedule(job.id, date).catch(() => setDateValue(installationDate));
  };

  return (
    <li className="border border-[var(--line)] bg-[var(--paper)] p-3" data-testid={`calendar-job-${job.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <p className="text-xs font-semibold leading-relaxed text-[var(--ink)]">{job.name}</p>
      </div>
      {job.project && <p className="mt-1 font-mono text-[14px] text-[var(--brand-blue)]">{job.project}</p>}
      <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
        <p className="flex min-w-0 items-start gap-1.5 text-[14px] leading-relaxed text-[var(--ink-soft)]">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{job.address ?? "ยังไม่ได้ระบุที่อยู่"}</span>
        </p>
        {job.address && (
          <a
            href={googleMapsUrl(job.address)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 shrink-0 items-center gap-1.5 border border-[var(--line)] bg-[var(--card-paper)] px-2.5 text-[14px] font-semibold text-[var(--ink)] transition-colors hover:border-[var(--brand-blue)] hover:text-[var(--brand-blue)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]"
            data-testid={`link-calendar-map-${job.id}`}
          >
            <MapPinned className="h-3.5 w-3.5" aria-hidden="true" />
            แผนที่
          </a>
        )}
      </div>
      {isLive && (
        <div className="mt-3 grid gap-2 border-t border-[var(--line)] pt-3 sm:grid-cols-2">
          <label className="grid gap-1 text-[14px] font-medium text-[var(--ink-soft)]">
            <span>ทีมช่าง</span>
            <select
              value={teamCode}
              disabled={isUpdating}
              onChange={(event) => onTeamChange(job.id, event.target.value ? event.target.value as TechnicianTeamCode : null)}
              className="h-9 min-w-0 border border-[var(--line)] bg-[var(--card-paper)] px-2 text-xs text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)] disabled:cursor-wait disabled:opacity-60"
              aria-label={`ทีมช่างสำหรับ ${job.name}`}
              data-testid={`select-calendar-team-${job.id}`}
            >
              <option value="">ปลดคิว / ไม่ระบุทีม</option>
              {technicianTeams.map((team) => (
                <option key={team.id} value={team.code}>{team.code} — {team.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[14px] font-medium text-[var(--ink-soft)]">
            <span>เลื่อนวันติดตั้ง</span>
            <input
              type="date"
              value={dateValue}
              disabled={isUpdating}
              onChange={(event) => handleDateChange(event.target.value)}
              className="h-9 min-w-0 border border-[var(--line)] bg-[var(--card-paper)] px-2 text-xs text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)] disabled:cursor-wait disabled:opacity-60"
              aria-label={`เลื่อนวันติดตั้ง ${job.name}`}
              data-testid={`input-calendar-installation-date-${job.id}`}
            />
          </label>
          {updateError && (
            <p className="text-[14px] text-[#a24439]" role="alert" data-testid={`calendar-update-error-${job.id}`}>
              {updateError}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function TeamQueue({
  team,
  technicianTeams,
  installationDate,
  isLive,
  isUpdating,
  updateError,
  onTeamChange,
  onReschedule,
}: {
  team: CalendarDay["teams"][number];
  technicianTeams: TechnicianTeam[];
  installationDate: string;
  isLive: boolean;
  isUpdating: boolean;
  updateError: string | null;
  onTeamChange: (jobId: number, teamCode: TechnicianTeamCode | null) => void;
  onReschedule: (jobId: number, date: string) => Promise<void>;
}) {
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
          <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">
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
            {team.jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                teamCode={team.teamCode}
                technicianTeams={technicianTeams}
                installationDate={installationDate}
                isLive={isLive}
                isUpdating={isUpdating}
                updateError={updateError}
                onTeamChange={onTeamChange}
                onReschedule={onReschedule}
              />
            ))}
          </ul>
        ) : (
          <p className="py-1 text-[14px] text-[var(--ink-soft)]">ยังไม่มีงานในคิววันนี้</p>
        )}
      </div>
    </article>
  );
}

export function TechnicianCalendarPage() {
  const today = new Date();
  const todayKey = toBangkokDateKey(today);
  const [visibleMonth, setVisibleMonth] = useState(() => monthStartFromBangkokDateKey(todayKey));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const queryClient = useQueryClient();
  const updateTech = useUpdateAdminLeadTechnician();
  const {
    data: technicianTeams,
    isLoading: isTeamsLoading,
    isError: isTeamsError,
  } = useListAdminTechnicianTeams();
  const activeTechnicianTeams = useMemo(
    () => (technicianTeams ?? []).filter((team) => team.active),
    [technicianTeams],
  );

  const visibleYear = visibleMonth.getUTCFullYear();
  const visibleMonthIndex = visibleMonth.getUTCMonth();
  const currentMonthKey = `${visibleYear}-${String(visibleMonthIndex + 1).padStart(2, "0")}`;
  const {
    data: calendarData,
    isLoading,
    isError: isCalendarError,
  } = useGetAdminTechnicianCalendar({ month: currentMonthKey });

  const isLive = Boolean(calendarData?.days);
  const monthDays = useMemo<CalendarDay[]>(
    () => (calendarData?.days as unknown as CalendarDay[] | undefined) ?? [],
    [calendarData],
  );
  const monthOffset = (new Date(Date.UTC(visibleYear, visibleMonthIndex, 1, 12)).getUTCDay() + 6) % 7;
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

  const [selectedTeamCode, setSelectedTeamCode] = useState<string | null>(null);

  const teamWorkloads = useMemo(() => {
    const map = new Map<string, { totalJobs: number; daysCount: number; todayJobs: number; stageCounts: Record<string, number> }>();
    activeTechnicianTeams.forEach((t) => map.set(t.code, { totalJobs: 0, daysCount: 0, todayJobs: 0, stageCounts: {} }));

    monthDays.forEach((day) => {
      day.teams.forEach((team) => {
        const entry = map.get(team.teamCode) ?? { totalJobs: 0, daysCount: 0, todayJobs: 0, stageCounts: {} };
        entry.totalJobs += team.jobCount;
        if (team.jobCount > 0) entry.daysCount += 1;
        if (day.date === todayKey) entry.todayJobs += team.jobCount;
        map.set(team.teamCode, entry);
      });
    });

    return activeTechnicianTeams
      .map((t) => {
        const stats = map.get(t.code) ?? { totalJobs: 0, daysCount: 0, todayJobs: 0, stageCounts: {} };
        return {
          ...t,
          ...stats,
        };
      })
      .sort((a, b) => b.totalJobs - a.totalJobs || a.name.localeCompare(b.name, "th"));
  }, [activeTechnicianTeams, monthDays, todayKey]);

  const todayDay = monthDays.find((d) => d.date === todayKey) ?? null;
  const todayJobsCount = todayDay ? todayDay.totalJobs : 0;
  const todayActiveTeamsCount = todayDay ? todayDay.teams.filter((t) => t.jobCount > 0).length : 0;

  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [activeWeekDate, setActiveWeekDate] = useState<string>(todayKey);

  const weekDays = useMemo(() => {
    const current = dateFromBangkokDateKey(activeWeekDate);
    const dayOfWeek = (current.getUTCDay() + 6) % 7; // 0 = Mon, 6 = Sun
    const mondayTime = current.getTime() - dayOfWeek * 86400000;

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mondayTime + i * 86400000);
      const key = toBangkokDateKey(d);
      const found = monthDays.find((day) => day.date === key);
      if (found) return found;
      return {
        date: key,
        dayStatus: "available" as CalendarStatus,
        totalJobs: 0,
        teams: [],
      };
    });
  }, [activeWeekDate, monthDays]);

  const changeWeek = (direction: -1 | 1) => {
    const current = dateFromBangkokDateKey(activeWeekDate);
    const nextDate = new Date(current.getTime() + direction * 7 * 86400000);
    const nextKey = toBangkokDateKey(nextDate);
    setActiveWeekDate(nextKey);
    const nextMonth = monthStartFromBangkokDateKey(nextKey);
    if (nextMonth.getTime() !== visibleMonth.getTime()) {
      setVisibleMonth(nextMonth);
    }
  };

  const weekRangeTitle = useMemo(() => {
    if (weekDays.length < 7) return "";
    const first = weekDays[0];
    const last = weekDays[6];
    const fD = Number(first.date.slice(-2));
    const lD = Number(last.date.slice(-2));
    const mStr = monthFormatter.format(dateFromBangkokDateKey(first.date));
    return `${fD} – ${lD} ${mStr}`;
  }, [weekDays]);

  const invalidateDispatchQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetAdminTechnicianCalendarQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetAdminDashboardStatsQueryKey() }),
    ]);
  };

  const updateTeam = (jobId: number, teamCode: TechnicianTeamCode | null) => {
    updateTech.mutate(
      { id: jobId, data: { technicianTeamCode: teamCode } },
      { onSuccess: invalidateDispatchQueries },
    );
  };

  const rescheduleJob = async (jobId: number, date: string) => {
    await updateTech.mutateAsync({ id: jobId, data: { expectedInstallationDate: date } });
    await invalidateDispatchQueries();
    setVisibleMonth(monthStartFromBangkokDateKey(date));
    setSelectedDate(date);
    setIsDetailOpen(true);
  };

  const changeMonth = (amount: number) => {
    setVisibleMonth((current) => shiftMonth(current, amount));
    setSelectedDate(null);
    setIsDetailOpen(false);
  };

  const goToToday = () => {
    setVisibleMonth(monthStartFromBangkokDateKey(todayKey));
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
          <p className="text-[12px] font-medium uppercase tracking-[0.2em] text-[var(--brand-blue)]">Dispatch / calendar</p>
          <h1 className="mt-1 font-semibold tracking-tight text-[var(--ink)]">
            ปฏิทินคิวช่าง
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--ink-soft)]">
            ตารางรายเดือนสำหรับวางแผนงานติดตั้งของทีมช่าง เลือกวันที่เพื่อเปิดคิวรายละเอียด
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void invalidateDispatchQueries()}
            disabled={isLoading}
            className="h-9 rounded-none px-3"
            data-testid="button-calendar-refresh"
          >
            <RefreshCw className={`mr-1.5 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
            รีเฟรช
          </Button>
          {isLive ? (
            <div
              className="flex max-w-sm items-start gap-2 border border-[#17816d]/40 bg-[#17816d]/10 px-3 py-2 text-xs leading-relaxed text-[#17816d]"
              data-testid="calendar-live-notice"
              role="note"
            >
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[#17816d]" aria-hidden="true" />
              <span><strong>เชื่อมต่อระบบจริง (Live Dispatch)</strong><br />ทีมพร้อมมอบหมาย {countFormatter.format(activeTechnicianTeams.length)} ทีม</span>
            </div>
          ) : (
            <div
              className="flex max-w-sm items-start gap-2 border border-[var(--saffron)]/40 bg-[var(--saffron)]/5 px-3 py-2 text-xs leading-relaxed text-[var(--ink)]"
              data-testid="calendar-unavailable-notice"
              role="note"
            >
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[var(--saffron-dark)]" aria-hidden="true" />
              <span>
                <strong>{isLoading ? "กำลังโหลดคิวงาน" : isCalendarError ? "โหลดคิวงานไม่สำเร็จ" : "ยังไม่มีข้อมูลคิวงาน"}</strong>
                <br />
                {isLoading ? "กำลังดึงข้อมูลจากระบบ" : isCalendarError ? "กรุณาลองใหม่อีกครั้งภายหลัง" : "ข้อมูลจะปรากฏเมื่อระบบส่งคิวงานมา"}
              </span>
            </div>
          )}
        </div>
      </header>

      {isTeamsLoading && (
        <p className="text-xs text-[var(--ink-soft)]" role="status" data-testid="calendar-teams-loading">
          กำลังโหลดรายชื่อทีมช่างสำหรับการมอบหมายงาน
        </p>
      )}
      {isTeamsError && (
        <p className="text-xs text-[#a24439]" role="alert" data-testid="calendar-teams-error">
          โหลดรายชื่อทีมช่างไม่สำเร็จ รายการทีมในเมนูมอบหมายงานอาจไม่ครบ
        </p>
      )}

      <section className="grid grid-cols-2 gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-4" aria-label="สรุปคิวประจำเดือน">
        <div className="bg-[var(--card-paper)] p-3.5 sm:p-4" data-testid="calendar-month-total">
          <p className="text-[12px] uppercase tracking-wider text-[var(--ink-soft)]">งานนัดติดตั้งในเดือน</p>
          <p className="admin-stat-value mt-1 text-[var(--ink)]">{countFormatter.format(monthStats.totalJobs)}</p>
          <p className="mt-1 text-[11px] text-[var(--ink-soft)]">รวมทั้ง 10 ทีมช่าง</p>
        </div>
        <div className="bg-[var(--card-paper)] p-3.5 sm:p-4" data-testid="calendar-today-total">
          <p className="text-[12px] uppercase tracking-wider text-[var(--ink-soft)] flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-blue)] animate-pulse" />
            คิวงานวันนี้ ({todayKey.slice(-2)} {monthFormatter.format(visibleMonth).split(" ")[0]})
          </p>
          <p className="admin-stat-value mt-1 text-[var(--brand-blue)]">{countFormatter.format(todayJobsCount)}</p>
          <p className="mt-1 text-[11px] text-[var(--ink-soft)]">{todayActiveTeamsCount > 0 ? `${todayActiveTeamsCount} ทีมออกหน้างาน` : "ไม่มีนัดวันนี้"}</p>
        </div>
        <div className="bg-[var(--card-paper)] p-3.5 sm:p-4" data-testid="calendar-month-available">
          <p className="text-[12px] uppercase tracking-wider text-[var(--ink-soft)]">วันที่คิวว่าง</p>
          <p className="admin-stat-value mt-1 text-[#17816d]">{countFormatter.format(monthStats.availableDays)}</p>
          <p className="mt-1 text-[11px] text-[var(--ink-soft)]">พร้อมรับงานติดตั้ง</p>
        </div>
        <div className="bg-[var(--card-paper)] p-3.5 sm:p-4" data-testid="calendar-month-busy">
          <p className="text-[12px] uppercase tracking-wider text-[var(--ink-soft)]">วันที่คิวแน่น/เต็ม</p>
          <p className="admin-stat-value mt-1 text-[#a24439]">{countFormatter.format(monthStats.busyDays)}</p>
          <p className="mt-1 text-[11px] text-[var(--ink-soft)]">ตั้งแต่ 4 งานหรือทีมเต็ม</p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] xl:grid-cols-[1fr_380px] gap-6 items-start">
        <section className="border border-[var(--line)] bg-[var(--card-paper)] shadow-sm" aria-label="ปฏิทินรายเดือน">
          <div className="space-y-4 border-b border-[var(--line)] p-3.5 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-none px-2.5 sm:px-3"
                  onClick={() => (viewMode === "month" ? changeMonth(-1) : changeWeek(-1))}
                  aria-label={viewMode === "month" ? "เดือนก่อนหน้า" : "สัปดาห์ก่อนหน้า"}
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
                  onClick={() => (viewMode === "month" ? changeMonth(1) : changeWeek(1))}
                  aria-label={viewMode === "month" ? "เดือนถัดไป" : "สัปดาห์ถัดไป"}
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
                  onClick={() => {
                    goToToday();
                    setActiveWeekDate(todayKey);
                  }}
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
                {viewMode === "month" ? monthFormatter.format(visibleMonth) : weekRangeTitle}
              </h2>
              <div className="flex items-center gap-2">
                {selectedTeamCode ? (
                  <div className="inline-flex items-center gap-1.5 bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] px-2.5 py-1 text-xs font-semibold">
                    <span>กรองทีม: {activeTechnicianTeams.find((t) => t.code === selectedTeamCode)?.name ?? selectedTeamCode}</span>
                    <button type="button" onClick={() => setSelectedTeamCode(null)} className="ml-1 hover:opacity-75">✕</button>
                  </div>
                ) : null}
                <div className="flex items-center border border-[var(--line)] p-0.5" role="group" aria-label="โหมดการแสดงผล">
                  <Button
                    type="button"
                    size="sm"
                    variant={viewMode === "month" ? "secondary" : "ghost"}
                    onClick={() => setViewMode("month")}
                    className="h-8 rounded-none px-2.5 text-xs font-semibold"
                    data-testid="button-calendar-view-month"
                  >
                    <LayoutGrid className="mr-1.5 h-3.5 w-3.5" /> เดือน
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={viewMode === "week" ? "secondary" : "ghost"}
                    onClick={() => {
                      setViewMode("week");
                      setActiveWeekDate(todayKey);
                    }}
                    className="h-8 rounded-none px-2.5 text-xs font-semibold"
                    data-testid="button-calendar-view-week"
                  >
                    <CalendarDays className="mr-1.5 h-3.5 w-3.5" /> สัปดาห์
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="คำอธิบายสถานะคิว">
              {(Object.entries(statusPresentation) as Array<[CalendarStatus, (typeof statusPresentation)[CalendarStatus]]>).map(([status, presentation]) => (
                <span key={status} className="inline-flex items-center gap-1.5 text-[12px] text-[var(--ink-soft)] sm:text-xs" data-testid={`calendar-legend-${status}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${presentation.dot}`} aria-hidden="true" />
                  <span>{presentation.label} · {presentation.description}</span>
                </span>
              ))}
              <span className="text-[12px] text-[var(--ink-soft)] sm:ml-auto sm:text-xs">คลิกวันที่เพื่อจัดการคิวงาน</span>
            </div>
          </div>

          {viewMode === "month" ? (
            <>
              <div className="grid grid-cols-7 border-b border-[var(--line)] bg-[var(--paper)]" aria-label="วันในสัปดาห์">
                {WEEKDAYS.map((weekday, index) => (
                  <div
                    key={weekday}
                    className={`py-2 text-center text-[13px] font-semibold uppercase tracking-wider text-[var(--ink-soft)] sm:py-3 sm:text-xs ${index >= 5 ? "text-[var(--brand-blue)]" : ""}`}
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
                    return <div key={`empty-${cellIndex}`} className="min-h-[96px] bg-[var(--card-paper)] sm:min-h-[136px]" aria-hidden="true" />;
                  }

                  const dayNumber = Number(day.date.slice(-2));
                  const isToday = day.date === todayKey;
                  const isSelected = day.date === selectedDate;
                  const presentation = statusPresentation[day.dayStatus];

                  const teamJobs = day.teams
                    .filter((t) => !selectedTeamCode || t.teamCode === selectedTeamCode)
                    .flatMap((t) => t.jobs.map((j) => ({ ...j, teamCode: t.teamCode, teamName: t.teamName })));

                  const hasFilterJob = selectedTeamCode ? teamJobs.length > 0 : true;
                  const isDimmed = selectedTeamCode && !hasFilterJob;

                  return (
                    <button
                      key={day.date}
                      type="button"
                      className={`group flex min-h-[96px] flex-col items-stretch border-t-2 bg-[var(--card-paper)] p-1.5 text-left transition-all hover:bg-[var(--paper)] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-blue)] sm:min-h-[136px] sm:p-2 ${presentation.accent} ${isSelected ? "ring-2 ring-inset ring-[var(--brand-blue)]" : ""} ${isDimmed ? "opacity-35 grayscale" : ""}`}
                      onClick={() => openDay(day)}
                      aria-label={`${dateFormatter.format(dateFromBangkokDateKey(day.date))}, ${countFormatter.format(day.totalJobs)} งาน, ${presentation.label}`}
                      aria-pressed={isSelected}
                      data-testid={`calendar-day-${day.date}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`grid h-6 w-6 place-items-center text-xs font-semibold tabular-nums sm:h-7 sm:w-7 sm:text-sm ${isToday ? "bg-[var(--brand-blue)] text-white shadow-sm" : "text-[var(--ink)]"}`}>
                          {dayNumber}
                        </span>
                        {day.totalJobs > 0 && (
                          <span className={`px-1.5 py-0.5 text-[10px] sm:text-[11px] font-bold rounded ${day.dayStatus === "busy" ? "bg-[#a24439]/10 text-[#a24439]" : "bg-[var(--line)] text-[var(--ink)]"}`}>
                            {day.totalJobs} งาน
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 space-y-1 overflow-hidden">
                        {teamJobs.slice(0, 2).map((j) => (
                          <div
                            key={j.id}
                            className="flex items-center gap-1 truncate rounded border border-[var(--line)]/60 bg-[var(--paper)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ink)] sm:text-[11px]"
                            title={`${j.teamName}: ${j.name}`}
                          >
                            <span className="font-bold text-[var(--brand-blue)] shrink-0">{j.teamCode}</span>
                            <span className="truncate">{j.name.replace(/^ลูกค้า\s*/, "")}</span>
                          </div>
                        ))}
                        {teamJobs.length > 2 && (
                          <p className="text-[10px] text-[var(--ink-soft)] font-medium pl-1 leading-tight">
                            +{teamJobs.length - 2} งานเพิ่มเติม
                          </p>
                        )}
                      </div>

                      {teamJobs.length === 0 && (
                        <span className="mt-auto hidden pt-2 text-[11px] text-[var(--ink-soft)] sm:block">
                          ว่าง
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-px bg-[var(--line)]" data-testid="calendar-week-grid">
              {weekDays.map((day, idx) => {
                const isToday = day.date === todayKey;
                const isSelected = day.date === selectedDate;
                const dayNumber = Number(day.date.slice(-2));
                const teamJobs = day.teams
                  .filter((t) => !selectedTeamCode || t.teamCode === selectedTeamCode)
                  .flatMap((t) => t.jobs.map((j) => ({ ...j, teamCode: t.teamCode, teamName: t.teamName })));

                return (
                  <div
                    key={day.date}
                    className={`flex flex-col min-h-[380px] bg-[var(--card-paper)] transition-all ${
                      isToday ? "ring-2 ring-inset ring-[var(--brand-blue)]" : ""
                    } ${isSelected ? "bg-[var(--brand-blue)]/5" : ""}`}
                  >
                    <div className={`p-2.5 border-b border-[var(--line)] flex items-center justify-between ${
                      isToday ? "bg-[var(--brand-blue)] text-white" : "bg-[var(--paper)]/80 text-[var(--ink)]"
                    }`}>
                      <div>
                        <p className="text-[11px] font-semibold uppercase">{FULL_WEEKDAYS[idx]}</p>
                        <p className="text-sm font-bold tabular-nums">
                          {dayNumber} {monthFormatter.format(dateFromBangkokDateKey(day.date)).split(" ")[0]}
                        </p>
                      </div>
                      {teamJobs.length > 0 ? (
                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${isToday ? "bg-white text-[var(--brand-blue)]" : "bg-[var(--line)] text-[var(--ink)]"}`}>
                          {teamJobs.length} งาน
                        </span>
                      ) : (
                        <span className={`text-xs ${isToday ? "text-white/80" : "text-[var(--ink-soft)]"}`}>ว่าง</span>
                      )}
                    </div>

                    <div className="p-2 space-y-2 flex-1 overflow-y-auto">
                      {teamJobs.map((j) => (
                        <div
                          key={j.id}
                          onClick={() => openDay(day)}
                          className="p-2.5 border border-[var(--line)] bg-[var(--paper)] hover:bg-[var(--line)]/30 hover:border-[var(--brand-blue)] transition-all cursor-pointer shadow-xs space-y-1.5 rounded-none"
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openDay(day); }}
                          title="คลิกเพื่อดูรายละเอียดและจัดการคิวงาน"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-xs font-mono text-[var(--brand-blue)] px-1.5 py-0.5 bg-[var(--brand-blue)]/10">
                              {j.teamCode}
                            </span>
                            <span className="text-[11px] font-semibold text-[var(--ink-soft)] truncate">
                              {j.teamName}
                            </span>
                          </div>
                          <p className="font-semibold text-xs text-[var(--ink)] line-clamp-2 leading-snug">
                            {j.name}
                          </p>
                          {j.project && (
                            <p className="text-[11px] text-[var(--ink-soft)] truncate">
                              {j.project}
                            </p>
                          )}
                        </div>
                      ))}
                      {teamJobs.length === 0 && (
                        <div
                          onClick={() => openDay(day)}
                          className="h-full min-h-[140px] flex flex-col items-center justify-center border border-dashed border-[var(--line)] text-center p-3 text-[var(--ink-soft)] hover:bg-[var(--paper)]/50 cursor-pointer transition-colors"
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openDay(day); }}
                        >
                          <p className="text-xs">ไม่มีคิวนัด</p>
                          <span className="text-[11px] text-[var(--brand-blue)] mt-1 font-medium">+ จัดคิวงาน</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <aside className="border border-[var(--line)] bg-[var(--card-paper)] p-4 sm:p-5 shadow-sm space-y-4" data-testid="technician-team-radar">
          <div className="border-b border-[var(--line)] pb-3 flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-blue)]">Team Radar</p>
              <h3 className="text-base font-semibold text-[var(--ink)] mt-0.5">เรดาร์คิวงาน 10 ทีมช่าง</h3>
              <p className="text-xs text-[var(--ink-soft)] mt-0.5">สรุปงานประจำ{monthFormatter.format(visibleMonth)}</p>
            </div>
            {selectedTeamCode && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 text-[var(--brand-blue)] rounded-none shrink-0"
                onClick={() => setSelectedTeamCode(null)}
              >
                ✕ แสดงทุกทีม
              </Button>
            )}
          </div>

          <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
            {teamWorkloads.map((team) => {
              const isSelected = selectedTeamCode === team.code;
              const maxMonthlyCapacity = 10;
              const loadPercent = Math.min(100, Math.round((team.totalJobs / maxMonthlyCapacity) * 100));

              return (
                <div
                  key={team.code}
                  onClick={() => setSelectedTeamCode(isSelected ? null : team.code)}
                  className={`p-3 border transition-all cursor-pointer select-none relative ${
                    isSelected
                      ? "border-[var(--brand-blue)] bg-[var(--brand-blue)]/5 shadow-sm ring-1 ring-[var(--brand-blue)]"
                      : "border-[var(--line)] bg-[var(--paper)]/50 hover:bg-[var(--line)]/25 hover:border-[var(--ink-soft)]/40"
                  }`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setSelectedTeamCode(isSelected ? null : team.code);
                  }}
                  aria-pressed={isSelected}
                  data-testid={`card-team-radar-${team.code}`}
                >
                  {/* Selected checkmark badge, exactly like basin selection */}
                  {isSelected && (
                    <span
                      className="absolute -top-2 -right-2 grid h-5 w-5 place-items-center rounded-full bg-[var(--brand-blue)] text-white shadow-sm ring-2 ring-[var(--card-paper)] z-10"
                      aria-hidden="true"
                    >
                      <Check className="h-3 w-3 stroke-[3]" />
                    </span>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-[var(--ink)] text-xs font-bold text-[var(--paper)] font-mono">
                        {team.code}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--ink)] truncate leading-tight">{team.name}</p>
                        {team.shortName && <p className="text-[11px] text-[var(--ink-soft)] truncate">ทีม{team.shortName}</p>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-bold ${
                          team.totalJobs >= 4
                            ? "bg-[#a24439]/10 text-[#a24439]"
                            : team.totalJobs > 0
                            ? "bg-[#17816d]/10 text-[#17816d]"
                            : "bg-[var(--line)]/60 text-[var(--ink-soft)]"
                        }`}
                      >
                        {team.totalJobs > 0 ? `${team.totalJobs} งาน` : "คิวว่าง"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 bg-[var(--line)] rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          team.totalJobs >= 4
                            ? "bg-[#a24439]"
                            : team.totalJobs > 0
                            ? "bg-[#17816d]"
                            : "bg-transparent"
                        }`}
                        style={{ width: `${loadPercent}%` }}
                      />
                    </div>
                    <span className="text-[11px] tabular-nums text-[var(--ink-soft)] font-medium shrink-0">
                      {team.daysCount} วันนัด
                    </span>
                  </div>

                  {team.todayJobs > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--brand-blue)] bg-[var(--brand-blue)]/10 px-2 py-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-blue)] animate-pulse" />
                      <span>มีงานนัดวันนี้ ({team.todayJobs} งาน)</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-[var(--line)] text-xs text-[var(--ink-soft)] flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[var(--brand-blue)] shrink-0" />
            <span>คลิกที่ทีมเพื่อกรองดูเฉพาะงานของทีมนั้นบนปฏิทิน</span>
          </div>
        </aside>
      </div>

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
                  <p className="text-[12px] font-medium uppercase tracking-[0.2em] text-[var(--brand-blue)]">
                    Daily dispatch / live
                  </p>
                  <SheetTitle className="text-xl font-semibold text-[var(--ink)]" data-testid="calendar-detail-date">
                    {dateFormatter.format(dateFromBangkokDateKey(selectedDay.date))}
                  </SheetTitle>
                  <SheetDescription className="text-xs text-[var(--ink-soft)]">
                    {countFormatter.format(selectedDay.totalJobs)} งานติดตั้ง · ทีมช่าง {countFormatter.format(selectedDay.teams.length)} ทีม
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={selectedDay.dayStatus} testId="calendar-detail-day-status" />
                  <span className="text-[12px] text-[var(--ink-soft)]">
                    ซิงก์จากคำสั่งซื้อจริง
                  </span>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6" data-testid="calendar-detail-team-list">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--ink)]">คิวทีมช่างประจำวัน</h3>
                    <p className="mt-1 text-[12px] text-[var(--ink-soft)]">รายละเอียดงาน โครงการ ที่อยู่ และแผนที่</p>
                  </div>
                   <span className="shrink-0 text-[12px] text-[var(--ink-soft)]">{countFormatter.format(selectedDay.teams.length)} ทีม</span>
                </div>

                <div className="hidden border-y border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-[14px] font-semibold uppercase tracking-wider text-[var(--ink-soft)] sm:grid sm:grid-cols-[9.5rem_5.75rem_minmax(0,1fr)] sm:gap-3.5" aria-hidden="true">
                  <span>ทีมช่าง</span>
                  <span>สถานะ</span>
                  <span>งาน / ที่อยู่</span>
                </div>
                <div className="border-y border-[var(--line)] sm:border-t-0" role="list" aria-label="รายการคิวทีมช่างประจำวัน">
                  {selectedDay.teams.map((team) => (
                    <TeamQueue
                      key={team.teamCode}
                      team={team}
                      technicianTeams={activeTechnicianTeams}
                      installationDate={selectedDay.date}
                      isLive={isLive}
                      isUpdating={updateTech.isPending}
                      updateError={updateTech.isError ? "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง" : null}
                      onTeamChange={updateTeam}
                      onReschedule={rescheduleJob}
                    />
                  ))}
                </div>
              </div>

            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
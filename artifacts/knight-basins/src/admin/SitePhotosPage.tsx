import { useMemo, useState } from "react";
import { Loader2, RefreshCw, X, ImageOff, Check, Pencil, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  customFetch,
  useListAdminSitePhotos,
  useUpdateAdminSitePhoto,
  getListAdminSitePhotosQueryKey,
} from "@workspace/api-client-react";
import type { SitePhoto, SitePhotoStage, ListAdminSitePhotosParams } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatThaiDateTime, THAI_TIME_ZONE } from "@/data/date-time";

export type SitePhotoStageFilter = SitePhotoStage | "all";

export const SITE_PHOTO_STAGE_OPTIONS: ReadonlyArray<{ value: SitePhotoStageFilter; label: string }> = [
  { value: "all", label: "ทั้งหมด" },
  { value: "survey", label: "📐 วัดหน้างาน" },
  { value: "installation", label: "🛠️ งานติดตั้ง" },
  { value: "service", label: "🔧 เก็บงาน/เซอร์วิส" },
  { value: "completed", label: "✅ เสร็จสมบูรณ์" },
];

const STAGE_BADGE_STYLES: Record<SitePhotoStage, string> = {
  survey: "bg-blue-100 text-blue-700 border-blue-300",
  installation: "bg-amber-100 text-amber-700 border-amber-300",
  service: "bg-purple-100 text-purple-700 border-purple-300",
  completed: "bg-green-100 text-green-700 border-green-300",
};

const STAGE_BADGE_LABEL: Record<SitePhotoStage, string> = {
  survey: "📐 วัดหน้างาน",
  installation: "🛠️ งานติดตั้ง",
  service: "🔧 เก็บงาน/เซอร์วิส",
  completed: "✅ เสร็จสมบูรณ์",
};

/**
 * Builds the server-side list query. The universal search stays client-side
 * because the endpoint's jobCode filter cannot match descriptions or senders.
 * Blank/whitespace-only jobCode and the "all" stage are omitted.
 */
export function sitePhotosQueryParams(filters: { jobCode: string; stage: SitePhotoStageFilter }): ListAdminSitePhotosParams {
  const params: ListAdminSitePhotosParams = {};
  const jobCode = filters.jobCode.trim();
  if (jobCode !== "") params.jobCode = jobCode;
  if (filters.stage !== "all") params.stage = filters.stage;
  return params;
}

export type SitePhotoExtraFilters = { onlyUnassigned: boolean; month: string };
export const ALL_SITE_PHOTOS_MONTHS = "all";
export type SitePhotoTimeRange = "all" | "30d" | "year";
export type SitePhotoYearPeriod = "all" | "q1" | "q2" | "q3" | "q4" | `month:${string}`;

const SITE_PHOTO_TIME_ZONE_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  timeZone: THAI_TIME_ZONE,
});

function sitePhotoDate(photo: SitePhoto): Date | null {
  for (const value of [photo.capturedAt, photo.createdAt]) {
    if (!value) continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function sitePhotoDateParts(date: Date): { year: string; month: string } | null {
  const parts = SITE_PHOTO_TIME_ZONE_DATE_FORMATTER.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return year && month ? { year, month } : null;
}

export function sitePhotoYearOptions(photos: readonly SitePhoto[]) {
  const years = new Set<string>();
  for (const photo of photos) {
    const date = sitePhotoDate(photo);
    const parts = date ? sitePhotoDateParts(date) : null;
    if (parts) years.add(parts.year);
  }
  return Array.from(years)
    .sort((left, right) => Number(right) - Number(left))
    .map((value) => ({ value, label: `พ.ศ. ${Number(value) + 543}` }));
}

export function sitePhotoYearPeriodOptions(photos: readonly SitePhoto[], year: string) {
  const monthKeys = new Set<string>();
  if (year) {
    for (const photo of photos) {
      const date = sitePhotoDate(photo);
      const parts = date ? sitePhotoDateParts(date) : null;
      if (parts?.year === year) monthKeys.add(`${parts.year}-${parts.month}`);
    }
  }
  return [
    { value: "all" as const, label: "ทั้งปี (ทุกเดือน)" },
    { value: "q1" as const, label: "ไตรมาส 1" },
    { value: "q2" as const, label: "ไตรมาส 2" },
    { value: "q3" as const, label: "ไตรมาส 3" },
    { value: "q4" as const, label: "ไตรมาส 4" },
    ...Array.from(monthKeys)
      .sort((left, right) => left.localeCompare(right))
      .map((monthKey) => ({
        value: `month:${monthKey}` as const,
        label: sitePhotoMonthLabel(monthKey),
      })),
  ];
}

export function sitePhotoCapturedMonthKey(capturedAt: string | null | undefined): string | null {
  if (!capturedAt) return null;
  const date = new Date(capturedAt);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    timeZone: THAI_TIME_ZONE,
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return year && month ? year + "-" + month : null;
}

function sitePhotoMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 15, 12));
  return new Intl.DateTimeFormat("th-TH", {
    month: "short",
    year: "2-digit",
    timeZone: THAI_TIME_ZONE,
  }).format(date);
}

export function sitePhotoMonthOptions(photos: readonly SitePhoto[], selectedMonth = ALL_SITE_PHOTOS_MONTHS) {
  const monthKeys = new Set<string>();
  for (const photo of photos) {
    const monthKey = sitePhotoCapturedMonthKey(photo.capturedAt);
    if (monthKey) monthKeys.add(monthKey);
  }
  if (selectedMonth !== ALL_SITE_PHOTOS_MONTHS) monthKeys.add(selectedMonth);
  return Array.from(monthKeys)
    .sort((left, right) => right.localeCompare(left))
    .map((value) => ({ value, label: sitePhotoMonthLabel(value) }));
}

export function filterSitePhotosExtra(photos: readonly SitePhoto[], filters: SitePhotoExtraFilters): SitePhoto[] {
  return photos.filter((photo) => {
    const isUnassigned = !photo.jobCode || photo.jobCode.trim() === "";
    if (filters.onlyUnassigned && !isUnassigned) return false;
    if (filters.month !== ALL_SITE_PHOTOS_MONTHS && sitePhotoCapturedMonthKey(photo.capturedAt) !== filters.month) return false;
    return true;
  });
}

export function filterSitePhotosSmart(
  photos: readonly SitePhoto[],
  filters: {
    search: string;
    stage: SitePhotoStageFilter;
    onlyUnassigned: boolean;
    timeRange: SitePhotoTimeRange;
    year: string;
    yearPeriod: SitePhotoYearPeriod;
  },
  now = new Date(),
): SitePhoto[] {
  const search = filters.search.trim().toLocaleLowerCase();
  const nowMs = now.getTime();
  const thirtyDaysAgoMs = nowMs - 30 * 24 * 60 * 60 * 1000;

  return photos.filter((photo) => {
    if (filters.stage !== "all" && photo.stage !== filters.stage) return false;

    const isUnassigned = !photo.jobCode || photo.jobCode.trim() === "";
    if (filters.onlyUnassigned && !isUnassigned) return false;

    if (search) {
      const matchesSearch = [photo.jobCode, photo.description, photo.senderName]
        .some((value) => value?.trim().toLocaleLowerCase().includes(search) ?? false);
      if (!matchesSearch) return false;
    }

    if (filters.timeRange === "30d") {
      const date = sitePhotoDate(photo);
      const timestamp = date?.getTime();
      if (timestamp === undefined || timestamp < thirtyDaysAgoMs || timestamp > nowMs) return false;
    }

    if (filters.timeRange === "year") {
      if (!filters.year) return false;
      const date = sitePhotoDate(photo);
      const parts = date ? sitePhotoDateParts(date) : null;
      if (!parts || parts.year !== filters.year) return false;

      if (filters.yearPeriod.startsWith("q")) {
        const quarter = Number(filters.yearPeriod.slice(1));
        if (!Number.isInteger(quarter) || Math.ceil(Number(parts.month) / 3) !== quarter) return false;
      } else if (filters.yearPeriod.startsWith("month:")) {
        const monthKey = `${parts.year}-${parts.month}`;
        if (filters.yearPeriod.slice("month:".length) !== monthKey) return false;
      }
    }

    return true;
  });
}

const SITE_PHOTOS_BASE_QUERY_KEY = getListAdminSitePhotosQueryKey();

function StageBadge({ stage }: { stage: SitePhotoStage }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${STAGE_BADGE_STYLES[stage]}`}
      data-testid={`badge-stage-${stage}`}
    >
      {STAGE_BADGE_LABEL[stage]}
    </span>
  );
}

function capturedOrCreatedAt(photo: SitePhoto) {
  return formatThaiDateTime(new Date(photo.capturedAt ?? photo.createdAt));
}

function SitePhotoLightbox({
  photo,
  onClose,
  startEditingDescription,
}: {
  photo: SitePhoto;
  onClose: () => void;
  startEditingDescription: boolean;
}) {
  const [savedDescription, setSavedDescription] = useState(photo.description ?? "");
  const [savedStage, setSavedStage] = useState<SitePhotoStage>(photo.stage);
  const [description, setDescription] = useState(photo.description ?? "");
  const [stage, setStage] = useState<SitePhotoStage>(photo.stage);
  const [editingDescription, setEditingDescription] = useState(startEditingDescription);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const updatePhoto = useUpdateAdminSitePhoto();
  const queryClient = useQueryClient();

  const dirty = description !== savedDescription || stage !== savedStage;

  const save = () => {
    setError("");
    setSaved(false);
    updatePhoto.mutate(
      { id: photo.id, data: { description: description.trim() === "" ? null : description.trim(), stage } },
      {
        onError: () => setError("บันทึกไม่สำเร็จ กรุณาลองใหม่"),
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: SITE_PHOTOS_BASE_QUERY_KEY });
          setSavedDescription(description.trim());
          setSavedStage(stage);
          setSaved(true);
          setEditingDescription(false);
        },
      },
    );
  };

  return (
    <div>
      <DialogTitle className="sr-only">{photo.description || photo.jobCode || "ภาพหน้างาน"}</DialogTitle>
      <img
        src={photo.imageUrl}
        alt={photo.description || photo.jobCode || "ภาพหน้างาน"}
        className="max-h-[65vh] w-full bg-black object-contain"
      />
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <StageBadge stage={stage} />
          {photo.jobCode && <span className="font-mono text-sm" data-testid="text-lightbox-job-code">{photo.jobCode}</span>}
          <span className="text-sm text-[var(--ink-soft)]">{photo.senderName ?? "ไม่ระบุผู้ส่ง"}</span>
          <span className="ml-auto text-sm text-[var(--ink-soft)]">{capturedOrCreatedAt(photo)}</span>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="แก้ไขขั้นตอนงาน">
          {(Object.keys(STAGE_BADGE_LABEL) as SitePhotoStage[]).map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={stage === option ? "default" : "outline"}
              className="rounded-none"
              onClick={() => setStage(option)}
              data-testid={`button-lightbox-stage-${option}`}
            >
              {STAGE_BADGE_LABEL[option]}
            </Button>
          ))}
        </div>

        {editingDescription ? (
          <div className="space-y-2">
            <label htmlFor="site-photo-job-description" className="text-sm font-medium">คำอธิบายงาน — ชื่องาน / สถานที่ / เจ้าของงาน</label>
            <Textarea
              id="site-photo-job-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="เช่น บ้านเดี่ยว คุณสมชาย ซอยราชพฤกษ์ 15"
              className="rounded-none"
              rows={3}
              data-testid="textarea-lightbox-description"
            />
          </div>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">คำอธิบายงาน</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--ink-soft)]" data-testid="text-lightbox-description">
                {description || "ยังไม่มีคำอธิบายงาน"}
              </p>
            </div>
            <Button type="button" variant="outline" className="rounded-none" onClick={() => setEditingDescription(true)} data-testid="button-lightbox-edit-description">
              <Pencil className="mr-2 h-4 w-4" />
              แก้ไขข้อมูลงาน
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-[#a24439]" role="alert" data-testid="status-lightbox-error">{error}</p>}
        {saved && !dirty && <p className="text-sm text-[var(--success)]" data-testid="status-lightbox-saved">บันทึกแล้ว</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-none" onClick={onClose} data-testid="button-lightbox-close">
            ปิด
          </Button>
          <Button
            type="button"
            className="rounded-none"
            disabled={!dirty || updatePhoto.isPending}
            onClick={save}
            data-testid="button-lightbox-save"
          >
            {updatePhoto.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            บันทึก
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SitePhotosPage() {
  const [searchInput, setSearchInput] = useState("");
  const [stageFilter, setStageFilter] = useState<SitePhotoStageFilter>("all");
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [timeRange, setTimeRange] = useState<SitePhotoTimeRange>("all");
  const [yearFilter, setYearFilter] = useState("");
  const [yearPeriodFilter, setYearPeriodFilter] = useState<SitePhotoYearPeriod>("all");
  const [selectedPhoto, setSelectedPhoto] = useState<SitePhoto | null>(null);
  const [editDescriptionOnOpen, setEditDescriptionOnOpen] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<SitePhoto | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteNotice, setDeleteNotice] = useState("");
  const [stageUpdatingPhotoId, setStageUpdatingPhotoId] = useState<number | null>(null);
  const [stageUpdateFeedback, setStageUpdateFeedback] = useState<{ photoId: number; message: string; isError: boolean } | null>(null);
  const queryClient = useQueryClient();
  const updatePhoto = useUpdateAdminSitePhoto();

  const params = useMemo(
    () => sitePhotosQueryParams({ jobCode: "", stage: stageFilter }),
    [stageFilter],
  );
  const photosQuery = useListAdminSitePhotos(params);
  const photos = photosQuery.data ?? [];
  const yearOptions = useMemo(() => sitePhotoYearOptions(photos), [photos]);
  const periodYear = yearFilter || yearOptions[0]?.value || "";
  const yearPeriodOptions = useMemo(
    () => sitePhotoYearPeriodOptions(photos, periodYear),
    [photos, periodYear],
  );
  const visiblePhotos = useMemo(
    () => filterSitePhotosSmart(photos, {
      search: searchInput,
      stage: stageFilter,
      onlyUnassigned,
      timeRange,
      year: yearFilter,
      yearPeriod: yearPeriodFilter,
    }),
    [photos, searchInput, stageFilter, onlyUnassigned, timeRange, yearFilter, yearPeriodFilter],
  );

  const clearFilters = () => {
    setSearchInput("");
    setStageFilter("all");
    setOnlyUnassigned(false);
    setTimeRange("all");
    setYearFilter("");
    setYearPeriodFilter("all");
  };

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: SITE_PHOTOS_BASE_QUERY_KEY });
  };

  const openPhoto = (photo: SitePhoto, editDescription = false) => {
    setEditDescriptionOnOpen(editDescription);
    setSelectedPhoto(photo);
  };

  const closePhoto = () => {
    setSelectedPhoto(null);
    setEditDescriptionOnOpen(false);
  };

  const changePhotoStage = (photo: SitePhoto, nextStage: SitePhotoStage) => {
    if (nextStage === photo.stage || stageUpdatingPhotoId !== null) return;
    setStageUpdateFeedback(null);
    setStageUpdatingPhotoId(photo.id);
    updatePhoto.mutate(
      { id: photo.id, data: { stage: nextStage } },
      {
        onError: () => setStageUpdateFeedback({ photoId: photo.id, message: "ย้ายขั้นตอนไม่สำเร็จ กรุณาลองใหม่", isError: true }),
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: SITE_PHOTOS_BASE_QUERY_KEY });
          setStageUpdateFeedback({ photoId: photo.id, message: "เปลี่ยนขั้นตอนแล้ว", isError: false });
        },
        onSettled: () => setStageUpdatingPhotoId(null),
      },
    );
  };

  const confirmDeleteSitePhoto = async () => {
    if (!photoToDelete || deletingPhotoId !== null) return;
    const photo = photoToDelete;
    setDeleteError("");
    setDeletingPhotoId(photo.id);
    try {
      await customFetch<void>(`/api/admin/site-photos/${encodeURIComponent(photo.id)}`, { method: "DELETE" });
      void queryClient.invalidateQueries({ queryKey: SITE_PHOTOS_BASE_QUERY_KEY });
      if (selectedPhoto?.id === photo.id) closePhoto();
      setDeleteNotice("ลบภาพหน้างานแล้ว");
      setPhotoToDelete(null);
    } catch {
      setDeleteError("ลบภาพไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setDeletingPhotoId(null);
    }
  };

  return (
    <div className="space-y-8" data-testid="admin-site-photos">
      <header className="border-b border-[var(--line)] pb-7">
        <p className="eyebrow accent">JOB SITE PHOTOS</p>
        <h1 className="font-display tracking-tight">ภาพหน้างาน</h1>
        <p className="mt-3 max-w-2xl text-[var(--ink-soft)]">
          ค้นหาและติดตามภาพหน้างานจากทุกขั้นตอน ตั้งแต่วัดหน้างานจนถึงส่งมอบ
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="ค้นหารหัสงาน สถานที่ คำอธิบาย หรือชื่อช่าง"
          className="w-full max-w-md rounded-none"
          aria-label="ค้นหาภาพหน้างาน"
          data-testid="input-site-photos-search"
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="กรองตามขั้นตอนงาน">
          {SITE_PHOTO_STAGE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={stageFilter === option.value ? "default" : "outline"}
              className="rounded-none"
              onClick={() => setStageFilter(option.value)}
              data-testid={`button-stage-filter-${option.value}`}
            >
              {option.label}
            </Button>
          ))}
          <Button
            type="button"
            variant={onlyUnassigned ? "default" : "outline"}
            className="rounded-none"
            aria-pressed={onlyUnassigned}
            data-testid="button-filter-unassigned-site-photos"
            onClick={() => {
              const nextOnlyUnassigned = !onlyUnassigned;
              setOnlyUnassigned(nextOnlyUnassigned);
              if (nextOnlyUnassigned) setSearchInput("");
            }}
          >
            ⚠️ ยังไม่ระบุรหัสงาน
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="กรองตามช่วงเวลา">
          <Button
            type="button"
            variant={timeRange === "all" ? "default" : "outline"}
            className="rounded-none"
            aria-pressed={timeRange === "all"}
            onClick={() => {
              setTimeRange("all");
              setYearFilter("");
              setYearPeriodFilter("all");
            }}
            data-testid="button-site-photos-time-all"
          >
            ทั้งหมด
          </Button>
          <Button
            type="button"
            variant={timeRange === "30d" ? "default" : "outline"}
            className="rounded-none"
            aria-pressed={timeRange === "30d"}
            onClick={() => {
              setTimeRange("30d");
              setYearFilter("");
              setYearPeriodFilter("all");
            }}
            data-testid="button-site-photos-time-30d"
          >
            30 วันล่าสุด
          </Button>
        </div>
        <label htmlFor="select-site-photo-year" className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
          <span>ปี พ.ศ.</span>
          <select
            id="select-site-photo-year"
            value={yearFilter}
            onChange={(event) => {
              const nextYear = event.target.value;
              setYearFilter(nextYear);
              setYearPeriodFilter("all");
              setTimeRange(nextYear ? "year" : "all");
            }}
            className="rounded-none border border-[var(--line)] bg-[var(--card-paper)] px-3 py-2 text-sm text-[var(--ink)]"
            data-testid="select-site-photo-year"
          >
            <option value="">เลือกปี</option>
            {yearOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label htmlFor="select-site-photo-month" className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
          <span>ช่วงในปี</span>
          <select
            id="select-site-photo-month"
            value={yearPeriodFilter}
            onChange={(event) => {
              setYearPeriodFilter(event.target.value as SitePhotoYearPeriod);
              setTimeRange("year");
            }}
            disabled={!yearFilter}
            className="rounded-none border border-[var(--line)] bg-[var(--card-paper)] px-3 py-2 text-sm text-[var(--ink)] disabled:opacity-60"
            data-testid="select-site-photo-month"
          >
            {yearPeriodOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" className="rounded-none" onClick={clearFilters} data-testid="button-clear-filters">
            <X className="mr-2 h-4 w-4" />
            ล้างตัวกรอง
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-none"
            onClick={refresh}
            disabled={photosQuery.isFetching}
            data-testid="button-refresh-site-photos"
          >
            {photosQuery.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            รีเฟรช
          </Button>
        </div>
      </div>

      {deleteNotice && (
        <p className="text-sm text-[var(--success)]" role="status" data-testid="status-site-photo-deleted">
          {deleteNotice}
        </p>
      )}

      {photosQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="กำลังโหลดภาพหน้างาน" data-testid="status-site-photos-loading">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-56 animate-pulse border border-[var(--line)] bg-[var(--card-paper)] rounded-none" />
          ))}
        </div>
      ) : photosQuery.isError ? (
        <div className="border border-[#a24439]/40 bg-[#a24439]/5 p-6 rounded-none" role="alert" data-testid="status-site-photos-load-error">
          <h3>โหลดภาพหน้างานไม่สำเร็จ</h3>
          <p className="mt-2 text-[#a24439]">ระบบไม่สามารถดึงข้อมูลภาพหน้างานได้ในขณะนี้</p>
        </div>
      ) : visiblePhotos.length === 0 ? (
        <div
          className="flex flex-col items-center gap-3 border border-[var(--line)] bg-[var(--card-paper)] p-12 text-center text-[var(--ink-soft)] rounded-none"
          data-testid="status-site-photos-empty"
        >
          <ImageOff className="h-8 w-8" aria-hidden="true" />
          <p>ไม่พบภาพหน้างานตามตัวกรองที่เลือก</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="grid-site-photos">
          {visiblePhotos.map((photo) => (
            <article key={photo.id} className="flex flex-col overflow-hidden border border-[var(--line)] bg-[var(--card-paper)] rounded-none">
              <button
                type="button"
                onClick={() => openPhoto(photo)}
                className="group flex w-full flex-col text-left"
                data-testid={`card-site-photo-${photo.id}`}
              >
                <div className="aspect-video w-full overflow-hidden bg-black/5">
                  <img
                    src={photo.imageUrl}
                    alt={photo.description || photo.jobCode || "ภาพหน้างาน"}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <div className="flex w-full flex-1 flex-col gap-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <StageBadge stage={photo.stage} />
                    {photo.jobCode && <span className="font-mono text-xs text-[var(--ink-soft)]">{photo.jobCode}</span>}
                  </div>
                  {photo.description && <p className="line-clamp-2 text-sm text-[var(--ink-soft)]">{photo.description}</p>}
                  <div className="mt-auto flex items-center justify-between text-xs text-[var(--ink-soft)]">
                    <span>{photo.senderName ?? "ไม่ระบุผู้ส่ง"}</span>
                    <span>{capturedOrCreatedAt(photo)}</span>
                  </div>
                </div>
              </button>

              <div className="space-y-3 border-t border-[var(--line)] p-4">
                <label htmlFor={`select-site-photo-stage-${photo.id}`} className="block text-sm font-medium">
                  ย้ายขั้นตอน
                </label>
                <select
                  id={`select-site-photo-stage-${photo.id}`}
                  value={photo.stage}
                  onChange={(event) => changePhotoStage(photo, event.target.value as SitePhotoStage)}
                  disabled={stageUpdatingPhotoId !== null}
                  aria-label={`ย้ายขั้นตอนภาพ ${photo.id}`}
                  className="w-full rounded-none border border-[var(--line)] bg-[var(--card-paper)] px-3 py-2 text-sm text-[var(--ink)] disabled:opacity-60"
                  data-testid={`select-site-photo-stage-${photo.id}`}
                >
                  {(Object.keys(STAGE_BADGE_LABEL) as SitePhotoStage[]).map((stage) => (
                    <option key={stage} value={stage}>{STAGE_BADGE_LABEL[stage]}</option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 rounded-none"
                    onClick={() => openPhoto(photo, true)}
                    data-testid="button-edit-site-photo-description"
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    แก้ไขข้อมูลงาน
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-none text-[#a24439] hover:text-[#a24439]"
                    disabled={deletingPhotoId !== null}
                    onClick={() => {
                      setDeleteError("");
                      setDeleteNotice("");
                      setPhotoToDelete(photo);
                    }}
                    aria-label={`ลบภาพ ${photo.jobCode || photo.id}`}
                    data-testid="button-delete-site-photo"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    ลบภาพ
                  </Button>
                </div>
                {stageUpdateFeedback?.photoId === photo.id && (
                  <p
                    className={`text-sm ${stageUpdateFeedback.isError ? "text-[#a24439]" : "text-[var(--success)]"}`}
                    role={stageUpdateFeedback.isError ? "alert" : "status"}
                    data-testid={`status-site-photo-stage-${photo.id}`}
                  >
                    {stageUpdateFeedback.message}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={selectedPhoto !== null} onOpenChange={(open) => { if (!open) closePhoto(); }}>
        <DialogContent className="max-w-3xl gap-0 rounded-none p-0" data-testid="dialog-site-photo-lightbox">
          {selectedPhoto && (
            <SitePhotoLightbox
              photo={selectedPhoto}
              onClose={closePhoto}
              startEditingDescription={editDescriptionOnOpen}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={photoToDelete !== null}
        onOpenChange={(open) => {
          if (!open && deletingPhotoId === null) {
            setPhotoToDelete(null);
            setDeleteError("");
          }
        }}
      >
        <DialogContent className="max-w-md rounded-none" data-testid="dialog-delete-site-photo">
          <DialogTitle>ยืนยันการลบภาพหน้างาน</DialogTitle>
          <p className="text-sm text-[var(--ink-soft)]">คุณต้องการลบภาพนี้ออกจากระบบใช่หรือไม่?</p>
          {photoToDelete && (
            <p className="text-sm font-medium">
              {photoToDelete.description || photoToDelete.jobCode || `ภาพหน้างาน #${photoToDelete.id}`}
            </p>
          )}
          {deleteError && <p className="text-sm text-[#a24439]" role="alert" data-testid="status-site-photo-delete-error">{deleteError}</p>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              disabled={deletingPhotoId !== null}
              onClick={() => {
                setPhotoToDelete(null);
                setDeleteError("");
              }}
              data-testid="button-cancel-delete-site-photo"
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              className="rounded-none"
              disabled={deletingPhotoId !== null}
              onClick={() => void confirmDeleteSitePhoto()}
              data-testid="button-confirm-delete-site-photo"
            >
              {deletingPhotoId !== null ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              {deletingPhotoId !== null ? "กำลังลบ…" : "ยืนยันลบภาพ"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SitePhotosPage;

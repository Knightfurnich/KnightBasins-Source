import { useMemo, useState } from "react";
import { Loader2, RefreshCw, X, ImageOff, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
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
 * Pure: turns the page's filter state into the query params sent to
 * GET /admin/site-photos, so the search bar and stage buttons genuinely
 * drive the server-side filters instead of filtering an already-fetched
 * page client-side. Blank/whitespace-only jobCode and the "all" stage
 * are both omitted so an unfiltered request lists everything.
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

function SitePhotoLightbox({ photo, onClose }: { photo: SitePhoto; onClose: () => void }) {
  const [description, setDescription] = useState(photo.description ?? "");
  const [stage, setStage] = useState<SitePhotoStage>(photo.stage);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const updatePhoto = useUpdateAdminSitePhoto();
  const queryClient = useQueryClient();

  const dirty = description !== (photo.description ?? "") || stage !== photo.stage;

  const save = () => {
    setError("");
    setSaved(false);
    updatePhoto.mutate(
      { id: photo.id, data: { description: description.trim() === "" ? null : description.trim(), stage } },
      {
        onError: () => setError("บันทึกไม่สำเร็จ กรุณาลองใหม่"),
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: SITE_PHOTOS_BASE_QUERY_KEY });
          setSaved(true);
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

        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="คำบรรยาย AI หรือหมายเหตุเพิ่มเติม"
          className="rounded-none"
          rows={3}
          data-testid="textarea-lightbox-description"
        />

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
  const [jobCodeInput, setJobCodeInput] = useState("");
  const [stageFilter, setStageFilter] = useState<SitePhotoStageFilter>("all");
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [monthFilter, setMonthFilter] = useState<string>(ALL_SITE_PHOTOS_MONTHS);
  const [selectedPhoto, setSelectedPhoto] = useState<SitePhoto | null>(null);
  const queryClient = useQueryClient();

  const params = useMemo(
    () => sitePhotosQueryParams({ jobCode: jobCodeInput, stage: stageFilter }),
    [jobCodeInput, stageFilter],
  );
  const photosQuery = useListAdminSitePhotos(params);
  const photos = photosQuery.data ?? [];
  const monthOptions = useMemo(() => sitePhotoMonthOptions(photos, monthFilter), [photos, monthFilter]);
  const visiblePhotos = useMemo(
    () => filterSitePhotosExtra(photos, { onlyUnassigned, month: monthFilter }),
    [photos, onlyUnassigned, monthFilter],
  );

  const clearFilters = () => {
    setJobCodeInput("");
    setStageFilter("all");
    setOnlyUnassigned(false);
    setMonthFilter(ALL_SITE_PHOTOS_MONTHS);
  };

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: SITE_PHOTOS_BASE_QUERY_KEY });
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
          value={jobCodeInput}
          onChange={(event) => setJobCodeInput(event.target.value)}
          placeholder="ค้นหารหัสงาน เช่น JB01/2569"
          className="max-w-xs rounded-none"
          disabled={onlyUnassigned}
          data-testid="input-site-photos-job-code"
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
              if (nextOnlyUnassigned) setJobCodeInput("");
            }}
          >
            ⚠️ ยังไม่ระบุรหัสงาน
          </Button>
        </div>
        <label htmlFor="select-site-photo-month" className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
          <span>เดือนที่ถ่าย</span>
          <select
            id="select-site-photo-month"
            value={monthFilter}
            onChange={(event) => setMonthFilter(event.target.value)}
            className="rounded-none border border-[var(--line)] bg-[var(--card-paper)] px-3 py-2 text-sm text-[var(--ink)]"
            data-testid="select-site-photo-month"
          >
            <option value={ALL_SITE_PHOTOS_MONTHS}>ทุกเดือน</option>
            {monthOptions.map((option) => (
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
            <button
              key={photo.id}
              type="button"
              onClick={() => setSelectedPhoto(photo)}
              className="group flex flex-col overflow-hidden border border-[var(--line)] bg-[var(--card-paper)] text-left rounded-none"
              data-testid={`card-site-photo-${photo.id}`}
            >
              <div className="aspect-video overflow-hidden bg-black/5">
                <img
                  src={photo.imageUrl}
                  alt={photo.description || photo.jobCode || "ภาพหน้างาน"}
                  className="h-full w-full object-cover transition group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
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
          ))}
        </div>
      )}

      <Dialog open={selectedPhoto !== null} onOpenChange={(open) => { if (!open) setSelectedPhoto(null); }}>
        <DialogContent className="max-w-3xl gap-0 rounded-none p-0" data-testid="dialog-site-photo-lightbox">
          {selectedPhoto && <SitePhotoLightbox photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SitePhotosPage;

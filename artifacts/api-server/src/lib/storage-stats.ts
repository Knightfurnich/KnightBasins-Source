// Disk storage & file health stats for GET /api/admin/storage/stats (job-112).
// Reads the portfolio catalog and the backup vault the same way
// lib/portfolio-catalog.ts and lib/backup-vault.ts already do, so this stays
// consistent with what those modules consider "a portfolio photo" / "a backup
// file" rather than re-deriving its own notion of either.
import { readdir, stat, statfs } from "node:fs/promises";
import { join } from "node:path";
import { loadCatalog } from "./portfolio-catalog";

/** Matches backups/knight_db_backup.sh output; mirrors lib/backup-vault.ts's pattern. */
const BACKUP_FILE_PATTERN = /\.(sql\.gz|dump)$/;

/** Below this fraction of free space on the checked partition, status flips to "warning". */
const DISK_WARNING_FREE_RATIO = 0.1;

export type PortfolioStorageStats = {
  count: number;
  totalBytes: number;
  averageBytes: number;
};

export type BackupStorageStats = {
  count: number;
  totalBytes: number;
  oldestDate: string | null;
  newestDate: string | null;
};

export type DiskUsageStats = {
  freeBytes: number;
  totalBytes: number;
  usedBytes: number;
};

export type StorageHealthStatus = "healthy" | "warning";

export type StorageStats = {
  portfolio: PortfolioStorageStats;
  backups: BackupStorageStats;
  diskUsage: DiskUsageStats;
  status: StorageHealthStatus;
};

export function isBackupArchiveFileName(name: string): boolean {
  return BACKUP_FILE_PATTERN.test(name);
}

/** Empty catalog (no items) safely yields count/totalBytes/averageBytes of 0. */
export async function computePortfolioStorageStats(uploadDir: string): Promise<PortfolioStorageStats> {
  const catalog = await loadCatalog(uploadDir);
  const count = catalog.items.length;
  const totalBytes = catalog.items.reduce((sum, item) => sum + (item.bytes || 0), 0);
  const averageBytes = count > 0 ? Math.round(totalBytes / count) : 0;
  return { count, totalBytes, averageBytes };
}

/** Missing/unreadable backup directory degrades to zero counts rather than throwing. */
export async function computeBackupStorageStats(backupDir: string): Promise<BackupStorageStats> {
  const names = await readdir(backupDir).catch(() => [] as string[]);
  const backupNames = names.filter(isBackupArchiveFileName);

  let totalBytes = 0;
  let oldestMs: number | null = null;
  let newestMs: number | null = null;

  for (const name of backupNames) {
    const info = await stat(join(backupDir, name)).catch(() => null);
    if (!info) continue;
    totalBytes += info.size;
    if (oldestMs === null || info.mtimeMs < oldestMs) oldestMs = info.mtimeMs;
    if (newestMs === null || info.mtimeMs > newestMs) newestMs = info.mtimeMs;
  }

  return {
    count: backupNames.length,
    totalBytes,
    oldestDate: oldestMs === null ? null : new Date(oldestMs).toISOString(),
    newestDate: newestMs === null ? null : new Date(newestMs).toISOString(),
  };
}

/** A missing/unreadable partition (e.g. in tests) degrades to all-zero usage rather than throwing. */
export async function computeDiskUsageStats(pathToCheck: string): Promise<DiskUsageStats> {
  try {
    const info = await statfs(pathToCheck);
    const totalBytes = info.blocks * info.bsize;
    const freeBytes = info.bfree * info.bsize;
    return { freeBytes, totalBytes, usedBytes: totalBytes - freeBytes };
  } catch {
    return { freeBytes: 0, totalBytes: 0, usedBytes: 0 };
  }
}

/** Unknown/zero total disk size is treated as healthy -- there's nothing to warn about yet. */
export function computeStorageHealthStatus(diskUsage: DiskUsageStats): StorageHealthStatus {
  if (diskUsage.totalBytes <= 0) return "healthy";
  const freeRatio = diskUsage.freeBytes / diskUsage.totalBytes;
  return freeRatio < DISK_WARNING_FREE_RATIO ? "warning" : "healthy";
}

export async function computeStorageStats(uploadDir: string, backupDir: string): Promise<StorageStats> {
  const [portfolio, backups, diskUsage] = await Promise.all([
    computePortfolioStorageStats(uploadDir),
    computeBackupStorageStats(backupDir),
    computeDiskUsageStats(uploadDir),
  ]);
  return { portfolio, backups, diskUsage, status: computeStorageHealthStatus(diskUsage) };
}

import { readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";

/** Matches the dumps produced by backups/knight_db_backup.sh (.sql.gz) and any .dump-format export. */
const BACKUP_FILE_PATTERN = /\.(sql\.gz|dump)$/;

/** Rule floor: never prune a backup younger than this, no matter how full the disk is. */
export const BACKUP_MIN_RETENTION_DAYS = 7;
/** Only backups older than this are prune candidates. */
export const BACKUP_MAX_AGE_DAYS = 30;
/** Rule floor: always leave at least this many backups on disk, even if every one of them is past the max age. */
export const BACKUP_SAFETY_FLOOR_COUNT = 3;

export type BackupFileInfo = {
  name: string;
  path: string;
  bytes: number;
  mtimeMs: number;
};

export type BackupPruneResult = {
  prunedCount: number;
  keptCount: number;
  freedBytes: number;
  totalBackups: number;
  prunedFiles: string[];
};

export function isBackupFileName(name: string): boolean {
  return BACKUP_FILE_PATTERN.test(name);
}

/**
 * Pure retention decision, kept separate from disk I/O so it's unit-testable
 * without touching the filesystem. Walks candidates oldest-first: each file
 * older than BACKUP_MAX_AGE_DAYS is pruned unless doing so would drop the
 * total remaining count below BACKUP_SAFETY_FLOOR_COUNT, in which case it
 * (and every younger file after it) is kept instead.
 */
export function planBackupPrune(
  files: BackupFileInfo[],
  now: Date,
): { toPrune: BackupFileInfo[]; toKeep: BackupFileInfo[] } {
  const nowMs = now.getTime();
  const minRetentionMs = BACKUP_MIN_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const maxAgeMs = BACKUP_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const sortedOldestFirst = [...files].sort((a, b) => a.mtimeMs - b.mtimeMs);

  const toPrune: BackupFileInfo[] = [];
  const toKeep: BackupFileInfo[] = [];

  for (const file of sortedOldestFirst) {
    const ageMs = nowMs - file.mtimeMs;
    const withinMinRetention = ageMs < minRetentionMs;
    const eligible = !withinMinRetention && ageMs > maxAgeMs;
    const totalKeptIfPruned = sortedOldestFirst.length - (toPrune.length + 1);

    if (eligible && totalKeptIfPruned >= BACKUP_SAFETY_FLOOR_COUNT) {
      toPrune.push(file);
    } else {
      toKeep.push(file);
    }
  }

  return { toPrune, toKeep };
}

export async function listBackupFiles(directory: string): Promise<BackupFileInfo[]> {
  const names = await readdir(directory).catch(() => [] as string[]);
  return Promise.all(
    names.filter(isBackupFileName).map(async (name) => {
      const path = join(directory, name);
      const info = await stat(path);
      return { name, path, bytes: info.size, mtimeMs: info.mtimeMs };
    }),
  );
}

/** Applies the retention policy to `directory` and deletes whatever it decides to prune, logging an audit record of the outcome either way. */
export async function pruneBackupVault(directory: string, now: Date = new Date()): Promise<BackupPruneResult> {
  const files = await listBackupFiles(directory);
  const { toPrune, toKeep } = planBackupPrune(files, now);

  let freedBytes = 0;
  const prunedFiles: string[] = [];
  for (const file of toPrune) {
    await unlink(file.path);
    freedBytes += file.bytes;
    prunedFiles.push(file.name);
  }

  const result: BackupPruneResult = {
    prunedCount: toPrune.length,
    keptCount: toKeep.length,
    freedBytes,
    totalBackups: files.length,
    prunedFiles,
  };

  // Audit trail for every prune run, kept as a structured console log (matching the
  // existing audit-style logging in routes/leads.ts) rather than pulling in the pino
  // logger here, since that logger spawns a pino-pretty transport worker that the
  // esbuild test bundler (route-harness.ts) isn't set up to handle the way build.mjs is.
  console.info("Backup vault prune executed", { directory, ...result });

  return result;
}

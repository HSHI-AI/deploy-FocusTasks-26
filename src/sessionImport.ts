import { id, safeUrl, type LearningSession } from './types';

export interface SessionImportRow { title: string; estimatedMinutes: number; notes: string; resourceUrl: string; }
export interface SessionImportPreview { additions: SessionImportRow[]; duplicates: string[]; errors: string[]; }

export const normalizeSessionTitle = (title: string): string => title.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

/** Accept an array or {sessions:[...]}; existing task backups are not accepted here. */
export function previewSessionImport(raw: string, existing: LearningSession[]): SessionImportPreview {
  const result: SessionImportPreview = { additions: [], duplicates: [], errors: [] };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { result.errors.push('Invalid JSON. Check commas, quotes, and brackets.'); return result; }
  const list: unknown = Array.isArray(parsed) ? parsed :
    (parsed && typeof parsed === 'object' && 'sessions' in parsed ? (parsed as {sessions: unknown}).sessions : null);
  if (!Array.isArray(list)) { result.errors.push('Expected a JSON array or an object with a "sessions" array.'); return result; }
  if (list.length > 1000) { result.errors.push('Maximum 1,000 sessions per import. Split the file into smaller batches.'); return result; }
  const seen = new Set(existing.map(s => normalizeSessionTitle(s.title)));
  list.forEach((item, index) => {
    const line = `Item ${index + 1}`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) { result.errors.push(`${line}: expected an object.`); return; }
    const obj = item as Record<string, unknown>;
    if (typeof obj.title !== 'string' || !obj.title.trim()) { result.errors.push(`${line}: title is required.`); return; }
    const title = obj.title.trim().replace(/\s+/g, ' ');
    // Format accepts estimatedHours (recommended) or estimatedMinutes (backup-compatible).
    const hasHours = Object.prototype.hasOwnProperty.call(obj, 'estimatedHours');
    const hasMinutes = Object.prototype.hasOwnProperty.call(obj, 'estimatedMinutes');
    if (hasHours === hasMinutes) { result.errors.push(`${line}: provide exactly one of estimatedHours or estimatedMinutes.`); return; }
    const value = hasHours ? obj.estimatedHours : obj.estimatedMinutes;
    if (typeof value !== 'number' || !Number.isFinite(value)) { result.errors.push(`${line}: estimated time must be a number.`); return; }
    const minutes = hasHours ? Math.round(value * 60) : value;
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60000) { result.errors.push(`${line}: estimated time must be between 1 and 60,000 minutes.`); return; }
    if (obj.notes !== undefined && typeof obj.notes !== 'string') { result.errors.push(`${line}: notes must be text.`); return; }
    if (obj.resourceUrl !== undefined && typeof obj.resourceUrl !== 'string') { result.errors.push(`${line}: resourceUrl must be text.`); return; }
    const resourceUrl = (obj.resourceUrl as string | undefined)?.trim() ?? '';
    if (resourceUrl && !safeUrl(resourceUrl)) { result.errors.push(`${line}: resourceUrl must be http:// or https://.`); return; }
    const key = normalizeSessionTitle(title);
    if (seen.has(key)) { result.duplicates.push(title); return; }
    seen.add(key);
    result.additions.push({ title, estimatedMinutes: minutes, notes: (obj.notes as string | undefined) ?? '', resourceUrl });
  });
  return result;
}

export function makeImportedSession(row: SessionImportRow): LearningSession {
  return { id: id(), title: row.title, estimatedMinutes: row.estimatedMinutes, actualMinutes: 0,
    done: false, completedAt: null, notes: row.notes, resourceUrl: row.resourceUrl };
}

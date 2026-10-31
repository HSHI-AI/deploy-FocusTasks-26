export type TaskStatus = 'active' | 'backlog' | 'completed';
export type Priority = 1 | 2 | 3;

export interface LearningSession {
  id: string;
  title: string;
  estimatedMinutes: number;
  actualMinutes: number;
  done: boolean;
  completedAt: string | null;
  notes: string;
  resourceUrl: string;
}

export interface LearningTask {
  id: string;
  title: string;
  category: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  deadline: string | null;
  completedAt: string | null;
  plannedMinutes: number;
  resourceUrl: string;
  resourceLabel: string;
  resourceNote: string;
  sessions: LearningSession[];
  createdAt: string;
  updatedAt: string;
}

export const id = (): string => crypto.randomUUID();
export const localDate = (date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const shiftedDate = (days: number): string => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return localDate(d);
};

export const totalMinutes = (t: LearningTask): number =>
  t.sessions.length ? t.sessions.reduce((sum, s) => sum + s.estimatedMinutes, 0) : t.plannedMinutes;
export const completedMinutes = (t: LearningTask): number =>
  t.sessions.reduce((sum, s) => sum + (s.done ? s.estimatedMinutes : 0), 0);
export const actualMinutes = (t: LearningTask): number =>
  t.sessions.reduce((sum, s) => sum + s.actualMinutes, 0);
export const progress = (t: LearningTask): number =>
  t.status === 'completed' ? 100 : totalMinutes(t) ? Math.round(completedMinutes(t) / totalMinutes(t) * 100) : 0;
export const hours = (minutes: number): string => {
  const n = Math.round((minutes / 60) * 10) / 10;
  return `${Number.isInteger(n) ? n.toFixed(0) : n.toFixed(1)}h`;
};
export const dateDisplay = (date?: string | null): string => {
  if (!date) return 'Not set';
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
};
export const daysUntil = (date: string | null): number | null => {
  if (!date) return null;
  return Math.round((new Date(`${date}T12:00:00`).getTime() - new Date(`${localDate()}T12:00:00`).getTime()) / 86400000);
};
export const safeUrl = (url: string): string | null => {
  if (!url.trim()) return null;
  try { const value = new URL(url); return ['http:', 'https:'].includes(value.protocol) ? value.href : null; }
  catch { return null; }
};

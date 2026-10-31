import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDownUp, ArrowRight, BookOpen, CalendarDays, Check, CheckCircle2, ChevronDown,
  ChevronUp, Clock3, Download, Edit3, ExternalLink, FileText, Flag, FolderOpen,
  Hourglass, Layers3, Link2, ListChecks, MoreHorizontal, Plus, RotateCcw, Search,
  Settings2, Target, Trash2, Upload, X
} from 'lucide-react';
import { db, initDatabase } from './db';
import { emptyTask } from './seed';
import { makeImportedSession, normalizeSessionTitle, previewSessionImport } from './sessionImport';
import {
  actualMinutes, completedMinutes, dateDisplay, daysUntil, hours, id, localDate,
  progress, safeUrl, totalMinutes, type LearningSession, type LearningTask,
  type Priority, type TaskStatus
} from './types';

type Tab = TaskStatus;
type TaskModal = { task: LearningTask; creating: boolean } | null;
type SessionModal = { taskId: string; session: LearningSession; creating: boolean } | null;
type ImportSessionModal = { taskId: string } | null;
type SortOrder = 'priority' | 'deadline' | 'title';
const tabLabels: Record<Tab, string> = { active: 'Active Tasks', backlog: 'Backlog', completed: 'Completed' };
const priorityLabels: Record<Priority, string> = { 1: 'P1 · High', 2: 'P2 · Medium', 3: 'P3 · Low' };

const newSession = (): LearningSession => ({
  id: id(), title: '', estimatedMinutes: 60, actualMinutes: 0,
  done: false, completedAt: null, notes: '', resourceUrl: ''
});
function sortTasks(items: LearningTask[], sort: SortOrder): LearningTask[] {
  return [...items].sort((a, b) => {
    if (sort === 'title') return a.title.localeCompare(b.title);
    if (sort === 'deadline') {
      const date = (a.deadline ?? '9999-12-31').localeCompare(b.deadline ?? '9999-12-31');
      if (date) return date;
    }
    const priority = a.priority - b.priority;
    return priority || (a.deadline ?? '9999-12-31').localeCompare(b.deadline ?? '9999-12-31') || a.title.localeCompare(b.title);
  });
}
function deadlineText(date: string | null): string {
  const days = daysUntil(date);
  if (days === null) return 'No deadline';
  if (days < 0) return `${Math.abs(days)} day${days === -1 ? '' : 's'} overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `${days} days left`;
}
function ResourceLink({ task }: { task: LearningTask }) {
  const url = safeUrl(task.resourceUrl);
  return <div className="resource-cell">
    {url ? <a className="resource-link" href={url} target="_blank" rel="noreferrer">
      <Link2 size={14}/>{task.resourceLabel || 'Open resource'}<ExternalLink size={12}/>
    </a> : <span className="muted text-small">{task.resourceLabel || '—'}</span>}
    {task.resourceNote && <span className="muted resource-note" title={task.resourceNote}>{task.resourceNote}</span>}
  </div>;
}
function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onClose]);
  return <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
      <header className="modal-heading"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Close dialog"><X size={20}/></button></header>
      {children}
    </section>
  </div>;
}
function TaskForm({ initial, creating, onClose, onSave }: {
  initial: LearningTask; creating: boolean; onClose: () => void; onSave: (task: LearningTask) => Promise<void>
}) {
  const [task, setTask] = useState<LearningTask>(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const update = <K extends keyof LearningTask>(key: K, value: LearningTask[K]) => setTask(t => ({ ...t, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!task.title.trim()) { setError('Please enter a task name.'); return; }
    if (task.status === 'active' && !task.deadline) { setError('Active tasks need a deadline.'); return; }
    if (task.resourceUrl.trim() && !safeUrl(task.resourceUrl)) { setError('Resource link must start with https:// or http://.'); return; }
    setSaving(true);
    try { await onSave({ ...task, title: task.title.trim(), updatedAt: new Date().toISOString() }); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save task.'); }
    finally { setSaving(false); }
  }
  return <Modal title={creating ? 'Create a task' : 'Edit task'} onClose={onClose}>
    <form onSubmit={submit} className="form-grid">
      <label className="field full"><span>Task name *</span><input autoFocus value={task.title} onChange={e => update('title', e.target.value)} placeholder="e.g. Python for Finance" /></label>
      <label className="field"><span>Category</span><input value={task.category} onChange={e => update('category', e.target.value)} placeholder="Quant · Book study" /></label>
      <label className="field"><span>Priority</span><select value={task.priority} onChange={e => update('priority', Number(e.target.value) as Priority)}><option value={1}>P1 · High</option><option value={2}>P2 · Medium</option><option value={3}>P3 · Low</option></select></label>
      <label className="field"><span>Deadline {task.status === 'active' ? '*' : '(optional)'}</span><input type="date" value={task.deadline ?? ''} onChange={e => update('deadline', e.target.value || null)}/></label>
      <label className="field"><span>Estimated hours {task.sessions.length ? '(fallback)' : ''}</span><input type="number" min="0.25" max="10000" step="0.25" value={task.plannedMinutes / 60} onChange={e => update('plannedMinutes', Math.max(15, Math.round(Number(e.target.value) * 60) || 15))}/></label>
      <p className="hint full">When learning sessions exist, estimated hours are calculated from their durations automatically.</p>
      <label className="field full"><span>Description / learning objective</span><textarea rows={2} value={task.description} onChange={e => update('description', e.target.value)} placeholder="What does finishing this task look like?"/></label>
      <div className="form-divider full">Resource & reference</div>
      <label className="field full"><span>Resource link</span><input type="url" value={task.resourceUrl} onChange={e => update('resourceUrl', e.target.value)} placeholder="https://..." /></label>
      <label className="field"><span>Link label</span><input value={task.resourceLabel} onChange={e => update('resourceLabel', e.target.value)} placeholder="Official book / PDF / GitHub" /></label>
      <label className="field"><span>Resource note (shown in Backlog)</span><input value={task.resourceNote} onChange={e => update('resourceNote', e.target.value)} placeholder="Author, chapter, or comment" /></label>
      {error && <p className="error-message full" role="alert">{error}</p>}
      <div className="modal-actions full"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}><Check size={16}/>{saving ? 'Saving...' : creating ? 'Create task' : 'Save changes'}</button></div>
    </form>
  </Modal>;
}
function SessionForm({ initial, creating, onClose, onSave, onDelete }: {
  initial: LearningSession; creating: boolean; onClose: () => void;
  onSave: (session: LearningSession) => Promise<void>; onDelete: (sessionId: string) => Promise<void>
}) {
  const [session, setSession] = useState(initial);
  const [error, setError] = useState('');
  const update = <K extends keyof LearningSession>(key: K, value: LearningSession[K]) => setSession(s => ({ ...s, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!session.title.trim()) { setError('Enter a learning session title.'); return; }
    if (session.resourceUrl.trim() && !safeUrl(session.resourceUrl)) { setError('Resource link must start with https:// or http://.'); return; }
    try { await onSave({ ...session, title: session.title.trim() }); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save session.'); }
  }
  return <Modal title={creating ? 'Add learning session' : 'Edit learning session'} onClose={onClose}>
    <form className="form-grid" onSubmit={submit}>
      <label className="field full"><span>Learning session *</span><input autoFocus value={session.title} onChange={e => update('title', e.target.value)} placeholder="e.g. Ch 8 — Volatility Analysis"/></label>
      <label className="field"><span>Estimated hours</span><input type="number" min="0.25" step="0.25" value={session.estimatedMinutes / 60} onChange={e => update('estimatedMinutes', Math.max(15, Math.round(Number(e.target.value) * 60) || 15))}/></label>
      <label className="field"><span>Actual hours</span><input type="number" min="0" step="0.25" value={session.actualMinutes / 60} onChange={e => update('actualMinutes', Math.max(0, Math.round(Number(e.target.value) * 60) || 0))}/></label>
      <label className="field full"><span>Session resource link</span><input type="url" value={session.resourceUrl} onChange={e => update('resourceUrl', e.target.value)} placeholder="https://..."/></label>
      <label className="field full"><span>Learning notes</span><textarea rows={4} value={session.notes} onChange={e => update('notes', e.target.value)} placeholder="Key ideas, code snippets, concepts to review..."/></label>
      {error && <p className="error-message full" role="alert">{error}</p>}
      <div className="modal-actions full separated-actions">
        {!creating ? <button type="button" className="btn btn-danger-ghost" onClick={async () => { if (window.confirm('Delete this learning session?')) { await onDelete(session.id); onClose(); } }}><Trash2 size={15}/> Delete</button> : <span/>}
        <div className="button-group"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary"><Check size={16}/>Save session</button></div>
      </div>
    </form>
  </Modal>;
}

function SessionImportDialog({ task, onClose, onImport }: {
  task: LearningTask; onClose: () => void; onImport: (raw: string) => Promise<number>
}) {
  const [raw, setRaw] = useState('[\n  {"title": "Ch 8 — Returns", "estimatedHours": 1},\n  {"title": "Ch 8 — Rolling Statistics", "estimatedHours": 1.5, "notes": "Implement in Python", "resourceUrl": "https://example.com"}\n]');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => previewSessionImport(raw, task.sessions), [raw, task.sessions]);
  const submit = async () => {
    setMessage(''); setSaving(true);
    try { const added = await onImport(raw); if (added) onClose(); else setMessage('No new sessions to import.'); }
    catch (err) { setMessage(err instanceof Error ? err.message : 'Import failed.'); }
    finally { setSaving(false); }
  };
  return <Modal title={`Import sessions — ${task.title}`} onClose={onClose}>
    <div className="session-import-dialog">
      <p className="import-help">Paste JSON or choose a .json file. Only <strong>new titles</strong> will be appended. Existing sessions—including completed dates, notes and logged hours—will never be overwritten.</p>
      <div className="import-toolbar"><button className="btn btn-subtle" onClick={() => fileRef.current?.click()}><Upload size={15}/>Choose JSON file</button><input ref={fileRef} hidden type="file" accept=".json,application/json" onChange={async e => { const file=e.target.files?.[0]; if (!file) return; if (file.size > 1000000) { setMessage('JSON file is too large (maximum 1 MB).'); return; } setRaw(await file.text()); setMessage(''); e.target.value=''; }}/></div>
      <label className="field"><span>Sessions JSON</span><textarea className="import-textarea" rows={9} value={raw} spellCheck={false} onChange={e => setRaw(e.target.value)}/></label>
      <p className="hint">Formats: <code>[{`{"title":"Chapter 1", "estimatedHours":1}`}]</code> or <code>{`{"sessions":[...]}`}</code>. Optional: <code>notes</code>, <code>resourceUrl</code>. You may use <code>estimatedMinutes</code> instead of <code>estimatedHours</code>.</p>
      <div className="import-summary"><span className="import-good">{preview.additions.length} new</span><span>{preview.duplicates.length} duplicates skipped</span><span className={preview.errors.length ? 'import-bad' : ''}>{preview.errors.length} invalid</span></div>
      <div className="import-preview" aria-label="Import preview">
        {preview.additions.slice(0, 12).map((s, i) => <div className="import-preview-row" key={i}><span>{s.title}</span><strong>{hours(s.estimatedMinutes)}</strong></div>)}
        {preview.additions.length > 12 && <p className="hint">...and {preview.additions.length - 12} more new sessions</p>}
        {preview.duplicates.slice(0, 5).map((s, i) => <div className="import-preview-row import-duplicate" key={`dup-${i}`}>Skipped duplicate: {s}</div>)}
        {preview.errors.slice(0, 8).map((error, i) => <div className="import-preview-row import-error" key={`err-${i}`}>{error}</div>)}
      </div>
      {task.status === 'completed' && <p className="import-warning">Importing new study sessions will move this completed task to Backlog. Its previously completed sessions and their completion dates remain unchanged.</p>}
      {message && <p className="error-message" role="alert">{message}</p>}
      <div className="modal-actions"><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={() => void submit()} disabled={saving || preview.errors.length > 0 || preview.additions.length === 0}><Upload size={15}/>{saving ? 'Importing...' : `Import ${preview.additions.length} new sessions`}</button></div>
    </div>
  </Modal>;
}

function ActiveCard({ task, onEdit, onMove, onDelete, onToggle, onAddSession, onImportSessions, onEditSession, onPriority, onComplete }: {
  task: LearningTask;
  onEdit: () => void; onMove: () => void; onDelete: () => void;
  onToggle: (sessionId: string) => void; onAddSession: () => void; onImportSessions: () => void;
  onEditSession: (session: LearningSession) => void; onPriority: (priority: Priority) => void;
  onComplete: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const total = totalMinutes(task);
  const completed = completedMinutes(task);
  const pct = progress(task);
  const days = daysUntil(task.deadline);
  const dueClass = days !== null && days < 0 ? 'overdue' : days !== null && days <= 7 ? 'due-soon' : '';
  return <article className="task-card">
    <div className="task-card-top">
      <div className="task-heading">
        <span className="category-text">{task.category || 'Self study'}</span>
        <h3>{task.title}</h3>
        {task.description && <p className="task-description">{task.description}</p>}
      </div>
      <div className="task-tools">
        <label className={`priority-select p${task.priority}`} title="Change priority">
          <Flag size={14}/><select aria-label={`Priority for ${task.title}`} value={task.priority} onChange={e => onPriority(Number(e.target.value) as Priority)}>
            {[1, 2, 3].map(p => <option value={p} key={p}>{priorityLabels[p as Priority]}</option>)}
          </select>
        </label>
        <button className="icon-btn" title="Edit task" aria-label={`Edit ${task.title}`} onClick={onEdit}><Edit3 size={17}/></button>
        <div className="menu-wrap"><MenuButtons onBacklog={onMove} onDelete={onDelete} onComplete={onComplete}/></div>
      </div>
    </div>
    <div className="task-progress-block">
      <div className="progress-labels"><span><strong>{pct}%</strong> complete</span><span>{hours(completed)} / {hours(total)} estimated</span></div>
      <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }}/></div>
      <div className="task-meta">
        <span><Clock3 size={15}/> Actual time: {hours(actualMinutes(task))}</span>
        <span className={dueClass}><CalendarDays size={15}/>{dateDisplay(task.deadline)} · {deadlineText(task.deadline)}</span>
      </div>
    </div>
    <div className="sessions-heading">
      <button className="section-toggle" onClick={() => setExpanded(e => !e)} aria-expanded={expanded}>
        <ListChecks size={17}/><strong>Learning sessions</strong>
        <span className="session-count">{task.sessions.filter(s => s.done).length}/{task.sessions.length}</span>
        {expanded ? <ChevronUp size={17}/> : <ChevronDown size={17}/>}
      </button>
      <div className="button-group"><button className="btn btn-tiny btn-subtle" onClick={onImportSessions}><Upload size={14}/>Import JSON</button><button className="btn btn-tiny" onClick={onAddSession}><Plus size={15}/>Add session</button></div>
    </div>
    {expanded && <div className="session-list">
      {task.sessions.length === 0 && <div className="empty-sessions">No learning sessions yet. Add your first ~1-hour study block.</div>}
      {task.sessions.map(s => <div className={`session-row ${s.done ? 'session-done' : ''}`} key={s.id}>
        <label className="check-row">
          <input type="checkbox" checked={s.done} onChange={() => onToggle(s.id)}/>
          <span className="custom-check"><Check size={13}/></span>
          <span className="session-name">{s.title}{s.notes && <span className="note-marker" title="Has learning notes"><FileText size={12}/></span>}</span>
        </label>
        <div className="session-actions">
          {s.resourceUrl && safeUrl(s.resourceUrl) && <a href={safeUrl(s.resourceUrl)!} title="Open session resource" target="_blank" rel="noreferrer" className="tiny-link" onClick={e => e.stopPropagation()}><ExternalLink size={14}/></a>}
          <span className="session-duration">{hours(s.estimatedMinutes)}</span>
          <button className="icon-btn icon-btn-small" title="Edit session / log time" aria-label={`Edit ${s.title}`} onClick={() => onEditSession(s)}><Edit3 size={15}/></button>
        </div>
      </div>)}
    </div>}
    {task.resourceUrl && safeUrl(task.resourceUrl) && <footer className="task-resource"><Link2 size={14}/><a href={safeUrl(task.resourceUrl)!} target="_blank" rel="noreferrer">{task.resourceLabel || 'Task resource'} <ExternalLink size={12}/></a>{task.resourceNote && <span>{task.resourceNote}</span>}</footer>}
  </article>;
}
function MenuButtons({ onBacklog, onDelete, onComplete }: { onBacklog: () => void; onDelete: () => void; onComplete: () => void }) {
  const [open, setOpen] = useState(false);
  return <>
    <button className="icon-btn" aria-label="More task actions" aria-expanded={open} onClick={() => setOpen(v => !v)}><MoreHorizontal size={20}/></button>
    {open && <div className="action-menu">
      <button onClick={() => { setOpen(false); onBacklog(); }}><FolderOpen size={15}/>Move to Backlog</button>
      <button onClick={() => { setOpen(false); onComplete(); }}><CheckCircle2 size={15}/>Mark task completed</button>
      <button className="danger-text" onClick={() => { setOpen(false); onDelete(); }}><Trash2 size={15}/>Delete task</button>
    </div>}
  </>;
}
function CompletedCard({ task, onReopen, onDelete, onImportSessions }: { task: LearningTask; onReopen: () => void; onDelete: () => void; onImportSessions: () => void }) {
  const [expanded, setExpanded] = useState(true);
  return <article className="task-card completed-card">
    <div className="task-card-top">
      <div className="task-heading"><span className="category-text">{task.category}</span><h3><CheckCircle2 size={20} className="complete-icon"/>{task.title}</h3>{task.description && <p className="task-description">{task.description}</p>}</div>
      <span className="complete-badge"><Check size={13}/> Completed</span>
    </div>
    <div className="completed-meta">
      <span><CalendarDays size={15}/> Completed: <strong>{dateDisplay(task.completedAt)}</strong></span>
      <span><Hourglass size={15}/> Estimated: <strong>{hours(totalMinutes(task))}</strong></span>
      <span><Clock3 size={15}/> Actual: <strong>{hours(actualMinutes(task))}</strong></span>
      <span><ListChecks size={15}/> Sessions: <strong>{task.sessions.filter(s => s.done).length}/{task.sessions.length}</strong></span>
    </div>
    <div className="sessions-heading">
      <button className="section-toggle" onClick={() => setExpanded(v => !v)}><ListChecks size={17}/><strong>Learning sessions</strong>{expanded ? <ChevronUp size={17}/> : <ChevronDown size={17}/>}</button>
      <div className="button-group"><button className="btn btn-tiny btn-subtle" onClick={onImportSessions}><Upload size={14}/>Import JSON</button><button className="btn btn-tiny btn-subtle" onClick={onReopen}><RotateCcw size={14}/>Reopen</button><button className="icon-btn icon-btn-small" title="Delete task" aria-label={`Delete ${task.title}`} onClick={onDelete}><Trash2 size={15}/></button></div>
    </div>
    {expanded && <div className="session-list">
      {task.sessions.length === 0 && <div className="empty-sessions">This task has no individual sessions.</div>}
      {task.sessions.map(s => <div className="session-row session-done" key={s.id}>
        <span className="read-only-session"><CheckCircle2 size={16}/><span>{s.title}</span></span>
        <span className="session-duration">{hours(s.estimatedMinutes)}{s.actualMinutes ? ` · actual ${hours(s.actualMinutes)}` : ''}</span>
      </div>)}
    </div>}
    {task.resourceUrl && safeUrl(task.resourceUrl) && <footer className="task-resource"><Link2 size={14}/><a href={safeUrl(task.resourceUrl)!} target="_blank" rel="noreferrer">{task.resourceLabel || 'Resource'} <ExternalLink size={12}/></a></footer>}
  </article>;
}

export default function App() {
  const [tab, setTab] = useState<Tab>('active');
  const [sort, setSort] = useState<SortOrder>('priority');
  const [search, setSearch] = useState('');
  const [taskModal, setTaskModal] = useState<TaskModal>(null);
  const [sessionModal, setSessionModal] = useState<SessionModal>(null);
  const [importSessionModal, setImportSessionModal] = useState<ImportSessionModal>(null);
  const [notice, setNotice] = useState('');
  const [initError, setInitError] = useState('');
  const uploadRef = useRef<HTMLInputElement>(null);
  const tasks = useLiveQuery(() => db.tasks.toArray(), [], undefined);

  useEffect(() => { initDatabase().catch(e => setInitError(String(e))); }, []);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 4200); return () => clearTimeout(timer); }, [notice]);

  const active = useMemo(() => sortTasks((tasks ?? []).filter(t => t.status === 'active'), sort), [tasks, sort]);
  const backlog = useMemo(() => sortTasks((tasks ?? []).filter(t => t.status === 'backlog').filter(t => `${t.title} ${t.category} ${t.resourceNote}`.toLowerCase().includes(search.toLowerCase())), sort), [tasks, sort, search]);
  const completed = useMemo(() => [...(tasks ?? []).filter(t => t.status === 'completed')].sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')), [tasks]);
  const activeCount = active.length;
  const actualTotal = (tasks ?? []).reduce((sum, t) => sum + actualMinutes(t), 0);
  const activeTotal = active.reduce((sum, t) => sum + totalMinutes(t), 0);
  const activeDone = active.reduce((sum, t) => sum + completedMinutes(t), 0);
  const overall = activeTotal ? Math.round(activeDone / activeTotal * 100) : 0;
  const dueSoon = active.filter(t => { const d = daysUntil(t.deadline); return d !== null && d <= 7; }).length;

  const toast = (text: string) => setNotice(text);
  function startTask(status: TaskStatus) {
    const target = status === 'active' && activeCount >= 5 ? 'backlog' : status;
    if (status === 'active' && target === 'backlog') { setTab('backlog'); toast('Active Tasks is full (5/5). Add to Backlog instead.'); }
    setTaskModal({ task: emptyTask(target), creating: true });
  }
  async function saveTask(task: LearningTask) {
    const existing = await db.tasks.get(task.id);
    if (task.status === 'active' && !task.deadline) throw new Error('Active tasks need a deadline.');
    if (task.status === 'active' && (!existing || existing.status !== 'active') && (await db.tasks.where('status').equals('active').count()) >= 5) throw new Error('Active Tasks can only contain 5 tasks.');
    await db.tasks.put(task);
    toast(existing ? 'Task updated.' : 'Task created.');
  }
  async function setPriority(task: LearningTask, priority: Priority) { await db.tasks.update(task.id, { priority, updatedAt: new Date().toISOString() }); }
  async function changeStatus(task: LearningTask, status: TaskStatus) {
    if (status === 'active') {
      if (await db.tasks.where('status').equals('active').count() >= 5) { toast('5/5 active tasks. Move or complete a task first.'); return; }
      if (!task.deadline) { setTaskModal({ task: { ...task, status: 'active', deadline: localDate(), completedAt: null }, creating: false }); toast('Please choose a deadline before activating this task.'); return; }
    }
    // Reopening a completed task clears the most recently finished session so it
    // is actionable again while preserving the rest of the learning history.
    let sessions = task.sessions;
    if (status === 'active' && task.status === 'completed' && sessions.length > 0 && sessions.every(s => s.done)) {
      sessions = sessions.map((s, index) => index === sessions.length - 1 ? { ...s, done: false, completedAt: null } : s);
    }
    await db.tasks.update(task.id, { status, sessions, completedAt: status === 'completed' ? localDate() : null, updatedAt: new Date().toISOString() });
    if (status === 'active') { setTab('active'); toast(`“${task.title}” moved to Active Tasks.`); }
    if (status === 'backlog') toast(`“${task.title}” moved to Backlog.`);
  }
  async function markComplete(task: LearningTask) {
    if (!window.confirm(`Mark “${task.title}” as completed and archive it?`)) return;
    const date = localDate();
    const sessions = task.sessions.map(s => ({ ...s, done: true, completedAt: s.completedAt || date }));
    await db.tasks.update(task.id, { status: 'completed', completedAt: date, sessions, updatedAt: new Date().toISOString() });
    toast(`Completed “${task.title}”. Find it in Completed.`);
  }
  async function toggleSession(task: LearningTask, sessionId: string) {
    const date = localDate();
    const sessions = task.sessions.map(s => s.id !== sessionId ? s : { ...s, done: !s.done, completedAt: s.done ? null : date });
    const finished = sessions.length > 0 && sessions.every(s => s.done);
    await db.tasks.update(task.id, {
      sessions, status: finished ? 'completed' : 'active', completedAt: finished ? date : null,
      updatedAt: new Date().toISOString()
    });
    if (finished) toast(`🎉 “${task.title}” completed and moved to Completed!`);
  }
  async function saveSession(taskId: string, session: LearningSession) {
    const task = await db.tasks.get(taskId); if (!task) throw new Error('Task not found.');
    const exists = task.sessions.some(s => s.id === session.id);
    const sessions = exists ? task.sessions.map(s => s.id === session.id ? session : s) : [...task.sessions, session];
    const finished = sessions.length > 0 && sessions.every(s => s.done);
    await db.tasks.update(taskId, {
      sessions, status: task.status === 'active' && finished ? 'completed' : task.status,
      completedAt: task.status === 'active' && finished ? localDate() : task.completedAt,
      updatedAt: new Date().toISOString()
    });
    toast(exists ? 'Learning session updated.' : 'Learning session added.');
  }
  async function importSessions(taskId: string, raw: string): Promise<number> {
    let count = 0;
    await db.transaction('rw', db.tasks, async () => {
      const task = await db.tasks.get(taskId);
      if (!task) throw new Error('Task no longer exists.');
      const preview = previewSessionImport(raw, task.sessions);
      if (preview.errors.length) throw new Error(`Fix ${preview.errors.length} invalid entries before importing.`);
      // Re-check against current database state inside the transaction to avoid replacing
      // any session changes made since the preview was opened.
      const seen = new Set(task.sessions.map(s => normalizeSessionTitle(s.title)));
      const additions = preview.additions.filter(s => { const key = normalizeSessionTitle(s.title); if (seen.has(key)) return false; seen.add(key); return true; }).map(makeImportedSession);
      if (!additions.length) return;
      count = additions.length;
      await db.tasks.update(taskId, {
        sessions: [...task.sessions, ...additions],
        status: task.status === 'completed' ? 'backlog' : task.status,
        completedAt: task.status === 'completed' ? null : task.completedAt,
        updatedAt: new Date().toISOString()
      });
    });
    if (count) { toast(`Imported ${count} new sessions. Existing progress preserved.`); }
    return count;
  }
  async function deleteSession(taskId: string, sessionId: string) {
    const task = await db.tasks.get(taskId); if (!task) return;
    await db.tasks.update(taskId, { sessions: task.sessions.filter(s => s.id !== sessionId), updatedAt: new Date().toISOString() });
    toast('Learning session deleted.');
  }
  async function deleteTask(task: LearningTask) {
    if (!window.confirm(`Permanently delete “${task.title}” and all its learning sessions?`)) return;
    await db.tasks.delete(task.id); toast('Task deleted.');
  }
  function exportJson() {
    const data = { app: 'FocusFlow', version: 1, exportedAt: new Date().toISOString(), tasks: tasks ?? [] };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `focusflow-backup-${localDate()}.json`; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
    toast('JSON backup downloaded.');
  }
  async function importJson(file?: File) {
    if (!file) return;
    try {
      const content = JSON.parse(await file.text()) as { app?: string; tasks?: unknown };
      if (content.app !== 'FocusFlow' || !Array.isArray(content.tasks)) throw new Error('This does not look like a FocusFlow backup.');
      if (content.tasks.length > 1000) throw new Error('Backup has too many tasks.');
      const incoming = content.tasks as LearningTask[];
      for (const t of incoming) {
        if (!t || typeof t.id !== 'string' || typeof t.title !== 'string' ||
          !['active', 'backlog', 'completed'].includes(t.status) || ![1, 2, 3].includes(t.priority) ||
          !Array.isArray(t.sessions) || typeof t.plannedMinutes !== 'number' ||
          typeof t.resourceUrl !== 'string' || (t.resourceUrl && !safeUrl(t.resourceUrl))) throw new Error('Backup contains an invalid task.');
        for (const s of t.sessions) {
          if (!s || typeof s.id !== 'string' || typeof s.title !== 'string' ||
            typeof s.estimatedMinutes !== 'number' || !Number.isFinite(s.estimatedMinutes) || s.estimatedMinutes <= 0 ||
            typeof s.actualMinutes !== 'number' || typeof s.done !== 'boolean' || typeof s.resourceUrl !== 'string' ||
            (s.resourceUrl && !safeUrl(s.resourceUrl))) throw new Error('Backup contains an invalid learning session.');
        }
      }
      if (incoming.filter(t => t.status === 'active').length > 5) throw new Error('Backup contains more than five active tasks.');
      if (new Set(incoming.map(t => t.id)).size !== incoming.length) throw new Error('Backup has duplicate task IDs.');
      if (!window.confirm(`Replace your existing ${tasks?.length ?? 0} tasks with ${incoming.length} imported tasks? Export a backup first if needed.`)) return;
      await db.transaction('rw', db.tasks, async () => { await db.tasks.clear(); if (incoming.length) await db.tasks.bulkAdd(incoming); });
      setTab('active'); toast(`Imported ${incoming.length} tasks successfully.`);
    } catch (e) { window.alert(`Import failed: ${e instanceof Error ? e.message : String(e)}`); }
    finally { if (uploadRef.current) uploadRef.current.value = ''; }
  }

  return <div className="page-shell">
    <header className="topbar"><div className="container topbar-inner">
      <div className="brand"><span className="brand-mark"><Layers3 size={24} strokeWidth={2.4}/></span><span>Focus<span className="brand-accent">Flow</span></span></div>
      <div className="topbar-right"><span className="topbar-description">A calmer way to make progress</span><button className="topbar-action" onClick={exportJson} title="Download JSON backup"><Download size={17}/><span>Export</span></button><button className="topbar-action" onClick={() => uploadRef.current?.click()} title="Import JSON backup"><Upload size={17}/><span>Import</span></button><input type="file" hidden ref={uploadRef} accept="application/json,.json" onChange={e => void importJson(e.target.files?.[0])}/></div>
    </div></header>
    <main className="container main-content">
      <section className="welcome-section"><div><div className="eyebrow"><Target size={15}/> PERSONAL LEARNING DASHBOARD</div><h1>Stay focused. Keep moving.</h1><p>Your learning roadmap, with every study session accounted for.</p></div><button className="btn btn-primary add-task" onClick={() => startTask(tab === 'completed' ? 'backlog' : tab)}><Plus size={18}/> New task</button></section>
      <section className="stats-grid" aria-label="Learning summary">
        <div className="stat-card"><div className="stat-icon blue"><Layers3 size={21}/></div><div><span className="stat-label">Active tasks</span><div className="stat-value">{activeCount}<span className="stat-unit"> / 5</span></div></div></div>
        <div className="stat-card"><div className="stat-icon green"><Clock3 size={21}/></div><div><span className="stat-label">Study time logged</span><div className="stat-value">{hours(actualTotal)}</div></div></div>
        <div className="stat-card"><div className="stat-icon violet"><Target size={21}/></div><div><span className="stat-label">Active progress</span><div className="stat-value">{overall}<span className="stat-unit">%</span></div></div></div>
        <div className="stat-card"><div className="stat-icon amber"><CheckCircle2 size={21}/></div><div><span className="stat-label">Completed tasks</span><div className="stat-value">{completed.length}</div></div></div>
      </section>
      <div className="tabbar" role="tablist" aria-label="Task sections">
        {(['active', 'backlog', 'completed'] as const).map(t => <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? 'selected' : ''}`} onClick={() => setTab(t)}>
          {t === 'active' ? <Target size={18}/> : t === 'backlog' ? <BookOpen size={18}/> : <CheckCircle2 size={18}/>}
          <span>{tabLabels[t]}</span><span className="tab-count">{t === 'active' ? activeCount : t === 'backlog' ? (tasks ?? []).filter(task => task.status === 'backlog').length : completed.length}</span>
        </button>)}
      </div>
      {initError && <div className="error-message">Could not open local database: {initError}</div>}
      {tasks === undefined ? <div className="loading">Loading your learning dashboard…</div> : <>
        {tab === 'active' && <section className="tab-content">
          <div className="section-header"><div><h2>Current Focus <span className="muted">({activeCount}/5)</span></h2><p>Complete sessions to move forward. Finishing the last session archives the task automatically.</p></div>
            <div className="header-controls"><label className="sort-control"><ArrowDownUp size={16}/><select aria-label="Sort active tasks" value={sort} onChange={e => setSort(e.target.value as SortOrder)}><option value="priority">Priority first</option><option value="deadline">Nearest deadline</option><option value="title">Name A–Z</option></select></label></div>
          </div>
          {dueSoon > 0 && <div className="deadline-alert"><CalendarDays size={17}/>{dueSoon} task{dueSoon !== 1 && 's'} due within 7 days or overdue. Check your upcoming deadlines.</div>}
          <div className="active-grid">{active.map(t => <ActiveCard key={t.id} task={t} onEdit={() => setTaskModal({ task: t, creating: false })}
            onMove={() => void changeStatus(t, 'backlog')} onDelete={() => void deleteTask(t)} onToggle={id => void toggleSession(t, id)}
            onAddSession={() => setSessionModal({ taskId: t.id, session: newSession(), creating: true })}
            onImportSessions={() => setImportSessionModal({ taskId: t.id })}
            onEditSession={session => setSessionModal({ taskId: t.id, session, creating: false })}
            onPriority={priority => void setPriority(t, priority)} onComplete={() => void markComplete(t)}/>)}</div>
          {active.length === 0 && <div className="empty-state"><Target size={28}/><h3>No active tasks yet</h3><p>Activate something from Backlog or create a new task to begin.</p><button className="btn btn-primary" onClick={() => startTask('active')}><Plus size={16}/>Create first task</button></div>}
          <div className="capacity-note"><Settings2 size={16}/><span>Focus rule: at most <strong>5 active tasks</strong>. Keep future ideas in Backlog so your dashboard stays manageable.</span></div>
        </section>}
        {tab === 'backlog' && <section className="tab-content">
          <div className="section-header"><div><h2>Learning Backlog</h2><p>Keep books, courses, links and ideas here until you're ready to focus on them.</p></div><div className="header-controls"><label className="search-control"><Search size={16}/><input aria-label="Search backlog" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search backlog..."/></label><label className="sort-control"><ArrowDownUp size={16}/><select aria-label="Sort backlog" value={sort} onChange={e => setSort(e.target.value as SortOrder)}><option value="priority">Priority first</option><option value="deadline">Nearest deadline</option><option value="title">Name A–Z</option></select></label></div></div>
          <div className="table-wrap"><table className="backlog-table"><thead><tr><th>Learning task</th><th>Priority</th><th>Est. time</th><th>Deadline</th><th>Resource / Notes</th><th>Actions</th></tr></thead>
            <tbody>{backlog.map(t => <tr key={t.id}><td><div className="table-task"><strong>{t.title}</strong><span>{t.category}</span></div></td><td><span className={`priority-badge p${t.priority}`}>{priorityLabels[t.priority]}</span></td><td className="nowrap">{hours(totalMinutes(t))}</td><td className="nowrap">{dateDisplay(t.deadline)}</td><td className="resource-table-cell"><ResourceLink task={t}/></td><td><div className="row-buttons"><button className="btn btn-tiny btn-promote" disabled={activeCount >= 5} title={activeCount >= 5 ? 'Complete or move an active task first' : 'Move to Active Tasks'} onClick={() => void changeStatus(t, 'active')}><ArrowRight size={15}/>Activate</button><button className="icon-btn icon-btn-small" title="Import sessions JSON" onClick={() => setImportSessionModal({ taskId: t.id })}><Upload size={16}/></button><button className="icon-btn icon-btn-small" title="Edit task and resources" onClick={() => setTaskModal({ task: t, creating: false })}><Edit3 size={16}/></button><button className="icon-btn icon-btn-small" title="Delete task" onClick={() => void deleteTask(t)}><Trash2 size={16}/></button></div></td></tr>)}</tbody>
          </table>{backlog.length === 0 && <div className="empty-table">No items match your search. Add a future learning task to your Backlog.</div>}</div>
          <div className="capacity-note"><BookOpen size={16}/><span>Backlog is unlimited. You can save a resource URL and a descriptive note for each task, then activate it without re-entering anything.</span></div>
        </section>}
        {tab === 'completed' && <section className="tab-content"><div className="section-header"><div><h2>Completed Learning</h2><p>Review completed sessions, time spent and the actual date each task was finished.</p></div></div>
          <div className="active-grid">{completed.map(t => <CompletedCard key={t.id} task={t} onReopen={() => void changeStatus(t, 'active')} onDelete={() => void deleteTask(t)} onImportSessions={() => setImportSessionModal({ taskId: t.id })}/>)}</div>
          {completed.length === 0 && <div className="empty-state"><CheckCircle2 size={28}/><h3>Your first milestone is ahead</h3><p>Finish all learning sessions in an active task and it will appear here with its completion date.</p></div>}
        </section>}
      </>}
      <footer className="site-footer"><span>FocusFlow · Built for consistent, thoughtful learning</span><span>Stored locally in this browser · Export your data regularly</span></footer>
    </main>
    {notice && <div className="toast" role="status"><CheckCircle2 size={17}/>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={16}/></button></div>}
    {taskModal && <TaskForm key={`${taskModal.task.id}-${taskModal.task.status}`} initial={taskModal.task} creating={taskModal.creating} onClose={() => setTaskModal(null)} onSave={saveTask}/>}
    {importSessionModal && tasks?.find(t => t.id === importSessionModal.taskId) && <SessionImportDialog task={tasks.find(t => t.id === importSessionModal.taskId)!} onClose={() => setImportSessionModal(null)} onImport={raw => importSessions(importSessionModal.taskId, raw)}/>}
    {sessionModal && <SessionForm key={sessionModal.session.id} initial={sessionModal.session} creating={sessionModal.creating} onClose={() => setSessionModal(null)} onSave={session => saveSession(sessionModal.taskId, session)} onDelete={sessionId => deleteSession(sessionModal.taskId, sessionId)}/>}
  </div>;
}
//#197577
# FocusFlow — Personal Learning Tracker

A small **frontend-only** React + TypeScript learning dashboard, inspired by the three-tab LMS layout.

## Run locally

Requires Node.js 20.19+ (or 22+).

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

Create a production build:

```bash
npm run build
npm run preview
```

Publish the generated `dist/` directory on **GitHub Pages**, **Cloudflare Pages**, or another static hosting service. Vite uses a relative asset base (`./`) so static subpath hosting is supported.

## How it works

### Three tabs, one task record

Each task has one `status` field: `backlog`, `active`, or `completed`. Moving between tabs updates this field; it **does not** duplicate the task. All sessions and resource notes remain attached to the same object.

- **Active Tasks**: maximum **5** tasks. Sort by priority, nearest deadline, or name. Priorities can be changed directly on the card. Learning sessions appear immediately beneath the task, with completion checkboxes.
- **Backlog**: unlimited tasks. Shows priority, estimated hours, optional deadline, a resource link, and free-text resource note. Activate an item to move it to the main dashboard. If the task lacks a deadline, the edit dialog asks you to set one before activation.
- **Completed**: each task shows individual sessions, total estimated hours, actual logged study time, and the **completion date**. Completed tasks can be reopened if an active slot is available; reopening unchecks the last finished session to make the task actionable again while preserving other sessions.

When the **last session** of an active task is checked, the task automatically moves to Completed and receives today's date. You can also mark a task complete from its “…” menu.

### Time / progress

- Per-session estimated and actual hours are editable with the pencil icon.
- When a task has sessions, estimated task hours are derived from the **sum of session estimates**. Before sessions are added, the task's planned hours are used.
- Task completion percentage is **estimated-duration weighted**, rather than based on actual time spent. This avoids showing 100% simply because studying took longer than expected.
- The dashboard's “Study time logged” metric sums actual minutes for *all* tasks, including completed ones.

### Data persistence and backup

Data is stored in this browser using **IndexedDB (Dexie)**. The project comes with editable *demo tasks* on the first load; they are inserted only once.

Use **Export** for a `.json` backup and **Import** to restore one. Import **replaces** all current tasks and asks for confirmation. The app has no user accounts, backend, tracking service, or automatic multi-device sync. Clearing site data or changing browsers can remove local data, so keep backups.

## File guide

- `src/App.tsx`: UI, interactions, validation, import/export.
- `src/types.ts`: task/session schema, progress and date calculations.
- `src/db.ts`: IndexedDB / Dexie persistence and first-time initialization.
- `src/seed.ts`: editable demo tasks.
- `src/styles.css`: responsive styling.

## Possible next steps

Timer, weekly statistics, importing a CSV reading list, PWA/offline support, or authenticated sync with a cloud database. Those are intentionally excluded from the first version.

## Import Sessions JSON (per task)

Click **Import JSON** beside **Learning sessions** on an Active/Completed card, or use the upload icon in a Backlog row. Paste JSON or choose a `.json` file; preview new, duplicate, and invalid rows, then confirm. This is **different from the top-bar Import**, which restores a full backup and replaces all tasks.

Example (`estimatedHours` is a number, not a string):

```json
[
  {"title": "Ch 8 — Returns", "estimatedHours": 1},
  {"title": "Ch 8 — Rolling Statistics", "estimatedHours": 1.5, "notes": "Implement rolling variance", "resourceUrl": "https://example.com"}
]
```

Also accepts `{ "sessions": [...] }`. Instead of `estimatedHours`, each row may specify `estimatedMinutes` (but not both). `title` and one duration field are required. `notes` and `resourceUrl` are optional. URL must be HTTP(S).

- Matches duplicates by session title after trimming whitespace, collapsing repeated spaces, and case folding. Both duplicates already present in the task and duplicates in the input are skipped.
- Any invalid row blocks the import until corrected. Maximum 1,000 entries per import.
- Existing sessions (including completed dates, logged hours, notes, and links) are untouched. New rows get new IDs and start incomplete, with 0 actual minutes.
- Imports update only the chosen task inside an IndexedDB transaction. Existing sessions remain in their original order; new sessions append at the end.
- Importing new rows into a **Completed** task returns that task to **Backlog** so the archive does not incorrectly mark the new work as finished. Previously completed sessions remain completed.
- Export a JSON backup before major changes. The top-bar **Import** still replaces the full task collection.

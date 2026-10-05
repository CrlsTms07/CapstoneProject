# ERCIHS Class Scheduling System – project conventions

PERN capstone (PostgreSQL, Express 5, React 18 + Vite + Tailwind) for Emmanuel Resurreccion
Congressional Integrated High School. `docs/FEATURE_MAP.md` maps every HIPO module to its files and
endpoints – read it first, and update it whenever you add or move a page, route or endpoint.

## Layout

```
server/                      Express API (npm run dev → :5000)
  server.js                  entry point: runs the migrations, then listens
  src/app.js                 Express app; mounts every module router, labeled with its HIPO number
  src/modules/<module>/      one folder per feature
  src/config/                database pool, mailer
  src/middleware/            RBAC: authenticate, authorize(...ROLES), scopeToDepartment (req.scope)
  src/utils/httpError.js     HttpError + sendError/handle: PostgreSQL errors -> readable 4xx (409 on conflicts / blocked deletes)
  src/db/migrations/         schema changes run at startup (incl. DB-level conflict guards)
  src/db/seeds/              npm run db:init (tables, roles, admin account)
  tests/unit/                npm run test:unit (node:test, no database)
  tests/integration/         npm run test:integration (real API + a separate <DB_NAME>_test database)
  tests/db/                  npm run test:db (smoke tests on the real database, rolled back)
client/                      React app (npm run dev → :5175, proxies /api to :5000)
  src/features/<module>/     pages + module-specific CSS
  src/components/, src/styles/   shared layout and styles
docs/FEATURE_MAP.md
```

## Module names (same on client and server – do not invent new ones)

auth (2.0) · dashboard (3.1) · schedules (3.2, also 8.0) · teachers (3.3) · sections (3.4) ·
subjects (4.1) · rooms (4.2) · users (4.3) · approvals (5.0) · reports (6.0) · exports (7.0) ·
profile (9.0) · public (10.0)

## Server module rules

- Each module has `<module>.routes.js`, `<module>.controller.js`, `<module>.service.js`,
  `<module>.validation.js`. Extra resources inside a module use the same suffixes with the resource
  name, e.g. `rooms/buildings.routes.js`, `schedules/classPrograms.controller.js`.
- routes = paths + auth middleware only · controller = req/res and HTTP status codes ·
  service = SQL / data access · validation = pure checks, no DB.
- Many controllers still contain inline SQL; when you touch one, move its SQL into the service.
- Errors go through `sendError` / `handle` from `src/utils/httpError.js`. Delete handlers pass
  `{ action: "delete" }` so a record still used by schedules (ON DELETE RESTRICT) answers 409, not 500.
- **Conflict detection** belongs only in `src/modules/schedules/conflict.service.js` (API) and the
  database guards (`scheduleConflictGuards.migration.js`, replaced in place by `entryTeachers.migration.js`).
  Change both together.
- Schedules live in `schedule_entries` (term, section, subject, primary `teacher_id`, room, `delivery_mode`,
  day, `start_min`–`end_min` in minutes after midnight, status draft → pending → approved / rejected).
  All 1–2 teachers of a class are in `entry_teachers` (a trigger keeps the primary teacher in it).
  Times come from `time_templates` / `time_template_slots`; `department_time_rules` is no longer read.
  The older `jhs_class_program_*` and `schedules` tables are no longer written to; their rows were copied once.
- **Migrations:** never edit an existing migration and never delete data; add a new `*.migration.js`,
  make it safe to run on every start, and register it in `src/db/migrations/index.js`.
- New routers are mounted in `server/src/app.js` with a `// HIPO x.x` comment. Order matters:
  `/api/roles/public` before `/api/roles`.
- Role IDs are hardcoded: 1 admin, 2 grade level chairperson, 3 master teacher, 4 teacher. In code use
  `ROLES.ADMIN`, `ROLES.CHAIR`, `ROLES.MASTER_TEACHER`, `ROLES.TEACHER` from `authMiddleware.js`.
- Every router except `/api/public`, `/api/roles/public` and the login / recovery endpoints starts with
  `router.use(authenticate)`; writes add `authorize(...)`. Planning routes add `scopeToDepartment`.

## Scheduling Rules

Source of truth: the school's real class programs (JHS Grade 7 – Honesty and SHS ABM 12-1, S.Y. 2026-2027).
Schedules, the plotter, Auto-Generate and every export must follow these layouts.

**Junior High School (Grades 7–10)**
- Two day patterns: `MON_THU` (one schedule repeated Monday–Thursday) and `FRI` (its own times).
- Periods have different lengths; the times come from a time template, never from a fixed period length.
  Grade 7 example:
  - MON_THU: 06:30–07:15 (45), 07:15–08:00 (45), 08:00–09:20 (80), BREAK 09:20–09:40 (20),
    09:40–10:25 (45), 10:25–11:45 (80), 11:45–12:30 (45), LUNCH 12:30–12:50 (20), 12:50–14:10 (80),
    14:10–14:55 (45), 14:55–15:40 (45), 15:40–16:25 (45)
  - FRI: 06:30–07:10 (40), 07:10–07:50 (40), 07:50–09:10 (80), BREAK 09:10–09:30 (20), 09:30–10:10 (40),
    10:10–11:30 (80), 11:30–12:10 (40), LUNCH 12:10–12:30 (20), 12:30–13:50 (80), 13:50–14:30 (40),
    14:30–15:10 (40), 15:10–15:50 (40), 15:50–16:30 (40) = HGP
- A section's subject order is the same every day; Friday follows the MON_THU order, then adds HGP
  (Homeroom Guidance), which is taught by the section's class adviser.
- One teacher per subject per section for the whole week.
- Printed layout: TIME | No. of Mins. | MONDAY–THURSDAY | TIME | No. of Mins. | FRIDAY | teacher.
  The teacher is printed once per row.

**Senior High School (Grades 11–12)**
- Each weekday (Monday–Friday) is plotted separately on a 30-minute grid.
- Grade 12 example: ASYNCHRONOUS 09:30–11:30, no class 11:30–12:30, face-to-face 12:30–14:30,
  BREAK 14:30–15:00, 15:00–17:00, 17:00–19:00.
- Entries are usually 2-hour blocks but can be 1 hour (e.g. Homeroom).
- An entry can have two teachers (co-teaching). Both are conflict-checked.
- Delivery mode is `face_to_face` or `asynchronous`. An asynchronous entry needs no room.
- Each subject has a display color. SHS uses Term + School Year (e.g. First Term, 2026-2027).
- A section has a strand (e.g. ABM), a class adviser and a co-adviser.

**Both**
- Totals per day (minutes and hours) are computed by the system, never typed.
- The header, signatories (Prepared by / Recommending Approval or Noted by / Conforme / Approved by,
  each with a position), DepEd Order references and the Doc Ref Code are admin-editable settings per
  department. Never hardcode them.
- Conflict detection compares minute ranges (`start_min`–`end_min`, half-open), never period numbers.

## Client rules

- Pages are PascalCase `.jsx` in `src/features/<module>/`; routes are declared in `src/App.jsx`.
- Tailwind scans `.jsx` comments too: words such as `static`, `hidden`, `block`, `fixed`, `flex`,
  `grid`, `table` in a comment add CSS to the bundle. Avoid them in comments.

## Every main file starts with its HIPO header

```js
// HIPO 3.2 – Schedule Plotter
// One line on what this file does.
```
Shared files use `// Shared – ...` instead.

## Workflow

- Never commit `server/.env` (use `server/.env.example`), `node_modules/` or `dist/`.
- Work on a branch; commit one module at a time with a `refactor(<module>):` / `feat(<module>):` prefix.
- Before committing, check that the server boots, `npm test` and `npm run test:db` pass and the client
  builds (`npx vite build`).

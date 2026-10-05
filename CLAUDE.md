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
- **Conflict detection** belongs only in `src/modules/schedules/conflict.service.js` (API) and
  `src/db/migrations/scheduleConflictGuards.migration.js` (database). Change both together.
- Schedules live in `schedule_entries` (term, section, subject, teacher, room, day, `start_min`–`end_min`
  in minutes after midnight, status draft → pending → approved / rejected). The older
  `jhs_class_program_*` and `schedules` tables are no longer written to; their rows were copied once.
- New routers are mounted in `server/src/app.js` with a `// HIPO x.x` comment. Order matters:
  `/api/roles/public` before `/api/roles`.
- Role IDs are hardcoded: 1 admin, 2 grade level chairperson, 3 master teacher, 4 teacher. In code use
  `ROLES.ADMIN`, `ROLES.CHAIR`, `ROLES.MASTER_TEACHER`, `ROLES.TEACHER` from `authMiddleware.js`.
- Every router except `/api/public`, `/api/roles/public` and the login / recovery endpoints starts with
  `router.use(authenticate)`; writes add `authorize(...)`. Planning routes add `scopeToDepartment`.

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

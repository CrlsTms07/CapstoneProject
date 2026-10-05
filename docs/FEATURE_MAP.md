# Feature Map – ERCIHS Class Scheduling System

This document maps every module of the HIPO diagram to the code that implements it.

- **Client** (React + Tailwind): `client/src/features/<module>/`
- **Server** (Express + PostgreSQL): `server/src/modules/<module>/`

The client and server use the same module names. Every main source file starts with a comment naming
its HIPO module, for example `// HIPO 3.2 – Schedule Plotter`.

Access levels used below: **Public** = no login · **Signed-in** = any logged-in role ·
**Admin** · **Chair** = Grade Level Chairperson · **MT** = Master Teacher.

## Module map

| HIPO | Module | Client files (page URL) | Server files | API endpoints (access) |
|---|---|---|---|---|
| 2.0 | Login | `features/auth/Login.jsx` (`/login`)<br>`features/auth/Signup.jsx` (`/signup`)<br>`features/auth/ForgotPassword.jsx` (`/forgot`)<br>`features/auth/ChangePasswordRequired.jsx` (`/change-password-required`)<br>`features/auth/login.css` | `modules/auth/auth.routes.js`<br>`auth.controller.js`<br>`auth.service.js`<br>`auth.validation.js`<br>`passwordReset.routes.js`<br>`passwordReset.controller.js` | `POST /api/auth/login` (Public)<br>`POST /api/auth/signup` (Public)<br>`GET /api/auth/me`<br>`POST /api/auth/logout`<br>`POST /api/auth/change-password` (Signed-in)<br>`POST /api/password-reset-requests` (Public)<br>`GET /api/password-reset-requests` (Admin)<br>`POST /api/password-reset-requests/:id/:decision` (Admin) |
| 3.1 | Dashboard | `features/dashboard/AdminDashboard.jsx` (`/admin`)<br>`ChairDashboard.jsx` (`/chair`)<br>`MasterTeacherDashboard.jsx` (`/master-teacher`)<br>`TeacherDashboard.jsx` (`/teacher`) | `modules/dashboard/README.md` (no endpoints of its own) | Uses other modules' endpoints: `/api/teachers`, `/api/sections`, `/api/subjects`, `/api/schedule-approvals`, `/api/users/pending`, `/api/password-reset-requests` |
| 3.2 | Schedule Plotter (real-time conflict detection) | `features/schedules/SchedulePlotter.jsx` (`/plot-schedule`)<br>`features/schedules/schedulePlotter.css` | `modules/schedules/classPrograms.routes.js`<br>`classPrograms.controller.js`<br>`classPrograms.errors.js`<br>`schedules.routes.js`<br>`schedules.controller.js`<br>`schedules.service.js`<br>`schedules.validation.js`<br>**`conflict.service.js`**<br>`timeSlots.routes.js`<br>`timeSlots.controller.js` | `GET /api/class-programs/section/:sectionId` (Admin, Chair)<br>`POST /api/class-programs/validate` (Admin, Chair) – live conflict check<br>`POST /api/class-programs` (Admin, Chair) – save draft / submit<br>`GET /api/schedules`, `GET /api/schedules/:id` (Signed-in)<br>`POST`, `PUT /api/schedules/:id` (Admin, Chair, MT)<br>`DELETE /api/schedules/:id` (Admin)<br>`/api/time-slots` CRUD (Public) |
| 3.3 | Manage Teacher (teaching-related tasks, load) | `features/teachers/Teachers.jsx` (`/teachers`) | `modules/teachers/teachers.routes.js`<br>`teachers.controller.js`<br>`teachers.service.js`<br>`teachers.validation.js` (load 4–5, ancillary tasks)<br>`teacherTasks.routes.js`<br>`teacherTasks.controller.js`<br>`teacherTasks.service.js` | `GET /api/teachers`, `/api/teachers/:id` (Signed-in)<br>`POST`, `PUT /api/teachers/:id` (Admin, Chair, MT)<br>`DELETE /api/teachers/:id` (Admin)<br>`/api/teacher-tasks` – same access pattern |
| 3.4 | Manage Section | `features/sections/Sections.jsx` (`/sections`) | `modules/sections/sections.routes.js`<br>`sections.controller.js`<br>`sections.service.js`<br>`sections.validation.js`<br>`gradeLevels.routes.js`<br>`gradeLevels.controller.js`<br>`departments.routes.js`<br>`departments.controller.js` | `/api/sections` CRUD (Public)<br>`/api/grade-levels` CRUD (Public)<br>`/api/departments` CRUD (Public) |
| 4.1 | Subjects | `features/subjects/Subjects.jsx` (`/subjects`) | `modules/subjects/subjects.routes.js`<br>`subjects.controller.js`<br>`subjects.service.js`<br>`subjects.validation.js` | `/api/subjects` CRUD (Public) |
| 4.2 | Rooms & Buildings | `features/rooms/Rooms.jsx` (`/rooms`) | `modules/rooms/rooms.routes.js`<br>`rooms.controller.js`<br>`rooms.service.js`<br>`rooms.validation.js`<br>`buildings.routes.js`<br>`buildings.controller.js` | `/api/rooms` CRUD (Public)<br>`/api/buildings` CRUD (Public) |
| 4.3 | Users & Roles (admin only) | `features/users/Users.jsx` (`/users`) | `modules/users/users.routes.js`<br>`users.controller.js`<br>`users.service.js`<br>`users.validation.js`<br>`roles.routes.js`<br>`roles.public.routes.js`<br>`roles.controller.js` | `/api/users` CRUD (Admin)<br>`GET /api/users/pending` (Admin)<br>`POST /api/users/:id/approve` (Admin)<br>`GET /api/roles`, `/api/roles/:id` (Signed-in)<br>`POST`, `PUT`, `DELETE /api/roles` (Admin)<br>`GET /api/roles/public`, `/api/roles/public/:id` (Public) |
| 5.0 | Approvals (approve/reject + audit trail) | `features/approvals/ScheduleApprovals.jsx` (`/schedule-approvals`)<br>`features/approvals/SubmittedSchedules.jsx` (`/submitted-schedules`) | `modules/approvals/classProgramReview.routes.js`<br>`classProgramReview.controller.js`<br>`approvals.routes.js`<br>`approvals.controller.js`<br>`approvals.service.js`<br>`approvals.validation.js` | `GET /api/class-programs/pending` (Admin)<br>`PUT /api/class-programs/:programId/review` (Admin)<br>`GET /api/schedule-approvals`, `/:id` (Signed-in)<br>`POST /api/schedule-approvals` (Admin, Chair, MT)<br>`PUT`, `DELETE /api/schedule-approvals/:id` (Admin) |
| 6.0 | Reports | `features/reports/Reports.jsx` (`/reports`) – placeholder page | `modules/reports/README.md` – not implemented yet | — |
| 7.0 | Export PDF/CSV | `features/exports/README.md`; current CSV export and print-to-PDF are in `features/schedules/SchedulePlotter.jsx` | `modules/exports/README.md` – no server export yet | — (runs in the browser) |
| 8.0 | View Personal Schedule (teacher) | `features/dashboard/TeacherDashboard.jsx` (`/teacher`) – placeholder cards | `modules/schedules/schedules.controller.js` (`getSchedules` returns only the teacher's own rows for the Teacher role) | `GET /api/schedules` (Signed-in) |
| 9.0 | View Profile | `features/profile/README.md` – not implemented yet | `modules/profile/README.md` – not implemented yet | Related: `GET /api/auth/me` |
| 10.0 | Guest schedule view (filter by department, section) | `features/public/PublicView.jsx` (`/`)<br>`features/public/publicView.css` | `modules/public/public.routes.js`<br>`public.controller.js`<br>`public.service.js`<br>`public.validation.js` | `GET /api/public/schedules?department_id=&section_id=` (Public) |

All client paths are relative to `client/src/` and all server paths to `server/src/`. A file listed
without a folder is in the same folder as the line above it.

## Where conflict detection lives (HIPO 3.2)

Conflicts are checked at three levels:

| Level | File | What it does |
|---|---|---|
| Browser (real time) | `client/src/features/schedules/SchedulePlotter.jsx` | 350 ms after each edit, sends the draft to `POST /api/class-programs/validate` and lists conflicts and teacher-load warnings |
| API | `server/src/modules/schedules/conflict.service.js` | `findClassProgramConflicts` – teacher / room / section overlaps for 45-minute JHS periods, against saved schedules and within the draft<br>`getTeacherLoadWarnings`, `getTeacherWarnings` – distinct subjects per teacher compared with `max_subject_load` (default 5)<br>`findLegacyScheduleConflict` – teacher / room / section clash on the same day and time slot for `/api/schedules` |
| Database | `server/src/db/migrations/scheduleConflictGuards.migration.js` | GiST exclusion constraints that block overlapping JHS entries for the same teacher, room or section, plus triggers that check `schedules` rows against each other and against JHS entries |

## Shared code

| Concern | Location |
|---|---|
| Server entry point and route mounting | `server/server.js` |
| Database connection | `server/src/config/database.js` |
| Email (account recovery) | `server/src/config/mailer.js` |
| Login and role checks | `server/src/middleware/authMiddleware.js` (`authenticateUser`, `authorizeRoles`) |
| Startup schema migrations | `server/src/db/migrations/` |
| First-time setup (tables, roles, admin) | `server/src/db/seeds/init_database.js` – `npm run db:init` |
| Database tests | `server/tests/db/` – `npm run test:db` |
| Original ERD schema (reference only, outdated) | `server/src/db/reference/class_scheduling.sql` |
| Client routes | `client/src/App.jsx` |
| Page shell, sidebar, dashboard widgets | `client/src/components/` |
| Shared styles | `client/src/styles/` |

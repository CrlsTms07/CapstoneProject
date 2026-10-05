# HIPO 3.1 – Dashboard (server)

No dedicated endpoints yet. The role dashboards in `client/src/features/dashboard/` build their
metrics from existing module APIs:

| Dashboard | Calls |
|---|---|
| Admin | `GET /api/teachers`, `/api/sections`, `/api/subjects`, `/api/schedule-approvals`, `/api/users/pending`, `/api/password-reset-requests` |
| Grade Level Chairperson | `GET /api/teachers`, `/api/sections`, `/api/schedule-approvals` |
| Master Teacher | `GET /api/subjects`, `/api/teachers`, `/api/schedule-approvals` |
| Teacher | none (placeholder cards only) |

When a summary endpoint is added it goes here as `dashboard.routes.js`, `dashboard.controller.js`,
`dashboard.service.js` and `dashboard.validation.js`.

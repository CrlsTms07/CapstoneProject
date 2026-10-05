# HIPO 9.0 – View Profile (server)

**Not implemented yet.** The only related endpoints today are in `modules/auth`:

- `GET /api/auth/me` – the signed-in user's session data
- `POST /api/auth/change-password` – used for forced password changes after account recovery

A profile endpoint (view and update own name, email and password) goes here as `profile.routes.js`,
`profile.controller.js`, `profile.service.js` and `profile.validation.js`.

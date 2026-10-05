Deployment notes — Capstone-Project

Frontend (Vite + React)
- Recommended hosts: Vercel, Netlify
- Quick local build:
  - cd client
  - npm install
  - npm run build
  - serve the `dist/` folder (Netlify/Vercel do this automatically)

Vercel: connect repo → set root to `/client` (Framework: Other or Vite) → set `build` = `npm run build` and `output` = `dist`.

Backend (Express + Postgres)
- Recommended hosts: Railway, Render, Heroku
- Ensure environment variables are set: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `SESSION_SECRET`, `FRONTEND_URL`.

Account recovery email setup
- Configure `SYSTEM_ADMIN_EMAIL` with the ICT/System Administrator mailbox.
- Configure SMTP with `SMTP_HOST`, `SMTP_PORT` (usually `587`), `SMTP_SECURE` (`false` for STARTTLS on port 587, `true` for implicit TLS on port 465), `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM`.
- Set `ADMIN_DASHBOARD_URL` to the externally reachable admin dashboard URL used in recovery notifications. If omitted, it uses `${FRONTEND_URL}/admin`.
- Restart the backend after setting environment variables. Recovery requests are stored even if notification delivery fails; approval is not committed unless the temporary-password email is accepted by SMTP.
- The backend creates `password_reset_requests` and the temporary-password account columns at startup. Fresh database installations also get them from `server/scripts/init_database.js`.
- Temporary passwords expire after 24 hours and require the user to set a new password before protected portal API access is allowed.

Heroku quick steps:
1. Create app on Heroku.
2. Provision a Heroku Postgres add-on or connect an external Postgres instance.
3. Set environment variables in Heroku Settings.
4. Add a `Procfile` with: `web: node server.js` (Heroku will run `npm install` and then start).

Docker (optional):
- Backend: build from `server/Dockerfile` and run with env vars.
- Frontend: build from `client/Dockerfile` and serve.

If you want, I can prepare a `Procfile`, GitHub Actions CI, or a `render.yaml` for Render deployments.

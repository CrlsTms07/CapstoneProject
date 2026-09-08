Deployment notes — Capstone-Project

Frontend (Vite + React)
- Recommended hosts: Vercel, Netlify
- Quick local build:
  - cd front-end
  - npm install
  - npm run build
  - serve the `dist/` folder (Netlify/Vercel do this automatically)

Vercel: connect repo → set root to `/front-end` (Framework: Other or Vite) → set `build` = `npm run build` and `output` = `dist`.

Backend (Express + Postgres)
- Recommended hosts: Railway, Render, Heroku
- Ensure environment variables are set: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `SESSION_SECRET`, `FRONTEND_URL`.

Heroku quick steps:
1. Create app on Heroku.
2. Provision a Heroku Postgres add-on or connect an external Postgres instance.
3. Set environment variables in Heroku Settings.
4. Add a `Procfile` with: `web: node server.js` (Heroku will run `npm install` and then start).

Docker (optional):
- Backend: build from `back-end/Dockerfile` and run with env vars.
- Frontend: build from `front-end/Dockerfile` and serve.

If you want, I can prepare a `Procfile`, GitHub Actions CI, or a `render.yaml` for Render deployments.

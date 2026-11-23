# COSMOLIB — Global AI Study Computer

> All-in-One Global AI Study app: Smart Study Folders, Exam Panic Mode, Ultra-Block Focus Timer, Silent Live-Cam Group Hub.

**Repo:** `nexlivestudy/cosmolib-app` — **Public** student project for learning full-stack development.
**Stack:** React 19 + Vite + Tailwind 4 + Express + Supabase + Gemini AI + PWA
**Live:** https://cosmolib.is-a.dev (via Render, custom domain)

## Features
- Onboarding Wizard (Country, Daily Target, Vibe Check, Degree → Branch → University cascade)
- Study Folders Module, Exam Panic Module (PDF drag-drop + Upload, no new-tab bug)
- Focus Timer, Group Hub (PeerJS silent live-cam), PWA installable
- Security: CSP, HSTS (prod), rate-limit 25/min on AI endpoints, BYOK support, .env never committed

## Quick Start
```bash
npm install
cp .env.example .env
# fill GEMINI_API_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm run build
npm start  # prod on PORT (default 3000, listens 0.0.0.0)
```
Dev: `npm run dev` (tsx server.ts + Vite middleware)

## Env
See `.env.example`:
- `GEMINI_API_KEY` — server AI, inject via Render Secrets (never commit)
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — Supabase project
- `APP_URL` — production URL https://cosmolib.is-a.dev (Render custom domain)
- `PORT`, `NODE_ENV=production`

## Deploy Plan (Render + is-a.dev)
1. Render Web Service from this repo, Build: `npm install && npm run build`, Start: `npm start`
2. DNS: `cosmolib.is-a.dev` A 216.24.57.1 via is-a-dev PR #62538
3. Render Dashboard > Settings > Custom Domains > add cosmolib.is-a.dev, verify SSL
4. Set Supabase Auth redirect allow-list to https://cosmolib.is-a.dev + localhost
5. Auto-Deploy ON: every push to main rebuilds and updates https://cosmolib.is-a.dev

## Project Structure
`src/components/`, `src/data/catalog.ts`, `src/utils/pdfUtils.ts + studyLogic.ts`, `src/lib/aiClient.ts + supabase.ts`, `server.ts`, `vite.config.ts (PWA)`, `public/`

## Security
Public repo for learning. See SECURITY.md. Report issues via GitHub Issues. No secrets in git history.

## License
MIT — see LICENSE. © nexlivestudy.
# COSMOLIB — Global AI Study Computer

> All-in-One Global AI Study app: Smart Study Folders, Exam Panic Mode, Ultra-Block Focus Timer, Silent Live-Cam Group Hub.

**Repo:** `cosmolibstudy/cosmolib-app` — **Public** student project for learning full-stack development.
**Stack:** React 19 + Vite + Tailwind 4 + Express + Supabase + Gemini AI + PWA
**Live:** https://cosmolib.is-a.dev (via Render, custom domain)

## Features
- Onboarding Wizard (Country, Daily Target, Vibe Check, Degree → Branch → University cascade)
- Study Folders Module, Exam Panic Module (PDF drag-drop + Upload, no new-tab bug)
- Focus Timer, Group Hub (PeerJS silent live-cam), PWA installable
- Security: CSP, HSTS (prod), rate-limit 25/min on AI endpoints, BYOK support, .env never committed

## Quick Start
```bash
npm install
cp .env.example .env
# fill GEMINI_API_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm run build
npm start  # prod on PORT (default 3000, listens 0.0.0.0)
```
Dev: `npm run dev` (tsx server.ts + Vite middleware)

## Env
See `.env.example`:
- `GEMINI_API_KEY` — server AI, inject via Render Secrets (never commit)
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — Supabase project
- `APP_URL` — production URL https://cosmolib.is-a.dev (Render custom domain)
- `PORT`, `NODE_ENV=production`

## Deploy Plan (Render + is-a.dev)
1. Render Web Service from this repo, Build: `npm install && npm run build`, Start: `npm start`
2. DNS: `cosmolib.is-a.dev` A 216.24.57.1 via is-a-dev PR #62538
3. Render Dashboard > Settings > Custom Domains > add cosmolib.is-a.dev, verify SSL
4. Set Supabase Auth redirect allow-list to https://cosmolib.is-a.dev + localhost
5. Auto-Deploy ON: every push to main rebuilds and updates https://cosmolib.is-a.dev

## Project Structure
`src/components/`, `src/data/catalog.ts`, `src/utils/pdfUtils.ts + studyLogic.ts`, `src/lib/aiClient.ts + supabase.ts`, `server.ts`, `vite.config.ts (PWA)`, `public/`

## Security
Public repo for learning. See SECURITY.md. Report issues via GitHub Issues. No secrets in git history.

## License
MIT — see LICENSE. © cosmolibstudy.

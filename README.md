# NEXLIVE — Global AI Study Computer

> All-in-One Global AI Study app: Smart Study Folders, Exam Panic Mode, Ultra-Block Focus Timer, Silent Live-Cam Group Hub.

**Repo:** `nexlivestudy/nexlive-app` — **Private** by default for worldwide privacy.
**Stack:** React 19 + Vite + Tailwind 4 + Express + Supabase + Gemini AI + PWA

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
- `GEMINI_API_KEY` — server AI, inject via hosting Secrets (never commit)
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — Supabase project
- `APP_URL` — production URL (Cloudflare domain - activating tomorrow)
- `PORT`, `NODE_ENV=production`

## Deploy Plan (tomorrow)
1. Cloudflare free domain (1yr) → DNS → Oracle Cloud free server (full performance)
2. Point domain to Oracle public IP, TLS via Cloudflare, HSTS already enabled in server.ts
3. Set Supabase Auth redirect allow-list to production domain + localhost
4. `NODE_ENV=production npm run build && npm start`

## Project Structure
`src/components/`, `src/data/catalog.ts`, `src/utils/pdfUtils.ts + studyLogic.ts`, `src/lib/aiClient.ts + supabase.ts`, `server.ts`, `vite.config.ts (PWA)`, `public/`

## Security
Private repo. See SECURITY.md. Report issues privately. No secrets in git history.

## License
MIT — see LICENSE. © nexlivestudy.

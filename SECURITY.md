# Security Policy - NEXLIVE (Global App)

Repo is Private. Do not share invites publicly.

## Reporting
Do not open public issues for secrets/vulns. Contact repo owner privately via GitHub.

## Rules for worldwide launch
- Never commit .env, GEMINI_API_KEY, Supabase service_role key. Only .env.example with placeholders.
- .gitignore already blocks .env*. Rotate keys if ever leaked.
- Prod must run with NODE_ENV=production (enables HSTS, strict CSP in server.ts).
- AI endpoints rate-limited 25/min/IP. Keep limit, add Cloudflare WAF tomorrow.
- Supabase: set Auth redirect allow-list to Cloudflare domain + localhost only.
- PWA + HTTPS only (Cloudflare TLS). Camera allowed self-only, mic blocked via Permissions-Policy.

## Supported
- main branch only until v1 launch. Security fixes ASAP.

# Framewrk API Worker

The no-n8n backend for Framewrk: Cloudflare Worker + D1 + Queues (+ R2
later). See `docs/specs/framewrk-build-spec.md` at the repo root for the
full design.

R2 (file storage for generated site files) is deliberately not provisioned
yet — Cloudflare requires adding a billing subscription to use R2 even on
the free tier, and nothing built so far needs it. It'll be added back once
the site-generation/deploy stages are built.

This is stage 1 of the build order: D1 schema, prospect CRUD, and the
Google Maps link parser. The queue consumer currently just acknowledges
jobs (logs and `ack()`s) — the actual pipeline stages (brand design, asset
sourcing, site generation, deploy, QA, outreach prep, handover) land next.

## What works right now

- `POST /prospects` — paste a Google Maps/Business Profile URL, get back a
  structured prospect record (business name/address/phone/photo refs
  looked up via the Places API if `GOOGLE_PLACES_API_KEY` is set; falls
  back to just the URL-derived business name if not)
- `GET /prospects` / `GET /prospects/:id` — list/detail
- `POST /prospects/:id/mark-lost`
- `POST /prospects/:id/build` — creates a `build` row and enqueues the
  first pipeline stage (`brand-design`)
- `GET /builds/:id` / `GET /builds/:id/jobs`
- Bearer token auth on every route except the (stubbed) Stripe webhook

## Local development (no Cloudflare account needed)

```bash
npm install
cp .dev.vars.example .dev.vars   # set FRAMEWRK_DASHBOARD_TOKEN to any string
npm run db:migrate:local
npm run dev
```

Then, in another terminal:

```bash
curl -X POST http://localhost:8787/prospects \
  -H "Authorization: Bearer <your .dev.vars token>" \
  -H "Content-Type: application/json" \
  -d '{"google_maps_url":"https://www.google.com/maps/place/Some+Business/@40.7,-74.0,17z"}'
```

Local D1/Queues/R2 are all emulated by `wrangler dev` — nothing here talks
to a real Cloudflare account until you deploy.

## What's needed to deploy for real

Two ways to do this. Either way, the *first-time* creation of the D1
database and Queue is a one-time dashboard/CLI action — it can't happen
via git push. (R2 is skipped for now — see note above.)

### Option A — Cloudflare's GitHub integration ("Workers Builds")

Recommended if you want every push to auto-deploy with no local CLI use.

1. **Create the resources** (Cloudflare dashboard → Workers & Pages):
   - **D1** → Create database → name it `framewrk-db` → copy the
     **Database ID** it shows you.
   - **Queues** → Create queue → name it `framewrk-build-pipeline`.
2. **Connect this repo:** Workers & Pages → Create → Workers → "Connect to
   Git" → select `kaicodesai/framewrk`.
   - **Root directory:** `framewrk`
   - **Build command:** `npm install`
   - **Deploy command:** `npx wrangler d1 migrations apply framewrk-db --remote && npx wrangler deploy`
   - **Branch:** whichever branch you want auto-deployed
3. **Send me the D1 Database ID** from step 1 — I'll paste it into
   `wrangler.toml` and push. Cloudflare picks up the change and deploys
   automatically; nothing further needed from this session.
4. **Set secrets** on that Worker's Settings → Variables and Secrets page
   (encrypted, dashboard-only, never touches this repo):
   `FRAMEWRK_DASHBOARD_TOKEN`, `OPENROUTER_API_KEY`, `GOOGLE_PLACES_API_KEY`,
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.

### Option B — local CLI (`wrangler login` on your own machine)

```bash
wrangler login
wrangler d1 create framewrk-db            # → paste database_id into wrangler.toml
wrangler queues create framewrk-build-pipeline
npm run db:migrate:remote
wrangler secret put FRAMEWRK_DASHBOARD_TOKEN
wrangler secret put OPENROUTER_API_KEY
wrangler secret put GOOGLE_PLACES_API_KEY
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
npm run deploy
```

Note: this session's sandbox cannot reach `api.cloudflare.com` directly (its
network egress policy blocks it), so I can't run either option's Cloudflare
API calls myself even with a token — one of the two paths above has to
happen on your side.

## Not built yet

- The queue consumer's actual pipeline stages (brand-design through
  handover) — build order tasks 3–9 in the build spec
- The dashboard frontend (Cloudflare Pages, React/Vite/Tailwind)
- Stripe payment link creation + webhook handling

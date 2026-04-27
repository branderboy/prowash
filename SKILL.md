---
name: build-tagglefish-os
description: Use when building or extending Tagglefish OS — the client-facing CMS/operations dashboard at /os in this Next.js repo. Triggers on requests to build, scaffold, or extend any of the five Taggle OS modules (Content Manager, SEO Manager, Lead Manager, Review Manager, Growth Operator OS), the /os shell, multi-tenant data, or client auth. Also triggers on phrases like "Taggle OS", "Tagglefish OS", "the OS", "build the CMS", "client dashboard".
---

# Build Tagglefish OS

Tagglefish OS is the **client-facing** product (lives at `/os`). It is separate from `/admin`, which is for TaggleFish staff. Marketing pages already exist at `/content-manager`, `/seo-manager`, `/lead-manager`, `/review-manager`, `/growth-operator-os` — read them first; the product must deliver what they promise.

## Stack invariants — do not change

- **Framework**: Next.js 14 App Router, TypeScript, server components by default
- **DB**: Neon Postgres via `@neondatabase/serverless` — always import `getDb` from `src/lib/db.ts`. Schema lives in `SCHEMA_SQL` in that file; extend it there, then run `POST /api/admin/setup` to apply.
- **Styling**: Tailwind with tokens `navy`, `orange`, `cream` (see `tailwind.config.ts`). Use existing shadcn-style primitives in `src/components/ui/`.
- **Email**: Resend via `src/lib/email.ts`. **SMS**: Twilio via `src/lib/sms.ts`. **Push**: OneSignal via `src/lib/push.ts`. **Billing**: Stripe via `src/lib/stripe.ts`. **Uploads**: Vercel Blob.
- **Custom domains**: `src/middleware.ts` rewrites non-internal hosts to `/_site/[path]`. Don't break this.
- **Auth today**: cookie-based `admin_auth` for `/admin`. `/os` needs its own cookie (`os_auth`) — do not reuse `admin_auth`.

## Architecture rules

1. **Two surfaces, one repo**:
   - `/admin/*` — TaggleFish staff only. Existing. Don't touch unless asked.
   - `/os/*` — clients log in here to operate their own marketing. New.
2. **Multi-tenant**: every `/os` query MUST be scoped by `client_id`. Resolve `client_id` from the session cookie in a single helper (`getOsSession()`); never trust client-supplied IDs.
3. **Roles**: `owner`, `manager`, `staff` (per-client). Gate writes behind a role check helper.
4. **Server-first**: server components + server actions where possible. Reach for client components only for editors, drag-and-drop, or live previews.
5. **Audit everything that mutates** — write to `audit_log` from server actions for any create/update/delete.
6. **Don't introduce new auth libraries.** Roll magic-link with Resend + signed cookie (HMAC `crypto.createHmac` over `client_id:user_id:exp`).
7. **No client-side secrets.** All third-party SDKs (Stripe, Twilio, Resend, OneSignal) stay server-side.

## Required data model additions

Extend `SCHEMA_SQL` in `src/lib/db.ts`. Reuse `clients` and `leads`; do not duplicate.

```sql
-- Users + memberships (multi-tenant identity)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS memberships (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','manager','staff')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, client_id)
);
CREATE TABLE IF NOT EXISTS magic_links (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content Manager
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  body_md TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','published')),
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  author_id INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, slug)
);

-- SEO Manager
CREATE TABLE IF NOT EXISTS keywords (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  phrase TEXT NOT NULL,
  location TEXT,
  intent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS rankings (
  id SERIAL PRIMARY KEY,
  keyword_id INTEGER NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  position INTEGER,
  url TEXT,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Review Manager
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  source TEXT NOT NULL,           -- 'google','facebook','manual'
  external_id TEXT,
  reviewer_name TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  body TEXT,
  responded_at TIMESTAMPTZ,
  response_body TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS review_requests (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('sms','email','both')),
  status TEXT NOT NULL DEFAULT 'queued',
  sent_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Growth Operator OS
CREATE TABLE IF NOT EXISTS goals (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  period TEXT NOT NULL,           -- 'YYYY-MM'
  revenue_target_cents INTEGER NOT NULL,
  avg_job_value_cents INTEGER NOT NULL,
  close_rate NUMERIC(4,3) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, period)
);
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  detail TEXT,
  due_on DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','snoozed')),
  source TEXT,                    -- 'bottleneck','manual','weekly'
  assigned_to INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_posts_client_status ON posts(client_id, status);
CREATE INDEX IF NOT EXISTS idx_keywords_client ON keywords(client_id);
CREATE INDEX IF NOT EXISTS idx_rankings_keyword_checked ON rankings(keyword_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_client_created ON reviews(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_requests_client_status ON review_requests(client_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_client_status ON tasks(client_id, status);
```

## Directory layout to create

```
src/app/os/
  layout.tsx                  # OS shell: sidebar + topbar + tenant switcher
  page.tsx                    # /os home — KPI cards across all 5 modules
  login/page.tsx              # email entry → magic link
  verify/page.tsx             # consumes ?token=... and sets os_auth cookie
  content/                    # Content Manager
    page.tsx                  # post list
    new/page.tsx
    [id]/page.tsx             # editor
    calendar/page.tsx
  seo/                        # SEO Manager
    page.tsx                  # keyword tracker
    pages/[slug]/page.tsx     # on-page editor (writes to site_pages)
  leads/                      # Lead Manager
    page.tsx                  # inbox
    [id]/page.tsx             # detail + reply
    templates/page.tsx
  reviews/                    # Review Manager
    page.tsx                  # review wall + sentiment
    request/page.tsx          # send a request
  growth/                     # Growth Operator OS
    page.tsx                  # goal + bottleneck + tasks

src/lib/os/
  session.ts                  # getOsSession(), requireOsSession(), requireRole()
  magic-link.ts               # createLink(), consumeLink()
  tenancy.ts                  # withClient<T>(fn) helper that scopes queries

src/app/api/os/
  auth/request/route.ts       # POST email → send magic link
  auth/verify/route.ts        # GET ?token=... → set cookie, redirect
  posts/route.ts              # CRUD
  ...                         # one route per resource as needed
```

## Conventions

- **Server actions over API routes** for first-party UI mutations. Reserve `/api/os/*` for webhooks and third-party callbacks.
- **One query helper per resource**, e.g. `listPosts(clientId)`, `getPost(clientId, id)` — never query directly from a page.
- **Validation at the boundary**: zod schema for every server action input. Reuse `src/lib/validation.ts` patterns.
- **Tailwind**: prefer existing tokens. Don't add new shades unless the design explicitly requires it.
- **No `'use client'` at the page level.** Push it down to the smallest interactive piece.
- **Loading + error**: every route with data needs `loading.tsx` and `error.tsx`.
- **Empty states**: every list view needs a designed empty state, not a blank page.

## Build order

Ship one PR per step. Don't combine.

1. **Auth + shell + migrations**
   - Add tables above to `SCHEMA_SQL`. Run `POST /api/admin/setup`.
   - `src/lib/os/session.ts`, `magic-link.ts`.
   - Update `src/middleware.ts` to gate `/os/*` (skip `/os/login`, `/os/verify`).
   - Build `/os/login`, `/os/verify`, and the `/os` shell layout with sidebar.
2. **Content Manager MVP** — posts CRUD, markdown editor, draft/schedule/publish, public render at `/_site/blog/[slug]` for the client's domain.
3. **Lead Manager MVP** — inbox view of `leads` scoped to client, status pipeline, reply via Resend/Twilio (log to `email_log`/`sms_log`), templates.
4. **Review Manager MVP** — `review_requests` send via SMS+email, `reviews` wall, response composer.
5. **SEO Manager MVP** — keyword + ranking tracker (manual entry first, scrape later), on-page editor that writes to `site_pages`.
6. **Growth Operator OS MVP** — monthly `goals`, derived bottleneck, weekly task generator into `tasks`.

Each step ends with: types build clean, page renders, mutation works end-to-end, audit log entry written.

## Hard rules

- Don't touch the public marketing pages under `src/app/*` (except `/_site/`).
- Don't break `/admin` or its middleware behavior.
- Don't push to `main` — work on the session branch.
- Don't add a new auth/ORM/UI library — use what's installed.
- Don't store plaintext magic-link tokens. Hash with `crypto.createHash('sha256')` before insert; compare hashed.
- Don't query without a `client_id` filter on any `/os` route. Add a runtime assertion in `withClient` that throws if `client_id` is missing.

## Before writing code

1. Read the marketing page for the module you're building (`src/app/<module>/page.tsx`) so the product matches the promise.
2. Read `src/lib/db.ts`, `src/middleware.ts`, and the closest existing `/admin/*` analog.
3. Propose data model + route map and get user approval before scaffolding.

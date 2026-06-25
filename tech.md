# Pro Wash Content Engine — Technical Design

Companion to `project-brief.md`. This describes the stack, data model,
integrations, and build phases. It stays consistent with the repo as it exists
today: a Vercel-hosted project with static pages and Node serverless functions
under `api/`.

## Stack

- **Hosting:** Vercel (already in use).
- **Frontend:** Single-page dashboard. Start with static HTML + vanilla JS to
  match the existing `dashboard.html`, move to a framework only if the UI grows.
  Tailwind via CDN for styling.
- **Backend:** Vercel serverless functions in `api/` (Node 18+, the same pattern
  as `api/create-checkout.js`).
- **Database:** Postgres (Vercel Postgres or Supabase). Holds ideas, content
  items, calendar, transactional records, and metrics.
- **Object/asset storage:** Google Drive for finished video; image files in
  Vercel Blob or the same Drive folder.
- **AI:** Claude API for idea generation, captions, hooks, hashtags, and image
  prompts. Image generation via an image model (see Integrations).
- **Scheduler/publisher:** Buffer (drafts via API, human posts).
- **Auth:** Simple email-based auth for two roles (operator, reviewer). NextAuth
  or a lightweight signed-session approach.

## High-level architecture

```
Dashboard (browser)
   |  fetch /api/*
   v
Vercel serverless functions (api/)
   |-- /api/ideas        generate idea batches per bucket (Claude)
   |-- /api/create       hook + caption + CTA + hashtags + image prompt (Claude)
   |-- /api/image        generate or fetch an image
   |-- /api/research     save research notes
   |-- /api/calendar     read/write the monthly plan
   |-- /api/assets       link Google Drive video, attach images
   |-- /api/buffer       push drafts to Buffer
   |-- /api/metrics      pull engagement/reach back
   |-- /api/transactional  scan + serve approved records only
   v
Postgres  +  Google Drive  +  Buffer  +  Claude/image APIs
```

## Data model (core tables)

- **buckets** — id, name (1 Lamond, 2 Vehicle, 3 Transactional, 4 Surveys, 5 SEO),
  creative_freedom.
- **ideas** — id, bucket_id, title, angle, source, status (`new` / `picked` /
  `discarded`), created_at.
- **research** — id, note, source, bucket_hint, created_by, created_at. Operator
  inbox that feeds idea generation.
- **content_items** — id, idea_id, bucket_id, channel, hook, caption, cta,
  hashtags[], image_prompt, image_url, video_url (Drive link), status
  (`draft` / `approved` / `scheduled` / `published` / `rejected`),
  scheduled_for, buffer_id.
- **transactional_records** — id, type (offer/service/program/location/hours/
  campaign), payload (JSON), source_ref, active. **Bucket 3 reads only from here.**
- **calendar_entries** — id, content_item_id, channel, date, slot.
- **metrics** — id, content_item_id, channel, impressions, reach, likes,
  comments, shares, saves, pulled_at.

## Status machine

```
draft  ->  approved  ->  scheduled (Buffer draft)  ->  published
   \-> rejected
```

The transition to `scheduled` calls the Buffer API and stores `buffer_id`.
`published` is set when a human posts (or when metrics confirm it went live).

## Integrations

### Claude API (generation)
- `/api/ideas`: given a bucket and count, return ideas. Bucket 3 is special: it
  must only propose items backed by `transactional_records`; if fewer exist than
  requested, return what is real and label the rest "No approved transactional
  content found."
- `/api/create`: given an idea + channel, return hook, caption, CTA, hashtags,
  image prompt, and (when relevant) a video prompt. Adapt length and hashtags
  per channel.
- Voice rules for Buckets 1, 2, 4, 5 come from the spec (first-person,
  neighborly, since 1997). Bucket 3 stays factual and never embellishes.
- Use the latest Claude model; keep prompts and the bucket rules in a shared
  system prompt so the "repo only" guard is always applied.

### Images (source or generate)
`/api/image` handles both paths and always returns an asset at the right size:

- **Source:** search a brand image library, the Pro Wash Google Drive, approved
  customer photos, or a stock provider (e.g. Pexels/Unsplash API) by keyword.
- **Generate:** when nothing fits, build a **sized photo prompt** and call an
  image model. The function takes `{ channel, format }`, maps it to the target
  dimensions and aspect ratio, and injects the brand palette (navy `#0A1E3D`,
  red `#B33A34`, soft blue `#E8F1FA`) into the prompt.

Channel size map (used to build the prompt and crop the output):

```
feed        1080x1080  1:1
reel/story  1080x1920  9:16
portrait    1080x1350  4:5
yt_thumb    1280x720   16:9
gmb         1200x900   4:3
```

Store the result (Vercel Blob or the monthly Drive folder) and link it to the
content item. The operator can swap a generated image for a real one before
approval. Start manual (upload only), add stock search next, then the image
model.

### Google Drive (video)
- OAuth to a Pro Wash Drive. Finished video lives in dated monthly folders.
- `/api/assets` stores the Drive file link on the content item. The platform
  references the link; it does not host the video.

### Buffer (scheduling, drafts only)
- `/api/buffer`: create drafts in the right Buffer channel with the per-channel
  caption, hashtags, and asset. Never auto-publish. Store `buffer_id`.
- GMB posts can be location-aware (one per location) using the five addresses.

### Stats (interesting-stats format)
- `/api/create` can output an **interesting-stats** post for any bucket (mostly
  Vehicle, Surveys & Debates, and searchable SEO angles).
- Every stat must be real and carry a source. Store `stat_value`, `stat_source`,
  and `stat_source_url` on the content item; reject a stats post with no source.
- Optional `stats_facts` table holds vetted, reusable stats (value, source, url,
  topic) so the generator pulls from approved facts instead of inventing numbers.

### Metrics
- `/api/metrics`: pull engagement and reach (from Buffer analytics or the
  platform APIs) and write to `metrics`. Surface per-bucket performance so the
  next batch leans into what works.

## The transactional guard (important)

Bucket 3 must never invent facts. Enforce it in two places:

1. **Data:** `/api/transactional` is the only source for Bucket 3. It reads
   `transactional_records` and nothing else.
2. **Prompt:** the Claude system prompt for Bucket 3 forbids inventing offers,
   prices, events, or updates and requires the "No approved transactional
   content found." response when there is no match.

A repository scanner (V2) can populate `transactional_records` from repo/business
sources (campaign files, automations, integrations, business facts).

## Security

- API keys (Claude, Buffer, Google, image model) in Vercel environment
  variables, never in the client.
- Two roles: operator (create/schedule) and reviewer (approve/publish).
- All AI generation passes through serverless functions so keys and the bucket
  rules stay server-side.

## Environment variables

```
ANTHROPIC_API_KEY
BUFFER_ACCESS_TOKEN
GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET / GOOGLE_DRIVE_REFRESH_TOKEN
IMAGE_API_KEY
DATABASE_URL
AUTH_SECRET
```

## Build phases

- **Phase 1 (MVP).** Postgres schema, dashboard shell, `/api/ideas` and
  `/api/create` (Claude), research inbox, monthly calendar UI, approval states.
  Buffer hand-off is manual (copy out).
- **Phase 2.** Buffer API drafts, Google Drive linking, image generation,
  per-channel formatting.
- **Phase 3.** Metrics pull-back and per-bucket reporting, repository scanner for
  transactional records, multi-location GMB scheduling.

## Repo layout (proposed)

```
/api
  ideas.js
  create.js
  image.js
  research.js
  calendar.js
  assets.js
  buffer.js
  metrics.js
  transactional.js
/lib
  claude.js          shared client + system prompts + bucket rules
  buffer.js          Buffer client
  drive.js           Google Drive client
  db.js              Postgres client
/public
  dashboard.html     content engine UI
project-brief.md
tech.md
```

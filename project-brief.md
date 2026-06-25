# Pro Wash Content Engine — Project Brief

## Summary

A web platform that runs the Pro Wash social media system every month. It
generates ideas across the five content buckets, helps create the captions and
images, holds research and video assets, builds a monthly calendar, pushes posts
to Buffer as drafts, tracks performance, and waits for human review before
anything goes live.

This is the operational tool behind the partnership proposal. The proposal sells
the method; this platform runs it.

## Goals

- Turn the five-bucket content system into a repeatable monthly workflow.
- Cut the time it takes to plan, write, and schedule a month of content.
- Keep a human in the loop. Nothing publishes without review.
- Never invent offers or business facts. Transactional content comes only from
  approved records.
- Track what works so each month gets sharper.

## Non-goals

- Auto-publishing. The platform schedules to Buffer as drafts only. A person
  reviews and posts.
- Replacing Buffer. Buffer stays the scheduler and publisher.
- Replacing the owner's voice. The platform drafts; Lamond and the operator
  approve.

## Who uses it

- **Operator (admin).** Generates ideas, creates content, uploads research and
  video, builds the calendar, sends drafts to Buffer, reads the data.
- **Owner / reviewer (Lamond).** Reviews the queue, approves or rejects, posts
  the approved drafts.

## The monthly workflow

1. **Generate ideas.** Pull a batch per bucket (default 10 each, more on demand).
2. **Add research.** Drop in owner notes, trends, customer stories, BOF angles.
3. **Create content.** For each idea: hook, caption, CTA, hashtags, the image
   (sourced or generated), and a video prompt where it applies.
4. **Attach assets.** Link or upload finished video to Google Drive; source or
   generate the image at the right size for the channel.
5. **Build the month.** Lay the approved items onto a monthly calendar with a
   posting cadence per channel.
6. **Send to Buffer.** Push scheduled items to Buffer as drafts, formatted per
   channel.
7. **Review and post.** Reviewer checks the drafts, approves, and publishes.
8. **Track data.** Pull back engagement and reach; mark what performed; feed the
   next batch.

## The content system — five buckets

| # | Bucket | Job | Source | Creative freedom |
|---|--------|-----|--------|-----------------|
| 1 | Lamond's Voice | Trust and connection | Owner voice / repo | High |
| 2 | The Vehicle | Conversation, car culture | Real ownership | High |
| 3 | Transactional | Offers, services, updates | **Repository only** | **None** |
| 4 | Surveys & Debates | Reach and comments (reel-first) | Engagement hooks | High |
| 5 | SEO & Discovery | Get found in local search | BOF video templates | High |

### Bucket 5 — SEO & Discovery

Reel-first, bottom-of-funnel videos that rank when locals search on TikTok,
YouTube, and Google. Reference titles:

- Here's where I get my car washed.
- Best place to get a car wash in Bowie.
- Best car wash in Prince George's County.
- This car wash is worth the drive.
- If you care about your car, go here.
- I finally found my car wash.
- This is my go-to car wash.
- Don't sleep on this spot.

## Images

Every post needs the right visual at the right size. The platform does this two
ways:

- **Source it.** Pull from a brand image library, the Pro Wash Google Drive,
  approved customer photos, or a stock provider. Good for real cars, locations,
  and the crew.
- **Create it.** When no real photo fits, the platform builds a **photo prompt**
  sized for the channel and generates the image. The prompt includes the format,
  aspect ratio, and brand colors (navy `#0A1E3D`, red `#B33A34`, soft blue
  `#E8F1FA`).

Channel sizes the prompt targets:

| Use | Size | Ratio |
|---|---|---|
| Instagram / Facebook feed | 1080 x 1080 | 1:1 |
| Reels / Stories / TikTok | 1080 x 1920 | 9:16 |
| Instagram portrait | 1080 x 1350 | 4:5 |
| YouTube thumbnail | 1280 x 720 | 16:9 |
| Google Business post | 1200 x 900 | 4:3 |

The operator can always swap a generated image for a real one before approval.

## Content formats

Buckets are the strategy. Formats are how a post is shaped. The generator can
produce any idea in a format that fits the bucket:

- **Text card** (point at the text), **carousel**, **reel**, **poll / debate**,
  **customer spotlight**, **how-to / educational**, and **interesting stats**.

### Interesting Stats

Short, surprising, shareable stats that pull saves and comments. They live mostly
in The Vehicle and Surveys & Debates, and the searchable ones support SEO. Every
stat must be real and sourced. No made-up numbers.

Examples of the angle:

- The average American spends around 17,600 minutes driving a year.
- A steering wheel can hold more bacteria than a public toilet seat.
- A clean, well-kept car can hold noticeably more resale value than a neglected one.
- Prince George's County has hundreds of thousands of registered vehicles.

Rules: cite a real source, keep one stat per post, and pair it with a hook and a
question to drive comments. If a stat can't be sourced, it doesn't ship.

## The one rule (transactional)

**If it isn't in the system, it doesn't exist.** Buckets 1, 2, 4, and 5 are
where we get creative. Bucket 3 (Transactional) pulls only from approved records:
offers, services, programs, locations, hours, campaigns. If a request can't be
matched to a record, the platform returns **"No approved transactional content
found."** It never guesses a price, an offer, or an event.

Approved sources today: Birthday Club (join only, gift sent privately by email),
Loyalty (8 stamps, 9th wash free), five DMV locations, hours, since 1997, the
approved campaign themes. No flash sales, coupons, or events exist on file.

## Approval gate

Every channel publishes through Buffer, and every item passes the gate:

`Generate → Review → Approve → Schedule (Buffer draft) → Human posts`

Nothing skips review.

## Channels

Instagram, Facebook, X, YouTube, and Google Business Profile (per location), all
through Buffer. The Creator adapts each post per channel: caption length,
hashtags, reel vs. local post.

## Plans this platform supports

- **Social.** Instagram, Facebook, X. Buckets 1 through 4.
- **Social + SEO.** Adds YouTube and Google Business across the location profiles,
  plus Bucket 5 and the BOF video workflow.

## Success metrics

- Time to produce a full month of content.
- Posts approved vs. rejected on first pass.
- Reach and engagement per bucket over time.
- Loyalty and Birthday Club signups attributable to social.
- Local search visibility for the target queries.

## Roadmap

- **MVP.** Idea generation (5 buckets), content creator, research inbox, monthly
  calendar, manual Buffer hand-off, approval states.
- **V1.** Buffer API drafts, Google Drive asset linking, image generation,
  per-channel formatting.
- **V2.** Analytics pull-back, performance tagging, repository scanner for
  transactional records, multi-location GMB scheduling.

## Out of scope (for now)

- Direct publishing without a human.
- Paid ads management.
- Customer CRM. (Loyalty and Birthday Club stay in their existing tools.)

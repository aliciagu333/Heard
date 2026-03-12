# Heard — Implementation Plan

> Status: AWAITING APPROVAL — no code will be written until this is approved.

---

## Overview

**Heard** is a human-mediated AI emotional support messenger. Users send tagged emotional messages; AI drafts a response; a human (friend or stranger) reviews and sends it. Daily limits encourage intentional use, not compulsive scrolling.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | JavaScript (no TypeScript) |
| Styling | Tailwind CSS |
| Database + Auth | Supabase (Postgres + Auth + Realtime) |
| AI | Anthropic Claude API (server-side only) |
| Deployment | Vercel |

---

## Phase 1 — Project Scaffolding

1. `npx create-next-app@latest heard --js --tailwind --app --no-src-dir`
2. Install deps: `@supabase/supabase-js`, `@supabase/ssr`, `@anthropic-ai/sdk`
3. Create `.env.local` with all four env vars (never committed)
4. Add `.env.local` to `.gitignore`
5. Create `CLAUDE.md` with project context for future sessions

---

## Phase 2 — Supabase Database Schema

Apply migrations via MCP in this order:

### Table: `users`
```sql
id uuid references auth.users primary key
display_name text
settings_json jsonb default '{}'
daily_count integer default 0
last_reset timestamptz default now()
```

### Table: `messages`
```sql
id uuid primary key default gen_random_uuid()
sender_id uuid references users(id)
receiver_id uuid references users(id)  -- nullable until routed
content text not null
intent_tags text[] not null            -- ['vent','advice','validation','understand']
status text default 'pending'          -- pending | routed | responded | expired
crisis_flagged boolean default false
created_at timestamptz default now()
routed_at timestamptz
```

### Table: `responses`
```sql
id uuid primary key default gen_random_uuid()
message_id uuid references messages(id)
responder_id uuid references users(id)
ai_draft text not null
edited_content text
was_edited boolean default false
sent_at timestamptz default now()
```

### Table: `invites`
```sql
id uuid primary key default gen_random_uuid()
inviter_id uuid references users(id)
invitee_email text not null
accepted boolean default false
created_at timestamptz default now()
```

### RLS Policies (all tables)
- `users`: users can read/update their own row only
- `messages`: sender can read own messages; receiver can read messages routed to them
- `responses`: responder can insert; message sender can read response to their message
- `invites`: inviter can read/insert their own invites

---

## Phase 3 — Supabase Auth Setup

- Email + password auth (no OAuth for now — keeps it simple)
- After sign-up: insert row into `users` table via server action
- Session handled via `@supabase/ssr` with cookie-based auth
- Middleware to protect all `/app/*` routes

---

## Phase 4 — File & Folder Structure

```
/app
  /app               ← authenticated shell (layout.js + middleware)
    /send             ← User A: compose message
    /inbox            ← User B: pending messages to respond to
    /history          ← past sent/received messages
    /invite           ← invite a friend
  /auth
    /login
    /signup
  /api
    /screen           ← POST: crisis screening + AI draft generation
    /respond          ← POST: User B submits response
    /reroute          ← POST: cron-like re-route after 5min timeout
    /reset-daily      ← POST: midnight UTC daily count reset (Vercel cron)
/components
  MessageComposer.js  ← tag selector + text input
  ResponseCard.js     ← shows message + AI draft + edit/send UI
  DailyLimitBanner.js ← gentle limit message
  CrisisOverlay.js    ← crisis resources modal
/lib
  supabase.js         ← browser client (anon key)
  supabase-server.js  ← server client (service role, server-only)
  crisis.js           ← crisis keyword/pattern detection utility
  dailyLimit.js       ← check + increment daily count logic
```

---

## Phase 5 — Core Product Logic

### 5a. Crisis Screening (server-side, `POST /api/screen`)
1. Receive message content
2. Run `crisis.js` pattern match against known crisis language
3. If crisis: set `crisis_flagged = true`, return `{ crisis: true }` — **do not proceed**
4. If safe: call Claude API with therapeutic framing prompt → return AI draft
5. Save message + draft to DB, set status = `pending`

### 5b. Routing Logic (`POST /api/screen` continued)
- If sender has a connected friend (future feature): route to them
- Otherwise: route to any active user who has remaining daily capacity
- Set `receiver_id`, `routed_at`, status = `routed`

### 5c. Re-routing (Vercel Cron every 1 min, `POST /api/reroute`)
- Query messages where `status = 'routed'` AND `routed_at < now() - 5 min`
- Re-assign to next available user, update `routed_at`

### 5d. Daily Limit Logic (`lib/dailyLimit.js`)
- On each send/respond: check `users.daily_count` vs limit (1 base)
- If `last_reset` is before today UTC midnight: reset count to 0 first
- Earned extras: +1 when B sends response (for both A and B), +1 per accepted invite
- Limit stored as computed: `base_limit + earned_extras` (or just track `daily_count` against a dynamic ceiling)

### 5e. Midnight Reset (Vercel Cron daily at 00:00 UTC, `POST /api/reset-daily`)
- Update all `users` rows: `daily_count = 0`, `last_reset = now()`

---

## Phase 6 — UI/UX Design Principles

- **Mobile-first**, max-width 480px content column
- **Color palette**: soft blues (`sky-100`, `blue-200`), white backgrounds, `slate-600` text
- **Typography**: clean, generous line-height — not clinical
- **No ratings, no engagement metrics visible to users**
- **Limit hit**: soft banner — "You've done your part for today. Come back tomorrow." — not a hard error
- **Crisis overlay**: full-screen calm overlay with hotline numbers, no harsh colors

---

## Phase 7 — Claude API Prompt Design (server-side only)

System prompt for response drafting:
```
You are helping a human respond to someone who needs emotional support.
The sender tagged their message as: {tags}.
Write a warm, concise response (3–5 sentences) that:
- Acknowledges their feeling without projecting
- Offers {advice if tagged / validation if tagged / reflection if tagged}
- Ends with an open, non-pressuring question
Do not use clinical language. Do not mention AI.
```

---

## Phase 8 — Deployment

1. Push to GitHub repo
2. Connect to Vercel, set all env vars in Vercel dashboard
3. Configure Vercel cron jobs in `vercel.json`:
   - `/api/reroute` — every 1 minute
   - `/api/reset-daily` — daily at 00:00 UTC
4. Verify Supabase Realtime is enabled on `messages` and `responses` tables

---

## Build Order (sequential)

| Step | What |
|---|---|
| 1 | Scaffold Next.js app + install deps |
| 2 | Apply DB migrations via Supabase MCP |
| 3 | Auth (signup/login pages + middleware) |
| 4 | `/api/screen` route (crisis check + Claude draft) |
| 5 | Send page (User A compose flow) |
| 6 | Inbox page (User B respond flow) |
| 7 | Re-route cron + daily reset cron |
| 8 | Invite flow |
| 9 | History page |
| 10 | Polish: daily limit UI, crisis overlay, responsive design |
| 11 | Deploy to Vercel |

---

## Open Questions for Your Approval

1. **Stranger routing**: Should strangers be opted-in explicitly, or is every user automatically available as a responder?
2. **AI draft visibility**: Should User B see the AI draft labeled "suggested response" or presented more neutrally?
3. **Friend connections**: Is friend-routing in scope for v1, or route to strangers only first?
4. **Invite bonus**: When an invited friend accepts, both get +1 daily — should this be a one-time bonus or recurring (each new invite accepted)?
5. **Display names**: Should users choose a display name on signup, or remain anonymous to each other entirely?

---

> **Awaiting your approval before any code is written.**

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
```

## Architecture

**Heard** is a human-mediated AI emotional support messenger. User A sends a tagged message → Claude drafts a response → User B (a stranger) reviews and sends it. 1 message + 1 response per user per day.

### Request flow
1. User A submits → `POST /api/screen`
2. Screen checks crisis language (`lib/crisis.js`) — if crisis, show resources and stop
3. If safe, call Claude API (server-side only) to generate AI draft
4. Route message + draft to an available User B (set `messages.receiver_id`)
5. User B sees message in `/app/inbox`, edits or sends AI draft → `POST /api/respond`
6. Both users receive +1 daily bonus; `messages.status` → `'responded'`
7. If User B ignores for 5 min: Vercel cron hits `GET /api/reroute` (every 1 min) → re-assigns

### Key files
| Path | Purpose |
|---|---|
| `lib/crisis.js` | Crisis pattern matching — runs before anything else |
| `lib/dailyLimit.js` | Check/increment/bonus daily count logic |
| `lib/supabase.js` | Browser Supabase client (anon key) |
| `lib/supabase-server.js` | Server Supabase client + `createServiceClient()` (service role) |
| `app/api/screen/route.js` | Crisis check + Claude draft + routing |
| `app/api/respond/route.js` | Submit response, award bonuses |
| `app/api/reroute/route.js` | Cron: re-route stale messages every 1 min |
| `app/api/reset-daily/route.js` | Cron: reset all daily counts at midnight UTC |
| `app/api/invite/route.js` | Send invite (POST) + accept invite + grant bonuses (PATCH) |

### Database tables (Supabase)
- `users` — `id` (= auth.users id), `display_name`, `daily_count`, `last_reset`, `settings_json`
- `messages` — `sender_id`, `receiver_id`, `content`, `intent_tags[]`, `status`, `crisis_flagged`, `routed_at`
- `responses` — `message_id`, `responder_id`, `ai_draft`, `edited_content`, `was_edited`
- `invites` — `inviter_id`, `invitee_email`, `accepted`

All tables have RLS enabled.

### Daily limit
- Base: 1 send + 1 respond per day
- Extras stored in `users.settings_json.daily_extras` (integer)
- +1 bonus earned by both users when User B sends a response
- +1 bonus (one-time) when an invited friend accepts their invite
- `dailyLimit.js` handles check, increment, reset, and bonus logic

### Security rules — never break these
- `ANTHROPIC_API_KEY` only in `.env.local` and server-side `route.js` files
- `SUPABASE_SERVICE_ROLE_KEY` only in `lib/supabase-server.js` via `createServiceClient()`
- `NEXT_PUBLIC_` prefix only for `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- All cron routes check `Authorization: Bearer $CRON_SECRET`
- All Supabase tables must keep RLS enabled

### Routing + middleware
- `middleware.js` protects `/app/*` (requires auth) and redirects authed users away from `/auth/*`
- Cron routes (`/api/reroute`, `/api/reset-daily`) require `Authorization: Bearer $CRON_SECRET`

### Design constraints
- Mobile-first, max-width 480px
- Soft blues (`sky-*`), white backgrounds, `slate-*` text
- No ratings, no engagement metrics, no surveys
- Daily limit UI is a gentle banner — never a hard error wall
- Crisis overlay is calm and full-screen — no harsh colors

## Deployment

Deploy to Vercel. Set env vars in Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `CRON_SECRET`

Vercel cron jobs are defined in `vercel.json`. Both cron routes require the `CRON_SECRET` bearer token.

# Telegram Opt-in Campaign Desk

MVP: Telegram bot + Mini App (Next.js) + Supabase + cron-job.org. Built-in Vercel Cron is intentionally not configured, so the project can deploy on Vercel Hobby.

## Scope and consent

This project sends only to users who started the bot with `/start`, and to groups whose administrator explicitly enabled publication with `/enable`. It does not search for arbitrary chats, use a personal MTProto/session login, or post to groups without their administrators' opt-in. This avoids building unsolicited mass-messaging automation.

## Features

- Admin sends the source message to the bot; text, formatting and supported media are copied with Telegram `copyMessage`.
- Mini App selects the saved message, approved audience and schedule.
- `/start` subscribes; `/stop` unsubscribes. Group admins use `/enable` and `/disable`.
- Campaign status and delivery counts.
- Caps: 500 individual subscribers and 50 enabled groups per campaign; up to 12 deliveries per cron request (call once per minute from cron-job.org).
- Mini App authentication verifies Telegram `initData` and checks the configured admin ID allowlist.

## Setup

1. Create a bot via `@BotFather`; note its token and the admin's numeric Telegram ID.
2. Create a Supabase project and run `supabase/schema.sql` in SQL Editor.
3. Copy `.env.example` to `.env.local` and fill in all secrets. Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only.
4. Install and run locally: `npm install && npm run dev`.
5. Deploy to Vercel and add the environment variables from `.env.example` in Project Settings. Set `CRON_SECRET`; Vercel Cron is not used because Hobby permits only daily schedules.
6. Register the webhook (replace values):

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
 -H 'content-type: application/json' \
 -d '{"url":"https://your-project.vercel.app/api/webhook","secret_token":"YOUR_TELEGRAM_WEBHOOK_SECRET","allowed_updates":["message"]}'
```

The webhook `secret_token` must equal `TELEGRAM_WEBHOOK_SECRET`.
7. In cron-job.org create a job: URL `https://your-project.vercel.app/api/cron`, method `GET`, schedule once per minute, request header `Authorization: Bearer <CRON_SECRET>`. Keep the job enabled; the endpoint verifies this secret.
8. Configure the Mini App URL in `@BotFather` as `https://your-project.vercel.app`. Start a private chat with the bot and send `/panel`.
9. Users subscribe with `/start`. Add the bot to your own group; one of its admins sends `/enable` to approve the group.

## Environment variables

- `TELEGRAM_BOT_TOKEN`: bot token.
- `TELEGRAM_WEBHOOK_SECRET`: random webhook secret (Telegram accepts 1–256 chars from A-Z, a-z, 0-9, `_`, `-`).
- `ADMIN_TELEGRAM_IDS`: comma-separated Telegram numeric IDs allowed to manage campaigns.
- `APP_URL`: deployed Mini App URL.
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase key.
- `CRON_SECRET`: long random secret for the scheduled endpoint.

Review Telegram rules, applicable messaging/privacy law, Vercel function limits, cron-job.org limits, and Supabase quotas before production use.

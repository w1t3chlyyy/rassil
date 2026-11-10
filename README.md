# Telegram Opt-in Campaign Desk

MVP: Telegram bot + Mini App (Next.js) + Supabase + Vercel Cron.

## Scope and consent

This project sends only to users who started the bot with `/start`, and to groups whose administrator explicitly enabled publication with `/enable`. It does not search for arbitrary chats, use a personal MTProto/session login, or post to groups without their administrators' opt-in. This avoids building unsolicited mass-messaging automation.

## Features

- Admin sends the source message to the bot; text, formatting and supported media are copied with Telegram `copyMessage`.
- Mini App selects the saved message, approved audience and schedule.
- `/start` subscribes; `/stop` unsubscribes. Group admins use `/enable` and `/disable`.
- Campaign status and delivery counts.
- Caps: 500 individual subscribers and 50 enabled groups per campaign; 80 deliveries per cron run.
- Mini App authentication verifies Telegram `initData` and checks the configured admin ID allowlist.

## Setup

1. Create a bot via `@BotFather`; note its token and the admin's numeric Telegram ID.
2. Create a Supabase project and run `supabase/schema.sql` in SQL Editor.
3. Copy `.env.example` to `.env.local` and fill in all secrets. Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only.
4. Install and run locally: `npm install && npm run dev`.
5. Deploy to Vercel and add the environment variables from `.env.example` in Project Settings. Vercel Cron invokes `/api/cron` every minute; set `CRON_SECRET`.
6. Register the webhook (replace values):

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
 -H 'content-type: application/json' \
 -d '{"url":"https://your-project.vercel.app/api/webhook","secret_token":"YOUR_TELEGRAM_WEBHOOK_SECRET","allowed_updates":["message"]}'
```

The webhook `secret_token` must equal `TELEGRAM_WEBHOOK_SECRET`.
7. Configure the Mini App URL in `@BotFather` as `https://your-project.vercel.app`. Start a private chat with the bot and send `/panel`.
8. Users subscribe with `/start`. Add the bot to your own group; one of its admins sends `/enable` to approve the group.

## Environment variables

- `TELEGRAM_BOT_TOKEN`: bot token.
- `TELEGRAM_WEBHOOK_SECRET`: random webhook secret (Telegram accepts 1–256 chars from A-Z, a-z, 0-9, `_`, `-`).
- `ADMIN_TELEGRAM_IDS`: comma-separated Telegram numeric IDs allowed to manage campaigns.
- `APP_URL`: deployed Mini App URL.
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase key.
- `CRON_SECRET`: long random secret for the scheduled endpoint.

Review Telegram rules, applicable messaging/privacy law, Vercel Cron limits, and Supabase quotas before production use.

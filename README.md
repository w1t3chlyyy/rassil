# Telegram Public Group Finder

Mini App on Next.js/Vercel plus a Telegram bot. User login for read-only discovery is MTProto (API ID + API hash + QR-generated StringSession); bot UI uses the regular Bot API. There is no sending, joining, folder creation, or campaign scheduling in this project.

## What search does

`/search <topic>` and the Mini App call Telegram MTProto `messages.searchGlobal` with `groups_only=true`. This is a global **message** search: it finds public groups where public messages match the query, then returns up to 10 individual `https://t.me/<username>` links. It is not a semantic catalog, may be incomplete, and does not return private groups or create `t.me/addlist` folder links. The authenticated account is not asked to join any result.

## Setup

1. Create a result bot in `@BotFather` with `/newbot`; configure its Mini App URL after deployment.
2. Get API ID and API hash at `https://my.telegram.org` (API development tools). Do not send these or the session string in chat.
3. Copy `.env.example` to `.env.local` and set `TELEGRAM_API_ID` and `TELEGRAM_API_HASH`.
4. On your own trusted computer, run `npm install` then `npm run auth:qr`. Scan the QR in Telegram: Settings → Devices → Link Desktop Device. If prompted, enter your Telegram 2FA password in the local terminal. Copy the resulting session string into `.env.local` as `TELEGRAM_SESSION_STRING`; never commit it.
5. Create a Vercel project from the repository. Add `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `ADMIN_TELEGRAM_IDS`, `APP_URL`, `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, and `TELEGRAM_SESSION_STRING` as server-side environment variables. Redeploy. Do not prefix the session with `NEXT_PUBLIC_`.
6. Configure the bot Mini App domain/URL in `@BotFather`. In a private chat send `/panel` and open the app.
7. Set the webhook once (replace the values):

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
 -H 'content-type: application/json' \
 -d '{"url":"https://your-project.vercel.app/api/webhook","secret_token":"YOUR_TELEGRAM_WEBHOOK_SECRET","allowed_updates":["message"]}'
```

The webhook `secret_token` must equal `TELEGRAM_WEBHOOK_SECRET`.

## Commands

- `/start` or `/help` — explain use.
- `/panel` — open the Mini App (allowlisted admin only).
- `/search предприниматели` — search and return up to 10 public group links (allowlisted admin only).

Set `ADMIN_TELEGRAM_IDS` to the Telegram numeric ID(s) authorized to search. `TELEGRAM_SESSION_STRING` grants access to the logged-in Telegram account: keep it private, store only in Vercel server-side environment settings, and revoke the session from Telegram → Settings → Devices if exposed. Consider using a dedicated account.

No Supabase or cron is needed for this read-only finder. Telegram may throttle global searches; use short topical queries and avoid repeated rapid requests.

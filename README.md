# Telegram Public Group Finder

Mini App on Next.js/Vercel plus a Telegram bot. Discovery uses a user-authorized MTProto session; the bot UI uses the regular Bot API. The project searches public groups, can organize chats that the account has already joined into a Telegram folder, and can create a shareable folder link when Telegram allows it.

The app never joins groups automatically and never sends campaign messages. The legacy campaign, content, and cron endpoints return HTTP 410; the old Supabase tables are retained but are no longer used for sending.

## Search behavior

`/search <topic>` and the Mini App use Telegram MTProto `messages.searchGlobal` with `groups_only=true`. Each page searches up to 100 matching messages and deduplicates public groups by username, ignoring case.

In the Mini App, repeat the same query or press **Ещё группы** to continue from Telegram's next-page cursor. New pages are appended without repeating groups already shown in that search session. A changed query starts a new search. Telegram's global message search is not a semantic catalog and may be incomplete.

The bot command returns the first 10 results to fit Telegram message limits. Use `/panel` for paginated results and folder tools.

## Telegram folders

Select results and choose a folder title to create or update a folder in the signed-in Telegram account. The selected groups must already be present in the account's dialogs; join them manually in Telegram first. The app does not join groups. It also returns a shareable `t.me/addlist/...` link if Telegram successfully exports one for the folder.

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
- `/search предприниматели` — return up to 10 public group links (allowlisted admin only).

Set `ADMIN_TELEGRAM_IDS` to the Telegram numeric ID(s) authorized to search. `TELEGRAM_SESSION_STRING` grants access to the logged-in Telegram account: keep it private, store only in Vercel server-side environment settings, and revoke the session from Telegram → Settings → Devices if exposed. Consider using a dedicated account.

No Supabase or cron is needed for search or folder creation. Telegram may throttle global searches; avoid repeated rapid requests.

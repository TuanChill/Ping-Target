# Ping Target

Ping Target is a private, single-page progress tracker. It stores one integer target in Cloud Firestore, records each achievement with a reason and timestamp, and sends configurable Telegram reminders with the current remaining amount.

The app uses Firebase Anonymous Authentication, so there is no account or login screen. The anonymous Firebase identity stays in the current browser profile. Someone opening the same URL in another browser gets a separate empty tracker; clearing this browser's data loses access to its tracker.

## Stack

- Next.js App Router on Vercel
- Firebase Anonymous Auth and Cloud Firestore for browser data
- Firestore Security Rules for owner-only access and paired progress/history writes
- A Cloudflare Worker Cron Trigger checking once each minute and calling a protected Vercel route
- Telegram Bot API for notifications

No machine or long-running backend server is required. The scheduled Vercel route is a serverless function so the Telegram token and Firebase Admin credentials stay off the browser.

## Local development

Use Node.js 20 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

Create a Firebase project and register a Web app. Enable **Authentication → Anonymous** and create a **Cloud Firestore** database. Set these public Web app values in the local environment or Vercel project:

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

These are Firebase Web app configuration values, not service-account credentials. They can be present in the browser bundle; Firestore Rules provide data access control. The app shows a setup notice until they are configured.

Deploy Firestore Rules to the Firebase project before using the tracker:

```bash
pnpm exec firebase login
pnpm exec firebase deploy --only firestore:rules --project YOUR_FIREBASE_PROJECT_ID
```

For local Rules tests, the Firebase Emulator Suite requires Java 21 or newer:

```bash
pnpm test:rules
```

## Telegram reminders

1. Create a bot with Telegram's `@BotFather`, open the bot in your account, and send `/start`.
2. Obtain the bot token and your private chat ID. Keep the token secret and never add it to source control or a `NEXT_PUBLIC_*` variable.
3. In Firebase, create a service account with the minimum Firestore access needed for reading the target/settings and writing reminder delivery records. Store its project ID, client email, and private key as Vercel environment variables:

   ```text
   FIREBASE_ADMIN_PROJECT_ID
   FIREBASE_ADMIN_CLIENT_EMAIL
   FIREBASE_ADMIN_PRIVATE_KEY
   REMINDER_OWNER_UID
   CRON_SECRET
   TELEGRAM_BOT_TOKEN
   TELEGRAM_CHAT_ID
   ```

   The private key value should preserve newlines or use `\n` escapes; the server module restores escaped newlines. `REMINDER_OWNER_UID` is the anonymous user ID for the browser containing your tracker. Open the app once, then copy its UID from Firebase Authentication's user list. `CRON_SECRET` must be a long random value.
4. Configure `CRON_SECRET` in Vercel. Set the same value as a Cloudflare Worker secret, then edit the Worker endpoint URL in `wrangler.toml` to your deployed Vercel URL:

   ```bash
   pnpm exec wrangler login
   pnpm exec wrangler secret put REMINDER_SECRET
   pnpm exec wrangler deploy
   ```

   Enter the same random value as `CRON_SECRET` when Wrangler prompts for `REMINDER_SECRET`. The Worker uses the `* * * * *` trigger and invokes the Vercel route with bearer authorization. Firestore stores reminder enabled state, timezone, and daily `HH:mm` slots, which you can change in the app without redeploying the Worker.

5. In the app, enable Telegram reminders, choose a timezone and one or more daily reminder times, and save. The Worker checks each minute; delivery may be delayed by roughly a minute or more during platform delays. Each local date/time slot is recorded so repeated Worker calls do not normally duplicate a reminder. A rare retry after Telegram accepted a message but before Firestore recorded success may send a duplicate.

### Free-tier expectations

One minutely Worker trigger makes about 1,440 scheduled calls per day. Cloudflare Workers Free currently allows 100,000 requests per day, while Vercel Hobby includes 1 million Function invocations per month, so this design has room for one small personal tracker under those published allowances. Provider quotas and plans can change; check usage in both dashboards. The Worker trigger is UTC-based, and the app converts it to the configured timezone.

## Data model and privacy

The browser owns its data under `users/{anonymousUid}`. Each achievement event is immutable. A Firestore transaction writes the event and lowers the cached remaining total together; Rules reject incomplete or mismatched writes. The server reminder route uses the configured owner UID and does not accept a UID or target value from the incoming request.

The deployed URL itself is reachable by anyone who has it. Firebase keeps each browser identity's data separate, but this is not a login system and does not prevent other people from opening the page. Do not put sensitive personal information in the target label or history reasons.

## Commands

```bash
pnpm dev                     # Local Next.js app
pnpm build                   # Production build
pnpm lint                    # ESLint for source, tests, and Worker
pnpm test                    # Jest suite
pnpm test:rules               # Firestore Rules against the local emulator
pnpm exec wrangler dev       # Local Cloudflare Worker
```

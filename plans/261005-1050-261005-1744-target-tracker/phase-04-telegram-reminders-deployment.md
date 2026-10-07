---
phase: 4
title: 'Telegram reminders, Worker scheduler, and deployment'
status: pending
priority: P1
effort: 4h
dependencies: [1, 2, 3]
---

# Phase 4: Telegram reminders, Worker scheduler, and deployment

## Goal

Send Telegram messages at multiple configured daily times using a Cloudflare Worker scheduler and deploy the app to Vercel.

## Files

- Create: `/Users/tuanchill/Desktop/Ping-Target/src/app/api/cron/target-reminder/route.ts`, `/Users/tuanchill/Desktop/Ping-Target/src/services/server/reminder.service.ts`, `/Users/tuanchill/Desktop/Ping-Target/tests/target-reminder-route.test.ts`, `/Users/tuanchill/Desktop/Ping-Target/tests/reminder-worker.test.ts`.
- Modify: `/Users/tuanchill/Desktop/Ping-Target/wrangler.toml`, `/Users/tuanchill/Desktop/Ping-Target/workers/reminder/index.ts`, `/Users/tuanchill/Desktop/Ping-Target/README.md`.

## Steps

1. Guard the GET route with timing-safe `Authorization: Bearer`/`CRON_SECRET` comparison before any data access.
2. Admin SDK reads the global `app/primary` target and `app/reminders` settings. No client request controls target path or amount.
3. Format Vietnamese target/completed/remaining/unit/generated-time text; call Telegram `sendMessage` only in the server route.
4. Log status without tokens, chat ID, or credential data; fail Telegram non-success responses.
5. Implement Cloudflare Worker's `scheduled()` handler to call the Vercel route with the secret stored as a Worker Secret. Run one Cron Trigger every minute; the route reads configured times/timezone from Firestore and sends only when a slot is due.
6. Deduplicate each delivery by local date and configured time in Firestore. Document that a failure after Telegram accepts a message but before its sent marker can rarely cause a duplicate on retry.
7. Document the required Vercel variables, Firebase anonymous auth, recipient chat, and Worker secret. Test the Worker locally and both authorized/rejected Vercel route calls; live deployment/testing needs the owner's provider credentials.
8. Document limits: Worker runs in UTC, exact-minute timing is not guaranteed, and minute checks count toward Cloudflare Workers Free daily request allowance. Firebase `onSchedule` remains an opt-in alternative if its billing model is acceptable.

## Verification

- `pnpm test -- target-reminder-route.test.ts`
- Invalid cron call returns 401/403 without Telegram request; valid Worker-triggered call sends latest remaining amount.
- `pnpm lint && pnpm build`

## Success criteria

- [ ] One minutely Cloudflare Cron Trigger checks configured Firestore schedules and authorized due slots reach Telegram once.
- [ ] Deployment requires no self-managed server and its free-tier limits are clear.

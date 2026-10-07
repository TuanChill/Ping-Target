---
phase: 1
title: 'Project and Firebase foundation'
status: pending
priority: P1
effort: 3h
dependencies: []
---

# Phase 1: Project and Firebase foundation

## Goal

Create a deployable Next.js/Firebase foundation with public and server-only settings separated.

## Files

- Modify: `/Users/tuanchill/Desktop/Ping-Target/package.json`, `/Users/tuanchill/Desktop/Ping-Target/src/config/env.ts`, `/Users/tuanchill/Desktop/Ping-Target/src/app/layout.tsx`.
- Create: `/Users/tuanchill/Desktop/Ping-Target/src/lib/firebase/client.ts`, `/Users/tuanchill/Desktop/Ping-Target/src/lib/firebase/admin.ts`, `/Users/tuanchill/Desktop/Ping-Target/firebase.json`, `/Users/tuanchill/Desktop/Ping-Target/firestore.rules`, `/Users/tuanchill/Desktop/Ping-Target/wrangler.toml`, `/Users/tuanchill/Desktop/Ping-Target/workers/reminder/index.ts`.

## Steps

1. Add only Firebase client/Admin and emulator dependencies required by the plan.
2. Validate `NEXT_PUBLIC_FIREBASE_*` separately from `FIREBASE_ADMIN_*`, `REMINDER_OWNER_UID`, `CRON_SECRET`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_CHAT_ID`; document names in README, never values.
3. Make browser Firebase initialization anonymous-auth capable and a `server-only` Admin singleton; configure the Emulator Suite.
4. Configure one Cloudflare Worker Cron Trigger to run every minute and call the deployed Vercel route with the shared scheduler secret. Reminder times live in Firestore, not Worker config.
5. Confirm no server-only value appears in client output.

## Verification

- `pnpm install && pnpm lint && pnpm build`
- Inspect browser output for no Admin credentials, cron secret, or Telegram token.

## Success criteria

- [x] Browser Firebase uses public configuration only.
- [x] Deployment configuration contains no secrets in Git.

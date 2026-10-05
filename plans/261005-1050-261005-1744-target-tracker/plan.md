---
title: "Ping Target: Firebase tracker and Telegram reminder"
description: "Build a private target tracker with an auditable progress ledger and configurable Telegram reminders."
status: in-progress
priority: P1
effort: 18h
branch: main
tags: [feature, frontend, database, auth, infra]
blockedBy: []
blocks: []
created: 2026-10-05
---

# Ping Target implementation plan

## Overview

Replace the boilerplate home page with a private Firebase target tracker. A user creates one target, records a positive achievement with reason and business time, and sees the remaining number decrease with immutable history. The user configures Telegram reminder times in the app. A Cloudflare Worker Cron Trigger checks once per minute and invokes a protected Vercel route, which sends the current remaining total when a configured time is due. This is serverless: no self-managed backend.

## Scope and architecture

- Baseline: Vercel hosts the app and protected reminder endpoint; one free Cloudflare Worker Cron Trigger runs each minute. Firestore stores user-configured reminder times and timezone, so changing a reminder needs no Worker redeploy.
- Security: anonymous Firebase Auth creates a browser-local UID without an account/login screen. Rules isolate every UID; the owner UID, Telegram token, Firebase Admin credential, and shared scheduler secret are server-only.
- Retention: clearing browser data or switching device loses access to the anonymous UID's target. This is accepted because the app is private to one browser and is not shared publicly.
- Non-goals: public data sharing, accounts/sign-in UI, shared or multiple targets, history edits/deletes, manual corrections, export/import, and a self-hosted server.

```text
Next.js Client + anonymous Firebase Auth → Firestore transaction
                                users/{uid}/targets/primary/decrements/{eventId}
Cloudflare minute Cron → protected Vercel Route Handler
                                                    → Firebase Admin + Telegram sendMessage
```

Amounts are integers. One transaction writes an immutable event and updates `remainingUnits`; Rules validate that pair.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Project and Firebase foundation](./phase-01-start.md) | Pending |
| 2 | [Secure Firestore data and authentication](./phase-02-firebase-data-auth.md) | Pending |
| 3 | [Target dashboard and audit history](./phase-03-target-dashboard-history.md) | Pending |
| 4 | [Telegram reminders, Worker scheduler, and deployment](./phase-04-telegram-reminders-deployment.md) | Pending |

## Acceptance criteria

- [ ] The private browser session creates one target and views target, completed, and remaining values without an account/login screen.
- [ ] A valid record atomically creates one history event and lowers remaining; invalid, excessive, cross-user, or partial writes fail.
- [ ] History is newest first with amount, reason, business time, and audit time.
- [ ] User can configure daily reminder times and timezone in the app; due times send the current remaining amount once per local date and time, with secrets kept server-side.
- [ ] Rules/emulator tests, unit/component tests, lint, build, and a production-like Telegram test pass.

## Evidence and validation log

- [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Firebase scheduled functions billing](https://firebase.google.com/docs/functions/schedule-functions)
- [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Cloudflare Workers Free plan limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Telegram sendMessage](https://core.telegram.org/bots/api#sendmessage)

### Validation decisions — 2026-10-05

- Amounts are whole-number integers.
- The tracker needs multiple configurable reminder times per day; exact-minute delivery is not required.
- There is no account/login screen and no public sharing. Anonymous Firebase Auth isolates the private browser's data; losing browser storage loses access, which is accepted.
- Free-tier baseline changed from Vercel Cron to Cloudflare Worker Cron Triggers (maximum five schedules) calling the Vercel reminder route.
- Reminder times must be configurable in the UI, not by editing/deploying Worker cron expressions. Worker checks once per minute; Firestore stores user times/timezone and the server route enforces once-per-slot delivery.
- Production build, lint, TypeScript, and 9 focused unit/component tests pass. The Firestore Rules emulator test is present but could not run here because the available Java is 17 and Firebase CLI requires Java 21+. Wrangler dry-run was also blocked by permissions on Wrangler's per-user config directory outside the workspace. Live deployment and Telegram delivery require the user's Firebase, Vercel, Cloudflare, and Telegram credentials.

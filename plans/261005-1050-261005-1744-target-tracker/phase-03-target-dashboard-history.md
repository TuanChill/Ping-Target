---
phase: 3
title: 'Target dashboard and audit history'
status: pending
priority: P1
effort: 5h
dependencies: [1, 2]
---

# Phase 3: Target dashboard and audit history

## Goal

Build the Vietnamese one-page flow for anonymous private-session setup, achievement recording, and audit history.

## Files

- Modify: `/Users/tuanchill/Desktop/Ping-Target/src/app/page.tsx`, `/Users/tuanchill/Desktop/Ping-Target/src/styles/globals.css`.
- Create: `/Users/tuanchill/Desktop/Ping-Target/src/components/target/target-tracker.tsx`, `target-setup-form.tsx`, `record-achievement-form.tsx`, `decrement-history.tsx`, `reminder-settings.tsx`, and `/Users/tuanchill/Desktop/Ping-Target/tests/target-tracker.test.tsx`.

## Steps

1. Replace the template page with anonymous-auth initializing, loading, setup, populated, pending, and failure states.
2. Start Firebase Anonymous Auth automatically, without an account/login screen. Setup captures label/unit and one integer target amount.
3. Render target, completed (`targetUnits - remainingUnits`), and remaining from Firestore only.
4. Validate positive integer amount, required bounded reason, and time; disable during command and explain over-limit/offline/permission errors.
5. Query exact private history newest first, showing business `occurredAt` separately from audit `recordedAt`; use existing Shadcn/Tailwind conventions.
6. Add reminder settings for enabled/disabled, timezone, and daily `HH:mm` times; persist settings in the anonymous browser user's Firestore path.

## Verification

- `pnpm test -- target-tracker.test.tsx`
- Manual anonymous-session setup → record → refresh and invalid amount checks.
- `pnpm lint && pnpm build`

## Success criteria

- [ ] The complete Vietnamese user journey works.
- [ ] Refresh retains accurate summary and history.

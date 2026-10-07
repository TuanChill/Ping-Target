---
phase: 2
title: 'Secure Firestore data and authentication'
status: pending
priority: P1
effort: 6h
dependencies: [1]
---

# Phase 2: Secure Firestore data and authentication

## Goal

Implement one shared target ledger and prove balance/history atomicity through Rules tests.

## Contract and files

```text
app/primary: targetUnits, remainingUnits, createdAt, updatedAt, lastEventId
app/primary/decrements/{eventId}: amountUnits, reason, occurredAt,
recordedAt, previousRemainingUnits, newRemainingUnits, actorUid
app/reminders: enabled, timezone, times[], updatedAt
```

- Modify: `/Users/tuanchill/Desktop/Ping-Target/firestore.rules`, `/Users/tuanchill/Desktop/Ping-Target/src/types/index.ts`, provider exports, and `/Users/tuanchill/Desktop/Ping-Target/src/app/layout.tsx`.
- Create: `/Users/tuanchill/Desktop/Ping-Target/src/types/target.ts`, `/Users/tuanchill/Desktop/Ping-Target/src/services/firebase/target.service.ts`, `/Users/tuanchill/Desktop/Ping-Target/src/providers/firebase-auth-provider.tsx`, `/Users/tuanchill/Desktop/Ping-Target/tests/firestore.rules.test.ts`.

## Steps

1. Enable Firebase Anonymous Authentication. Do not render account/login UI; on app bootstrap establish a Firebase UID before reading data. All UIDs access the same app singleton.
2. Use integer units. Any visitor may create the target only if missing; prevent client reset. Shared data remains available from other browsers.
3. Generate an event ID outside `runTransaction`; read, validate, create immutable event, and update balance/`lastEventId` atomically.
4. Disable double submit and reconcile ambiguous transaction failures by reading the event ID before retry.
5. Rules deny unauthenticated access, unknown fields, invalid reminder schedules, balance-only writes, event-only writes, event mutations/deletes, and any mismatched event/balance pair via `getAfter()`. Every authenticated visitor may read the shared target/history and append a valid decrement.
6. Test valid operations and every denial using the Emulator Suite.

## Verification

- `pnpm test:rules` (Firestore Emulator Suite)
- `pnpm exec jest --runInBand tests/firestore.rules.test.ts` (with the emulator running)
- Concurrent decrements cannot yield negative or partial state.

## Success criteria

- [ ] Shared read access and append-only ledger are mechanically tested.
- [ ] Every accepted decrement has one matching audit event.

# Firebase architecture research: Ping-Target

**Research date:** 2026-10-05 (Asia/Ho_Chi_Minh)

## Recommendation

Use only **Firebase Authentication + Cloud Firestore** as runtime Firebase
products. Use the Firebase modular Web SDK directly from a small Next.js
Client Component. Authenticate each browser with anonymous Auth initially, and
use a Firestore transaction to append an immutable decrement event while
updating the target summary. Enforce the pairing and arithmetic in Firestore
Security Rules. Add **Firebase App Check** before public launch as abuse
protection; it complements Auth and Rules and is not a replacement for either.

This fits the current repository: `src/app/page.tsx` is a static App Router
page, `firebase` is not installed, and `src/config/env.ts` currently validates
only `NEXT_PUBLIC_API_BASE`. No Next.js route handler, Admin SDK, service
account, Cloud Function, Firebase Hosting, Storage, Realtime Database, or
separate API is required.

The important boundary is that the browser is allowed to request a valid
operation, but it is never trusted to invent the resulting balance. The Rules
must require the summary update and event create to occur atomically.

## Products and ranked alternatives

| Rank  | Shape                                                                    | Fit                                                               | Main trade-off                                                                                                                                 |
| ----- | ------------------------------------------------------------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | Anonymous Auth + Firestore + App Check for production hardening          | Best for a frictionless single-user tracker on a free host        | Clearing browser storage loses the anonymous identity; public abuse must be controlled with App Check and quotas                               |
| **2** | Google or email-link Auth + Firestore + App Check                        | Best if data must survive browser changes and sync across devices | Adds sign-in UX and account-recovery/product decisions                                                                                         |
| 3     | Firestore events only; compute remaining by summing events in the client | Simplest Rules                                                    | No atomic materialized balance; larger history reads and weaker protection against a client creating a logically excessive event total         |
| 4     | Next.js API/Server Action + Admin SDK                                    | Strong server authority                                           | Violates the no-separate-backend constraint; service credentials and server deployment become required, and Admin SDK bypasses Firestore Rules |

Firebase's modular Web SDK is explicitly the production-recommended, tree-
shakeable API and is intended to be installed through npm/module bundlers
([Firebase web setup](https://firebase.google.com/docs/web/setup)).

Anonymous Auth is a concrete minimum viable identity: Firebase creates a
temporary user that can access data protected by Rules, and the account can
later be linked to a permanent provider
([anonymous Auth](https://firebase.google.com/docs/auth/web/anonymous-auth)).
If cross-device persistence is a requirement, start with Google/email-link
Auth, or link the anonymous account before the user changes devices.

## Data model

Use a fixed target ID (`primary`) unless multiple targets are explicitly
needed. Keep all user-owned data below a UID path; there is no public read.

```text
users/{uid}/targets/primary
  targetUnits: int >= 0            # immutable initial target, integer units
  remainingUnits: int >= 0         # materialized balance
  createdAt: timestamp              # server timestamp
  updatedAt: timestamp              # server timestamp
  lastEventId: string | null        # links the latest atomic decrement

users/{uid}/targets/primary/decrements/{eventId}
  amountUnits: int > 0
  reason: string, bounded length
  occurredAt: timestamp             # user-selected event time, not future
  recordedAt: timestamp              # server timestamp / audit time
  previousRemainingUnits: int >= 0
  newRemainingUnits: int >= 0
  actorUid: string                   # must equal the path UID
```

Use integer units. If the domain needs decimals, choose a fixed scale (for
example, cents or thousandths) and store the scaled integer; do not use
floating-point arithmetic in Rules. `occurredAt` is the business time entered
by the user; `recordedAt` is the server-side audit time. If only “now” is
needed, set both through a server timestamp.

The client should query the exact user target path and its `decrements`
subcollection. Rules are not query filters, so do not use an unscoped or
collection-group query for this private data.

## Atomic decrement flow

```text
Client (authenticated UID)
  │ runTransaction()
  ├─ read users/{uid}/targets/primary
  ├─ reject locally if amountUnits <= 0 or amountUnits > remainingUnits
  ├─ create decrements/{newRandomEventId} (immutable event)
  └─ update target: remainingUnits -= amountUnits,
                    lastEventId = newRandomEventId,
                    updatedAt = serverTimestamp()
                 │
                 └─ Firestore Rules validate both getAfter() states
                    or reject the entire transaction
```

`runTransaction` is required because the new balance depends on the current
balance. Firestore transactions retry on a concurrent edit and never partially
apply writes; the callback may run more than once, so generate the event ID
outside the callback and keep the callback free of UI/state side effects. A
transaction fails while the client is offline, so the UI must show a retry-
when-online state rather than claiming success
([transactions and batched writes](https://firebase.google.com/docs/firestore/manage-data/transactions),
[transaction contention](https://firebase.google.com/docs/firestore/transaction-data-contention)).

Persist that event ID for the duration of one submit action. If the network
returns an ambiguous error after a possible commit, reconcile by reading that
event/target pair before allowing a new submit; do not generate a second event
for the same user action. This is client-side idempotency for UX and does not
replace the Rules invariants.

The event create and target update are deliberately paired. A Rules design can
use the target's `lastEventId` to construct a dynamic `getAfter()` path, as in
Firebase's documented pattern that uses a value from `request.resource.data`
in a `getAfter` path
([atomic Rules validation](https://firebase.google.com/docs/firestore/manage-data/transactions)).

## Rules invariants

The following is a design sketch, not a drop-in ruleset. The implementation
must test it in the emulator before deployment.

```text
For every read/write:
  request.auth != null
  request.auth.uid == {uid} from the document path

Target create:
  exact field allowlist
  targetUnits and remainingUnits are int and >= 0
  remainingUnits == targetUnits
  createdAt == request.time
  updatedAt == request.time
  lastEventId == null

Target update (the only mutable target operation):
  affectedKeys().hasOnly([
    'remainingUnits', 'lastEventId', 'updatedAt'
  ])
  new remainingUnits is int, >= 0, and strictly less than old remainingUnits
  updatedAt == request.time
  lastEventId is string
  getAfter(/.../decrements/{request.resource.data.lastEventId}) exists
  event.recordedAt == request.time
  event.previousRemainingUnits == old remainingUnits
  event.newRemainingUnits == new remainingUnits
  event.amountUnits == old remainingUnits - new remainingUnits

Event create (no update or delete):
  exact field allowlist and bounded reason
  amountUnits is int and > 0
  occurredAt is timestamp and <= request.time
  recordedAt == request.time
  actorUid == {uid}
  newRemainingUnits == previousRemainingUnits - amountUnits
  newRemainingUnits >= 0
  getAfter(/.../targets/primary).data.lastEventId == {eventId}
  getAfter(/.../targets/primary).data.remainingUnits == newRemainingUnits
  getAfter(/.../targets/primary).data.updatedAt == request.time

All other target/event writes:
  deny
```

`affectedKeys().hasOnly(...)` prevents a client from changing the immutable
target amount or adding an unreviewed field. Rules can enforce field types and
timestamps; Firebase documents both `is int`/`is timestamp` checks and the
`diff().affectedKeys()` pattern
([field-level Rules](https://firebase.google.com/docs/firestore/security/rules-fields)).
For writes containing a server timestamp, `request.time` equals the resolved
server timestamp, which makes the `recordedAt`/`updatedAt` checks meaningful
([Rules Request reference](https://firebase.google.com/docs/reference/rules/rules.firestore.Request)).

The target rule must require the event's `recordedAt == request.time`; merely
checking that `lastEventId` names _some existing_ event would permit a direct
balance edit that reuses an old event. Event documents must be create-only and
the transaction must be the only path that writes the two documents.

Rules do not stop an authenticated user from intentionally recording a valid
decrement. That is the product's meaning of “record a decrement.” If the
business needs operator approval, rate limits, fraud scoring, or a server-
trusted amount, a client-only Firebase design is insufficient and a trusted
backend/Cloud Function becomes necessary.

## Client SDK and Next.js constraints

1. Add the `firebase` package and use modular imports only:
   `firebase/app`, `firebase/auth`, and `firebase/firestore`; add
   `firebase/app-check` when App Check is enabled.
2. Keep Firebase initialization and auth listeners in a small `'use client'`
   module/provider. The current `page.tsx` is a Server Component by default;
   render a client tracker inside it. Next.js documents `'use client'` as the
   boundary for event handlers, state, browser APIs, and client-only modules
   ([Next.js `use client`](https://nextjs.org/docs/app/api-reference/directives/use-client)).
3. Do not import `window`, `localStorage`, or start auth listeners at module
   evaluation if the build must prerender; initialize in a client lifecycle or
   a client-only boundary. Keep server components free of Firebase browser
   SDK calls.
4. Do not use the Admin SDK, service-account JSON, private keys, or a Next.js
   route handler for this path. Server client libraries bypass Firestore Rules;
   they require IAM and would change the trust model
   ([Rules testing note](https://firebase.google.com/docs/firestore/security/test-rules-emulator)).
5. Since the repository already has React Query and Zustand, either is enough
   for local UI state, but neither is required for correctness. Firestore is
   the source of truth; invalidate/refetch after a committed transaction.

## Environment and deployment

Replace or extend the current `NEXT_PUBLIC_API_BASE`-only schema with the
Firebase web-app configuration, for example:

```text
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
# Optional only if App Check is enabled:
NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY=
```

Firebase's web configuration is not a service-account secret; Firebase states
that a Firebase API key can be included in public code/config when restricted
to Firebase services. Rules and App Check remain mandatory protections
([Firebase API keys](https://firebase.google.com/docs/projects/api-keys)). Never
put a service-account private key or Admin credential in `NEXT_PUBLIC_*`.

The Firebase console supplies the exact `apiKey`, `projectId`, and `appId`; do
not hand-edit them. Google Analytics/`measurementId` is unnecessary for this
feature ([Firebase config object](https://firebase.google.com/docs/web/learn-more)).

Vercel can build the normal Next.js app. Cloudflare Pages can host it as a
static Next.js export (`output: 'export'`, build output `out`); this is a good
fit because Firebase reads/writes happen in the browser and the page currently
has no server data dependency. Cloudflare's current static-export guide uses
`npx next build` and `out`
([Cloudflare Pages static Next.js](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/)).
Set the public variables in each host's preview and production environment,
and register every deployed origin used by Auth/App Check. Deploy the host and
Firebase resources independently:

```text
firebase init firestore emulators
firebase emulators:exec --only firestore,auth "pnpm test -- ..."
firebase deploy --only firestore:rules,firestore:indexes
```

No Firebase Hosting deployment is required. Keep separate Firebase projects
or at least separate rules/data for development and production; do not point a
local build at production while developing.

## App Check and abuse boundary

Rules + Auth answer “which user can access this user's data?” They do not prove
that traffic originated from the published web app. For a public URL, enable
App Check after observing metrics, preferably with reCAPTCHA Enterprise for a
new integration. Firebase documents App Check as a complementary layer for
Cloud Firestore and Authentication and supports staged monitoring before
enforcement
([App Check web setup](https://firebase.google.com/docs/app-check/web/recaptcha-provider)).

Use a debug provider/token for localhost and CI only; keep the token out of the
repository and production bundle
([App Check debug provider](https://firebase.google.com/docs/app-check/web/debug-provider)).
App Check is recommended hardening, not a license to loosen Rules. A determined
attacker can still use a genuine browser, so enforce exact fields, limits,
reason length, and Firestore/Auth quotas.

## Testing and operational limits

Use the Local Emulator Suite and `@firebase/rules-unit-testing` with the
repository's existing Jest setup. Firebase specifically recommends emulator
tests for Rules and provides authenticated/unauthenticated test contexts
([Firestore Rules emulator tests](https://firebase.google.com/docs/firestore/security/test-rules-emulator)).

Minimum tests:

- anonymous/unauthenticated read and write denial;
- UID A cannot read or write UID B's target/events;
- target creation rejects extra fields, floats, negative values, and a
  mismatched initial remaining value;
- a valid transaction creates exactly one event and matching target update;
- a direct target balance update, an event-only write, an event update, and an
  event delete all fail;
- amount zero, amount greater than remaining, future event time, bad reason
  type/length, wrong `actorUid`, and wrong `lastEventId` all fail;
- concurrent decrement attempts leave a non-negative balance and no partial
  event/summary pair.

Cloud Firestore's no-cost quota is currently 1 GiB stored, 50,000 document
reads/day, 20,000 writes/day, 20,000 deletes/day, and 10 GiB/month outbound;
only one database per project receives the free quota
([Firestore pricing](https://firebase.google.com/docs/firestore/pricing)). A
decrement transaction costs at least one target write plus one event write and
reads the target, so estimate history reads and anonymous-account abuse before
assuming the free quota is unlimited.

## Adoption risk and limitations

- Firebase Auth, Firestore, modular Web SDK, Rules, Emulator Suite, and App
  Check are mature, first-party services with official support and no new
  backend runtime to maintain. The main maintenance risk is Rules complexity:
  every schema field change must update both code and Rules tests.
- Anonymous Auth is deliberately ephemeral. It is the correct low-friction
  default only if losing data after clearing browser state is acceptable.
- Client transactions depend on network availability and can be retried;
  make UI submission idempotent from the user's perspective and disable the
  submit control while a request is in flight.
- This design does not cover multi-user sharing, admin correction, data
  export/deletion workflows, rate limiting beyond Firebase quotas, or a
  server-authoritative policy. Those are unresolved product scope, not gaps to
  hide inside the client.

## Unresolved user decisions

1. Is this tracker private to one browser, or must data survive device changes?
   Choose anonymous Auth for the former; choose/link Google or email-link Auth
   for the latter.
2. Is “time” a user-entered historical time (`occurredAt`) or strictly the
   server record time? The schema supports both, but the Rules policy should be
   explicit.
3. Are target and decrement amounts integers, or must the UI expose decimal
   quantities? If decimals are required, select and document a fixed scale.
4. Is App Check required at first public release, and which deployed domains
   should be allowed? It should be staged in monitor mode before enforcement.
5. Should users be able to edit/delete events or reset a target? The proposed
   ledger is intentionally append-only; corrections should be compensating
   events unless a trusted admin flow is added.

## Source set

The recommendation was cross-checked against the official Firebase and Next.js
documentation linked inline above. Key primary sources are:

- [Firebase modular Web SDK setup](https://firebase.google.com/docs/web/setup)
- [Firestore transactions and batched writes](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Firestore field-level Rules](https://firebase.google.com/docs/firestore/security/rules-fields)
- [Firebase anonymous Auth](https://firebase.google.com/docs/auth/web/anonymous-auth)
- [Firebase API-key guidance](https://firebase.google.com/docs/projects/api-keys)
- [Firebase App Check web setup](https://firebase.google.com/docs/app-check/web/recaptcha-provider)
- [Firestore Rules emulator tests](https://firebase.google.com/docs/firestore/security/test-rules-emulator)
- [Firestore pricing/free quota](https://firebase.google.com/docs/firestore/pricing)
- [Next.js Client Component boundary](https://nextjs.org/docs/app/api-reference/directives/use-client)
- [Cloudflare Pages static Next.js deployment](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/)

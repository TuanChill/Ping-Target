/** @jest-environment node */

import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  Timestamp,
  deleteDoc,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let testEnvironment: RulesTestEnvironment;

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId: 'demo-ping-target',
    firestore: { rules: readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8') }
  });
});

afterEach(async () => {
  await testEnvironment.clearFirestore();
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

async function seedTarget(uid: string, remainingUnits = 12): Promise<void> {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', uid, 'targets', 'primary'), {
      label: 'Mục tiêu',
      unit: 'km',
      targetUnits: 12,
      remainingUnits,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      lastEventId: null
    });
  });
}

describe('Firestore target rules', () => {
  it('denies unauthenticated access and cross-user reads', async () => {
    await seedTarget('owner');
    const anonymousDb = testEnvironment.unauthenticatedContext().firestore();
    const otherUserDb = testEnvironment.authenticatedContext('other').firestore();
    await assertFails(getDoc(doc(anonymousDb, 'users', 'owner', 'targets', 'primary')));
    await assertFails(getDoc(doc(otherUserDb, 'users', 'owner', 'targets', 'primary')));
  });

  it('allows the matching atomic decrement and rejects a balance-only update', async () => {
    await seedTarget('owner');
    const db = testEnvironment.authenticatedContext('owner').firestore();
    const targetRef = doc(db, 'users', 'owner', 'targets', 'primary');
    const eventRef = doc(db, 'users', 'owner', 'targets', 'primary', 'decrements', 'event-one');

    await assertFails(updateDoc(targetRef, { remainingUnits: 9, updatedAt: serverTimestamp() }));

    await assertSucceeds(
      runTransaction(db, async (transaction) => {
        const target = await transaction.get(targetRef);
        const previousRemainingUnits = target.data()?.remainingUnits as number;
        transaction.set(eventRef, {
          amountUnits: 3,
          reason: 'Đã hoàn thành một phần',
          occurredAt: Timestamp.now(),
          recordedAt: serverTimestamp(),
          previousRemainingUnits,
          newRemainingUnits: previousRemainingUnits - 3,
          actorUid: 'owner'
        });
        transaction.update(targetRef, {
          remainingUnits: previousRemainingUnits - 3,
          lastEventId: 'event-one',
          updatedAt: serverTimestamp()
        });
      })
    );

    await assertFails(updateDoc(targetRef, { remainingUnits: 6, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(eventRef, { reason: 'Sửa lịch sử' }));
    await assertFails(deleteDoc(eventRef));
  });

  it('rejects an event without the matching target update and immutable event edits', async () => {
    await seedTarget('owner');
    const db = testEnvironment.authenticatedContext('owner').firestore();
    const eventRef = doc(db, 'users', 'owner', 'targets', 'primary', 'decrements', 'event-two');
    const batch = writeBatch(db);
    batch.set(eventRef, {
      amountUnits: 2,
      reason: 'Ghi nhận sai cách',
      occurredAt: Timestamp.now(),
      recordedAt: serverTimestamp(),
      previousRemainingUnits: 12,
      newRemainingUnits: 10,
      actorUid: 'owner'
    });
    await assertFails(batch.commit());
    await assertFails(updateDoc(eventRef, { reason: 'Sửa lịch sử' }));
  });
});

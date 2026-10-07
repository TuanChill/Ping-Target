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

async function seedTarget(remainingUnits = 12): Promise<void> {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'app', 'primary'), {
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
  it('denies unauthenticated access and allows every signed-in visitor to read the shared target', async () => {
    await seedTarget();
    const anonymousDb = testEnvironment.unauthenticatedContext().firestore();
    const otherUserDb = testEnvironment.authenticatedContext('other').firestore();
    await assertFails(getDoc(doc(anonymousDb, 'app', 'primary')));
    await assertSucceeds(getDoc(doc(otherUserDb, 'app', 'primary')));
  });

  it('allows any signed-in visitor to make a matching atomic decrement and rejects a balance-only update', async () => {
    await seedTarget();
    const db = testEnvironment.authenticatedContext('visitor').firestore();
    const targetRef = doc(db, 'app', 'primary');
    const eventRef = doc(db, 'app', 'primary', 'decrements', 'event-one');

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
          actorUid: 'visitor'
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
    await seedTarget();
    const db = testEnvironment.authenticatedContext('visitor').firestore();
    const eventRef = doc(db, 'app', 'primary', 'decrements', 'event-two');
    const batch = writeBatch(db);
    batch.set(eventRef, {
      amountUnits: 2,
      reason: 'Ghi nhận sai cách',
      occurredAt: Timestamp.now(),
      recordedAt: serverTimestamp(),
      previousRemainingUnits: 12,
      newRemainingUnits: 10,
      actorUid: 'visitor'
    });
    await assertFails(batch.commit());
    await assertFails(updateDoc(eventRef, { reason: 'Sửa lịch sử' }));
  });

  it('allows a confirmed target reset to clear prior history and rejects partial setup changes', async () => {
    await seedTarget(9);
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'app', 'primary', 'decrements', 'old-event'), {
        generation: 0
      });
    });
    const db = testEnvironment.authenticatedContext('visitor').firestore();
    const targetRef = doc(db, 'app', 'primary');
    const oldEventRef = doc(db, 'app', 'primary', 'decrements', 'old-event');

    await assertFails(
      updateDoc(targetRef, {
        label: 'Đi bộ',
        targetUnits: 20,
        remainingUnits: 20,
        updatedAt: serverTimestamp()
      })
    );

    await assertSucceeds(
      updateDoc(targetRef, {
        label: 'Đi bộ',
        targetUnits: 20,
        remainingUnits: 20,
        historyGeneration: 1,
        lastEventId: null,
        updatedAt: serverTimestamp()
      })
    );
    await assertSucceeds(deleteDoc(oldEventRef));
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'app', 'primary', 'decrements', 'current-event'), {
        generation: 1
      });
    });
    await assertFails(deleteDoc(doc(db, 'app', 'primary', 'decrements', 'current-event')));
    const target = await getDoc(targetRef);
    expect(target.data()?.remainingUnits).toBe(20);
    expect(target.data()?.targetUnits).toBe(20);
    expect(target.data()?.label).toBe('Đi bộ');
    expect(target.data()?.historyGeneration).toBe(1);
  });

  it('lets any signed-in visitor create the one shared target once', async () => {
    const db = testEnvironment.authenticatedContext('visitor').firestore();
    const targetRef = doc(db, 'app', 'primary');
    const initialTarget = {
      label: 'Mục tiêu',
      unit: 'km',
      targetUnits: 12,
      remainingUnits: 12,
      historyGeneration: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastEventId: null
    };

    await assertSucceeds(setDoc(targetRef, initialTarget));
    await assertFails(setDoc(targetRef, initialTarget));
  });

  it('lets any signed-in visitor update shared reminder settings', async () => {
    const db = testEnvironment.authenticatedContext('visitor').firestore();
    const reminderRef = doc(db, 'app', 'reminders');

    await assertSucceeds(
      setDoc(reminderRef, {
        enabled: true,
        timezone: 'Asia/Ho_Chi_Minh',
        times: ['09:00'],
        updatedAt: serverTimestamp()
      })
    );
    await assertSucceeds(getDoc(reminderRef));
  });
});

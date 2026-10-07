import type {
  DecrementEvent,
  DecrementHistoryEntry,
  ReminderSettings,
  Target,
  TargetResetEvent
} from '@/types/target';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch
} from 'firebase/firestore';

import { getFirebaseClient } from '@/lib/firebase/client';

const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';

function firestore() {
  const firebase = getFirebaseClient();
  if (!firebase) throw new Error('Firebase chưa được cấu hình.');

  return firebase.db;
}

function targetRef(uid: string) {
  if (!uid) throw new Error('Cần có phiên Firebase để truy cập mục tiêu chung.');

  return doc(firestore(), 'app', 'primary');
}

function reminderRef(uid: string) {
  if (!uid) throw new Error('Cần có phiên Firebase để truy cập cài đặt nhắc chung.');

  return doc(firestore(), 'app', 'reminders');
}

export function subscribeTarget(
  uid: string,
  onValue: (target: Target | null) => void,
  onError: (error: Error) => void
): () => void {
  return onSnapshot(
    targetRef(uid),
    (snapshot) => onValue(snapshot.exists() ? (snapshot.data() as Target) : null),
    onError
  );
}

export async function createTarget(
  uid: string,
  input: { label: string; unit: string; targetUnits: number }
): Promise<void> {
  const label = input.label.trim();
  const unit = input.unit.trim();
  if (!Number.isSafeInteger(input.targetUnits) || input.targetUnits <= 0) {
    throw new Error('Mục tiêu phải là số nguyên lớn hơn 0.');
  }
  if (!label || label.length > 80 || !unit || unit.length > 24) {
    throw new Error('Tên mục tiêu hoặc đơn vị không hợp lệ.');
  }
  await setDoc(targetRef(uid), {
    label,
    unit,
    targetUnits: input.targetUnits,
    remainingUnits: input.targetUnits,
    historyGeneration: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastEventId: null
  });
}

export async function recordAchievement(
  uid: string,
  input: { amountUnits: number; reason: string; occurredAt: Date }
): Promise<string> {
  if (!Number.isSafeInteger(input.amountUnits) || input.amountUnits <= 0) {
    throw new Error('Số đã đạt phải là số nguyên lớn hơn 0.');
  }
  const reason = input.reason.trim();
  if (!reason || reason.length > 280) throw new Error('Lý do cần có từ 1 đến 280 ký tự.');
  if (Number.isNaN(input.occurredAt.getTime()) || input.occurredAt.getTime() > Date.now()) {
    throw new Error('Thời gian ghi nhận không hợp lệ.');
  }

  const parentRef = targetRef(uid);
  const eventRef = doc(collection(parentRef, 'decrements'));
  const eventId = eventRef.id;

  try {
    await runTransaction(firestore(), async (transaction) => {
      const targetSnapshot = await transaction.get(parentRef);
      if (!targetSnapshot.exists()) throw new Error('Chưa thiết lập mục tiêu.');

      const target = targetSnapshot.data() as Target;
      if (input.amountUnits > target.remainingUnits) {
        throw new Error('Số đã đạt không thể lớn hơn mục tiêu còn lại.');
      }

      const newRemainingUnits = target.remainingUnits - input.amountUnits;
      const event: DecrementEvent = {
        kind: 'decrement',
        unit: target.unit,
        generation: target.historyGeneration ?? 0,
        amountUnits: input.amountUnits,
        reason,
        occurredAt: Timestamp.fromDate(input.occurredAt),
        recordedAt: Timestamp.now(),
        previousRemainingUnits: target.remainingUnits,
        newRemainingUnits,
        actorUid: uid
      };

      transaction.set(eventRef, { ...event, recordedAt: serverTimestamp() });
      transaction.update(parentRef, {
        remainingUnits: newRemainingUnits,
        lastEventId: eventId,
        updatedAt: serverTimestamp()
      });
    });

    return eventId;
  } catch (error) {
    // A network failure may arrive after the transaction committed. Reconcile
    // against the stable event ID before exposing a retry to the user.
    const eventSnapshot = await getDoc(eventRef).catch(() => null);
    if (eventSnapshot?.exists()) return eventId;
    throw error;
  }
}

export async function resetTarget(
  uid: string,
  input: { label: string; unit: string; targetUnits: number }
): Promise<void> {
  const label = input.label.trim();
  const unit = input.unit.trim();
  if (!Number.isSafeInteger(input.targetUnits) || input.targetUnits <= 0) {
    throw new Error('Mục tiêu phải là số nguyên lớn hơn 0.');
  }
  if (!label || label.length > 80 || !unit || unit.length > 24) {
    throw new Error('Tên mục tiêu hoặc đơn vị không hợp lệ.');
  }

  const parentRef = targetRef(uid);
  let nextGeneration = 0;
  let expectedGeneration = 0;

  try {
    nextGeneration = await runTransaction(firestore(), async (transaction) => {
      const targetSnapshot = await transaction.get(parentRef);
      if (!targetSnapshot.exists()) throw new Error('Chưa thiết lập mục tiêu.');

      const target = targetSnapshot.data() as Target;
      const generation = (target.historyGeneration ?? 0) + 1;
      expectedGeneration = generation;
      transaction.update(parentRef, {
        label,
        unit,
        targetUnits: input.targetUnits,
        remainingUnits: input.targetUnits,
        historyGeneration: generation,
        lastEventId: null,
        updatedAt: serverTimestamp()
      });

      return generation;
    });
  } catch (error) {
    const targetSnapshot = await getDoc(parentRef).catch(() => null);
    const target = targetSnapshot?.data() as Target | undefined;
    if (
      !expectedGeneration ||
      !target ||
      target.historyGeneration !== expectedGeneration ||
      target.label !== label ||
      target.unit !== unit ||
      target.targetUnits !== input.targetUnits
    ) {
      throw error;
    }
    nextGeneration = expectedGeneration;
  }

  const historySnapshot = await getDocs(collection(parentRef, 'decrements'));
  const oldEntries = historySnapshot.docs.filter(
    (entry) =>
      ((entry.data() as DecrementEvent | TargetResetEvent).generation ?? 0) < nextGeneration
  );

  for (let start = 0; start < oldEntries.length; start += 450) {
    const batch = writeBatch(firestore());
    oldEntries.slice(start, start + 450).forEach((entry) => batch.delete(entry.ref));
    try {
      await batch.commit();
    } catch {
      throw new Error(
        'Target đã được thiết lập lại và lịch sử cũ đã ẩn, nhưng chưa xóa hết bản ghi trên máy chủ. Hãy xác nhận lại để thử dọn tiếp.'
      );
    }
  }
}

export function subscribeHistory(
  uid: string,
  generation: number,
  onValue: (entries: DecrementHistoryEntry[]) => void,
  onError: (error: Error) => void
): () => void {
  const historyQuery = query(
    collection(targetRef(uid), 'decrements'),
    orderBy('recordedAt', 'desc'),
    limit(100)
  );

  return onSnapshot(
    historyQuery,
    (snapshot) =>
      onValue(
        snapshot.docs
          .filter(
            (entry) =>
              ((entry.data() as DecrementEvent | TargetResetEvent).generation ?? 0) === generation
          )
          .map((entry) => ({
            id: entry.id,
            ...(entry.data() as DecrementEvent | TargetResetEvent)
          }))
      ),
    onError
  );
}

export function subscribeReminderSettings(
  uid: string,
  onValue: (settings: ReminderSettings | null) => void,
  onError: (error: Error) => void
): () => void {
  return onSnapshot(
    reminderRef(uid),
    (snapshot) => onValue(snapshot.exists() ? (snapshot.data() as ReminderSettings) : null),
    onError
  );
}

export async function saveReminderSettings(
  uid: string,
  settings: Pick<ReminderSettings, 'enabled' | 'timezone' | 'times'>
): Promise<void> {
  const uniqueTimes = [...new Set(settings.times)].sort();
  if (uniqueTimes.length !== settings.times.length || uniqueTimes.length > 24) {
    throw new Error('Giờ nhắc không được trùng nhau và tối đa 24 mốc mỗi ngày.');
  }
  if (uniqueTimes.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) {
    throw new Error('Giờ nhắc không đúng định dạng.');
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: settings.timezone });
  } catch {
    throw new Error('Múi giờ không hợp lệ.');
  }

  await setDoc(reminderRef(uid), {
    enabled: settings.enabled,
    timezone: settings.timezone,
    times: uniqueTimes,
    updatedAt: serverTimestamp()
  });
}

export const DEFAULT_REMINDER_SETTINGS: Pick<ReminderSettings, 'enabled' | 'timezone' | 'times'> = {
  enabled: false,
  timezone: DEFAULT_TIMEZONE,
  times: ['09:00']
};

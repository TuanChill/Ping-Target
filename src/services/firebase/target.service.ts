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
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp
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
): Promise<string> {
  const label = input.label.trim();
  const unit = input.unit.trim();
  if (!Number.isSafeInteger(input.targetUnits) || input.targetUnits <= 0) {
    throw new Error('Mục tiêu phải là số nguyên lớn hơn 0.');
  }
  if (!label || label.length > 80 || !unit || unit.length > 24) {
    throw new Error('Tên mục tiêu hoặc đơn vị không hợp lệ.');
  }

  const parentRef = targetRef(uid);
  const eventRef = doc(collection(parentRef, 'decrements'));
  const eventId = eventRef.id;

  try {
    await runTransaction(firestore(), async (transaction) => {
      const targetSnapshot = await transaction.get(parentRef);
      if (!targetSnapshot.exists()) throw new Error('Chưa thiết lập mục tiêu.');

      const target = targetSnapshot.data() as Target;
      if (
        target.label === label &&
        target.unit === unit &&
        target.targetUnits === input.targetUnits &&
        target.remainingUnits === input.targetUnits
      ) {
        throw new Error('Thiết lập mục tiêu mới phải khác thiết lập hiện tại.');
      }

      const event: TargetResetEvent = {
        kind: 'reset',
        previousLabel: target.label,
        newLabel: label,
        previousUnit: target.unit,
        newUnit: unit,
        previousTargetUnits: target.targetUnits,
        newTargetUnits: input.targetUnits,
        previousRemainingUnits: target.remainingUnits,
        newRemainingUnits: input.targetUnits,
        recordedAt: Timestamp.now(),
        actorUid: uid
      };

      transaction.set(eventRef, { ...event, recordedAt: serverTimestamp() });
      transaction.update(parentRef, {
        label,
        unit,
        targetUnits: input.targetUnits,
        remainingUnits: input.targetUnits,
        lastEventId: eventId,
        updatedAt: serverTimestamp()
      });
    });

    return eventId;
  } catch (error) {
    const eventSnapshot = await getDoc(eventRef).catch(() => null);
    if (eventSnapshot?.exists()) return eventId;
    throw error;
  }
}

export function subscribeHistory(
  uid: string,
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
        snapshot.docs.map((entry) => ({
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

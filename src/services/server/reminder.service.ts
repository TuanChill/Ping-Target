import 'server-only';

import { FieldValue, Timestamp, type DocumentReference } from 'firebase-admin/firestore';

import { getFirebaseAdmin } from '@/lib/firebase/admin';
import { getLocalReminderClock, isValidReminderSettings } from '@/lib/reminder-time';

type ReminderResult = { status: 'sent' | 'not-due' | 'disabled' | 'busy' | 'not-configured' };

function formatMessage(
  target: {
    label: string;
    unit: string;
    targetUnits: number;
    remainingUnits: number;
  },
  date: Date,
  timezone: string
): string {
  const completed = target.targetUnits - target.remainingUnits;
  const time = new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone
  }).format(date);

  return [
    `🎯 ${target.label}`,
    `Đã đạt: ${completed.toLocaleString('vi-VN')} / ${target.targetUnits.toLocaleString('vi-VN')} ${target.unit}`,
    `Còn lại: ${target.remainingUnits.toLocaleString('vi-VN')} ${target.unit}`,
    `Cập nhật lúc ${time}`
  ].join('\n');
}

async function claimSlot(
  db: ReturnType<typeof getFirebaseAdmin>['db'],
  runRef: DocumentReference,
  now: Date
): Promise<boolean> {
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(runRef);
    if (snapshot.exists) {
      const data = snapshot.data();
      if (data?.status === 'sent') return false;
      if (data?.status === 'sending' && data.claimedAt instanceof Timestamp) {
        if (now.getTime() - data.claimedAt.toMillis() < 5 * 60_000) return false;
      }
      if (data?.status === 'failed' && data.nextAttemptAt instanceof Timestamp) {
        if (data.nextAttemptAt.toMillis() > now.getTime()) return false;
      }
    }

    transaction.set(
      runRef,
      {
        status: 'sending',
        claimedAt: Timestamp.fromDate(now),
        attempts: (snapshot.data()?.attempts ?? 0) + 1,
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    return true;
  });
}

export async function sendDueReminder(now = new Date()): Promise<ReminderResult> {
  const ownerUid = process.env.REMINDER_OWNER_UID;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!ownerUid || !botToken || !chatId) return { status: 'not-configured' };

  const { db } = getFirebaseAdmin();
  const userRef = db.collection('users').doc(ownerUid);
  const [targetSnapshot, settingsSnapshot] = await Promise.all([
    userRef.collection('targets').doc('primary').get(),
    userRef.collection('settings').doc('reminders').get()
  ]);
  if (!targetSnapshot.exists || !settingsSnapshot.exists) return { status: 'disabled' };

  const settings: unknown = settingsSnapshot.data();
  if (!isValidReminderSettings(settings)) throw new Error('Reminder settings are invalid.');
  if (!settings.enabled || settings.times.length === 0) return { status: 'disabled' };

  const clock = getLocalReminderClock(now, settings.timezone);
  const dueTimes = [...settings.times].sort().filter((time) => time <= clock.time);
  if (dueTimes.length === 0) return { status: 'not-due' };

  const runs = userRef.collection('notificationRuns');
  for (const time of dueTimes) {
    const slotId = `${clock.date}_${time.replace(':', '')}`;
    const runRef = runs.doc(slotId);
    const claimed = await claimSlot(db, runRef, now);
    if (!claimed) {
      const snapshot = await runRef.get();
      if (snapshot.data()?.status === 'sent') continue;

      return { status: 'busy' };
    }

    try {
      const target = targetSnapshot.data() as {
        label: string;
        unit: string;
        targetUnits: number;
        remainingUnits: number;
      };
      const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: formatMessage(target, now, settings.timezone),
          disable_web_page_preview: true
        })
      });
      if (!telegramResponse.ok) throw new Error('Telegram request failed.');
      const payload: unknown = await telegramResponse.json();
      if (!payload || typeof payload !== 'object' || !('ok' in payload) || payload.ok !== true) {
        throw new Error('Telegram rejected the message.');
      }
      await runRef.set({ status: 'sent', sentAt: FieldValue.serverTimestamp() }, { merge: true });

      return { status: 'sent' };
    } catch (error) {
      await runRef.set(
        {
          status: 'failed',
          nextAttemptAt: Timestamp.fromDate(new Date(now.getTime() + 5 * 60_000)),
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
      throw error;
    }
  }

  return { status: 'not-due' };
}

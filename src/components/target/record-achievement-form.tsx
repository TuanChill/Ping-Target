'use client';

import { recordAchievement } from '@/services/firebase/target.service';
import { FormEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type RecordAchievementFormProps = {
  uid: string;
  remainingUnits: number;
  unit: string;
  onSaved: () => void;
};

function localDateTimeValue(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function RecordAchievementForm({
  uid,
  remainingUnits,
  unit,
  onSaved
}: RecordAchievementFormProps) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [occurredAt, setOccurredAt] = useState(localDateTimeValue(new Date()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!Number.isSafeInteger(Number(amount)) || Number(amount) <= 0) {
      setError('Vui lòng nhập một số nguyên lớn hơn 0.');

      return;
    }
    if (Number(amount) > remainingUnits) {
      setError('Số vừa nhập lớn hơn mục tiêu còn lại.');

      return;
    }
    setSaving(true);
    setError(null);
    try {
      await recordAchievement(uid, {
        amountUnits: Number(amount),
        reason,
        occurredAt: new Date(occurredAt)
      });
      setAmount('');
      setReason('');
      setOccurredAt(localDateTimeValue(new Date()));
      onSaved();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Chưa thể ghi nhận. Vui lòng thử lại.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="achievement-amount"
            className="mb-2 block text-sm font-medium text-stone-700"
          >
            Số vừa đạt ({unit})
          </label>
          <Input
            id="achievement-amount"
            type="number"
            inputMode="numeric"
            min="1"
            max={remainingUnits}
            step="1"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
            placeholder="0"
            className="h-12 rounded-xl border-stone-200 bg-white px-4 text-lg tabular-nums"
          />
        </div>
        <div>
          <label
            htmlFor="achievement-time"
            className="mb-2 block text-sm font-medium text-stone-700"
          >
            Thời điểm đạt được
          </label>
          <Input
            id="achievement-time"
            type="datetime-local"
            max={localDateTimeValue(new Date())}
            value={occurredAt}
            onChange={(event) => setOccurredAt(event.target.value)}
            required
            className="h-12 rounded-xl border-stone-200 bg-white px-4"
          />
        </div>
      </div>
      <div>
        <label
          htmlFor="achievement-reason"
          className="mb-2 block text-sm font-medium text-stone-700"
        >
          Lý do / ghi chú
        </label>
        <textarea
          id="achievement-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          required
          maxLength={280}
          rows={3}
          placeholder="Bạn đã làm gì để đạt được con số này?"
          className="w-full resize-y rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
        />
        <div className="mt-1 text-right text-xs text-stone-400">{reason.length}/280</div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      )}
      <Button
        disabled={saving || remainingUnits === 0}
        className="h-12 w-full rounded-xl bg-stone-950 text-white hover:bg-stone-800"
      >
        {saving
          ? 'Đang ghi nhận…'
          : remainingUnits === 0
            ? 'Đã hoàn thành mục tiêu'
            : 'Ghi nhận tiến độ'}
      </Button>
    </form>
  );
}

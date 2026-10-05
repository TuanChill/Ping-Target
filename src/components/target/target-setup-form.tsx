'use client';

import { createTarget } from '@/services/firebase/target.service';
import { FormEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type TargetSetupFormProps = {
  uid: string;
  onCreated: () => void;
};

export function TargetSetupForm({ uid, onCreated }: TargetSetupFormProps) {
  const [label, setLabel] = useState('Mục tiêu của tôi');
  const [unit, setUnit] = useState('lần');
  const [target, setTarget] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createTarget(uid, { label, unit, targetUnits: Number(target) });
      onCreated();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Không thể lưu mục tiêu.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="target-label" className="mb-2 block text-sm font-medium text-stone-700">
          Tên mục tiêu
        </label>
        <Input
          id="target-label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          maxLength={80}
          required
          className="h-12 rounded-xl border-stone-200 bg-white px-4"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_150px]">
        <div>
          <label htmlFor="target-total" className="mb-2 block text-sm font-medium text-stone-700">
            Con số cần đạt
          </label>
          <Input
            id="target-total"
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            required
            placeholder="Ví dụ: 100"
            className="h-12 rounded-xl border-stone-200 bg-white px-4 text-lg tabular-nums"
          />
        </div>
        <div>
          <label htmlFor="target-unit" className="mb-2 block text-sm font-medium text-stone-700">
            Đơn vị
          </label>
          <Input
            id="target-unit"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            maxLength={24}
            required
            className="h-12 rounded-xl border-stone-200 bg-white px-4"
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      )}
      <Button
        disabled={saving}
        className="h-12 w-full rounded-xl bg-stone-950 text-white hover:bg-stone-800"
      >
        {saving ? 'Đang lưu…' : 'Bắt đầu theo dõi'}
      </Button>
    </form>
  );
}

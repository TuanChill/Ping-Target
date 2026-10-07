'use client';

import { createTarget, resetTarget } from '@/services/firebase/target.service';
import type { Target } from '@/types/target';
import { FormEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type TargetSetupFormProps = {
  uid: string;
  onCreated: () => void;
  currentTarget?: Target;
  onCancel?: () => void;
};

export function TargetSetupForm({ uid, onCreated, currentTarget, onCancel }: TargetSetupFormProps) {
  const [label, setLabel] = useState(currentTarget?.label ?? 'Mục tiêu của tôi');
  const [unit, setUnit] = useState(currentTarget?.unit ?? 'lần');
  const [target, setTarget] = useState(currentTarget ? String(currentTarget.targetUnits) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = { label, unit, targetUnits: Number(target) };
    if (
      currentTarget &&
      !window.confirm(
        `Thiết lập lại target dùng chung thành “${label}” — ${Number(target).toLocaleString('vi-VN')} ${unit}? Mọi khách truy cập sẽ thấy thiết lập mới và tiến độ bắt đầu từ 0. Lịch sử cũ vẫn được giữ.`
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (currentTarget) await resetTarget(uid, input);
      else await createTarget(uid, input);
      onCreated();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Không thể lưu mục tiêu.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {currentTarget && (
        <p className="text-sm leading-6 text-stone-600">
          Cập nhật tên, con số và đơn vị. Tiến độ sẽ bắt đầu lại từ 0, còn lịch sử cũ sẽ được giữ.
        </p>
      )}
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
      <div className="flex flex-col gap-2 sm:flex-row">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="h-12 rounded-xl">
            Hủy
          </Button>
        )}
        <Button
          disabled={saving}
          className="h-12 flex-1 rounded-xl bg-stone-950 text-white hover:bg-stone-800"
        >
          {saving ? 'Đang lưu…' : currentTarget ? 'Đặt lại và bắt đầu' : 'Bắt đầu theo dõi'}
        </Button>
      </div>
    </form>
  );
}

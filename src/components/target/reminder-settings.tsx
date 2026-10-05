'use client';

import {
  DEFAULT_REMINDER_SETTINGS,
  saveReminderSettings
} from '@/services/firebase/target.service';
import type { ReminderSettings } from '@/types/target';
import { Bell, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ReminderSettingsProps = {
  uid: string;
  savedSettings: ReminderSettings | null;
  onSaved: () => void;
};

function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_REMINDER_SETTINGS.timezone;
}

export function ReminderSettingsPanel({ uid, savedSettings, onSaved }: ReminderSettingsProps) {
  const [enabled, setEnabled] = useState(
    savedSettings?.enabled ?? DEFAULT_REMINDER_SETTINGS.enabled
  );
  const [timezone, setTimezone] = useState(savedSettings?.timezone ?? getBrowserTimezone());
  const [times, setTimes] = useState(savedSettings?.times ?? DEFAULT_REMINDER_SETTINGS.times);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!savedSettings) return;
    setEnabled(savedSettings.enabled);
    setTimezone(savedSettings.timezone);
    setTimes(savedSettings.times);
  }, [savedSettings]);

  function updateTime(index: number, value: string) {
    setTimes((current) => current.map((time, i) => (i === index ? value : time)));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await saveReminderSettings(uid, { enabled, timezone: timezone.trim(), times });
      setMessage('Đã lưu lịch nhắc. Telegram sẽ nhắc ở các khung giờ đã chọn.');
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể lưu lịch nhắc.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700">
            <Bell size={19} aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-semibold text-stone-900">Nhắc nhở Telegram</h2>
            <p className="mt-1 text-sm leading-6 text-stone-500">
              Nhận số mục tiêu còn lại vào các giờ bạn chọn.
            </p>
          </div>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm text-stone-600">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="h-4 w-4 accent-stone-900"
          />
          Bật
        </label>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="reminder-timezone"
            className="mb-2 block text-sm font-medium text-stone-700"
          >
            Múi giờ
          </label>
          <Input
            id="reminder-timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            placeholder="Asia/Ho_Chi_Minh"
            className="h-11 rounded-xl border-stone-200 bg-stone-50 px-3"
          />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-stone-700">Giờ nhắc mỗi ngày</span>
            <button
              type="button"
              onClick={() => setTimes((current) => [...current, '18:00'])}
              disabled={times.length >= 24}
              className="inline-flex items-center gap-1 text-xs font-semibold text-stone-700 hover:text-stone-950 disabled:opacity-40"
            >
              <Plus size={14} aria-hidden="true" /> Thêm giờ
            </button>
          </div>
          <div className="space-y-2">
            {times.map((time, index) => (
              <div key={`${index}-${time}`} className="flex items-center gap-2">
                <Input
                  aria-label={`Giờ nhắc ${index + 1}`}
                  type="time"
                  value={time}
                  onChange={(event) => updateTime(index, event.target.value)}
                  className="h-11 rounded-xl border-stone-200 bg-stone-50 px-3"
                />
                <button
                  type="button"
                  aria-label={`Xóa giờ nhắc ${time}`}
                  onClick={() => setTimes((current) => current.filter((_, i) => i !== index))}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-stone-400 hover:bg-rose-50 hover:text-rose-700"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
            {times.length === 0 && <p className="text-xs text-stone-500">Chưa có giờ nhắc nào.</p>}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-stone-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-xs leading-5 text-stone-500">
          Lịch có thể trễ khoảng một phút. Cấu hình bot Telegram được lưu ở môi trường triển khai.
        </p>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving}
          variant="outline"
          className="h-10 rounded-xl border-stone-300 px-4"
        >
          {saving ? 'Đang lưu…' : 'Lưu lịch nhắc'}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-emerald-700">
          {message}
        </p>
      )}
    </section>
  );
}

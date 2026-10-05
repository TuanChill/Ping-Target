'use client';

import type { DecrementHistoryEntry } from '@/types/target';
import { ArrowDownRight, Clock3 } from 'lucide-react';

type DecrementHistoryProps = {
  entries: DecrementHistoryEntry[];
  unit: string;
};

function formatDate(value: DecrementHistoryEntry['occurredAt']): string {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(value.toDate());
}

export function DecrementHistory({ entries, unit }: DecrementHistoryProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4 sm:px-6">
        <div>
          <h2 className="font-semibold text-stone-900">Lịch sử tiến độ</h2>
          <p className="mt-1 text-sm text-stone-500">Mỗi bước đều được lưu lại.</p>
        </div>
        <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs tabular-nums text-stone-500">
          {entries.length} lần
        </span>
      </div>
      {entries.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-stone-100 text-stone-400">
            <Clock3 size={18} aria-hidden="true" />
          </div>
          <p className="mt-3 text-sm font-medium text-stone-700">Chưa có lần ghi nhận nào</p>
          <p className="mt-1 text-sm text-stone-500">Bước đầu tiên của bạn sẽ xuất hiện ở đây.</p>
        </div>
      ) : (
        <ol className="divide-y divide-stone-100">
          {entries.map((entry) => (
            <li key={entry.id} className="flex gap-3 px-5 py-4 sm:gap-4 sm:px-6">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                <ArrowDownRight size={17} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="font-semibold tabular-nums text-stone-900">
                    −{entry.amountUnits.toLocaleString('vi-VN')} {unit}
                  </p>
                  <time className="text-xs text-stone-500">{formatDate(entry.occurredAt)}</time>
                </div>
                <p className="mt-1 break-words text-sm leading-6 text-stone-600">{entry.reason}</p>
                <p className="mt-1 text-xs text-stone-400">
                  Còn {entry.newRemainingUnits.toLocaleString('vi-VN')} {unit} sau lần này
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

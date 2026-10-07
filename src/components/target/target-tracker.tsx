'use client';

import { useFirebaseAuth } from '@/providers/firebase-auth-provider';
import {
  subscribeHistory,
  subscribeReminderSettings,
  subscribeTarget
} from '@/services/firebase/target.service';
import type { DecrementHistoryEntry, ReminderSettings, Target } from '@/types/target';
import {
  Activity,
  ArrowUpRight,
  Check,
  CircleHelp,
  LockKeyhole,
  RotateCcw,
  Target as TargetIcon
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { DecrementHistory } from '@/components/target/decrement-history';
import { RecordAchievementForm } from '@/components/target/record-achievement-form';
import { ReminderSettingsPanel } from '@/components/target/reminder-settings';
import { TargetSetupForm } from '@/components/target/target-setup-form';
import { Button } from '@/components/ui/button';

function formatNumber(value: number): string {
  return value.toLocaleString('vi-VN');
}

function LoadingScreen() {
  return (
    <main className="min-h-screen bg-[#f6f5f2] px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl animate-pulse">
        <div className="h-6 w-32 rounded bg-stone-200" />
        <div className="mt-16 h-8 w-64 rounded bg-stone-200" />
        <div className="mt-4 h-5 w-96 max-w-full rounded bg-stone-200" />
        <div className="mt-10 h-64 rounded-3xl bg-stone-200" />
      </div>
    </main>
  );
}

function SetupNotice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f5f2] px-5 py-12">
      <section className="w-full max-w-xl rounded-3xl border border-stone-200 bg-white p-7 shadow-sm sm:p-10">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-800">
          <CircleHelp size={22} aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-stone-950">{title}</h1>
        <div className="mt-3 text-sm leading-7 text-stone-600">{children}</div>
      </section>
    </main>
  );
}

export function TargetTracker() {
  const { user, loading: authLoading, configured, error: authError } = useFirebaseAuth();
  const [target, setTarget] = useState<Target | null>(null);
  const [history, setHistory] = useState<DecrementHistoryEntry[]>([]);
  const [reminders, setReminders] = useState<ReminderSettings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingSetup, setEditingSetup] = useState(false);
  const setupDialogRef = useRef<HTMLDialogElement>(null);
  const historyGeneration = target?.historyGeneration ?? 0;

  useEffect(() => {
    if (!user) return;
    setLoaded(false);
    setStreamError(null);
    const stopTarget = subscribeTarget(
      user.uid,
      (value) => {
        setTarget(value);
        setLoaded(true);
      },
      () => {
        setStreamError('Không thể tải dữ liệu. Kiểm tra cấu hình Firebase rồi thử tải lại trang.');
        setLoaded(true);
      }
    );
    const stopHistory = subscribeHistory(user.uid, historyGeneration, setHistory, () =>
      setStreamError('Không thể tải lịch sử tiến độ.')
    );
    const stopReminders = subscribeReminderSettings(user.uid, setReminders, () =>
      setStreamError('Không thể tải cài đặt nhắc nhở.')
    );

    return () => {
      stopTarget();
      stopHistory();
      stopReminders();
    };
  }, [user, refreshKey, historyGeneration]);

  useEffect(() => {
    const dialog = setupDialogRef.current;
    if (!dialog || !editingSetup) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }, [editingSetup]);

  if (!configured) {
    return (
      <SetupNotice title="Cần kết nối Firebase">
        <p>Thêm cấu hình ứng dụng Firebase vào môi trường local hoặc Vercel:</p>
        <code className="mt-3 block rounded-xl bg-stone-100 p-4 text-xs leading-6 text-stone-700">
          NEXT_PUBLIC_FIREBASE_API_KEY
          <br />
          NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
          <br />
          NEXT_PUBLIC_FIREBASE_PROJECT_ID
          <br />
          NEXT_PUBLIC_FIREBASE_APP_ID
        </code>
        <p className="mt-4">
          Bật Anonymous Authentication và Cloud Firestore trong Firebase Console.
        </p>
      </SetupNotice>
    );
  }

  if (authError) {
    return <SetupNotice title="Chưa thể mở Ping Target">{authError}</SetupNotice>;
  }

  if (authLoading || !user || !loaded) return <LoadingScreen />;

  if (streamError) {
    return (
      <SetupNotice title="Không tải được dữ liệu">
        <p>{streamError}</p>
        <Button onClick={() => setRefreshKey((key) => key + 1)} className="mt-5 rounded-xl">
          Thử lại
        </Button>
      </SetupNotice>
    );
  }

  if (!target) {
    return (
      <main className="min-h-screen bg-[#f6f5f2] px-5 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-5xl">
          <BrandHeader />
          <section className="mt-14 grid gap-10 rounded-3xl border border-stone-200 bg-white p-6 sm:mt-20 sm:grid-cols-[1.1fr_0.9fr] sm:p-10">
            <div className="flex flex-col justify-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Bắt đầu từ đây
              </p>
              <h1 className="mt-4 max-w-md text-4xl font-semibold leading-tight tracking-tight text-stone-950 sm:text-5xl">
                Một mục tiêu lớn, từng bước nhỏ.
              </h1>
              <p className="mt-5 max-w-md text-base leading-7 text-stone-600">
                Đặt con số bạn muốn chạm tới. Mỗi lần ghi nhận sẽ giúp bạn thấy mình đã đi được bao
                xa.
              </p>
              <div className="mt-8 flex items-center gap-2 text-xs text-stone-500">
                <LockKeyhole size={14} aria-hidden="true" />
                Riêng tư trong trình duyệt này
              </div>
            </div>
            <div className="rounded-2xl bg-[#f7f6f3] p-5 sm:p-6">
              <h2 className="mb-5 text-lg font-semibold text-stone-900">Thiết lập mục tiêu</h2>
              <TargetSetupForm uid={user.uid} onCreated={() => setRefreshKey((key) => key + 1)} />
            </div>
          </section>
        </div>
      </main>
    );
  }

  const completedUnits = target.targetUnits - target.remainingUnits;
  const progress = Math.min(100, Math.round((completedUnits / target.targetUnits) * 100));

  return (
    <main className="min-h-screen bg-[#f6f5f2] px-5 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <BrandHeader />

        <section className="relative mt-10 overflow-hidden rounded-3xl bg-[#1b2924] px-6 py-7 text-white sm:mt-12 sm:px-10 sm:py-9">
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                Mục tiêu hiện tại
              </p>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                {target.label}
              </h1>
              <p className="mt-2 text-sm text-stone-300">
                {formatNumber(completedUnits)} / {formatNumber(target.targetUnits)} {target.unit} đã
                hoàn thành
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-right">
              <p className="text-xs text-stone-300">Tiến độ</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{progress}%</p>
            </div>
          </div>
          <div className="relative z-10 mt-8 h-2 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-emerald-300 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="relative z-10 mt-3 flex justify-between text-xs text-stone-300">
            <span>0</span>
            <span>
              {formatNumber(target.targetUnits)} {target.unit}
            </span>
          </div>
          <div
            aria-hidden="true"
            className="absolute -right-10 -top-24 h-72 w-72 rounded-full border border-white/10"
          />
          <div
            aria-hidden="true"
            className="absolute -right-2 -top-16 h-56 w-56 rounded-full border border-white/10"
          />
        </section>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <SummaryCard
            label="Mục tiêu"
            value={target.targetUnits}
            unit={target.unit}
            icon={<TargetIcon size={18} />}
          />
          <SummaryCard
            label="Đã đạt được"
            value={completedUnits}
            unit={target.unit}
            icon={<Check size={18} />}
            tone="green"
          />
          <SummaryCard
            label="Còn lại"
            value={target.remainingUnits}
            unit={target.unit}
            icon={<Activity size={18} />}
            tone="amber"
          />
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-stone-600">
            Thiết lập lại tên, con số và đơn vị mục tiêu; lịch sử tiến độ sẽ được xóa.
          </p>
          <div className="flex shrink-0 flex-col items-start gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setEditingSetup((value) => !value);
              }}
            >
              <RotateCcw size={16} aria-hidden="true" />
              {editingSetup ? 'Đóng thiết lập' : 'Thiết lập lại target'}
            </Button>
          </div>
        </div>

        {editingSetup && (
          <dialog
            ref={setupDialogRef}
            aria-labelledby="setup-target-title"
            aria-modal="true"
            onCancel={() => setEditingSetup(false)}
            onClose={() => setEditingSetup(false)}
            className="fixed inset-0 m-auto max-h-[90vh] w-[min(42rem,calc(100%-2rem))] overflow-y-auto rounded-3xl border border-stone-200 bg-white p-5 shadow-2xl backdrop:bg-stone-950/50 sm:p-7"
          >
            <h2 id="setup-target-title" className="mb-5 font-semibold text-stone-900">
              Thiết lập lại mục tiêu
            </h2>
            <TargetSetupForm
              uid={user.uid}
              currentTarget={target}
              onCreated={() => {
                setEditingSetup(false);
                setRefreshKey((key) => key + 1);
              }}
              onCancel={() => setEditingSetup(false)}
            />
          </dialog>
        )}

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[1.08fr_0.92fr]">
          <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-stone-900">Ghi nhận tiến độ</h2>
                <p className="mt-1 text-sm leading-6 text-stone-500">
                  Mỗi cập nhật sẽ được lưu vào lịch sử mục tiêu.
                </p>
              </div>
              <span className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                − {formatNumber(target.remainingUnits)} còn lại
              </span>
            </div>
            <RecordAchievementForm
              uid={user.uid}
              remainingUnits={target.remainingUnits}
              unit={target.unit}
              onSaved={() => setRefreshKey((key) => key + 1)}
            />
          </section>

          <ReminderSettingsPanel
            uid={user.uid}
            savedSettings={reminders}
            onSaved={() => setRefreshKey((key) => key + 1)}
          />
        </div>

        <div className="mt-5">
          <DecrementHistory entries={history} unit={target.unit} />
        </div>

        <footer className="flex flex-col gap-2 py-8 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            <LockKeyhole size={13} aria-hidden="true" /> Dữ liệu riêng tư của trình duyệt này
          </span>
          <span>
            {history.length >= 100
              ? 'Hiển thị 100 cập nhật gần nhất'
              : `${history.length} cập nhật đã ghi nhận`}
          </span>
        </footer>
      </div>
    </main>
  );
}

function BrandHeader() {
  return (
    <header className="flex items-center justify-between">
      <Link href="/" className="flex items-center gap-3" aria-label="Ping Target trang chủ">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-800 text-white">
          <TargetIcon size={19} aria-hidden="true" />
        </span>
        <span>
          <span className="block text-sm font-semibold tracking-tight text-stone-950">
            Ping Target
          </span>
          <span className="block text-xs text-stone-500">Từng bước tới đích</span>
        </span>
      </Link>
      <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        Lưu riêng tư
        <ArrowUpRight size={13} aria-hidden="true" />
      </div>
    </header>
  );
}

function SummaryCard({
  label,
  value,
  unit,
  icon,
  tone = 'stone'
}: {
  label: string;
  value: number;
  unit: string;
  icon: React.ReactNode;
  tone?: 'stone' | 'green' | 'amber';
}) {
  const colors = {
    stone: 'bg-stone-100 text-stone-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700'
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-stone-500">{label}</span>
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${colors[tone]}`}>{icon}</span>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums text-stone-950">
        {formatNumber(value)} <span className="text-sm font-medium text-stone-500">{unit}</span>
      </p>
    </div>
  );
}

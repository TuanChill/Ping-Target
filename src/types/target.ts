import type { Timestamp } from 'firebase/firestore';

export type Target = {
  label: string;
  unit: string;
  targetUnits: number;
  remainingUnits: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastEventId: string | null;
};

export type DecrementEvent = {
  kind?: 'decrement';
  unit?: string;
  amountUnits: number;
  reason: string;
  occurredAt: Timestamp;
  recordedAt: Timestamp;
  previousRemainingUnits: number;
  newRemainingUnits: number;
  actorUid: string;
};

export type ReminderSettings = {
  enabled: boolean;
  timezone: string;
  times: string[];
  updatedAt?: Timestamp;
};

export type TargetResetEvent = {
  kind: 'reset';
  previousLabel?: string;
  newLabel?: string;
  previousUnit?: string;
  newUnit?: string;
  previousTargetUnits?: number;
  newTargetUnits?: number;
  previousRemainingUnits: number;
  newRemainingUnits: number;
  recordedAt: Timestamp;
  actorUid: string;
};

export type DecrementHistoryEntry = (DecrementEvent | TargetResetEvent) & { id: string };

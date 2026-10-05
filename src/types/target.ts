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

export type DecrementHistoryEntry = DecrementEvent & { id: string };

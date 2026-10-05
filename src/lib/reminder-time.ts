export type LocalReminderClock = { date: string; time: string };

export function getLocalReminderClock(date: Date, timezone: string): LocalReminderClock {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`
  };
}

export function isValidReminderSettings(value: unknown): value is {
  enabled: boolean;
  timezone: string;
  times: string[];
} {
  if (!value || typeof value !== 'object') return false;
  const settings = value as Record<string, unknown>;
  if (
    typeof settings.enabled !== 'boolean' ||
    typeof settings.timezone !== 'string' ||
    !Array.isArray(settings.times) ||
    settings.times.length > 24 ||
    !settings.times.every(
      (time) => typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
    )
  ) {
    return false;
  }
  if (new Set(settings.times).size !== settings.times.length) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: settings.timezone });

    return settings.timezone.length > 0 && settings.timezone.length <= 64;
  } catch {
    return false;
  }
}

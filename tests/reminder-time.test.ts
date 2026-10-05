import { getLocalReminderClock, isValidReminderSettings } from '@/lib/reminder-time';

describe('reminder clock', () => {
  it('uses the configured local timezone, including date rollover', () => {
    expect(getLocalReminderClock(new Date('2026-10-05T17:00:00.000Z'), 'Asia/Ho_Chi_Minh')).toEqual(
      {
        date: '2026-10-06',
        time: '00:00'
      }
    );
  });

  it('rejects malformed, duplicate, and unknown-timezone settings', () => {
    expect(
      isValidReminderSettings({ enabled: true, timezone: 'Asia/Ho_Chi_Minh', times: ['08:30'] })
    ).toBe(true);
    expect(
      isValidReminderSettings({ enabled: true, timezone: 'Asia/Ho_Chi_Minh', times: ['8:30'] })
    ).toBe(false);
    expect(
      isValidReminderSettings({
        enabled: true,
        timezone: 'Asia/Ho_Chi_Minh',
        times: ['08:30', '08:30']
      })
    ).toBe(false);
    expect(isValidReminderSettings({ enabled: true, timezone: 'Mars/Olympus', times: [] })).toBe(
      false
    );
  });
});

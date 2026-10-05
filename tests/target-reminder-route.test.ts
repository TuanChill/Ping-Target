/** @jest-environment node */

import { GET } from '@/app/api/cron/target-reminder/route';
import { sendDueReminder } from '@/services/server/reminder.service';

jest.mock('@/services/server/reminder.service', () => ({
  sendDueReminder: jest.fn()
}));

const sendDueReminderMock = jest.mocked(sendDueReminder);

describe('target reminder route', () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret';
    sendDueReminderMock.mockReset();
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it('rejects missing or invalid scheduler authorization before reading Firebase', async () => {
    const response = await GET(new Request('https://example.test/api/cron/target-reminder'));
    expect(response.status).toBe(401);
    expect(sendDueReminderMock).not.toHaveBeenCalled();
  });

  it('runs the delivery check for a valid scheduler secret', async () => {
    sendDueReminderMock.mockResolvedValue({ status: 'sent' });
    const response = await GET(
      new Request('https://example.test/api/cron/target-reminder', {
        headers: { authorization: 'Bearer test-secret' }
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'sent' });
    expect(sendDueReminderMock).toHaveBeenCalledTimes(1);
  });

  it('does not expose upstream error details', async () => {
    sendDueReminderMock.mockRejectedValue(new Error('private firebase detail'));
    const response = await GET(
      new Request('https://example.test/api/cron/target-reminder', {
        headers: { authorization: 'Bearer test-secret' }
      })
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'Reminder delivery failed.' });
  });
});

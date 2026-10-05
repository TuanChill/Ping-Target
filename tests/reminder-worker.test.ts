/** @jest-environment node */

import reminderWorker from '../workers/reminder/index';

describe('reminder worker', () => {
  afterEach(() => jest.restoreAllMocks());

  it('invokes the secured Vercel endpoint with the Worker secret', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('ok'));
    let pending: Promise<unknown> | undefined;

    await reminderWorker.scheduled(
      { scheduledTime: Date.now(), cron: '* * * * *' },
      {
        REMINDER_ENDPOINT: 'https://ping-target.example/api/cron/target-reminder',
        REMINDER_SECRET: 'secret'
      },
      {
        waitUntil: (promise) => {
          pending = promise;
        }
      }
    );
    await pending;

    expect(fetchMock).toHaveBeenCalledWith(
      'https://ping-target.example/api/cron/target-reminder',
      expect.objectContaining({ headers: { Authorization: 'Bearer secret' }, method: 'GET' })
    );
  });

  it('fails the scheduled event when Vercel rejects the request', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('unauthorized', { status: 401 }));
    let pending: Promise<unknown> | undefined;
    await reminderWorker.scheduled(
      { scheduledTime: Date.now(), cron: '* * * * *' },
      {
        REMINDER_ENDPOINT: 'https://ping-target.example/api/cron/target-reminder',
        REMINDER_SECRET: 'secret'
      },
      {
        waitUntil: (promise) => {
          pending = promise;
        }
      }
    );
    await expect(pending).rejects.toThrow('Reminder endpoint failed with status 401.');
  });
});

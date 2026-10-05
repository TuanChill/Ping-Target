interface Env {
  REMINDER_ENDPOINT: string;
  REMINDER_SECRET: string;
}

type ScheduledEventLike = { scheduledTime: number; cron: string };
type ExecutionContextLike = { waitUntil(promise: Promise<unknown>): void };

const reminderWorker = {
  async scheduled(
    _controller: ScheduledEventLike,
    env: Env,
    context: ExecutionContextLike
  ): Promise<void> {
    context.waitUntil(
      fetch(env.REMINDER_ENDPOINT, {
        method: 'GET',
        headers: { Authorization: `Bearer ${env.REMINDER_SECRET}` }
      }).then(async (response) => {
        if (!response.ok)
          throw new Error(`Reminder endpoint failed with status ${response.status}.`);
      })
    );
  }
};

export default reminderWorker;

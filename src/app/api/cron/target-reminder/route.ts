import { sendDueReminder } from '@/services/server/reminder.service';
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization');
  if (!secret || !authorization?.startsWith('Bearer ')) return false;

  const expected = Buffer.from(secret);
  const supplied = Buffer.from(authorization.slice('Bearer '.length));

  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await sendDueReminder();

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Reminder delivery failed.' }, { status: 502 });
  }
}

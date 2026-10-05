import { BusinessCode, HttpStatus } from '@tuanchill/business-codes';
import { jsonError, jsonSuccess } from '@tuanchill/business-codes/nextjs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get('fail') === 'true') {
    return jsonError(
      'Simulated failure for testing',
      HttpStatus.NOT_FOUND,
      BusinessCode.RESOURCE_NOT_FOUND
    );
  }

  return jsonSuccess({ pong: true }, '@tuanchill/business-codes wired up correctly');
}

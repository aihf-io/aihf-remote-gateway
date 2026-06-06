import { Env } from './types';

const VERSION = '1.0.0';

export function handleHealth(env: Env): Response {
  return new Response(
    JSON.stringify({
      status: 'healthy',
      gateway: env.GATEWAY_NAME,
      platform: env.AIHF_PLATFORM_URL,
      version: VERSION,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

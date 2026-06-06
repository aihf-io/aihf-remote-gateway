import { Env } from './types';

const ALLOWED_METHODS = 'GET, POST, PUT, DELETE, OPTIONS';
const ALLOWED_HEADERS = 'Content-Type, Authorization, X-AIHF-Org-Id';

function parseAllowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

export function isOriginAllowed(origin: string | null, env: Env): boolean {
  if (!origin) return false;
  const allowed = parseAllowedOrigins(env);
  return allowed.includes(origin);
}

export function addCorsHeaders(response: Response, origin: string, env: Env): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
  headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  headers.set('Access-Control-Expose-Headers', 'X-AIHF-Request-Id');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function handlePreflight(origin: string): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': ALLOWED_METHODS,
      'Access-Control-Allow-Headers': ALLOWED_HEADERS,
      'Access-Control-Max-Age': '86400',
    },
  });
}

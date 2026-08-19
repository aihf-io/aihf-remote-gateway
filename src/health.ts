import { BASE_SECURITY_HEADERS } from './security-headers';

// Finding 5.5: return a minimal status to unauthenticated callers.
// Gateway name, upstream URL and version are kept internal (reconnaissance material).
export function handleHealth(): Response {
  return new Response(
    JSON.stringify({ status: 'ok' }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...BASE_SECURITY_HEADERS },
    },
  );
}

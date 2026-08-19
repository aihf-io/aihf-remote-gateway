// Baseline security headers for gateway-generated responses (health,
// auth/validation errors, 502). Proxied upstream responses keep the
// platform's own headers, minus server-identifying ones (see stripServerHeaders).

export const BASE_SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

// Remove server-identifying headers before returning an upstream response
// to the client (finding 5.8).
export function stripServerHeaders(headers: Headers): void {
  headers.delete('Server');
  headers.delete('X-Powered-By');
}

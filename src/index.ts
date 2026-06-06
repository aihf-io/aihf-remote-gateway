import { Env } from './types';
import { isOriginAllowed, handlePreflight, addCorsHeaders } from './cors';
import { validateAuthToken, validateApiAuth } from './auth-validator';
import { proxyRequest } from './proxy';
import { handleHealth } from './health';

function jsonError(message: string, status: number, proxyError: boolean): Response {
  return new Response(
    JSON.stringify({ error: message, ...(proxyError ? { proxy_error: true } : {}) }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Health check — no CORS needed
    if (path === '/health' || path === '/') {
      return handleHealth(env);
    }

    // Everything below requires origin validation
    const origin = request.headers.get('Origin');

    // OPTIONS preflight
    if (request.method === 'OPTIONS') {
      if (!origin || !isOriginAllowed(origin, env)) {
        return jsonError('Origin not allowed', 403, true);
      }
      return handlePreflight(origin);
    }

    // Only /api/** routes are proxied
    if (!path.startsWith('/api/')) {
      return jsonError(`Not found: ${path}`, 404, true);
    }

    // Origin check for API routes
    if (!origin || !isOriginAllowed(origin, env)) {
      return jsonError('Origin not allowed', 403, true);
    }

    // Auth validation (pre-forward — catches misconfigs before hitting upstream)
    if (path === '/api/auth/token' && request.method === 'POST') {
      const authCheck = await validateAuthToken(request);
      if (!authCheck.valid) {
        return addCorsHeaders(
          jsonError(authCheck.error || 'Invalid auth request', 400, true),
          origin,
          env,
        );
      }
    } else {
      const authCheck = validateApiAuth(request);
      if (!authCheck.valid) {
        return addCorsHeaders(
          jsonError(authCheck.error || 'Unauthorized', 401, true),
          origin,
          env,
        );
      }
    }

    // Proxy to upstream platform
    return proxyRequest(request, env, origin);
  },
} satisfies ExportedHandler<Env>;

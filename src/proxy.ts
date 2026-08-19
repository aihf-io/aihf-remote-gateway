import { Env, ProxyContext } from './types';
import { addCorsHeaders } from './cors';
import { BASE_SECURITY_HEADERS, stripServerHeaders } from './security-headers';

const PASSTHROUGH_HEADERS = [
  'authorization',
  'cookie',
  'content-type',
  'x-aihf-org-id',
  'accept',
];

// Finding 5.11: reject oversized request bodies at the gateway (10 MB).
// The edge (Cloudflare) enforces its own limit; this is a defensive ceiling.
const MAX_REQUEST_BODY_BYTES = 10 * 1024 * 1024;

// Trust headers the gateway sets itself — a client must never be able to
// supply them (finding 5.4).
const GATEWAY_TRUST_HEADERS = ['x-aihf-remote-gateway', 'x-forwarded-for'];

function buildUpstreamUrl(request: Request, platformUrl: string): string {
  const url = new URL(request.url);
  const upstream = new URL(platformUrl);
  upstream.pathname = url.pathname;
  upstream.search = url.search;
  return upstream.toString();
}

function buildUpstreamHeaders(request: Request, ctx: ProxyContext): Headers {
  const headers = new Headers();
  const upstreamHost = new URL(ctx.platformUrl).host;

  // Set host to upstream
  headers.set('Host', upstreamHost);

  // Pass through allowed headers
  for (const name of PASSTHROUGH_HEADERS) {
    const value = request.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }

  // Finding 5.4: the header set is built fresh, but strip the gateway trust
  // headers explicitly so a client-supplied value can never reach the upstream
  // — even if PASSTHROUGH_HEADERS is later widened.
  for (const name of GATEWAY_TRUST_HEADERS) {
    headers.delete(name);
  }

  // Add traceability headers (gateway-controlled, not client-controlled)
  headers.set('X-Forwarded-For', ctx.clientIp);
  headers.set('X-AIHF-Remote-Gateway', ctx.gatewayName);

  // Do NOT pass Origin or Referer — avoids CORS confusion upstream
  return headers;
}

export async function proxyRequest(
  request: Request,
  env: Env,
  origin: string,
): Promise<Response> {
  const upstreamUrl = buildUpstreamUrl(request, env.AIHF_PLATFORM_URL);

  // Finding 5.11: reject oversized bodies before streaming upstream.
  const contentLength = request.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_REQUEST_BODY_BYTES) {
    return addCorsHeaders(
      new Response(
        JSON.stringify({ error: 'Request body too large', proxy_error: true }),
        { status: 413, headers: { 'Content-Type': 'application/json', ...BASE_SECURITY_HEADERS } },
      ),
      origin,
      env,
    );
  }

  const ctx: ProxyContext = {
    clientIp: request.headers.get('cf-connecting-ip') || '0.0.0.0',
    gatewayName: env.GATEWAY_NAME,
    platformUrl: env.AIHF_PLATFORM_URL,
  };

  const upstreamHeaders = buildUpstreamHeaders(request, ctx);

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers: upstreamHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'manual',
    });
  } catch (err) {
    // Finding 5.9: log the detail server-side, return a generic body so
    // internal hostnames / DNS detail are not leaked to the client.
    const message = err instanceof Error ? err.message : 'Unknown upstream error';
    console.error('Upstream connection failed:', message);
    return addCorsHeaders(
      new Response(
        JSON.stringify({ error: 'Upstream connection failed', proxy_error: true }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...BASE_SECURITY_HEADERS } },
      ),
      origin,
      env,
    );
  }

  // For SSE / streaming responses, pass the ReadableStream body through directly
  const responseHeaders = new Headers(upstreamResponse.headers);

  // Strip upstream CORS headers — we set our own
  responseHeaders.delete('Access-Control-Allow-Origin');
  responseHeaders.delete('Access-Control-Allow-Credentials');
  responseHeaders.delete('Access-Control-Allow-Methods');
  responseHeaders.delete('Access-Control-Allow-Headers');

  // Finding 5.8: drop server-identifying headers from the upstream response.
  stripServerHeaders(responseHeaders);

  const proxiedResponse = new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });

  return addCorsHeaders(proxiedResponse, origin, env);
}

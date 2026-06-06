import { Env, ProxyContext } from './types';
import { addCorsHeaders } from './cors';

const PASSTHROUGH_HEADERS = [
  'authorization',
  'cookie',
  'content-type',
  'x-aihf-org-id',
  'accept',
];

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

  // Add traceability headers
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
    const message = err instanceof Error ? err.message : 'Unknown upstream error';
    return addCorsHeaders(
      new Response(
        JSON.stringify({ error: `Upstream connection failed: ${message}`, proxy_error: true }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      ),
      origin,
      env,
    );
  }

  // For SSE / streaming responses, pass the ReadableStream body through directly
  const contentType = upstreamResponse.headers.get('Content-Type') || '';
  const responseHeaders = new Headers(upstreamResponse.headers);

  // Strip upstream CORS headers — we set our own
  responseHeaders.delete('Access-Control-Allow-Origin');
  responseHeaders.delete('Access-Control-Allow-Credentials');
  responseHeaders.delete('Access-Control-Allow-Methods');
  responseHeaders.delete('Access-Control-Allow-Headers');

  const proxiedResponse = new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });

  return addCorsHeaders(proxiedResponse, origin, env);
}

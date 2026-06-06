# AIHF Remote Gateway

A lightweight Cloudflare Worker proxy that enables external app developers to call AIHF workflow steps via API from their own frontends.

The remote gateway sits between your frontend (e.g. `myapp.com`) and the AIHF platform (`app.aihf.io`), handling CORS and forwarding auth credentials on every request. It is fully stateless — no KV, R2, D1, or credential caching.

```
Your Frontend              Remote Gateway Worker           AIHF Platform
(myapp.com)                (api.myapp.com)                 (app.aihf.io)
    |                              |                               |
    |-- POST /api/auth/token ----->|                               |
    |   { entity_id, token }       |-- forward + X-AIHF-Remote --> |
    |                              |<-- { session_id, info } ------|
    |<-- { session_id, info } -----|                               |
    |                              |                               |
    |-- POST /api/v1/app/wf/... ->|                               |
    |   Authorization: Bearer xxx  |-- forward ------------------>|
    |                              |<-- result -------------------|
    |<-- result -------------------|                               |
```

## Quick Start

```bash
# Clone and install
cd workers/aihf-remote-gateway
npm install

# Configure wrangler.toml (see Configuration below)

# Run locally
npm run dev

# Verify
curl http://localhost:8787/health
```

## Configuration

Edit `wrangler.toml` `[vars]` section:

| Variable | Description | Example |
|---|---|---|
| `AIHF_PLATFORM_URL` | Upstream AIHF platform URL | `https://app.aihf.io` |
| `ALLOWED_ORIGINS` | Comma-separated allowed origins | `https://myapp.com,http://localhost:3000` |
| `GATEWAY_NAME` | Identifier for this gateway instance | `myapp-prod-gateway` |

For production, use `wrangler secret` for sensitive overrides or environment-specific `[env.*]` blocks in `wrangler.toml`.

## Auth Flow

Browser cookies from `app.aihf.io` will **not** work cross-origin. Bearer mode is mandatory.

### 1. Authenticate with entity credentials

```javascript
const res = await fetch('https://api.myapp.com/api/auth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entity_id: 'ent_abc123',
    token: 'your-entity-token'
  })
});

const { session_id, info_token } = await res.json();
```

### 2. Use session for subsequent requests

```javascript
const workflows = await fetch('https://api.myapp.com/api/v1/app/workflows', {
  headers: {
    'Authorization': `Bearer ${session_id}`,
    'X-AIHF-Org-Id': 'org_xyz'
  }
});

const data = await workflows.json();
```

### 3. Trigger a workflow step

```javascript
const result = await fetch('https://api.myapp.com/api/v1/app/wf/my-workflow/step/start', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session_id}`,
    'X-AIHF-Org-Id': 'org_xyz',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ input: 'value' })
});
```

## API Reference

All `/api/**` paths are proxied transparently to the upstream platform. The gateway adds no URL remapping — paths map 1:1.

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/health` | GET | None | Gateway health check |
| `/` | GET | None | Same as `/health` |
| `/api/auth/token` | POST | Body: `{ entity_id, token }` | Exchange entity credentials for session |
| `/api/**` | Any | `Authorization: Bearer <session_id>` | All other platform API calls |

### Error responses

Errors from the proxy itself include `"proxy_error": true` in the JSON body. Errors from the upstream platform do not have this field.

| Status | Meaning |
|---|---|
| 400 | Missing or invalid auth fields (proxy) |
| 401 | Missing Authorization header (proxy) |
| 403 | Origin not in ALLOWED_ORIGINS (proxy) |
| 404 | Path not under `/api/` (proxy) |
| 502 | Upstream connection failure (proxy) |

## Deployment

```bash
# Type check
npm run type-check

# Deploy to Cloudflare
npm run deploy
```

### Custom domain

After deploying, add a Custom Domain in the Cloudflare dashboard (Workers & Pages > your worker > Settings > Domains & Routes) to serve the gateway on `api.myapp.com`.

## Project Structure

```
src/
  index.ts              # Worker entry, routing
  types.ts              # Env interface, type definitions
  cors.ts               # Origin-validated CORS handling
  auth-validator.ts     # Pre-forward auth presence checks
  proxy.ts              # Core proxy/forward logic
  health.ts             # Health endpoint
```

~350 lines of TypeScript. Zero runtime dependencies.

## Related

- [aihf-workflow-toolkit](https://github.com/aihf-io/aihf-workflow-toolkit) — SDK and CLI for building AIHF workflows

# AIHF Remote Gateway — AI Dev Context

## What this is

A stateless Cloudflare Worker proxy (~350 LOC) that forwards requests from a developer's frontend to the AIHF platform (`app.aihf.io`). Handles CORS and passes auth credentials through on every request.

## All files are modifiable

This is a developer-owned worker, not shared infrastructure. All files can be modified freely.

## File map

- `src/index.ts` — Worker entry point, request routing
- `src/types.ts` — `Env` interface, `ProxyContext`, `AuthCheckResult` types
- `src/cors.ts` — Origin allowlist validation, CORS header injection, preflight handling
- `src/auth-validator.ts` — Pre-forward checks: entity token body validation, bearer/cookie presence
- `src/proxy.ts` — URL rewriting, header building, upstream fetch, SSE streaming passthrough
- `src/health.ts` — `/health` endpoint

## Design constraints

- **No Hono** — manual routing only, per platform design principals
- **No `any` types** — string-first security, explicit JSON parsing
- **Stateless** — no KV, R2, D1 bindings. No credential caching. Entity tokens flow through on every request.
- **Zero runtime deps** — only devDependencies for types and tooling
- **Transparent URL proxy** — `/api/**` maps 1:1 to upstream, no URL remapping

## Auth model

1. Frontend POSTs `{ entity_id, token }` to `/api/auth/token` — proxy forwards to platform, returns session
2. Frontend uses `Authorization: Bearer <session_id>` + `X-AIHF-Org-Id` on all subsequent requests
3. Browser cookies from `app.aihf.io` will NOT work cross-origin — Bearer mode is mandatory

## Related CLAUDE.md files

- `aihf-workflow-toolkit/CLAUDE.md` — for building workflows that this gateway proxies to

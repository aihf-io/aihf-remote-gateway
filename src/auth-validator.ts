import { AuthCheckResult } from './types';

interface TokenBody {
  entity_id?: unknown;
  token?: unknown;
}

export async function validateAuthToken(request: Request): Promise<AuthCheckResult> {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.includes('application/json')) {
    return { valid: false, error: 'Content-Type must be application/json' };
  }

  // Clone before reading body so the original can be forwarded
  const clone = request.clone();
  let body: TokenBody;
  try {
    body = await clone.json() as TokenBody;
  } catch {
    return { valid: false, error: 'Invalid JSON body' };
  }

  if (typeof body.entity_id !== 'string' || body.entity_id.length === 0) {
    return { valid: false, error: 'Missing or empty entity_id' };
  }

  if (typeof body.token !== 'string' || body.token.length === 0) {
    return { valid: false, error: 'Missing or empty token' };
  }

  return { valid: true, authMode: 'entity_token' };
}

export function validateApiAuth(request: Request): AuthCheckResult {
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer' && parts[1].length > 0) {
      return { valid: true, authMode: 'bearer' };
    }
    return { valid: false, error: 'Authorization header must be: Bearer <token>' };
  }

  const cookie = request.headers.get('Cookie');
  if (cookie && cookie.includes('AIHF_session')) {
    return { valid: true, authMode: 'cookie' };
  }

  return {
    valid: false,
    error: 'Missing authentication. Provide Authorization: Bearer <session_id> header or AIHF_session cookie',
  };
}

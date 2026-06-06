export interface Env {
  AIHF_PLATFORM_URL: string;   // "https://app.aihf.io"
  ALLOWED_ORIGINS: string;      // "https://myapp.com,http://localhost:3000"
  GATEWAY_NAME: string;         // "my-gateway" (for X-AIHF-Remote-Gateway header)
}

export type AuthMode = 'entity_token' | 'bearer' | 'cookie';

export interface AuthCheckResult {
  valid: boolean;
  error?: string;
  authMode?: AuthMode;
}

export interface ProxyContext {
  clientIp: string;
  gatewayName: string;
  platformUrl: string;
}

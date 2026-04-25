/**
 * Deployment environment detection.
 *
 * Local dev (npm run dev, file:// in the Electron-style .command launcher):
 *   - AI calls go direct to OpenAI/Anthropic/Ollama from the browser (keys in session state)
 *   - No auth gate
 *
 * Hosted (landroid.abstractmapping.com or any non-loopback hostname):
 *   - AI calls go to /api/ai/chat (server proxy; no keys in the browser)
 *   - Cognito auth gate enforced before the app renders
 */

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '']);

export function isHostedMode(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  if (LOCAL_HOSTNAMES.has(hostname)) return false;
  if (window.location.protocol === 'file:') return false;
  return true;
}

export function apiBaseUrl(): string {
  return '/api';
}

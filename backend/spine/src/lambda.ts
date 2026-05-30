import { CognitoJwtVerifier } from 'aws-jwt-verify';
import {
  createBackendSpineHandler,
  type BackendSpineHttpEvent,
  type BackendSpineHttpResponse,
} from './handler.js';

const COGNITO_USER_POOL_ID = requireEnv('COGNITO_USER_POOL_ID');
const COGNITO_CLIENT_ID = requireEnv('COGNITO_CLIENT_ID');

const verifier = CognitoJwtVerifier.create({
  userPoolId: COGNITO_USER_POOL_ID,
  tokenUse: 'id',
  clientId: COGNITO_CLIENT_ID,
});

const spineHandler = createBackendSpineHandler({
  verifyToken: async (token) => {
    const payload = await verifier.verify(token);
    const sub = typeof payload.sub === 'string' ? payload.sub : '';
    return { sub };
  },
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export async function handler(event: BackendSpineHttpEvent): Promise<BackendSpineHttpResponse> {
  return spineHandler(event);
}

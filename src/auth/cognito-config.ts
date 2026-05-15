import type { UserManagerSettings } from 'oidc-client-ts';

export interface CognitoConfigEnv {
  readonly VITE_COGNITO_DOMAIN?: string;
  readonly VITE_COGNITO_CLIENT_ID?: string;
  readonly VITE_COGNITO_REDIRECT_URI?: string;
  readonly VITE_COGNITO_USER_POOL_ID?: string;
}

function normalizeHost(value: string): string {
  return value.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

export function cognitoIssuerFromUserPoolId(userPoolId: string): string {
  const normalized = userPoolId.trim();
  const separatorIndex = normalized.indexOf('_');
  if (separatorIndex <= 0 || separatorIndex === normalized.length - 1) {
    throw new Error('VITE_COGNITO_USER_POOL_ID must look like <region>_<pool-id>.');
  }
  const region = normalized.slice(0, separatorIndex);
  return `https://cognito-idp.${region}.amazonaws.com/${normalized}`;
}

export function buildCognitoConfig(
  env: CognitoConfigEnv,
  fallbackOrigin: string
): UserManagerSettings {
  const domain = env.VITE_COGNITO_DOMAIN ? normalizeHost(env.VITE_COGNITO_DOMAIN) : '';
  const clientId = env.VITE_COGNITO_CLIENT_ID?.trim() ?? '';
  const userPoolId = env.VITE_COGNITO_USER_POOL_ID?.trim() ?? '';
  const redirectUri = env.VITE_COGNITO_REDIRECT_URI ?? `${fallbackOrigin}/`;

  if (!domain || !clientId || !userPoolId) {
    throw new Error(
      'Missing Cognito config. Set VITE_COGNITO_DOMAIN, VITE_COGNITO_CLIENT_ID, and VITE_COGNITO_USER_POOL_ID in the hosted build.'
    );
  }

  const hostedUiBaseUrl = `https://${domain}`;
  const issuer = cognitoIssuerFromUserPoolId(userPoolId);

  return {
    authority: issuer,
    metadataUrl: `${issuer}/.well-known/openid-configuration`,
    client_id: clientId,
    redirect_uri: redirectUri,
    post_logout_redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email',
    metadataSeed: {
      authorization_endpoint: `${hostedUiBaseUrl}/oauth2/authorize`,
      token_endpoint: `${hostedUiBaseUrl}/oauth2/token`,
      userinfo_endpoint: `${hostedUiBaseUrl}/oauth2/userInfo`,
      end_session_endpoint: `${hostedUiBaseUrl}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(
        redirectUri
      )}`,
    },
  };
}

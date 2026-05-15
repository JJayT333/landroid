import { describe, expect, it } from 'vitest';
import { buildCognitoConfig, cognitoIssuerFromUserPoolId } from '../cognito-config';

describe('cognito config', () => {
  it('derives the user-pool issuer from the Cognito pool id', () => {
    expect(cognitoIssuerFromUserPoolId('us-east-1_TWeBB7xvQ')).toBe(
      'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TWeBB7xvQ'
    );
  });

  it('uses user-pool metadata while keeping Hosted UI auth endpoints', () => {
    const config = buildCognitoConfig(
      {
        VITE_COGNITO_DOMAIN: 'https://us-east-1twebb7xvq.auth.us-east-1.amazoncognito.com/',
        VITE_COGNITO_CLIENT_ID: 'client-123',
        VITE_COGNITO_REDIRECT_URI: 'https://landroid.abstractmapping.com/',
        VITE_COGNITO_USER_POOL_ID: 'us-east-1_TWeBB7xvQ',
      },
      'https://landroid.abstractmapping.com'
    );

    expect(config.authority).toBe(
      'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TWeBB7xvQ'
    );
    expect(config.metadataUrl).toBe(
      'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TWeBB7xvQ/.well-known/openid-configuration'
    );
    expect(config.metadataSeed).toMatchObject({
      authorization_endpoint:
        'https://us-east-1twebb7xvq.auth.us-east-1.amazoncognito.com/oauth2/authorize',
      token_endpoint: 'https://us-east-1twebb7xvq.auth.us-east-1.amazoncognito.com/oauth2/token',
      userinfo_endpoint:
        'https://us-east-1twebb7xvq.auth.us-east-1.amazoncognito.com/oauth2/userInfo',
      end_session_endpoint:
        'https://us-east-1twebb7xvq.auth.us-east-1.amazoncognito.com/logout?client_id=client-123&logout_uri=https%3A%2F%2Flandroid.abstractmapping.com%2F',
    });
  });

  it('requires the pool id instead of treating the Hosted UI domain as issuer', () => {
    expect(() =>
      buildCognitoConfig(
        {
          VITE_COGNITO_DOMAIN: 'us-east-1twebb7xvq.auth.us-east-1.amazoncognito.com',
          VITE_COGNITO_CLIENT_ID: 'client-123',
        },
        'https://landroid.abstractmapping.com'
      )
    ).toThrow(/VITE_COGNITO_USER_POOL_ID/);
  });

  it('rejects malformed pool ids before oidc-client-ts is initialized', () => {
    expect(() => cognitoIssuerFromUserPoolId('not-a-pool-id')).toThrow(/<region>_<pool-id>/);
  });
});

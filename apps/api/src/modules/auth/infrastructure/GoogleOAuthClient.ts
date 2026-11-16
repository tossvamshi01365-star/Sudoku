import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { AppError } from '../../../common/errors/AppError';
import { generateToken } from '../../../common/crypto/tokens';
import type { GoogleAuthorizationRequest, GoogleProfile, IGoogleOAuthClient } from '../auth.ports';

/**
 * Google "Authorization Code + PKCE" flow, done entirely on the server.
 * The browser never sees Google tokens; we only keep the verified identity.
 */
export class GoogleOAuthClient implements IGoogleOAuthClient {
  private readonly client: OAuth2Client;

  constructor(private readonly options: { clientId: string; clientSecret: string; redirectUri: string }) {
    this.client = new OAuth2Client(options);
  }

  async createAuthorizationRequest(): Promise<GoogleAuthorizationRequest> {
    const { codeVerifier, codeChallenge } = await this.client.generateCodeVerifierAsync();
    const state = generateToken();
    const url = this.client.generateAuthUrl({
      access_type: 'online',
      scope: ['openid', 'email', 'profile'],
      state,
      code_challenge: codeChallenge,
      code_challenge_method: CodeChallengeMethod.S256,
      prompt: 'select_account',
    });
    return { url, state, codeVerifier };
  }

  async exchangeCode(code: string, codeVerifier: string): Promise<GoogleProfile> {
    const { tokens } = await this.client.getToken({ code, codeVerifier, redirect_uri: this.options.redirectUri });
    if (!tokens.id_token) {
      throw AppError.unauthorized('GOOGLE_NO_ID_TOKEN', 'Google did not return an identity token.');
    }

    // Checks the signature, expiry, issuer and that the token was issued for OUR client ID.
    const ticket = await this.client.verifyIdToken({ idToken: tokens.id_token, audience: this.options.clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      throw AppError.unauthorized('GOOGLE_PROFILE_INCOMPLETE', 'Google did not share an email address.');
    }

    return {
      sub: payload.sub,
      email: payload.email.trim().toLowerCase(),
      emailVerified: payload.email_verified === true,
      name: payload.name ?? null,
    };
  }
}

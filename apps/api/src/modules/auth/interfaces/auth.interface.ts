export interface GoogleProfile {
  id: string;
  email: string;
  displayName: string;
  photos?: Array<{ value: string }>;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export interface TokenResult {
  accessToken: string;
  refreshToken?: string;
}

export interface PKCEChallenge {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

export interface OAuthState {
  state: string;
  codeVerifier: string;
  redirectUri: string;
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface EncryptedToken {
  data: string;
  iv: string;
  tag: string;
  keyVersion: number;
}
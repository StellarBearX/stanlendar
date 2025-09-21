import { Injectable } from '@nestjs/common';

@Injectable()
export class MockGoogleOAuthService {
  generateAuthUrl(options: any) {
    return 'http://localhost:3001/auth/mock-google-callback?code=mock-auth-code&state=' + options.state;
  }

  async getToken(code: string) {
    return {
      access_token: 'mock-access-token-' + Date.now(),
      refresh_token: 'mock-refresh-token-' + Date.now(),
      scope: 'openid email profile https://www.googleapis.com/auth/calendar',
      token_type: 'Bearer',
      expires_in: 3600,
    };
  }

  async refreshAccessToken(refreshToken: string) {
    return {
      access_token: 'mock-refreshed-access-token-' + Date.now(),
      expires_in: 3600,
      token_type: 'Bearer',
    };
  }

  async getUserInfo(accessToken: string) {
    return {
      id: 'mock-user-123',
      email: 'test.user@example.com',
      name: 'Test User',
      given_name: 'Test',
      family_name: 'User',
      picture: 'https://via.placeholder.com/150',
      locale: 'en',
      verified_email: true,
    };
  }

  async revokeToken(token: string) {
    return { success: true };
  }
}
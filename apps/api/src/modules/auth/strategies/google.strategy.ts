import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';
import { GoogleProfile } from '../interfaces/auth.interface';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: `${configService.get<string>('API_BASE_URL')}/auth/google/callback`,
      scope: [
        'openid',
        'email', 
        'profile',
        'https://www.googleapis.com/auth/calendar.events'
      ],
      accessType: 'offline',
      prompt: 'consent', // Force consent to get refresh token
      passReqToCallback: true, // Pass request to validate method for PKCE
    });
  }

  async validate(
    request: any,
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      // Extract PKCE parameters from request
      const { code_verifier, state } = request.query;
      
      if (!code_verifier || !state) {
        return done(new Error('Missing PKCE parameters'), null);
      }

      // Validate state parameter (should be done in controller)
      // Here we just pass it along for the controller to validate

      const googleProfile: GoogleProfile = {
        id: profile.id,
        email: profile.emails[0].value,
        displayName: profile.displayName,
        photos: profile.photos,
      };

      const tokens = {
        accessToken,
        refreshToken,
        expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
      };

      // Return data for controller to process
      const user = await this.authService.validateGoogleUser(googleProfile, tokens);
      
      return {
        user,
        codeVerifier: code_verifier,
        state,
      };
    } catch (error) {
      return done(error, null);
    }
  }
}
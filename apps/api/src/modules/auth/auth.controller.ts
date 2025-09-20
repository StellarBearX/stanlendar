import { 
  Controller, 
  Get, 
  Post, 
  UseGuards, 
  Req, 
  Res, 
  Query,
  Body,
  UnauthorizedException,
  BadRequestException 
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { PKCEChallenge } from './interfaces/auth.interface';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Initiates Google OAuth flow with PKCE
   * GET /auth/google/init
   */
  @Public()
  @Get('google/init')
  async initiateGoogleAuth(@Query('redirect_uri') redirectUri?: string) {
    const pkceData = this.authService.generatePKCEChallenge();
    
    // Build Google OAuth URL with PKCE parameters
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!);
    googleAuthUrl.searchParams.set('redirect_uri', `${process.env.API_BASE_URL}/auth/google/callback`);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', [
      'openid',
      'email',
      'profile', 
      'https://www.googleapis.com/auth/calendar.events'
    ].join(' '));
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('prompt', 'consent');
    googleAuthUrl.searchParams.set('state', pkceData.state);
    googleAuthUrl.searchParams.set('code_challenge', pkceData.codeChallenge);
    googleAuthUrl.searchParams.set('code_challenge_method', pkceData.codeChallengeMethod);

    return {
      authUrl: googleAuthUrl.toString(),
      state: pkceData.state,
    };
  }

  /**
   * Google OAuth callback handler
   * GET /auth/google/callback
   */
  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @Req() req: any,
    @Res() res: Response,
    @Query('state') state: string,
    @Query('code') code: string,
    @Query('error') error?: string,
  ) {
    if (error) {
      return res.redirect(`${process.env.FRONTEND_URL}/auth/error?error=${encodeURIComponent(error)}`);
    }

    if (!state || !code) {
      return res.redirect(`${process.env.FRONTEND_URL}/auth/error?error=missing_parameters`);
    }

    try {
      // Validate state parameter
      const oauthState = this.authService.validateStateAndGetPKCE(state);
      
      // User is available from GoogleStrategy validation
      const { user } = req.user;

      // Generate JWT tokens
      const tokens = await this.authService.generateTokens(user);

      // Redirect to frontend with tokens
      const redirectUrl = new URL(`${process.env.FRONTEND_URL}/auth/callback`);
      redirectUrl.searchParams.set('access_token', tokens.accessToken);
      redirectUrl.searchParams.set('refresh_token', tokens.refreshToken);
      
      return res.redirect(redirectUrl.toString());
    } catch (error) {
      console.error('OAuth callback error:', error);
      return res.redirect(`${process.env.FRONTEND_URL}/auth/error?error=oauth_failed`);
    }
  }

  /**
   * Refresh access token
   * POST /auth/refresh
   */
  @Public()
  @Post('refresh')
  async refreshToken(@Body('refresh_token') refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    try {
      const tokens = await this.authService.refreshToken(refreshToken);
      return {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Logout user
   * POST /auth/logout
   */
  @Post('logout')
  async logout(@CurrentUser() user: any, @Body('refresh_token') refreshToken?: string) {
    await this.authService.logout(user.id, refreshToken);
    
    return {
      message: 'Logged out successfully',
    };
  }

  /**
   * Logout user from all devices
   * POST /auth/logout-all
   */
  @Post('logout-all')
  async logoutFromAllDevices(@CurrentUser() user: any) {
    await this.authService.logoutFromAllDevices(user.id);
    
    return {
      message: 'Logged out from all devices successfully',
    };
  }

  /**
   * Get current user profile
   * GET /auth/me
   */
  @Get('me')
  async getProfile(@CurrentUser() user: any) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      lastLoginAt: user.lastLoginAt,
    };
  }

  /**
   * Check if user has Google Calendar connected
   * GET /auth/google/status
   */
  @Get('google/status')
  async getGoogleStatus(@CurrentUser() user: any) {
    const tokens = await this.authService.getGoogleTokens(user.id);
    
    return {
      connected: !!tokens,
      tokenExpired: tokens ? tokens.expiresAt < new Date() : false,
    };
  }
}
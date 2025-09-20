import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { CryptoService } from './crypto.service';
import { JwtAuthGuard } from './guards/auth.guard';
import { SessionService } from './session/session.service';
import { SecurityHeadersMiddleware, RequestLoggingMiddleware } from './middleware/security.middleware';
import { CorsMiddleware } from './middleware/cors.middleware';
import { RateLimitMiddleware, AuthRateLimitMiddleware } from './middleware/rate-limit.middleware';
import { User } from '../../infra/database/entities/user.entity';
import { CalendarAccount } from '../../infra/database/entities/calendar-account.entity';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '15m', // Access token expires in 15 minutes
        },
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([User, CalendarAccount]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService, 
    GoogleStrategy, 
    JwtStrategy, 
    CryptoService,
    SessionService,
    JwtAuthGuard,
    SecurityHeadersMiddleware,
    RequestLoggingMiddleware,
    CorsMiddleware,
    RateLimitMiddleware,
    AuthRateLimitMiddleware,
  ],
  exports: [
    AuthService, 
    CryptoService, 
    JwtAuthGuard, 
    SessionService,
    SecurityHeadersMiddleware,
    RequestLoggingMiddleware,
    CorsMiddleware,
    RateLimitMiddleware,
    AuthRateLimitMiddleware,
  ],
})
export class AuthModule {}
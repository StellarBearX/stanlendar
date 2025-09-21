import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MockGoogleCalendarService } from './mock-google-calendar.service';
import { MockGoogleOAuthService } from './mock-google-oauth.service';
import { MockRedisService } from './mock-redis.service';

@Global()
@Module({
  providers: [
    {
      provide: 'GOOGLE_CALENDAR_SERVICE',
      useFactory: (configService: ConfigService) => {
        const isMockMode = configService.get('ENABLE_GOOGLE_API_MOCK') === 'true';
        return isMockMode ? new MockGoogleCalendarService() : null;
      },
      inject: [ConfigService],
    },
    {
      provide: 'GOOGLE_OAUTH_SERVICE',
      useFactory: (configService: ConfigService) => {
        const isMockMode = configService.get('ENABLE_GOOGLE_API_MOCK') === 'true';
        return isMockMode ? new MockGoogleOAuthService() : null;
      },
      inject: [ConfigService],
    },
    {
      provide: 'REDIS_SERVICE',
      useFactory: (configService: ConfigService) => {
        const isMockMode = configService.get('ENABLE_REDIS_MOCK') === 'true';
        return isMockMode ? new MockRedisService() : null;
      },
      inject: [ConfigService],
    },
  ],
  exports: ['GOOGLE_CALENDAR_SERVICE', 'GOOGLE_OAUTH_SERVICE', 'REDIS_SERVICE'],
})
export class MockModule {}
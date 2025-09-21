import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../modules/auth/decorators/public.decorator';

@Controller('test-mode')
export class TestModeController {
  constructor(private readonly configService: ConfigService) {}

  @Get('status')
  @Public()
  getTestModeStatus() {
    const isMockMode = this.configService.get('ENABLE_MOCK_MODE') === 'true';
    
    return {
      testMode: isMockMode,
      environment: this.configService.get('NODE_ENV'),
      mockServices: {
        googleApi: this.configService.get('ENABLE_GOOGLE_API_MOCK') === 'true',
        redis: this.configService.get('ENABLE_REDIS_MOCK') === 'true',
        database: this.configService.get('ENABLE_DATABASE_MOCK') === 'true',
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Post('mock-auth')
  @Public()
  mockAuthentication(@Body() body: { email?: string; name?: string }) {
    const isMockMode = this.configService.get('ENABLE_MOCK_MODE') === 'true';
    
    if (!isMockMode) {
      return { error: 'Mock mode is not enabled' };
    }

    const mockUser = {
      id: 'mock-user-123',
      email: body.email || 'test.user@example.com',
      name: body.name || 'Test User',
      picture: 'https://via.placeholder.com/150',
      accessToken: 'mock-access-token-' + Date.now(),
      refreshToken: 'mock-refresh-token-' + Date.now(),
    };

    return {
      success: true,
      user: mockUser,
      message: 'Mock authentication successful',
    };
  }

  @Get('sample-data')
  @Public()
  getSampleData(@Query('type') type: string) {
    const isMockMode = this.configService.get('ENABLE_MOCK_MODE') === 'true';
    
    if (!isMockMode) {
      return { error: 'Mock mode is not enabled' };
    }

    const sampleData = {
      subjects: [
        {
          id: 1,
          name: 'Software Project Management',
          code: '960200',
          color: '#3B82F6',
          createdAt: new Date().toISOString(),
        },
        {
          id: 2,
          name: 'Database Systems',
          code: '960300',
          color: '#10B981',
          createdAt: new Date().toISOString(),
        },
        {
          id: 3,
          name: 'Web Development',
          code: '960400',
          color: '#F59E0B',
          createdAt: new Date().toISOString(),
        },
      ],
      sections: [
        {
          id: 1,
          subjectId: 1,
          sectionCode: '001',
          days: ['MO', 'WE'],
          startTime: '09:00',
          endTime: '10:30',
          room: 'Room 301',
          startDate: '2024-01-15',
          endDate: '2024-05-15',
          skipDates: ['2024-04-13', '2024-04-15'],
        },
        {
          id: 2,
          subjectId: 2,
          sectionCode: '002',
          days: ['TU', 'TH'],
          startTime: '13:00',
          endTime: '14:30',
          room: 'Lab 201',
          startDate: '2024-01-15',
          endDate: '2024-05-15',
          skipDates: [],
        },
      ],
      events: [
        {
          id: 1,
          subjectId: 1,
          sectionId: 1,
          title: 'Software Project Management',
          startTime: '2024-01-15T09:00:00+07:00',
          endTime: '2024-01-15T10:30:00+07:00',
          location: 'Room 301',
          isRecurring: true,
        },
        {
          id: 2,
          subjectId: 2,
          sectionId: 2,
          title: 'Database Systems',
          startTime: '2024-01-16T13:00:00+07:00',
          endTime: '2024-01-16T14:30:00+07:00',
          location: 'Lab 201',
          isRecurring: true,
        },
      ],
    };

    if (type && sampleData[type]) {
      return { data: sampleData[type] };
    }

    return { data: sampleData };
  }

  @Post('reset-data')
  @Public()
  resetTestData() {
    const isMockMode = this.configService.get('ENABLE_MOCK_MODE') === 'true';
    
    if (!isMockMode) {
      return { error: 'Mock mode is not enabled' };
    }

    return {
      success: true,
      message: 'Test data has been reset',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('google-calendar-mock')
  @Public()
  getGoogleCalendarMockStatus() {
    const isMockMode = this.configService.get('ENABLE_GOOGLE_API_MOCK') === 'true';
    
    return {
      mockEnabled: isMockMode,
      mockCalendars: [
        {
          id: 'primary',
          summary: 'Test Calendar',
          primary: true,
        },
        {
          id: 'mock-calendar-2',
          summary: 'Secondary Test Calendar',
          primary: false,
        },
      ],
      mockEvents: [
        {
          id: 'mock-event-1',
          summary: 'Software Project Management',
          start: { dateTime: '2024-01-15T09:00:00+07:00' },
          end: { dateTime: '2024-01-15T10:30:00+07:00' },
          location: 'Room 301',
        },
      ],
    };
  }
}
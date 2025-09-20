import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { SubjectsModule } from '../subjects.module';
import { AuthModule } from '../../auth/auth.module';
import { EventsModule } from '../../events/events.module';
import { SectionsModule } from '../../sections/sections.module';
import { DatabaseModule } from '../../../infra/database/database.module';
import { User } from '../../../infra/database/entities/user.entity';
import { Subject } from '../../../infra/database/entities/subject.entity';
import { Section } from '../../../infra/database/entities/section.entity';
import { LocalEvent } from '../../../infra/database/entities/local-event.entity';
import { CalendarAccount } from '../../../infra/database/entities/calendar-account.entity';
import { SavedFilter } from '../../../infra/database/entities/saved-filter.entity';
import { ImportJob } from '../../../infra/database/entities/import-job.entity';
import { ImportItem } from '../../../infra/database/entities/import-item.entity';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';

describe('Quick Add Integration', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let authToken: string;
  let testUser: User;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [User, Subject, Section, LocalEvent, CalendarAccount, SavedFilter, ImportJob, ImportItem],
          synchronize: true,
          logging: false,
        }),
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' },
        }),
        SubjectsModule,
        AuthModule,
        EventsModule,
        SectionsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));

    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    // Create test user
    testUser = await dataSource.getRepository(User).save({
      email: 'test@example.com',
      displayName: 'Test User',
    });

    // Generate auth token
    authToken = jwtService.sign({ sub: testUser.id, email: testUser.email });
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  beforeEach(async () => {
    // Clean up data before each test
    await dataSource.getRepository(LocalEvent).delete({});
    await dataSource.getRepository(Section).delete({});
    await dataSource.getRepository(Subject).delete({});
  });

  describe('POST /subjects/quick-add', () => {
    const validQuickAddData = {
      subjectName: 'Software Engineering',
      subjectCode: 'SE101',
      subjectColor: '#3b82f6',
      sectionCode: '001',
      teacher: 'Dr. Smith',
      room: 'A101',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:30',
      startDate: '2024-01-01',
      endDate: '2024-05-31',
      skipDates: ['2024-03-15'],
    };

    it('should create new subject, section, and events successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/subjects/quick-add')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validQuickAddData)
        .expect(201);

      expect(response.body).toMatchObject({
        subject: {
          id: expect.any(String),
          name: 'Software Engineering',
          code: 'SE101',
          colorHex: '#3b82f6',
          meta: { teacher: 'Dr. Smith' },
        },
        section: {
          id: expect.any(String),
          secCode: '001',
          teacher: 'Dr. Smith',
          room: 'A101',
          scheduleRules: [{
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '10:30',
            startDate: '2024-01-01',
            endDate: '2024-05-31',
            skipDates: ['2024-03-15'],
          }],
        },
        eventsGenerated: expect.any(Number),
      });

      // Verify data was created in database
      const subject = await dataSource.getRepository(Subject).findOne({
        where: { name: 'Software Engineering', userId: testUser.id },
      });
      expect(subject).toBeTruthy();

      const section = await dataSource.getRepository(Section).findOne({
        where: { secCode: '001', subjectId: subject!.id },
      });
      expect(section).toBeTruthy();

      const events = await dataSource.getRepository(LocalEvent).find({
        where: { subjectId: subject!.id },
      });
      expect(events.length).toBeGreaterThan(0);
    });

    it('should use existing subject if name matches', async () => {
      // Create existing subject
      const existingSubject = await dataSource.getRepository(Subject).save({
        userId: testUser.id,
        name: 'Software Engineering',
        code: 'OLD_CODE',
        colorHex: '#ff0000',
        meta: {},
      });

      const response = await request(app.getHttpServer())
        .post('/subjects/quick-add')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validQuickAddData)
        .expect(201);

      expect(response.body.subject.id).toBe(existingSubject.id);
      expect(response.body.subject.code).toBe('SE101'); // Should be updated
      expect(response.body.subject.colorHex).toBe('#3b82f6'); // Should be updated

      // Verify only one subject exists
      const subjects = await dataSource.getRepository(Subject).find({
        where: { userId: testUser.id },
      });
      expect(subjects).toHaveLength(1);
    });

    it('should return 400 for invalid time range', async () => {
      const invalidData = {
        ...validQuickAddData,
        startTime: '10:30',
        endTime: '09:00',
      };

      const response = await request(app.getHttpServer())
        .post('/subjects/quick-add')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.message).toContain('Start time (10:30) must be before end time (09:00)');
    });

    it('should return 400 for invalid date range', async () => {
      const invalidData = {
        ...validQuickAddData,
        startDate: '2024-05-31',
        endDate: '2024-01-01',
      };

      const response = await request(app.getHttpServer())
        .post('/subjects/quick-add')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.message).toContain('Start date (2024-05-31) must be before end date (2024-01-01)');
    });

    it('should return 400 for duplicate section code', async () => {
      // Create existing subject and section
      const existingSubject = await dataSource.getRepository(Subject).save({
        userId: testUser.id,
        name: 'Software Engineering',
        colorHex: '#3b82f6',
        meta: {},
      });

      await dataSource.getRepository(Section).save({
        subjectId: existingSubject.id,
        secCode: '001',
        scheduleRules: [],
      });

      const response = await request(app.getHttpServer())
        .post('/subjects/quick-add')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validQuickAddData)
        .expect(400);

      expect(response.body.message).toContain("Section with code '001' already exists for this subject");
    });

    it('should return 400 for conflicting subject code', async () => {
      // Create existing subject with same code but different name
      await dataSource.getRepository(Subject).save({
        userId: testUser.id,
        name: 'Different Subject',
        code: 'SE101',
        colorHex: '#ff0000',
        meta: {},
      });

      const response = await request(app.getHttpServer())
        .post('/subjects/quick-add')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validQuickAddData)
        .expect(400);

      expect(response.body.message).toContain("Subject with code 'SE101' already exists");
    });

    it('should validate required fields', async () => {
      const incompleteData = {
        subjectName: 'Software Engineering',
        // Missing required fields
      };

      const response = await request(app.getHttpServer())
        .post('/subjects/quick-add')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteData)
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('subjectColor'),
          expect.stringContaining('sectionCode'),
          expect.stringContaining('dayOfWeek'),
          expect.stringContaining('startTime'),
          expect.stringContaining('endTime'),
          expect.stringContaining('startDate'),
          expect.stringContaining('endDate'),
        ])
      );
    });

    it('should validate field formats', async () => {
      const invalidData = {
        ...validQuickAddData,
        subjectColor: 'invalid-color',
        dayOfWeek: 7, // Invalid day
        startTime: '25:00', // Invalid time
        endTime: 'invalid-time',
        startDate: 'invalid-date',
        endDate: 'invalid-date',
      };

      const response = await request(app.getHttpServer())
        .post('/subjects/quick-add')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('subjectColor'),
          expect.stringContaining('dayOfWeek'),
          expect.stringContaining('startTime'),
          expect.stringContaining('endTime'),
          expect.stringContaining('startDate'),
          expect.stringContaining('endDate'),
        ])
      );
    });

    it('should work without optional fields', async () => {
      const minimalData = {
        subjectName: 'Minimal Subject',
        subjectColor: '#3b82f6',
        sectionCode: '001',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '10:30',
        startDate: '2024-01-01',
        endDate: '2024-05-31',
      };

      const response = await request(app.getHttpServer())
        .post('/subjects/quick-add')
        .set('Authorization', `Bearer ${authToken}`)
        .send(minimalData)
        .expect(201);

      expect(response.body.subject.code).toBeNull();
      expect(response.body.section.teacher).toBeNull();
      expect(response.body.section.room).toBeNull();
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .post('/subjects/quick-add')
        .send(validQuickAddData)
        .expect(401);
    });

    it('should normalize color format', async () => {
      const dataWithUppercaseColor = {
        ...validQuickAddData,
        subjectColor: '#FF0000',
      };

      const response = await request(app.getHttpServer())
        .post('/subjects/quick-add')
        .set('Authorization', `Bearer ${authToken}`)
        .send(dataWithUppercaseColor)
        .expect(201);

      expect(response.body.subject.colorHex).toBe('#ff0000');
    });

    it('should handle skip dates correctly', async () => {
      const dataWithSkipDates = {
        ...validQuickAddData,
        skipDates: ['2024-02-14', '2024-04-01'],
      };

      const response = await request(app.getHttpServer())
        .post('/subjects/quick-add')
        .set('Authorization', `Bearer ${authToken}`)
        .send(dataWithSkipDates)
        .expect(201);

      expect(response.body.section.scheduleRules[0].skipDates).toEqual(['2024-02-14', '2024-04-01']);

      // Verify events were not created for skip dates
      const events = await dataSource.getRepository(LocalEvent).find({
        where: { subjectId: response.body.subject.id },
      });

      const skipDateEvents = events.filter(event => 
        ['2024-02-14', '2024-04-01'].includes(event.eventDate.toISOString().split('T')[0])
      );
      expect(skipDateEvents).toHaveLength(0);
    });
  });
});
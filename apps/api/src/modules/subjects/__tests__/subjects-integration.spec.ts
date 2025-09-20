import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { SubjectsModule } from '../subjects.module';
import { AuthModule } from '../../auth/auth.module';
import { DatabaseModule } from '../../../infra/database/database.module';
import { Subject } from '../../../infra/database/entities/subject.entity';
import { User } from '../../../infra/database/entities/user.entity';
import { CalendarAccount } from '../../../infra/database/entities/calendar-account.entity';
import { Section } from '../../../infra/database/entities/section.entity';
import { LocalEvent } from '../../../infra/database/entities/local-event.entity';
import { SavedFilter } from '../../../infra/database/entities/saved-filter.entity';
import { ImportJob } from '../../../infra/database/entities/import-job.entity';
import { ImportItem } from '../../../infra/database/entities/import-item.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from '../../auth/auth.service';

describe('Subjects Integration', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let subjectRepository: Repository<Subject>;
  let authService: AuthService;
  let testUser: User;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env.test', '.env'],
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT) || 5432,
          username: process.env.DB_USERNAME || 'test',
          password: process.env.DB_PASSWORD || 'test',
          database: process.env.DB_NAME || 'test_db',
          entities: [User, CalendarAccount, Subject, Section, LocalEvent, SavedFilter, ImportJob, ImportItem],
          synchronize: true,
          dropSchema: true,
        }),
        AuthModule,
        SubjectsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    
    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    subjectRepository = moduleFixture.get<Repository<Subject>>(getRepositoryToken(Subject));
    authService = moduleFixture.get<AuthService>(AuthService);

    await app.init();

    // Create test user
    testUser = await userRepository.save({
      email: 'test@example.com',
      displayName: 'Test User',
    });

    // Generate auth token for test user
    const tokenResult = await authService.generateTokens(testUser.id);
    authToken = tokenResult.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up subjects before each test
    await subjectRepository.delete({ userId: testUser.id });
  });

  describe('POST /subjects', () => {
    it('should create a subject successfully', async () => {
      const createDto = {
        code: 'CS101',
        name: 'Computer Science',
        colorHex: '#ff0000',
        meta: { teacher: 'John Doe' },
      };

      const response = await request(app.getHttpServer())
        .post('/subjects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body).toMatchObject({
        code: 'CS101',
        name: 'Computer Science',
        colorHex: '#ff0000',
        meta: { teacher: 'John Doe' },
        sectionsCount: 0,
        eventsCount: 0,
      });
      expect(response.body.id).toBeDefined();
      expect(response.body.createdAt).toBeDefined();
    });

    it('should normalize color hex', async () => {
      const createDto = {
        name: 'Math',
        colorHex: 'FF0000', // Without # and uppercase
      };

      const response = await request(app.getHttpServer())
        .post('/subjects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.colorHex).toBe('#ff0000');
    });

    it('should return 400 for invalid color format', async () => {
      const createDto = {
        name: 'Math',
        colorHex: 'invalid',
      };

      await request(app.getHttpServer())
        .post('/subjects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(400);
    });

    it('should return 409 for duplicate subject code', async () => {
      const createDto = {
        code: 'CS101',
        name: 'Computer Science',
        colorHex: '#ff0000',
      };

      // Create first subject
      await request(app.getHttpServer())
        .post('/subjects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      // Try to create duplicate
      await request(app.getHttpServer())
        .post('/subjects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...createDto, name: 'Different Name' })
        .expect(409);
    });

    it('should return 409 for duplicate subject name', async () => {
      const createDto = {
        name: 'Computer Science',
        colorHex: '#ff0000',
      };

      // Create first subject
      await request(app.getHttpServer())
        .post('/subjects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      // Try to create duplicate
      await request(app.getHttpServer())
        .post('/subjects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...createDto, code: 'CS102' })
        .expect(409);
    });

    it('should return 401 without auth token', async () => {
      const createDto = {
        name: 'Math',
        colorHex: '#ff0000',
      };

      await request(app.getHttpServer())
        .post('/subjects')
        .send(createDto)
        .expect(401);
    });
  });

  describe('GET /subjects', () => {
    it('should return all subjects for user', async () => {
      // Create test subjects
      const subject1 = await subjectRepository.save({
        userId: testUser.id,
        code: 'CS101',
        name: 'Computer Science',
        colorHex: '#ff0000',
      });

      const subject2 = await subjectRepository.save({
        userId: testUser.id,
        name: 'Mathematics',
        colorHex: '#00ff00',
      });

      const response = await request(app.getHttpServer())
        .get('/subjects')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.map(s => s.id)).toContain(subject1.id);
      expect(response.body.map(s => s.id)).toContain(subject2.id);
    });

    it('should return empty array if no subjects', async () => {
      const response = await request(app.getHttpServer())
        .get('/subjects')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('GET /subjects/search', () => {
    beforeEach(async () => {
      // Create test subjects for search
      await subjectRepository.save([
        {
          userId: testUser.id,
          code: 'CS101',
          name: 'Computer Science',
          colorHex: '#ff0000',
        },
        {
          userId: testUser.id,
          code: 'MATH101',
          name: 'Mathematics',
          colorHex: '#00ff00',
        },
        {
          userId: testUser.id,
          name: 'Physics',
          colorHex: '#0000ff',
        },
      ]);
    });

    it('should search subjects by name', async () => {
      const response = await request(app.getHttpServer())
        .get('/subjects/search?q=Computer')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Computer Science');
    });

    it('should search subjects by code', async () => {
      const response = await request(app.getHttpServer())
        .get('/subjects/search?q=MATH')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].code).toBe('MATH101');
    });

    it('should return all subjects if no search query', async () => {
      const response = await request(app.getHttpServer())
        .get('/subjects/search')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(3);
    });
  });

  describe('GET /subjects/:id', () => {
    it('should return subject by id', async () => {
      const subject = await subjectRepository.save({
        userId: testUser.id,
        code: 'CS101',
        name: 'Computer Science',
        colorHex: '#ff0000',
      });

      const response = await request(app.getHttpServer())
        .get(`/subjects/${subject.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(subject.id);
      expect(response.body.name).toBe('Computer Science');
    });

    it('should return 404 for non-existent subject', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      
      await request(app.getHttpServer())
        .get(`/subjects/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 400 for invalid UUID', async () => {
      await request(app.getHttpServer())
        .get('/subjects/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('PATCH /subjects/:id', () => {
    it('should update subject successfully', async () => {
      const subject = await subjectRepository.save({
        userId: testUser.id,
        code: 'CS101',
        name: 'Computer Science',
        colorHex: '#ff0000',
      });

      const updateDto = {
        name: 'Advanced Computer Science',
        colorHex: '#00ff00',
      };

      const response = await request(app.getHttpServer())
        .patch(`/subjects/${subject.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.name).toBe('Advanced Computer Science');
      expect(response.body.colorHex).toBe('#00ff00');
      expect(response.body.code).toBe('CS101'); // Should remain unchanged
    });

    it('should return 404 for non-existent subject', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      
      await request(app.getHttpServer())
        .patch(`/subjects/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated' })
        .expect(404);
    });
  });

  describe('DELETE /subjects/:id', () => {
    it('should delete subject successfully', async () => {
      const subject = await subjectRepository.save({
        userId: testUser.id,
        name: 'Computer Science',
        colorHex: '#ff0000',
      });

      await request(app.getHttpServer())
        .delete(`/subjects/${subject.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify subject is deleted
      const deletedSubject = await subjectRepository.findOne({ where: { id: subject.id } });
      expect(deletedSubject).toBeNull();
    });

    it('should return 404 for non-existent subject', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      
      await request(app.getHttpServer())
        .delete(`/subjects/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
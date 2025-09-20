import { Test, TestingModule } from '@nestjs/testing';
import { SectionsController } from '../sections.controller';
import { SectionsService } from '../sections.service';
import { CreateSectionDto } from '../dto/create-section.dto';
import { UpdateSectionDto } from '../dto/update-section.dto';
import { SectionResponseDto } from '../dto/section-response.dto';
import { JwtAuthGuard } from '../../auth/guards/auth.guard';

describe('SectionsController', () => {
  let controller: SectionsController;
  let service: jest.Mocked<SectionsService>;

  const mockUserId = 'user-123';
  const mockSubjectId = 'subject-123';
  const mockSectionId = 'section-123';

  const mockSectionResponse: SectionResponseDto = {
    id: mockSectionId,
    subjectId: mockSubjectId,
    secCode: 'A01',
    teacher: 'John Doe',
    room: 'Room 101',
    scheduleRules: [
      {
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '10:30',
        startDate: '2024-01-15',
        endDate: '2024-04-15',
        skipDates: [],
      },
    ],
    subjectName: 'Computer Science',
    subjectCode: 'CS101',
    eventsCount: 0,
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findBySubject: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const mockAuthGuard = {
      canActivate: jest.fn(() => true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SectionsController],
      providers: [
        {
          provide: SectionsService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<SectionsController>(SectionsController);
    service = module.get(SectionsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a section', async () => {
      const createDto: CreateSectionDto = {
        subjectId: mockSubjectId,
        secCode: 'A01',
        teacher: 'John Doe',
        room: 'Room 101',
        scheduleRules: [
          {
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '10:30',
            startDate: '2024-01-15',
            endDate: '2024-04-15',
            skipDates: [],
          },
        ],
      };

      service.create.mockResolvedValue(mockSectionResponse);

      const result = await controller.create(mockUserId, createDto);

      expect(service.create).toHaveBeenCalledWith(mockUserId, createDto);
      expect(result).toEqual(mockSectionResponse);
    });
  });

  describe('findBySubject', () => {
    it('should return sections for subject', async () => {
      const sections = [mockSectionResponse];
      service.findBySubject.mockResolvedValue(sections);

      const result = await controller.findBySubject(mockUserId, mockSubjectId);

      expect(service.findBySubject).toHaveBeenCalledWith(mockUserId, mockSubjectId);
      expect(result).toEqual(sections);
    });
  });

  describe('findOne', () => {
    it('should return a section by id', async () => {
      service.findOne.mockResolvedValue(mockSectionResponse);

      const result = await controller.findOne(mockUserId, mockSectionId);

      expect(service.findOne).toHaveBeenCalledWith(mockUserId, mockSectionId);
      expect(result).toEqual(mockSectionResponse);
    });
  });

  describe('update', () => {
    it('should update a section', async () => {
      const updateDto: UpdateSectionDto = {
        secCode: 'A02',
        teacher: 'Jane Smith',
      };
      const updatedSection = { ...mockSectionResponse, ...updateDto };
      service.update.mockResolvedValue(updatedSection);

      const result = await controller.update(mockUserId, mockSectionId, updateDto);

      expect(service.update).toHaveBeenCalledWith(mockUserId, mockSectionId, updateDto);
      expect(result).toEqual(updatedSection);
    });
  });

  describe('remove', () => {
    it('should delete a section', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove(mockUserId, mockSectionId);

      expect(service.remove).toHaveBeenCalledWith(mockUserId, mockSectionId);
    });
  });
});
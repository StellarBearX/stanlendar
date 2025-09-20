import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { QuickAddService } from '../quick-add.service';
import { SubjectRepository } from '../../../infra/database/repositories/interfaces/subject-repository.interface';
import { SectionRepository } from '../../../infra/database/repositories/interfaces/section-repository.interface';
import { EventGenerationService } from '../../events/event-generation.service';
import { Subject } from '../../../infra/database/entities/subject.entity';
import { Section } from '../../../infra/database/entities/section.entity';
import { QuickAddClassDto } from '../dto/quick-add-class.dto';

describe('QuickAddService', () => {
  let service: QuickAddService;
  let subjectRepository: jest.Mocked<SubjectRepository>;
  let sectionRepository: jest.Mocked<SectionRepository>;
  let eventGenerationService: jest.Mocked<EventGenerationService>;

  const mockUserId = 'user-123';
  const mockSubject: Subject = {
    id: 'subject-123',
    userId: mockUserId,
    code: 'CS101',
    name: 'Computer Science',
    colorHex: '#3b82f6',
    meta: {},
    createdAt: new Date(),
    sections: [],
    events: [],
  };

  const mockSection: Section = {
    id: 'section-123',
    subjectId: mockSubject.id,
    secCode: '001',
    teacher: 'Dr. Smith',
    room: 'A101',
    scheduleRules: [{
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:30',
      startDate: '2024-01-01',
      endDate: '2024-05-31',
      skipDates: [],
    }],
    subject: mockSubject,
    events: [],
  };

  beforeEach(async () => {
    const mockSubjectRepository = {
      create: jest.fn(),
      findByUserIdAndName: jest.fn(),
      findByUserIdAndCode: jest.fn(),
      update: jest.fn(),
    };

    const mockSectionRepository = {
      create: jest.fn(),
      findBySubjectIdAndSecCode: jest.fn(),
    };

    const mockEventGenerationService = {
      generateEventsForSection: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuickAddService,
        {
          provide: 'SubjectRepository',
          useValue: mockSubjectRepository,
        },
        {
          provide: 'SectionRepository',
          useValue: mockSectionRepository,
        },
        {
          provide: EventGenerationService,
          useValue: mockEventGenerationService,
        },
      ],
    }).compile();

    service = module.get<QuickAddService>(QuickAddService);
    subjectRepository = module.get('SubjectRepository');
    sectionRepository = module.get('SectionRepository');
    eventGenerationService = module.get(EventGenerationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('quickAddClass', () => {
    const validQuickAddDto: QuickAddClassDto = {
      subjectName: 'Computer Science',
      subjectCode: 'CS101',
      subjectColor: '#3b82f6',
      sectionCode: '001',
      teacher: 'Dr. Smith',
      room: 'A101',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:30',
      startDate: '2024-01-01',
      endDate: '2024-05-31',
      skipDates: [],
    };

    it('should create new subject and section successfully', async () => {
      subjectRepository.findByUserIdAndName.mockResolvedValue(null);
      subjectRepository.findByUserIdAndCode.mockResolvedValue(null);
      subjectRepository.create.mockResolvedValue(mockSubject);
      sectionRepository.findBySubjectIdAndSecCode.mockResolvedValue(null);
      sectionRepository.create.mockResolvedValue(mockSection);
      eventGenerationService.generateEventsForSection.mockResolvedValue(10);

      const result = await service.quickAddClass(mockUserId, validQuickAddDto);

      expect(result).toEqual({
        subject: expect.objectContaining({
          id: mockSubject.id,
          name: mockSubject.name,
        }),
        section: expect.objectContaining({
          id: mockSection.id,
          secCode: mockSection.secCode,
        }),
        eventsGenerated: 10,
      });

      expect(subjectRepository.create).toHaveBeenCalledWith({
        userId: mockUserId,
        code: 'CS101',
        name: 'Computer Science',
        colorHex: '#3b82f6',
        meta: { teacher: 'Dr. Smith' },
      });

      expect(sectionRepository.create).toHaveBeenCalledWith({
        subjectId: mockSubject.id,
        secCode: '001',
        teacher: 'Dr. Smith',
        room: 'A101',
        scheduleRules: [{
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '10:30',
          startDate: '2024-01-01',
          endDate: '2024-05-31',
          skipDates: [],
        }],
      });

      expect(eventGenerationService.generateEventsForSection).toHaveBeenCalledWith(mockSection.id);
    });

    it('should use existing subject if found by name', async () => {
      const existingSubject = { ...mockSubject, colorHex: '#ff0000' };
      subjectRepository.findByUserIdAndName.mockResolvedValue(existingSubject);
      subjectRepository.update.mockResolvedValue({ ...existingSubject, colorHex: '#3b82f6' });
      sectionRepository.findBySubjectIdAndSecCode.mockResolvedValue(null);
      sectionRepository.create.mockResolvedValue(mockSection);
      eventGenerationService.generateEventsForSection.mockResolvedValue(5);

      const result = await service.quickAddClass(mockUserId, validQuickAddDto);

      expect(subjectRepository.create).not.toHaveBeenCalled();
      expect(subjectRepository.update).toHaveBeenCalledWith(existingSubject.id, {
        colorHex: '#3b82f6',
        meta: { teacher: 'Dr. Smith' },
      });
      expect(result.eventsGenerated).toBe(5);
    });

    it('should throw error if subject code conflicts', async () => {
      const conflictingSubject = { ...mockSubject, id: 'different-id' };
      subjectRepository.findByUserIdAndName.mockResolvedValue(null);
      subjectRepository.findByUserIdAndCode.mockResolvedValue(conflictingSubject);

      await expect(service.quickAddClass(mockUserId, validQuickAddDto))
        .rejects.toThrow(BadRequestException);
      await expect(service.quickAddClass(mockUserId, validQuickAddDto))
        .rejects.toThrow("Subject with code 'CS101' already exists");
    });

    it('should throw error if section code conflicts', async () => {
      subjectRepository.findByUserIdAndName.mockResolvedValue(null);
      subjectRepository.findByUserIdAndCode.mockResolvedValue(null);
      subjectRepository.create.mockResolvedValue(mockSubject);
      sectionRepository.findBySubjectIdAndSecCode.mockResolvedValue(mockSection);

      await expect(service.quickAddClass(mockUserId, validQuickAddDto))
        .rejects.toThrow(BadRequestException);
      await expect(service.quickAddClass(mockUserId, validQuickAddDto))
        .rejects.toThrow("Section with code '001' already exists for this subject");
    });

    it('should validate time range', async () => {
      const invalidDto = {
        ...validQuickAddDto,
        startTime: '10:30',
        endTime: '09:00',
      };

      await expect(service.quickAddClass(mockUserId, invalidDto))
        .rejects.toThrow(BadRequestException);
      await expect(service.quickAddClass(mockUserId, invalidDto))
        .rejects.toThrow('Start time (10:30) must be before end time (09:00)');
    });

    it('should validate minimum duration', async () => {
      const invalidDto = {
        ...validQuickAddDto,
        startTime: '09:00',
        endTime: '09:10', // Only 10 minutes
      };

      await expect(service.quickAddClass(mockUserId, invalidDto))
        .rejects.toThrow(BadRequestException);
      await expect(service.quickAddClass(mockUserId, invalidDto))
        .rejects.toThrow('Class duration must be at least 15 minutes');
    });

    it('should validate maximum duration', async () => {
      const invalidDto = {
        ...validQuickAddDto,
        startTime: '09:00',
        endTime: '18:00', // 9 hours
      };

      await expect(service.quickAddClass(mockUserId, invalidDto))
        .rejects.toThrow(BadRequestException);
      await expect(service.quickAddClass(mockUserId, invalidDto))
        .rejects.toThrow('Class duration cannot exceed 8 hours');
    });

    it('should validate date range', async () => {
      const invalidDto = {
        ...validQuickAddDto,
        startDate: '2024-05-31',
        endDate: '2024-01-01',
      };

      await expect(service.quickAddClass(mockUserId, invalidDto))
        .rejects.toThrow(BadRequestException);
      await expect(service.quickAddClass(mockUserId, invalidDto))
        .rejects.toThrow('Start date (2024-05-31) must be before end date (2024-01-01)');
    });

    it('should validate skip dates are within range', async () => {
      const invalidDto = {
        ...validQuickAddDto,
        skipDates: ['2023-12-25'], // Before start date
      };

      await expect(service.quickAddClass(mockUserId, invalidDto))
        .rejects.toThrow(BadRequestException);
      await expect(service.quickAddClass(mockUserId, invalidDto))
        .rejects.toThrow('Skip date 2023-12-25 must be within the schedule date range');
    });

    it('should validate color format', async () => {
      const invalidDto = {
        ...validQuickAddDto,
        subjectColor: 'invalid-color',
      };

      await expect(service.quickAddClass(mockUserId, invalidDto))
        .rejects.toThrow(BadRequestException);
      await expect(service.quickAddClass(mockUserId, invalidDto))
        .rejects.toThrow('Invalid hex color format');
    });

    it('should normalize color format', async () => {
      const dtoWithUppercaseColor = {
        ...validQuickAddDto,
        subjectColor: '#FF0000',
      };

      subjectRepository.findByUserIdAndName.mockResolvedValue(null);
      subjectRepository.findByUserIdAndCode.mockResolvedValue(null);
      subjectRepository.create.mockResolvedValue(mockSubject);
      sectionRepository.findBySubjectIdAndSecCode.mockResolvedValue(null);
      sectionRepository.create.mockResolvedValue(mockSection);
      eventGenerationService.generateEventsForSection.mockResolvedValue(1);

      await service.quickAddClass(mockUserId, dtoWithUppercaseColor);

      expect(subjectRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          colorHex: '#ff0000', // Should be normalized to lowercase
        })
      );
    });

    it('should handle color without # prefix', async () => {
      const dtoWithoutHash = {
        ...validQuickAddDto,
        subjectColor: '3b82f6',
      };

      subjectRepository.findByUserIdAndName.mockResolvedValue(null);
      subjectRepository.findByUserIdAndCode.mockResolvedValue(null);
      subjectRepository.create.mockResolvedValue(mockSubject);
      sectionRepository.findBySubjectIdAndSecCode.mockResolvedValue(null);
      sectionRepository.create.mockResolvedValue(mockSection);
      eventGenerationService.generateEventsForSection.mockResolvedValue(1);

      await service.quickAddClass(mockUserId, dtoWithoutHash);

      expect(subjectRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          colorHex: '#3b82f6', // Should add # prefix
        })
      );
    });

    it('should work without optional fields', async () => {
      const minimalDto: QuickAddClassDto = {
        subjectName: 'Computer Science',
        subjectColor: '#3b82f6',
        sectionCode: '001',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '10:30',
        startDate: '2024-01-01',
        endDate: '2024-05-31',
      };

      subjectRepository.findByUserIdAndName.mockResolvedValue(null);
      subjectRepository.create.mockResolvedValue(mockSubject);
      sectionRepository.findBySubjectIdAndSecCode.mockResolvedValue(null);
      sectionRepository.create.mockResolvedValue(mockSection);
      eventGenerationService.generateEventsForSection.mockResolvedValue(1);

      const result = await service.quickAddClass(mockUserId, minimalDto);

      expect(result).toBeDefined();
      expect(subjectRepository.create).toHaveBeenCalledWith({
        userId: mockUserId,
        code: undefined,
        name: 'Computer Science',
        colorHex: '#3b82f6',
        meta: {},
      });
    });
  });
});
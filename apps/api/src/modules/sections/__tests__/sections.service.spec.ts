import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { SectionsService } from '../sections.service';
import { SectionRepository } from '../../../infra/database/repositories/interfaces/section-repository.interface';
import { SubjectRepository } from '../../../infra/database/repositories/interfaces/subject-repository.interface';
import { Section } from '../../../infra/database/entities/section.entity';
import { Subject } from '../../../infra/database/entities/subject.entity';
import { CreateSectionDto } from '../dto/create-section.dto';
import { UpdateSectionDto } from '../dto/update-section.dto';

const SECTION_REPOSITORY_TOKEN = 'SectionRepository';
const SUBJECT_REPOSITORY_TOKEN = 'SubjectRepository';

describe('SectionsService', () => {
  let service: SectionsService;
  let sectionRepository: jest.Mocked<SectionRepository>;
  let subjectRepository: jest.Mocked<SubjectRepository>;

  const mockUserId = 'user-123';
  const mockSubjectId = 'subject-123';
  const mockSectionId = 'section-123';

  const mockSubject: Subject = {
    id: mockSubjectId,
    userId: mockUserId,
    code: 'CS101',
    name: 'Computer Science',
    colorHex: '#ff0000',
    meta: {},
    createdAt: new Date(),
    user: null,
    sections: [],
    events: [],
  };

  const mockSection: Section = {
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
    subject: mockSubject,
    events: [],
  };

  beforeEach(async () => {
    const mockSectionRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findBySubjectId: jest.fn(),
      findBySubjectIdAndSecCode: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockSubjectRepository = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SectionsService,
        {
          provide: SECTION_REPOSITORY_TOKEN,
          useValue: mockSectionRepository,
        },
        {
          provide: SUBJECT_REPOSITORY_TOKEN,
          useValue: mockSubjectRepository,
        },
      ],
    }).compile();

    service = module.get<SectionsService>(SectionsService);
    sectionRepository = module.get(SECTION_REPOSITORY_TOKEN);
    subjectRepository = module.get(SUBJECT_REPOSITORY_TOKEN);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
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

    it('should create a section successfully', async () => {
      subjectRepository.findById.mockResolvedValue(mockSubject);
      sectionRepository.findBySubjectIdAndSecCode.mockResolvedValue(null);
      sectionRepository.create.mockResolvedValue(mockSection);

      const result = await service.create(mockUserId, createDto);

      expect(subjectRepository.findById).toHaveBeenCalledWith(mockSubjectId);
      expect(sectionRepository.findBySubjectIdAndSecCode).toHaveBeenCalledWith(mockSubjectId, 'A01');
      expect(sectionRepository.create).toHaveBeenCalledWith({
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
      });
      expect(result.id).toBe(mockSectionId);
      expect(result.secCode).toBe('A01');
    });

    it('should throw NotFoundException if subject not found', async () => {
      subjectRepository.findById.mockResolvedValue(null);

      await expect(service.create(mockUserId, createDto)).rejects.toThrow(
        new NotFoundException(`Subject with ID '${mockSubjectId}' not found`),
      );
    });

    it('should throw NotFoundException if subject belongs to different user', async () => {
      const otherUserSubject = { ...mockSubject, userId: 'other-user' };
      subjectRepository.findById.mockResolvedValue(otherUserSubject);

      await expect(service.create(mockUserId, createDto)).rejects.toThrow(
        new NotFoundException(`Subject with ID '${mockSubjectId}' not found`),
      );
    });

    it('should throw ConflictException if section code already exists', async () => {
      subjectRepository.findById.mockResolvedValue(mockSubject);
      sectionRepository.findBySubjectIdAndSecCode.mockResolvedValue(mockSection);

      await expect(service.create(mockUserId, createDto)).rejects.toThrow(
        new ConflictException("Section with code 'A01' already exists for this subject"),
      );
    });

    it('should throw BadRequestException for invalid time range', async () => {
      const invalidDto = {
        ...createDto,
        scheduleRules: [
          {
            dayOfWeek: 1,
            startTime: '10:30',
            endTime: '09:00', // End before start
            startDate: '2024-01-15',
            endDate: '2024-04-15',
            skipDates: [],
          },
        ],
      };

      subjectRepository.findById.mockResolvedValue(mockSubject);
      sectionRepository.findBySubjectIdAndSecCode.mockResolvedValue(null);

      await expect(service.create(mockUserId, invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for invalid date range', async () => {
      const invalidDto = {
        ...createDto,
        scheduleRules: [
          {
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '10:30',
            startDate: '2024-04-15',
            endDate: '2024-01-15', // End before start
            skipDates: [],
          },
        ],
      };

      subjectRepository.findById.mockResolvedValue(mockSubject);
      sectionRepository.findBySubjectIdAndSecCode.mockResolvedValue(null);

      await expect(service.create(mockUserId, invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for overlapping schedule rules', async () => {
      const overlappingDto = {
        ...createDto,
        scheduleRules: [
          {
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '10:30',
            startDate: '2024-01-15',
            endDate: '2024-04-15',
            skipDates: [],
          },
          {
            dayOfWeek: 1,
            startTime: '10:00',
            endTime: '11:30',
            startDate: '2024-01-15',
            endDate: '2024-04-15',
            skipDates: [],
          },
        ],
      };

      subjectRepository.findById.mockResolvedValue(mockSubject);
      sectionRepository.findBySubjectIdAndSecCode.mockResolvedValue(null);

      await expect(service.create(mockUserId, overlappingDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for too short duration', async () => {
      const shortDto = {
        ...createDto,
        scheduleRules: [
          {
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '09:10', // Only 10 minutes
            startDate: '2024-01-15',
            endDate: '2024-04-15',
            skipDates: [],
          },
        ],
      };

      subjectRepository.findById.mockResolvedValue(mockSubject);
      sectionRepository.findBySubjectIdAndSecCode.mockResolvedValue(null);

      await expect(service.create(mockUserId, shortDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findBySubject', () => {
    it('should return sections for subject', async () => {
      subjectRepository.findById.mockResolvedValue(mockSubject);
      sectionRepository.findBySubjectId.mockResolvedValue([mockSection]);

      const result = await service.findBySubject(mockUserId, mockSubjectId);

      expect(subjectRepository.findById).toHaveBeenCalledWith(mockSubjectId);
      expect(sectionRepository.findBySubjectId).toHaveBeenCalledWith(mockSubjectId);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockSectionId);
    });

    it('should throw NotFoundException if subject not found', async () => {
      subjectRepository.findById.mockResolvedValue(null);

      await expect(service.findBySubject(mockUserId, mockSubjectId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findOne', () => {
    it('should return section if found and belongs to user', async () => {
      sectionRepository.findById.mockResolvedValue(mockSection);

      const result = await service.findOne(mockUserId, mockSectionId);

      expect(sectionRepository.findById).toHaveBeenCalledWith(mockSectionId);
      expect(result.id).toBe(mockSectionId);
    });

    it('should throw NotFoundException if section not found', async () => {
      sectionRepository.findById.mockResolvedValue(null);

      await expect(service.findOne(mockUserId, mockSectionId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if section belongs to different user', async () => {
      const otherUserSection = {
        ...mockSection,
        subject: { ...mockSubject, userId: 'other-user' },
      };
      sectionRepository.findById.mockResolvedValue(otherUserSection as any);

      await expect(service.findOne(mockUserId, mockSectionId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdateSectionDto = {
      secCode: 'A02',
      teacher: 'Jane Smith',
    };

    it('should update section successfully', async () => {
      const updatedSection = { ...mockSection, ...updateDto };
      sectionRepository.findById.mockResolvedValue(mockSection);
      sectionRepository.findBySubjectIdAndSecCode.mockResolvedValue(null);
      sectionRepository.update.mockResolvedValue(updatedSection);

      const result = await service.update(mockUserId, mockSectionId, updateDto);

      expect(sectionRepository.update).toHaveBeenCalledWith(mockSectionId, {
        secCode: 'A02',
        teacher: 'Jane Smith',
      });
      expect(result.secCode).toBe('A02');
      expect(result.teacher).toBe('Jane Smith');
    });

    it('should throw NotFoundException if section not found', async () => {
      sectionRepository.findById.mockResolvedValue(null);

      await expect(service.update(mockUserId, mockSectionId, updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if updated section code conflicts', async () => {
      const conflictSection = { ...mockSection, id: 'other-id' };
      sectionRepository.findById.mockResolvedValue(mockSection);
      sectionRepository.findBySubjectIdAndSecCode.mockResolvedValue(conflictSection);

      await expect(service.update(mockUserId, mockSectionId, updateDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('remove', () => {
    it('should delete section successfully', async () => {
      sectionRepository.findById.mockResolvedValue(mockSection);
      sectionRepository.delete.mockResolvedValue(true);

      await service.remove(mockUserId, mockSectionId);

      expect(sectionRepository.delete).toHaveBeenCalledWith(mockSectionId);
    });

    it('should throw NotFoundException if section not found', async () => {
      sectionRepository.findById.mockResolvedValue(null);

      await expect(service.remove(mockUserId, mockSectionId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if section has events', async () => {
      const sectionWithEvents = {
        ...mockSection,
        events: [{ id: 'event-1' }],
      };
      sectionRepository.findById.mockResolvedValue(sectionWithEvents as any);

      await expect(service.remove(mockUserId, mockSectionId)).rejects.toThrow(
        new BadRequestException('Cannot delete section with existing events. Delete events first.'),
      );
    });
  });
});
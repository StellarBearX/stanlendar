import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EventGenerationService } from '../event-generation.service';
import { LocalEventRepository } from '../../../infra/database/repositories/interfaces/local-event-repository.interface';
import { SectionRepository } from '../../../infra/database/repositories/interfaces/section-repository.interface';
import { LocalEvent } from '../../../infra/database/entities/local-event.entity';
import { Section } from '../../../infra/database/entities/section.entity';
import { Subject } from '../../../infra/database/entities/subject.entity';

const LOCAL_EVENT_REPOSITORY_TOKEN = 'LocalEventRepository';
const SECTION_REPOSITORY_TOKEN = 'SectionRepository';

describe('EventGenerationService', () => {
  let service: EventGenerationService;
  let localEventRepository: jest.Mocked<LocalEventRepository>;
  let sectionRepository: jest.Mocked<SectionRepository>;

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
        dayOfWeek: 1, // Monday
        startTime: '09:00',
        endTime: '10:30',
        startDate: '2024-01-15', // Monday
        endDate: '2024-01-29', // Two weeks later
        skipDates: ['2024-01-22'], // Skip second Monday
      },
    ],
    subject: mockSubject,
    events: [],
  };

  const mockEvent: LocalEvent = {
    id: 'event-123',
    userId: mockUserId,
    subjectId: mockSubjectId,
    sectionId: mockSectionId,
    eventDate: '2024-01-15',
    startTime: '09:00',
    endTime: '10:30',
    room: 'Room 101',
    status: 'planned',
    gcalEventId: null,
    gcalEtag: null,
    titleOverride: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: null,
    subject: mockSubject,
    section: mockSection,
  };

  beforeEach(async () => {
    const mockLocalEventRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findBySectionId: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      softDelete: jest.fn(),
    };

    const mockSectionRepository = {
      findById: jest.fn(),
      findBySubjectId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventGenerationService,
        {
          provide: LOCAL_EVENT_REPOSITORY_TOKEN,
          useValue: mockLocalEventRepository,
        },
        {
          provide: SECTION_REPOSITORY_TOKEN,
          useValue: mockSectionRepository,
        },
      ],
    }).compile();

    service = module.get<EventGenerationService>(EventGenerationService);
    localEventRepository = module.get(LOCAL_EVENT_REPOSITORY_TOKEN);
    sectionRepository = module.get(SECTION_REPOSITORY_TOKEN);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateEventsForSection', () => {
    it('should generate events for section successfully', async () => {
      sectionRepository.findById.mockResolvedValue(mockSection);
      localEventRepository.findBySectionId.mockResolvedValue([]);
      localEventRepository.create.mockResolvedValue(mockEvent);

      const result = await service.generateEventsForSection(mockUserId, mockSectionId);

      expect(sectionRepository.findById).toHaveBeenCalledWith(mockSectionId);
      expect(localEventRepository.create).toHaveBeenCalledTimes(2); // Two Mondays, one skipped
      expect(result.generated).toBe(2);
      expect(result.skipped).toBe(1); // One skip date
      expect(result.replaced).toBe(0);
    });

    it('should throw NotFoundException if section not found', async () => {
      sectionRepository.findById.mockResolvedValue(null);

      await expect(service.generateEventsForSection(mockUserId, mockSectionId)).rejects.toThrow(
        new NotFoundException(`Section with ID '${mockSectionId}' not found`),
      );
    });

    it('should throw NotFoundException if section belongs to different user', async () => {
      const otherUserSection = {
        ...mockSection,
        subject: { ...mockSubject, userId: 'other-user' },
      };
      sectionRepository.findById.mockResolvedValue(otherUserSection as any);

      await expect(service.generateEventsForSection(mockUserId, mockSectionId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should skip existing events when replaceExisting is false', async () => {
      sectionRepository.findById.mockResolvedValue(mockSection);
      localEventRepository.findBySectionId.mockResolvedValue([mockEvent]);

      const result = await service.generateEventsForSection(mockUserId, mockSectionId, {
        replaceExisting: false,
      });

      expect(result.generated).toBe(1); // Only one new event (other exists)
      expect(result.skipped).toBe(2); // One existing + one skip date
    });

    it('should replace existing events when replaceExisting is true', async () => {
      sectionRepository.findById.mockResolvedValue(mockSection);
      localEventRepository.findBySectionId.mockResolvedValue([mockEvent]);
      localEventRepository.update.mockResolvedValue(mockEvent);

      const result = await service.generateEventsForSection(mockUserId, mockSectionId, {
        replaceExisting: true,
      });

      expect(result.generated).toBe(1); // One new event
      expect(result.replaced).toBe(1); // One replaced event
      expect(result.skipped).toBe(1); // One skip date
    });

    it('should respect custom date range', async () => {
      sectionRepository.findById.mockResolvedValue(mockSection);
      localEventRepository.findBySectionId.mockResolvedValue([]);
      localEventRepository.create.mockResolvedValue(mockEvent);

      const result = await service.generateEventsForSection(mockUserId, mockSectionId, {
        startDate: '2024-01-15',
        endDate: '2024-01-21', // Only first week
      });

      expect(result.generated).toBe(1); // Only first Monday
      expect(result.skipped).toBe(0);
    });
  });

  describe('generateEventsForSubject', () => {
    it('should generate events for all sections of subject', async () => {
      sectionRepository.findBySubjectId.mockResolvedValue([mockSection]);
      sectionRepository.findById.mockResolvedValue(mockSection); // Mock for generateEventsForSection call
      localEventRepository.findBySectionId.mockResolvedValue([]);
      localEventRepository.create.mockResolvedValue(mockEvent);

      const result = await service.generateEventsForSubject(mockUserId, mockSubjectId);

      expect(sectionRepository.findBySubjectId).toHaveBeenCalledWith(mockSubjectId);
      expect(result.generated).toBe(2);
      expect(result.skipped).toBe(1);
    });

    it('should throw NotFoundException if no sections found', async () => {
      sectionRepository.findBySubjectId.mockResolvedValue([]);

      await expect(service.generateEventsForSubject(mockUserId, mockSubjectId)).rejects.toThrow(
        new NotFoundException(`No sections found for subject ID '${mockSubjectId}'`),
      );
    });
  });

  describe('deleteEventsForSection', () => {
    it('should delete planned events (hard delete)', async () => {
      sectionRepository.findById.mockResolvedValue(mockSection);
      localEventRepository.findBySectionId.mockResolvedValue([mockEvent]);
      localEventRepository.delete.mockResolvedValue(true);

      const result = await service.deleteEventsForSection(mockUserId, mockSectionId);

      expect(localEventRepository.delete).toHaveBeenCalledWith(mockEvent.id);
      expect(result).toBe(1);
    });

    it('should soft delete synced events', async () => {
      const syncedEvent = { ...mockEvent, status: 'synced' as const };
      sectionRepository.findById.mockResolvedValue(mockSection);
      localEventRepository.findBySectionId.mockResolvedValue([syncedEvent]);
      localEventRepository.softDelete.mockResolvedValue(true);

      const result = await service.deleteEventsForSection(mockUserId, mockSectionId);

      expect(localEventRepository.softDelete).toHaveBeenCalledWith(syncedEvent.id);
      expect(result).toBe(1);
    });
  });

  describe('regenerateEventsForSection', () => {
    it('should delete existing events and generate new ones', async () => {
      // Mock for deleteEventsForSection
      sectionRepository.findById.mockResolvedValue(mockSection);
      localEventRepository.findBySectionId.mockResolvedValue([mockEvent]);
      localEventRepository.delete.mockResolvedValue(true);
      
      // Mock for generateEventsForSection (called after delete)
      localEventRepository.findBySectionId.mockResolvedValueOnce([mockEvent]); // For delete
      localEventRepository.findBySectionId.mockResolvedValue([]); // For generate (no existing events)
      localEventRepository.create.mockResolvedValue(mockEvent);

      const result = await service.regenerateEventsForSection(mockUserId, mockSectionId);

      expect(localEventRepository.delete).toHaveBeenCalled();
      expect(result.generated).toBe(2);
      expect(result.replaced).toBe(1); // Deleted count
    });
  });
});
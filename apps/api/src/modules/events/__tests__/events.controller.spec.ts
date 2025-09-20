import { Test, TestingModule } from '@nestjs/testing';
import { EventsController } from '../events.controller';
import { EventGenerationService } from '../event-generation.service';
import { GenerateEventsDto } from '../dto/generate-events.dto';
import { JwtAuthGuard } from '../../auth/guards/auth.guard';

describe('EventsController', () => {
  let controller: EventsController;
  let service: jest.Mocked<EventGenerationService>;

  const mockUserId = 'user-123';
  const mockSubjectId = 'subject-123';
  const mockSectionId = 'section-123';

  const mockGenerationResult = {
    generated: 5,
    skipped: 2,
    replaced: 1,
    events: [],
  };

  beforeEach(async () => {
    const mockService = {
      generateEventsForSection: jest.fn(),
      generateEventsForSubject: jest.fn(),
      regenerateEventsForSection: jest.fn(),
      deleteEventsForSection: jest.fn(),
    };

    const mockAuthGuard = {
      canActivate: jest.fn(() => true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        {
          provide: EventGenerationService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<EventsController>(EventsController);
    service = module.get(EventGenerationService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generateEventsForSection', () => {
    it('should generate events for section', async () => {
      const generateDto: GenerateEventsDto = {
        startDate: '2024-01-15',
        endDate: '2024-04-15',
        replaceExisting: false,
      };

      service.generateEventsForSection.mockResolvedValue(mockGenerationResult);

      const result = await controller.generateEventsForSection(mockUserId, mockSectionId, generateDto);

      expect(service.generateEventsForSection).toHaveBeenCalledWith(
        mockUserId,
        mockSectionId,
        generateDto
      );
      expect(result.generated).toBe(5);
      expect(result.skipped).toBe(2);
      expect(result.replaced).toBe(1);
    });
  });

  describe('generateEventsForSubject', () => {
    it('should generate events for all sections of subject', async () => {
      const generateDto: GenerateEventsDto = {
        startDate: '2024-01-15',
        endDate: '2024-04-15',
      };

      service.generateEventsForSubject.mockResolvedValue(mockGenerationResult);

      const result = await controller.generateEventsForSubject(mockUserId, mockSubjectId, generateDto);

      expect(service.generateEventsForSubject).toHaveBeenCalledWith(
        mockUserId,
        mockSubjectId,
        generateDto
      );
      expect(result.generated).toBe(5);
    });
  });

  describe('regenerateEventsForSection', () => {
    it('should regenerate events for section', async () => {
      const generateDto: GenerateEventsDto = {
        replaceExisting: true,
      };

      service.regenerateEventsForSection.mockResolvedValue(mockGenerationResult);

      const result = await controller.regenerateEventsForSection(mockUserId, mockSectionId, generateDto);

      expect(service.regenerateEventsForSection).toHaveBeenCalledWith(
        mockUserId,
        mockSectionId,
        generateDto
      );
      expect(result.generated).toBe(5);
    });
  });

  describe('deleteEventsForSection', () => {
    it('should delete events for section', async () => {
      service.deleteEventsForSection.mockResolvedValue(3);

      const result = await controller.deleteEventsForSection(mockUserId, mockSectionId);

      expect(service.deleteEventsForSection).toHaveBeenCalledWith(mockUserId, mockSectionId);
      expect(result.deleted).toBe(3);
    });
  });
});
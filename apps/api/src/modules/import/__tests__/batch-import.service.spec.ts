import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BatchImportService } from '../services/batch-import.service';
import { ImportJobRepositoryInterface } from '../../../infra/database/repositories/interfaces/import-job-repository.interface';
import { ImportItemRepositoryInterface } from '../../../infra/database/repositories/interfaces/import-item-repository.interface';
import { SubjectRepositoryInterface } from '../../../infra/database/repositories/interfaces/subject-repository.interface';
import { SectionRepositoryInterface } from '../../../infra/database/repositories/interfaces/section-repository.interface';
import { LocalEventRepositoryInterface } from '../../../infra/database/repositories/interfaces/local-event-repository.interface';
import { EventGenerationService } from '../../events/event-generation.service';
import {
    IMPORT_JOB_REPOSITORY,
    IMPORT_ITEM_REPOSITORY,
    SUBJECT_REPOSITORY,
    SECTION_REPOSITORY,
    LOCAL_EVENT_REPOSITORY,
} from '../../../infra/database/repositories/repository.module';
import { ImportJob } from '../../../infra/database/entities/import-job.entity';
import { ImportItem } from '../../../infra/database/entities/import-item.entity';
import { Subject } from '../../../infra/database/entities/subject.entity';
import { Section } from '../../../infra/database/entities/section.entity';

describe('BatchImportService', () => {
    let service: BatchImportService;
    let importJobRepository: jest.Mocked<ImportJobRepositoryInterface>;
    let importItemRepository: jest.Mocked<ImportItemRepositoryInterface>;
    let subjectRepository: jest.Mocked<SubjectRepositoryInterface>;
    let sectionRepository: jest.Mocked<SectionRepositoryInterface>;
    let localEventRepository: jest.Mocked<LocalEventRepositoryInterface>;
    let eventGenerationService: jest.Mocked<EventGenerationService>;

    const mockImportJob: ImportJob = {
        id: 'job-1',
        userId: 'user-1',
        sourceType: 'csv',
        state: 'preview',
        columnMap: {
            'Subject': 'subjectName',
            'Section': 'sectionCode',
            'Start Time': 'startTime',
            'End Time': 'endTime',
            'Days': 'daysOfWeek',
            'Room': 'room',
        },
        errorMessage: null,
        createdAt: new Date(),
        user: null,
        items: [],
    };

    const mockImportItems: ImportItem[] = [
        {
            id: 'item-1',
            importJobId: 'job-1',
            rawRow: {
                'Subject': 'Math 101',
                'Section': '001',
                'Start Time': '09:00',
                'End Time': '10:30',
                'Days': 'MO,WE,FR',
                'Room': 'A101',
            },
            subjectId: null,
            sectionId: null,
            startDate: null,
            endDate: null,
            daysOfWeek: null,
            startTime: null,
            endTime: null,
            room: null,
            note: null,
            status: 'preview',
            importJob: null,
        },
    ];

    const mockSubject: Subject = {
        id: 'subject-1',
        userId: 'user-1',
        code: null,
        name: 'Math 101',
        colorHex: '#3B82F6',
        meta: {},
        createdAt: new Date(),
        sections: [],
        events: [],
        user: null,
    };

    const mockSection: Section = {
        id: 'section-1',
        subjectId: 'subject-1',
        secCode: '001',
        teacher: null,
        room: 'A101',
        scheduleRules: {
            type: 'weekly',
            startTime: '09:00',
            endTime: '10:30',
            daysOfWeek: ['MO', 'WE', 'FR'],
            startDate: null,
            endDate: null,
            skipDates: [],
        },
        subject: null,
        events: [],
    };

    beforeEach(async () => {
        const mockImportJobRepo = {
            findById: jest.fn(),
            update: jest.fn(),
            create: jest.fn(),
            findByUserId: jest.fn(),
            findByUserIdAndState: jest.fn(),
            findWithItems: jest.fn(),
            delete: jest.fn(),
            findAll: jest.fn(),
        };

        const mockImportItemRepo = {
            findByImportJobId: jest.fn(),
            updateStatus: jest.fn(),
            create: jest.fn(),
            findById: jest.fn(),
            findByImportJobIdAndStatus: jest.fn(),
            bulkCreate: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findAll: jest.fn(),
        };

        const mockSubjectRepo = {
            findByUserIdAndName: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            findById: jest.fn(),
            findByUserId: jest.fn(),
            findByUserIdAndCode: jest.fn(),
            searchByText: jest.fn(),
            delete: jest.fn(),
            findAll: jest.fn(),
        };

        const mockSectionRepo = {
            findBySubjectIdAndSecCode: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            findById: jest.fn(),
            findBySubjectId: jest.fn(),
            delete: jest.fn(),
            findAll: jest.fn(),
        };

        const mockLocalEventRepo = {
            create: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findAll: jest.fn(),
        };

        const mockEventGenerationService = {
            generateEventsForSection: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BatchImportService,
                {
                    provide: IMPORT_JOB_REPOSITORY,
                    useValue: mockImportJobRepo,
                },
                {
                    provide: IMPORT_ITEM_REPOSITORY,
                    useValue: mockImportItemRepo,
                },
                {
                    provide: SUBJECT_REPOSITORY,
                    useValue: mockSubjectRepo,
                },
                {
                    provide: SECTION_REPOSITORY,
                    useValue: mockSectionRepo,
                },
                {
                    provide: LOCAL_EVENT_REPOSITORY,
                    useValue: mockLocalEventRepo,
                },
                {
                    provide: EventGenerationService,
                    useValue: mockEventGenerationService,
                },
            ],
        }).compile();

        service = module.get<BatchImportService>(BatchImportService);
        importJobRepository = module.get(IMPORT_JOB_REPOSITORY);
        importItemRepository = module.get(IMPORT_ITEM_REPOSITORY);
        subjectRepository = module.get(SUBJECT_REPOSITORY);
        sectionRepository = module.get(SECTION_REPOSITORY);
        localEventRepository = module.get(LOCAL_EVENT_REPOSITORY);
        eventGenerationService = module.get(EventGenerationService);
    });

    describe('processImport', () => {
        it('should process import successfully', async () => {
            importJobRepository.findById.mockResolvedValue(mockImportJob);
            importItemRepository.findByImportJobId.mockResolvedValue(mockImportItems);
            subjectRepository.findByUserIdAndName.mockResolvedValue(null);
            subjectRepository.create.mockResolvedValue(mockSubject);
            sectionRepository.findBySubjectIdAndSecCode.mockResolvedValue(null);
            sectionRepository.create.mockResolvedValue(mockSection);
            eventGenerationService.generateEventsForSection.mockResolvedValue([]);
            importItemRepository.updateStatus.mockResolvedValue(undefined);
            importJobRepository.update.mockResolvedValue(mockImportJob);

            const result = await service.processImport('job-1', 'user-1');

            expect(result.summary.totalRows).toBe(1);
            expect(result.summary.created).toBe(1);
            expect(result.summary.failed).toBe(0);
            expect(result.details).toHaveLength(1);
            expect(result.details[0].action).toBe('created');
            expect(result.details[0].subjectName).toBe('Math 101');
            expect(result.details[0].sectionCode).toBe('001');
        });

        it('should throw error for non-existent job', async () => {
            importJobRepository.findById.mockResolvedValue(null);

            await expect(service.processImport('job-1', 'user-1')).rejects.toThrow(BadRequestException);
        });

        it('should throw error for wrong user', async () => {
            importJobRepository.findById.mockResolvedValue(mockImportJob);

            await expect(service.processImport('job-1', 'user-2')).rejects.toThrow(BadRequestException);
        });

        it('should throw error for non-preview state', async () => {
            const appliedJob = { ...mockImportJob, state: 'applied' as const };
            importJobRepository.findById.mockResolvedValue(appliedJob);

            await expect(service.processImport('job-1', 'user-1')).rejects.toThrow(BadRequestException);
        });

        it('should throw error when column mapping is missing', async () => {
            const jobWithoutMapping = { ...mockImportJob, columnMap: null };
            importJobRepository.findById.mockResolvedValue(jobWithoutMapping);

            await expect(service.processImport('job-1', 'user-1')).rejects.toThrow(BadRequestException);
        });

        it('should handle missing required fields', async () => {
            const itemWithMissingData = {
                ...mockImportItems[0],
                rawRow: {
                    'Subject': 'Math 101',
                    'Section': '', // Missing required field
                    'Start Time': '09:00',
                    'End Time': '10:30',
                    'Days': 'MO,WE,FR',
                },
            };

            importJobRepository.findById.mockResolvedValue(mockImportJob);
            importItemRepository.findByImportJobId.mockResolvedValue([itemWithMissingData]);
            importItemRepository.updateStatus.mockResolvedValue(undefined);
            importJobRepository.update.mockResolvedValue(mockImportJob);

            const result = await service.processImport('job-1', 'user-1');

            expect(result.summary.failed).toBe(1);
            expect(result.details[0].action).toBe('failed');
            expect(result.details[0].message).toContain('Missing required field');
        });

        it('should reuse existing subject', async () => {
            importJobRepository.findById.mockResolvedValue(mockImportJob);
            importItemRepository.findByImportJobId.mockResolvedValue(mockImportItems);
            subjectRepository.findByUserIdAndName.mockResolvedValue(mockSubject);
            sectionRepository.findBySubjectIdAndSecCode.mockResolvedValue(null);
            sectionRepository.create.mockResolvedValue(mockSection);
            eventGenerationService.generateEventsForSection.mockResolvedValue([]);
            importItemRepository.updateStatus.mockResolvedValue(undefined);
            importJobRepository.update.mockResolvedValue(mockImportJob);

            const result = await service.processImport('job-1', 'user-1');

            expect(subjectRepository.create).not.toHaveBeenCalled();
            expect(result.summary.created).toBe(1);
        });

        it('should reuse existing section', async () => {
            importJobRepository.findById.mockResolvedValue(mockImportJob);
            importItemRepository.findByImportJobId.mockResolvedValue(mockImportItems);
            subjectRepository.findByUserIdAndName.mockResolvedValue(mockSubject);
            sectionRepository.findBySubjectIdAndSecCode.mockResolvedValue(mockSection);
            eventGenerationService.generateEventsForSection.mockResolvedValue([]);
            importItemRepository.updateStatus.mockResolvedValue(undefined);
            importJobRepository.update.mockResolvedValue(mockImportJob);

            const result = await service.processImport('job-1', 'user-1');

            expect(sectionRepository.create).not.toHaveBeenCalled();
            expect(result.summary.created).toBe(1);
        });
    });

    describe('getImportResult', () => {
        it('should return import result for completed job', async () => {
            const completedJob = { ...mockImportJob, state: 'applied' as const };
            const completedItems = mockImportItems.map(item => ({ ...item, status: 'created' as const }));

            importJobRepository.findById.mockResolvedValue(completedJob);
            importItemRepository.findByImportJobId.mockResolvedValue(completedItems);

            const result = await service.getImportResult('job-1', 'user-1');

            expect(result).not.toBeNull();
            expect(result!.summary.totalRows).toBe(1);
            expect(result!.summary.created).toBe(1);
        });

        it('should return null for non-existent job', async () => {
            importJobRepository.findById.mockResolvedValue(null);

            const result = await service.getImportResult('job-1', 'user-1');

            expect(result).toBeNull();
        });

        it('should return null for job in preview state', async () => {
            importJobRepository.findById.mockResolvedValue(mockImportJob);

            const result = await service.getImportResult('job-1', 'user-1');

            expect(result).toBeNull();
        });
    });
});
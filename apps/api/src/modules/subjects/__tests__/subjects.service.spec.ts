import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { SubjectsService } from '../subjects.service';
import { SubjectRepository } from '../../../infra/database/repositories/interfaces/subject-repository.interface';
import { Subject } from '../../../infra/database/entities/subject.entity';
import { CreateSubjectDto } from '../dto/create-subject.dto';
import { UpdateSubjectDto } from '../dto/update-subject.dto';

const SUBJECT_REPOSITORY_TOKEN = 'SubjectRepository';

describe('SubjectsService', () => {
  let service: SubjectsService;
  let repository: jest.Mocked<SubjectRepository>;

  const mockUserId = 'user-123';
  const mockSubjectId = 'subject-123';

  const mockSubject: Subject = {
    id: mockSubjectId,
    userId: mockUserId,
    code: 'CS101',
    name: 'Computer Science',
    colorHex: '#ff0000',
    meta: { teacher: 'John Doe' },
    createdAt: new Date(),
    user: null,
    sections: [],
    events: [],
  };

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      findByUserIdAndCode: jest.fn(),
      findByUserIdAndName: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      searchByText: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubjectsService,
        {
          provide: SUBJECT_REPOSITORY_TOKEN,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<SubjectsService>(SubjectsService);
    repository = module.get(SUBJECT_REPOSITORY_TOKEN);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateSubjectDto = {
      code: 'CS101',
      name: 'Computer Science',
      colorHex: '#FF0000',
      meta: { teacher: 'John Doe' },
    };

    it('should create a subject successfully', async () => {
      repository.findByUserIdAndCode.mockResolvedValue(null);
      repository.findByUserIdAndName.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockSubject);

      const result = await service.create(mockUserId, createDto);

      expect(repository.findByUserIdAndCode).toHaveBeenCalledWith(mockUserId, 'CS101');
      expect(repository.findByUserIdAndName).toHaveBeenCalledWith(mockUserId, 'Computer Science');
      expect(repository.create).toHaveBeenCalledWith({
        userId: mockUserId,
        code: 'CS101',
        name: 'Computer Science',
        colorHex: '#ff0000',
        meta: { teacher: 'John Doe' },
      });
      expect(result.id).toBe(mockSubjectId);
      expect(result.name).toBe('Computer Science');
    });

    it('should throw ConflictException if subject code already exists', async () => {
      repository.findByUserIdAndCode.mockResolvedValue(mockSubject);

      await expect(service.create(mockUserId, createDto)).rejects.toThrow(
        new ConflictException("Subject with code 'CS101' already exists"),
      );
    });

    it('should throw ConflictException if subject name already exists', async () => {
      repository.findByUserIdAndCode.mockResolvedValue(null);
      repository.findByUserIdAndName.mockResolvedValue(mockSubject);

      await expect(service.create(mockUserId, createDto)).rejects.toThrow(
        new ConflictException("Subject with name 'Computer Science' already exists"),
      );
    });

    it('should normalize color to lowercase with #', async () => {
      repository.findByUserIdAndCode.mockResolvedValue(null);
      repository.findByUserIdAndName.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockSubject);

      await service.create(mockUserId, { ...createDto, colorHex: 'FF0000' });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          colorHex: '#ff0000',
        }),
      );
    });

    it('should throw BadRequestException for invalid color format', async () => {
      const invalidColorDto = { ...createDto, colorHex: 'invalid' };

      await expect(service.create(mockUserId, invalidColorDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create subject without code', async () => {
      const noCodDto = { ...createDto, code: undefined };
      repository.findByUserIdAndName.mockResolvedValue(null);
      repository.create.mockResolvedValue({ ...mockSubject, code: null });

      const result = await service.create(mockUserId, noCodDto);

      expect(repository.findByUserIdAndCode).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return all subjects for user', async () => {
      const subjects = [mockSubject];
      repository.findByUserId.mockResolvedValue(subjects);

      const result = await service.findAll(mockUserId);

      expect(repository.findByUserId).toHaveBeenCalledWith(mockUserId);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockSubjectId);
    });
  });

  describe('findOne', () => {
    it('should return subject if found and belongs to user', async () => {
      repository.findById.mockResolvedValue(mockSubject);

      const result = await service.findOne(mockUserId, mockSubjectId);

      expect(repository.findById).toHaveBeenCalledWith(mockSubjectId);
      expect(result.id).toBe(mockSubjectId);
    });

    it('should throw NotFoundException if subject not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne(mockUserId, mockSubjectId)).rejects.toThrow(
        new NotFoundException(`Subject with ID '${mockSubjectId}' not found`),
      );
    });

    it('should throw NotFoundException if subject belongs to different user', async () => {
      const otherUserSubject = { ...mockSubject, userId: 'other-user' };
      repository.findById.mockResolvedValue(otherUserSubject);

      await expect(service.findOne(mockUserId, mockSubjectId)).rejects.toThrow(
        new NotFoundException(`Subject with ID '${mockSubjectId}' not found`),
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdateSubjectDto = {
      name: 'Updated Computer Science',
      colorHex: '#00FF00',
    };

    it('should update subject successfully', async () => {
      const updatedSubject = { ...mockSubject, ...updateDto, colorHex: '#00ff00' };
      repository.findById.mockResolvedValue(mockSubject);
      repository.findByUserIdAndName.mockResolvedValue(null);
      repository.update.mockResolvedValue(updatedSubject);

      const result = await service.update(mockUserId, mockSubjectId, updateDto);

      expect(repository.update).toHaveBeenCalledWith(mockSubjectId, {
        name: 'Updated Computer Science',
        colorHex: '#00ff00',
      });
      expect(result.name).toBe('Updated Computer Science');
    });

    it('should throw NotFoundException if subject not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update(mockUserId, mockSubjectId, updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if updated name conflicts', async () => {
      const conflictSubject = { ...mockSubject, id: 'other-id' };
      repository.findById.mockResolvedValue(mockSubject);
      repository.findByUserIdAndName.mockResolvedValue(conflictSubject);

      await expect(service.update(mockUserId, mockSubjectId, updateDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('remove', () => {
    it('should delete subject successfully', async () => {
      repository.findById.mockResolvedValue(mockSubject);
      repository.delete.mockResolvedValue(true);

      await service.remove(mockUserId, mockSubjectId);

      expect(repository.delete).toHaveBeenCalledWith(mockSubjectId);
    });

    it('should throw NotFoundException if subject not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove(mockUserId, mockSubjectId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if subject has sections', async () => {
      const subjectWithSections = {
        ...mockSubject,
        sections: [{ id: 'section-1' }],
      };
      repository.findById.mockResolvedValue(subjectWithSections as any);

      await expect(service.remove(mockUserId, mockSubjectId)).rejects.toThrow(
        new BadRequestException('Cannot delete subject with existing sections. Delete sections first.'),
      );
    });

    it('should throw BadRequestException if subject has events', async () => {
      const subjectWithEvents = {
        ...mockSubject,
        events: [{ id: 'event-1' }],
      };
      repository.findById.mockResolvedValue(subjectWithEvents as any);

      await expect(service.remove(mockUserId, mockSubjectId)).rejects.toThrow(
        new BadRequestException('Cannot delete subject with existing events. Delete events first.'),
      );
    });
  });

  describe('search', () => {
    it('should search subjects by text', async () => {
      const subjects = [mockSubject];
      repository.searchByText.mockResolvedValue(subjects);

      const result = await service.search(mockUserId, 'Computer');

      expect(repository.searchByText).toHaveBeenCalledWith(mockUserId, 'Computer');
      expect(result).toHaveLength(1);
    });

    it('should return all subjects if search text is empty', async () => {
      const subjects = [mockSubject];
      repository.findByUserId.mockResolvedValue(subjects);

      const result = await service.search(mockUserId, '');

      expect(repository.findByUserId).toHaveBeenCalledWith(mockUserId);
      expect(result).toHaveLength(1);
    });
  });
});
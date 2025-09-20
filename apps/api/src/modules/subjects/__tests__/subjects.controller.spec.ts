import { Test, TestingModule } from '@nestjs/testing';
import { SubjectsController } from '../subjects.controller';
import { SubjectsService } from '../subjects.service';
import { CreateSubjectDto } from '../dto/create-subject.dto';
import { UpdateSubjectDto } from '../dto/update-subject.dto';
import { SubjectResponseDto } from '../dto/subject-response.dto';
import { JwtAuthGuard } from '../../auth/guards/auth.guard';

describe('SubjectsController', () => {
  let controller: SubjectsController;
  let service: jest.Mocked<SubjectsService>;

  const mockUserId = 'user-123';
  const mockSubjectId = 'subject-123';

  const mockSubjectResponse: SubjectResponseDto = {
    id: mockSubjectId,
    code: 'CS101',
    name: 'Computer Science',
    colorHex: '#ff0000',
    meta: { teacher: 'John Doe' },
    createdAt: new Date(),
    sectionsCount: 0,
    eventsCount: 0,
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      search: jest.fn(),
    };

    const mockAuthGuard = {
      canActivate: jest.fn(() => true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubjectsController],
      providers: [
        {
          provide: SubjectsService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<SubjectsController>(SubjectsController);
    service = module.get(SubjectsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a subject', async () => {
      const createDto: CreateSubjectDto = {
        code: 'CS101',
        name: 'Computer Science',
        colorHex: '#ff0000',
        meta: { teacher: 'John Doe' },
      };

      service.create.mockResolvedValue(mockSubjectResponse);

      const result = await controller.create(mockUserId, createDto);

      expect(service.create).toHaveBeenCalledWith(mockUserId, createDto);
      expect(result).toEqual(mockSubjectResponse);
    });
  });

  describe('findAll', () => {
    it('should return all subjects for user', async () => {
      const subjects = [mockSubjectResponse];
      service.findAll.mockResolvedValue(subjects);

      const result = await controller.findAll(mockUserId);

      expect(service.findAll).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(subjects);
    });
  });

  describe('search', () => {
    it('should search subjects', async () => {
      const subjects = [mockSubjectResponse];
      const searchText = 'Computer';
      service.search.mockResolvedValue(subjects);

      const result = await controller.search(mockUserId, searchText);

      expect(service.search).toHaveBeenCalledWith(mockUserId, searchText);
      expect(result).toEqual(subjects);
    });
  });

  describe('findOne', () => {
    it('should return a subject by id', async () => {
      service.findOne.mockResolvedValue(mockSubjectResponse);

      const result = await controller.findOne(mockUserId, mockSubjectId);

      expect(service.findOne).toHaveBeenCalledWith(mockUserId, mockSubjectId);
      expect(result).toEqual(mockSubjectResponse);
    });
  });

  describe('update', () => {
    it('should update a subject', async () => {
      const updateDto: UpdateSubjectDto = {
        name: 'Updated Computer Science',
      };
      const updatedSubject = { ...mockSubjectResponse, name: 'Updated Computer Science' };
      service.update.mockResolvedValue(updatedSubject);

      const result = await controller.update(mockUserId, mockSubjectId, updateDto);

      expect(service.update).toHaveBeenCalledWith(mockUserId, mockSubjectId, updateDto);
      expect(result).toEqual(updatedSubject);
    });
  });

  describe('remove', () => {
    it('should delete a subject', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove(mockUserId, mockSubjectId);

      expect(service.remove).toHaveBeenCalledWith(mockUserId, mockSubjectId);
    });
  });
});
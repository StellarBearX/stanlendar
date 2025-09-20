import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubjectsService } from './subjects.service';
import { SubjectsController } from './subjects.controller';
import { Subject } from '../../infra/database/entities/subject.entity';
import { TypeOrmSubjectRepository } from '../../infra/database/repositories/typeorm-subject.repository';
import { SubjectRepository } from '../../infra/database/repositories/interfaces/subject-repository.interface';

@Module({
  imports: [TypeOrmModule.forFeature([Subject])],
  controllers: [SubjectsController],
  providers: [
    SubjectsService,
    {
      provide: 'SubjectRepository',
      useClass: TypeOrmSubjectRepository,
    },
  ],
  exports: [SubjectsService, 'SubjectRepository'],
})
export class SubjectsModule {}
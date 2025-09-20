import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubjectsService } from './subjects.service';
import { QuickAddService } from './quick-add.service';
import { SubjectsController } from './subjects.controller';
import { Subject } from '../../infra/database/entities/subject.entity';
import { Section } from '../../infra/database/entities/section.entity';
import { TypeOrmSubjectRepository } from '../../infra/database/repositories/typeorm-subject.repository';
import { TypeOrmSectionRepository } from '../../infra/database/repositories/typeorm-section.repository';
import { SubjectRepository } from '../../infra/database/repositories/interfaces/subject-repository.interface';
import { SectionRepository } from '../../infra/database/repositories/interfaces/section-repository.interface';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subject, Section]),
    EventsModule,
  ],
  controllers: [SubjectsController],
  providers: [
    SubjectsService,
    QuickAddService,
    {
      provide: 'SubjectRepository',
      useClass: TypeOrmSubjectRepository,
    },
    {
      provide: 'SectionRepository',
      useClass: TypeOrmSectionRepository,
    },
  ],
  exports: [SubjectsService, QuickAddService, 'SubjectRepository'],
})
export class SubjectsModule {}
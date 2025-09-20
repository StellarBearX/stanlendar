import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SectionsService } from './sections.service';
import { SectionsController } from './sections.controller';
import { Section } from '../../infra/database/entities/section.entity';
import { Subject } from '../../infra/database/entities/subject.entity';
import { TypeOrmSectionRepository } from '../../infra/database/repositories/typeorm-section.repository';
import { TypeOrmSubjectRepository } from '../../infra/database/repositories/typeorm-subject.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Section, Subject])],
  controllers: [SectionsController],
  providers: [
    SectionsService,
    {
      provide: 'SectionRepository',
      useClass: TypeOrmSectionRepository,
    },
    {
      provide: 'SubjectRepository',
      useClass: TypeOrmSubjectRepository,
    },
  ],
  exports: [SectionsService, 'SectionRepository'],
})
export class SectionsModule {}
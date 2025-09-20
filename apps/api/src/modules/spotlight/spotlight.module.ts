import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpotlightService } from './spotlight.service';
import { SpotlightController } from './spotlight.controller';
import { SavedFiltersService } from './saved-filters.service';
import { SavedFiltersController } from './saved-filters.controller';
import { LocalEvent } from '../../infra/database/entities/local-event.entity';
import { Subject } from '../../infra/database/entities/subject.entity';
import { Section } from '../../infra/database/entities/section.entity';
import { SavedFilter } from '../../infra/database/entities/saved-filter.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([LocalEvent, Subject, Section, SavedFilter])
  ],
  controllers: [SpotlightController, SavedFiltersController],
  providers: [SpotlightService, SavedFiltersService],
  exports: [SpotlightService, SavedFiltersService]
})
export class SpotlightModule {}
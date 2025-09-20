import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventGenerationService } from './event-generation.service';
import { EventsController } from './events.controller';
import { LocalEvent } from '../../infra/database/entities/local-event.entity';
import { Section } from '../../infra/database/entities/section.entity';
import { TypeOrmLocalEventRepository } from '../../infra/database/repositories/typeorm-local-event.repository';
import { TypeOrmSectionRepository } from '../../infra/database/repositories/typeorm-section.repository';

@Module({
  imports: [TypeOrmModule.forFeature([LocalEvent, Section])],
  controllers: [EventsController],
  providers: [
    EventGenerationService,
    {
      provide: 'LocalEventRepository',
      useClass: TypeOrmLocalEventRepository,
    },
    {
      provide: 'SectionRepository',
      useClass: TypeOrmSectionRepository,
    },
  ],
  exports: [EventGenerationService, 'LocalEventRepository'],
})
export class EventsModule {}
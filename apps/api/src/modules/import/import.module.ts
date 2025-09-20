import { Module } from '@nestjs/common';
import { ImportController } from './import.controller';
import { ImportService } from './services/import.service';
import { FileParserService } from './services/file-parser.service';
import { BatchImportService } from './services/batch-import.service';
import { RepositoryModule } from '../../infra/database/repositories/repository.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [RepositoryModule, EventsModule],
  controllers: [ImportController],
  providers: [ImportService, FileParserService, BatchImportService],
  exports: [ImportService, BatchImportService],
})
export class ImportModule {}
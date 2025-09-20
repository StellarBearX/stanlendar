import { LocalEvent } from '../../../infra/database/entities/local-event.entity';

export class EventGenerationResultDto {
  generated: number;
  skipped: number;
  replaced: number;
  events: LocalEventSummaryDto[];

  static fromResult(result: { generated: number; skipped: number; replaced: number; events: LocalEvent[] }): EventGenerationResultDto {
    return {
      generated: result.generated,
      skipped: result.skipped,
      replaced: result.replaced,
      events: result.events.map(event => LocalEventSummaryDto.fromEntity(event)),
    };
  }
}

export class LocalEventSummaryDto {
  id: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  room?: string;
  status: string;
  subjectName?: string;
  sectionCode?: string;

  static fromEntity(event: LocalEvent): LocalEventSummaryDto {
    return {
      id: event.id,
      eventDate: event.eventDate,
      startTime: event.startTime,
      endTime: event.endTime,
      room: event.room,
      status: event.status,
      subjectName: event.subject?.name,
      sectionCode: event.section?.secCode,
    };
  }
}
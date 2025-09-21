import { Injectable } from '@nestjs/common';

@Injectable()
export class MockGoogleCalendarService {
  async listCalendars() {
    return {
      items: [
        {
          id: 'primary',
          summary: 'Test Calendar',
          primary: true,
          accessRole: 'owner',
        },
        {
          id: 'mock-calendar-2',
          summary: 'Secondary Test Calendar',
          primary: false,
          accessRole: 'writer',
        },
      ],
    };
  }

  async createEvent(calendarId: string, event: any) {
    return {
      id: `mock-event-${Date.now()}`,
      summary: event.summary,
      start: event.start,
      end: event.end,
      description: event.description,
      location: event.location,
      status: 'confirmed',
      htmlLink: `https://calendar.google.com/event?eid=mock-${Date.now()}`,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };
  }

  async updateEvent(calendarId: string, eventId: string, event: any) {
    return {
      id: eventId,
      summary: event.summary,
      start: event.start,
      end: event.end,
      description: event.description,
      location: event.location,
      status: 'confirmed',
      htmlLink: `https://calendar.google.com/event?eid=${eventId}`,
      updated: new Date().toISOString(),
    };
  }

  async deleteEvent(calendarId: string, eventId: string) {
    return { success: true, eventId };
  }

  async listEvents(calendarId: string, options: any = {}) {
    const mockEvents = [
      {
        id: 'mock-event-1',
        summary: 'Software Project Management',
        start: { dateTime: '2024-01-15T09:00:00+07:00' },
        end: { dateTime: '2024-01-15T10:30:00+07:00' },
        location: 'Room 301',
        description: 'Section 001',
      },
      {
        id: 'mock-event-2',
        summary: 'Database Systems',
        start: { dateTime: '2024-01-16T13:00:00+07:00' },
        end: { dateTime: '2024-01-16T14:30:00+07:00' },
        location: 'Lab 201',
        description: 'Section 002',
      },
    ];

    return {
      items: mockEvents,
      nextPageToken: null,
    };
  }

  async batchRequest(requests: any[]) {
    return requests.map((request, index) => ({
      id: `batch-${index}`,
      status: 200,
      body: {
        id: `mock-batch-event-${index}`,
        summary: 'Batch Created Event',
        status: 'confirmed',
      },
    }));
  }
}
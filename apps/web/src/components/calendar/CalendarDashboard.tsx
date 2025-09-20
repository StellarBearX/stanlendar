'use client'

import { useState, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { useQuery } from '@tanstack/react-query'
import { eventsApi } from '@/lib/api'
import QuickAddClass from './QuickAddClass'
import SyncControls from './SyncControls'
import SyncHistory from './SyncHistory'
import ReminderSettings from './ReminderSettings'

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  backgroundColor?: string
  borderColor?: string
  extendedProps?: {
    subject?: string
    location?: string
    instructor?: string
    type?: string
  }
}

const SUBJECT_COLORS = {
  'Mathematics': { bg: '#3b82f6', border: '#2563eb' },
  'Physics': { bg: '#ef4444', border: '#dc2626' },
  'Chemistry': { bg: '#10b981', border: '#059669' },
  'Biology': { bg: '#f59e0b', border: '#d97706' },
  'Computer Science': { bg: '#8b5cf6', border: '#7c3aed' },
  'English': { bg: '#06b6d4', border: '#0891b2' },
  'History': { bg: '#84cc16', border: '#65a30d' },
  'default': { bg: '#6b7280', border: '#4b5563' }
}

export default function CalendarDashboard() {
  const [currentView, setCurrentView] = useState('dayGridMonth')
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [isReminderSettingsOpen, setIsReminderSettingsOpen] = useState(false)
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  })

  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ['events', dateRange.start, dateRange.end],
    queryFn: () => eventsApi.getAll({
      from: dateRange.start,
      to: dateRange.end
    }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const calendarEvents: CalendarEvent[] = (events as any[]).map((event: any) => {
    const subjectName = event.subject?.name || 'default'
    const colors = SUBJECT_COLORS[subjectName as keyof typeof SUBJECT_COLORS] || SUBJECT_COLORS.default
    
    return {
      id: event.id,
      title: event.title || `${event.subject?.name} - ${event.section?.name}`,
      start: event.startTime,
      end: event.endTime,
      backgroundColor: colors.bg,
      borderColor: colors.border,
      extendedProps: {
        subject: event.subject?.name,
        location: event.location,
        instructor: event.instructor,
        type: event.type
      }
    }
  })

  const handleEventClick = (clickInfo: any) => {
    const event = clickInfo.event
    const props = event.extendedProps
    
    const details = [
      props.subject && `Subject: ${props.subject}`,
      props.location && `Location: ${props.location}`,
      props.instructor && `Instructor: ${props.instructor}`,
      props.type && `Type: ${props.type}`,
      `Time: ${event.start?.toLocaleString()} - ${event.end?.toLocaleString()}`
    ].filter(Boolean).join('\n')
    
    alert(`${event.title}\n\n${details}`)
  }

  const handleDatesSet = (dateInfo: any) => {
    setDateRange({
      start: dateInfo.start.toISOString().split('T')[0],
      end: dateInfo.end.toISOString().split('T')[0]
    })
  }

  const handleViewChange = (view: string) => {
    setCurrentView(view)
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center">
          <div className="mb-4">
            <svg
              className="mx-auto h-12 w-12 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Failed to load calendar events
          </h3>
          <p className="text-sm text-gray-600">
            Please try refreshing the page or contact support if the problem persists.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg">
      {/* Calendar Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">
            Class Schedule
          </h2>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsQuickAddOpen(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Quick Add Class
            </button>
            
            {/* Sync Controls */}
            <SyncControls 
              onSyncComplete={(result) => {
                // Refresh events after sync
                // The query will automatically refetch due to invalidation
              }}
            />
            
            <SyncHistory />
            
            <button
              onClick={() => setIsReminderSettingsOpen(true)}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4 19h6v-2H4v2zM4 15h8v-2H4v2zM4 11h8V9H4v2zM4 7h8V5H4v2z" />
              </svg>
              Reminders
            </button>
            
            <div className="flex space-x-2">
              <button
                onClick={() => handleViewChange('dayGridMonth')}
                className={`px-3 py-1 text-sm rounded-md ${
                  currentView === 'dayGridMonth'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => handleViewChange('timeGridWeek')}
                className={`px-3 py-1 text-sm rounded-md ${
                  currentView === 'timeGridWeek'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => handleViewChange('timeGridDay')}
                className={`px-3 py-1 text-sm rounded-md ${
                  currentView === 'timeGridDay'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Day
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={currentView}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: ''
            }}
            events={calendarEvents}
            eventClick={handleEventClick}
            datesSet={handleDatesSet}
            height="auto"
            eventDisplay="block"
            dayMaxEvents={3}
            moreLinkClick="popover"
            eventTimeFormat={{
              hour: 'numeric',
              minute: '2-digit',
              meridiem: 'short'
            }}
            slotLabelFormat={{
              hour: 'numeric',
              minute: '2-digit',
              meridiem: 'short'
            }}
            allDaySlot={false}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            nowIndicator={true}
            weekends={true}
            businessHours={{
              daysOfWeek: [1, 2, 3, 4, 5], // Monday - Friday
              startTime: '08:00',
              endTime: '18:00'
            }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="px-6 py-4 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Subject Colors</h3>
        <div className="flex flex-wrap gap-4">
          {Object.entries(SUBJECT_COLORS).map(([subject, colors]) => (
            subject !== 'default' && (
              <div key={subject} className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: colors.bg }}
                />
                <span className="text-xs text-gray-600">{subject}</span>
              </div>
            )
          ))}
        </div>
      </div>

      {/* Quick Add Modal */}
      <QuickAddClass
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSuccess={() => {
          // Calendar events will be automatically refreshed via query invalidation
        }}
      />

      {/* Reminder Settings Modal */}
      <ReminderSettings
        isOpen={isReminderSettingsOpen}
        onClose={() => setIsReminderSettingsOpen(false)}
      />
    </div>
  )
}
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CalendarDashboard from '../CalendarDashboard'
import { useAuthStore } from '../../../store/auth'
import * as api from '../../../lib/api'

// Mock the auth store
jest.mock('../../../store/auth')
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>

// Mock the API
jest.mock('../../../lib/api')
const mockApi = api as jest.Mocked<typeof api>

// Mock FullCalendar
jest.mock('@fullcalendar/react', () => {
  return function MockFullCalendar({ events, eventClick, datesSet, ...props }: any) {
    return (
      <div data-testid="fullcalendar" data-view={props.initialView}>
        <div data-testid="calendar-events">
          {events?.map((event: any, index: number) => (
            <div
              key={event.id || index}
              data-testid={`event-${event.id}`}
              onClick={() => eventClick?.({ event })}
              style={{ backgroundColor: event.backgroundColor }}
            >
              {event.title}
            </div>
          ))}
        </div>
        <button
          data-testid="prev-button"
          onClick={() => datesSet?.({ start: new Date('2024-01-01'), end: new Date('2024-01-31') })}
        >
          Previous
        </button>
        <button
          data-testid="next-button"
          onClick={() => datesSet?.({ start: new Date('2024-02-01'), end: new Date('2024-02-29') })}
        >
          Next
        </button>
      </div>
    )
  }
})

// Mock Spotlight Filter
jest.mock('../../spotlight/SpotlightFilter', () => {
  return function MockSpotlightFilter({ onFilterChange, subjects, sections }: any) {
    return (
      <div data-testid="spotlight-filter">
        <input
          data-testid="search-input"
          placeholder="Search classes..."
          onChange={(e) => onFilterChange?.({ text: e.target.value })}
        />
        <div data-testid="subject-chips">
          {subjects?.map((subject: any) => (
            <button
              key={subject.id}
              data-testid={`subject-chip-${subject.id}`}
              onClick={() => onFilterChange?.({ subjectIds: [subject.id] })}
            >
              {subject.name}
            </button>
          ))}
        </div>
      </div>
    )
  }
})

const mockEvents = [
  {
    id: 'event-1',
    title: 'CS101 Computer Science (001)',
    start: '2024-01-15T09:00:00+07:00',
    end: '2024-01-15T10:30:00+07:00',
    backgroundColor: '#3B82F6',
    extendedProps: {
      subjectId: 'subject-1',
      sectionId: 'section-1',
      room: 'Room 101',
      teacher: 'Dr. Smith',
    },
  },
  {
    id: 'event-2',
    title: 'MATH201 Mathematics (002)',
    start: '2024-01-15T11:00:00+07:00',
    end: '2024-01-15T12:30:00+07:00',
    backgroundColor: '#EF4444',
    extendedProps: {
      subjectId: 'subject-2',
      sectionId: 'section-2',
      room: 'Room 102',
      teacher: 'Dr. Johnson',
    },
  },
]

const mockSubjects = [
  {
    id: 'subject-1',
    code: 'CS101',
    name: 'Computer Science',
    colorHex: '#3B82F6',
  },
  {
    id: 'subject-2',
    code: 'MATH201',
    name: 'Mathematics',
    colorHex: '#EF4444',
  },
]

const mockSections = [
  {
    id: 'section-1',
    subjectId: 'subject-1',
    secCode: '001',
    teacher: 'Dr. Smith',
    room: 'Room 101',
  },
  {
    id: 'section-2',
    subjectId: 'subject-2',
    secCode: '002',
    teacher: 'Dr. Johnson',
    room: 'Room 102',
  },
]

describe('CalendarDashboard (Comprehensive)', () => {
  let queryClient: QueryClient
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    user = userEvent.setup()

    // Mock auth store
    mockUseAuthStore.mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com', displayName: 'Test User' },
      isAuthenticated: true,
      token: 'mock-token',
      login: jest.fn(),
      logout: jest.fn(),
    })

    // Mock API calls
    mockApi.getEvents.mockResolvedValue(mockEvents)
    mockApi.getSubjects.mockResolvedValue(mockSubjects)
    mockApi.getSections.mockResolvedValue(mockSections)
    mockApi.syncToGoogle.mockResolvedValue({
      summary: { created: 2, updated: 0, failed: 0, skipped: 0 },
      details: [],
      conflicts: [],
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  const renderCalendarDashboard = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <CalendarDashboard {...props} />
      </QueryClientProvider>
    )
  }

  describe('Initial Rendering', () => {
    it('should render calendar with events', async () => {
      renderCalendarDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('fullcalendar')).toBeInTheDocument()
      })

      expect(screen.getByTestId('event-event-1')).toBeInTheDocument()
      expect(screen.getByTestId('event-event-2')).toBeInTheDocument()
      expect(screen.getByText('CS101 Computer Science (001)')).toBeInTheDocument()
      expect(screen.getByText('MATH201 Mathematics (002)')).toBeInTheDocument()
    })

    it('should render spotlight filter', async () => {
      renderCalendarDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('spotlight-filter')).toBeInTheDocument()
      })

      expect(screen.getByTestId('search-input')).toBeInTheDocument()
      expect(screen.getByTestId('subject-chips')).toBeInTheDocument()
    })

    it('should show loading state initially', () => {
      mockApi.getEvents.mockImplementation(() => new Promise(() => {})) // Never resolves

      renderCalendarDashboard()

      expect(screen.getByText('Loading events...')).toBeInTheDocument()
    })

    it('should show empty state when no events', async () => {
      mockApi.getEvents.mockResolvedValue([])

      renderCalendarDashboard()

      await waitFor(() => {
        expect(screen.getByText('No classes scheduled')).toBeInTheDocument()
      })

      expect(screen.getByText('Add your first class to get started')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /quick add class/i })).toBeInTheDocument()
    })
  })

  describe('View Switching', () => {
    it('should switch between calendar views', async () => {
      renderCalendarDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('fullcalendar')).toBeInTheDocument()
      })

      // Test view buttons
      const monthButton = screen.getByRole('button', { name: /month/i })
      const weekButton = screen.getByRole('button', { name: /week/i })
      const agendaButton = screen.getByRole('button', { name: /agenda/i })

      expect(monthButton).toHaveClass('active') // Default view

      await user.click(weekButton)
      expect(weekButton).toHaveClass('active')
      expect(monthButton).not.toHaveClass('active')

      await user.click(agendaButton)
      expect(agendaButton).toHaveClass('active')
      expect(weekButton).not.toHaveClass('active')
    })

    it('should maintain view state across re-renders', async () => {
      const { rerender } = renderCalendarDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('fullcalendar')).toBeInTheDocument()
      })

      // Switch to week view
      await user.click(screen.getByRole('button', { name: /week/i }))

      // Re-render component
      rerender(
        <QueryClientProvider client={queryClient}>
          <CalendarDashboard />
        </QueryClientProvider>
      )

      expect(screen.getByRole('button', { name: /week/i })).toHaveClass('active')
    })
  })

  describe('Event Interactions', () => {
    it('should show event details on click', async () => {
      renderCalendarDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('event-event-1')).toBeInTheDocument()
      })

      await user.click(screen.getByTestId('event-event-1'))

      expect(screen.getByText('Event Details')).toBeInTheDocument()
      expect(screen.getByText('CS101 Computer Science (001)')).toBeInTheDocument()
      expect(screen.getByText('Room: Room 101')).toBeInTheDocument()
      expect(screen.getByText('Teacher: Dr. Smith')).toBeInTheDocument()
      expect(screen.getByText('Time: 09:00 - 10:30')).toBeInTheDocument()
    })

    it('should allow editing event from details modal', async () => {
      renderCalendarDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('event-event-1')).toBeInTheDocument()
      })

      await user.click(screen.getByTestId('event-event-1'))
      await user.click(screen.getByRole('button', { name: /edit/i }))

      expect(screen.getByText('Edit Event')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Room 101')).toBeInTheDocument()
    })

    it('should allow deleting event from details modal', async () => {
      mockApi.deleteEvent.mockResolvedValue(undefined)

      renderCalendarDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('event-event-1')).toBeInTheDocument()
      })

      await user.click(screen.getByTestId('event-event-1'))
      await user.click(screen.getByRole('button', { name: /delete/i }))

      // Confirm deletion
      await user.click(screen.getByRole('button', { name: /confirm delete/i }))

      await waitFor(() => {
        expect(mockApi.deleteEvent).toHaveBeenCalledWith('event-1')
      })
    })
  })

  describe('Spotlight Filtering', () => {
    it('should filter events by text search', async () => {
      renderCalendarDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('search-input')).toBeInTheDocument()
      })

      await user.type(screen.getByTestId('search-input'), 'Computer')

      await waitFor(() => {
        expect(screen.getByTestId('event-event-1')).toBeInTheDocument()
        expect(screen.queryByTestId('event-event-2')).not.toBeInTheDocument()
      })
    })

    it('should filter events by subject selection', async () => {
      renderCalendarDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('subject-chip-subject-1')).toBeInTheDocument()
      })

      await user.click(screen.getByTestId('subject-chip-subject-1'))

      await waitFor(() => {
        expect(screen.getByTestId('event-event-1')).toBeInTheDocument()
        expect(screen.queryByTestId('event-event-2')).not.toBeInTheDocument()
      })
    })

    it('should clear filters when reset button is clicked', async () => {
      renderCalendarDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('search-input')).toBeInTheDocument()
      })

      // Apply filter
      await user.type(screen.getByTestId('search-input'), 'Computer')

      await waitFor(() => {
        expect(screen.queryByTestId('event-event-2')).not.toBeInTheDocument()
      })

      // Clear filter
      await user.click(screen.getByRole('button', { name: /clear filters/i }))

      await waitFor(() => {
        expect(screen.getByTestId('event-event-1')).toBeInTheDocument()
        expect(screen.getByTestId('event-event-2')).toBeInTheDocument()
      })
    })

    it('should show filter mode toggle (hide/dim)', async () => {
      renderCalendarDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('search-input')).toBeInTheDocument()
      })

      const filterModeToggle = screen.getByRole('button', { name: /filter mode/i })
      expect(filterModeToggle).toBeInTheDocument()

      await user.click(filterModeToggle)

      expect(screen.getByText('Hide Others')).toBeInTheDocument()
      expect(screen.getByText('Dim Others')).toBeInTheDocument()
    })
  })

  describe('Sync Functionality', () => {
    it('should sync events to Google Calendar', async () => {
      renderCalendarDashboard()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sync to google/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /sync to google/i }))

      expect(screen.getByText('Syncing...')).toBeInTheDocument()

      await waitFor(() => {
        expect(mockApi.syncToGoogle).toHaveBeenCalledWith({
          direction: 'upsert-to-google',
          range: expect.any(Object),
          idempotencyKey: expect.any(String),
        })
      })

      expect(screen.getByText('Sync completed successfully')).toBeInTheDocument()
      expect(screen.getByText('2 events created')).toBeInTheDocument()
    })

    it('should show sync options modal', async () => {
      renderCalendarDashboard()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sync options/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /sync options/i }))

      expect(screen.getByText('Sync Options')).toBeInTheDocument()
      expect(screen.getByLabelText('Date Range')).toBeInTheDocument()
      expect(screen.getByLabelText('Dry Run')).toBeInTheDocument()
    })

    it('should handle sync errors gracefully', async () => {
      mockApi.syncToGoogle.mockRejectedValue(new Error('Sync failed'))

      renderCalendarDashboard()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sync to google/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /sync to google/i }))

      await waitFor(() => {
        expect(screen.getByText('Sync failed')).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    it('should show sync conflicts when they occur', async () => {
      mockApi.syncToGoogle.mockResolvedValue({
        summary: { created: 1, updated: 0, failed: 0, skipped: 0 },
        details: [],
        conflicts: [
          {
            localEventId: 'event-1',
            gcalEventId: 'gcal-1',
            conflictType: 'etag_mismatch',
            localData: { summary: 'Local Version' },
            googleData: { summary: 'Google Version' },
          },
        ],
      })

      renderCalendarDashboard()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sync to google/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /sync to google/i }))

      await waitFor(() => {
        expect(screen.getByText('Sync Conflicts Detected')).toBeInTheDocument()
      })

      expect(screen.getByText('1 conflict needs resolution')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /resolve conflicts/i })).toBeInTheDocument()
    })
  })

  describe('Date Navigation', () => {
    it('should navigate between months', async () => {
      renderCalendarDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('prev-button')).toBeInTheDocument()
      })

      await user.click(screen.getByTestId('prev-button'))

      await waitFor(() => {
        expect(mockApi.getEvents).toHaveBeenCalledWith(
          expect.objectContaining({
            from: '2024-01-01',
            to: '2024-01-31',
          })
        )
      })

      await user.click(screen.getByTestId('next-button'))

      await waitFor(() => {
        expect(mockApi.getEvents).toHaveBeenCalledWith(
          expect.objectContaining({
            from: '2024-02-01',
            to: '2024-02-29',
          })
        )
      })
    })

    it('should update events when date range changes', async () => {
      renderCalendarDashboard()

      await waitFor(() => {
        expect(mockApi.getEvents).toHaveBeenCalledTimes(1)
      })

      await user.click(screen.getByTestId('next-button'))

      await waitFor(() => {
        expect(mockApi.getEvents).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Performance', () => {
    it('should handle large number of events efficiently', async () => {
      const manyEvents = Array.from({ length: 1000 }, (_, i) => ({
        id: `event-${i}`,
        title: `Event ${i}`,
        start: `2024-01-${String(i % 28 + 1).padStart(2, '0')}T09:00:00+07:00`,
        end: `2024-01-${String(i % 28 + 1).padStart(2, '0')}T10:30:00+07:00`,
        backgroundColor: '#3B82F6',
      }))

      mockApi.getEvents.mockResolvedValue(manyEvents)

      const startTime = performance.now()
      renderCalendarDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('fullcalendar')).toBeInTheDocument()
      })

      const renderTime = performance.now() - startTime
      expect(renderTime).toBeLessThan(1000) // Should render within 1 second
    })

    it('should debounce search input', async () => {
      jest.useFakeTimers()

      renderCalendarDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('search-input')).toBeInTheDocument()
      })

      const searchInput = screen.getByTestId('search-input')

      // Type multiple characters quickly
      await user.type(searchInput, 'Computer Science')

      // Fast forward time
      jest.advanceTimersByTime(300) // Less than debounce delay

      // Should not have triggered filter yet
      expect(screen.getByTestId('event-event-2')).toBeInTheDocument()

      // Fast forward past debounce delay
      jest.advanceTimersByTime(200)

      await waitFor(() => {
        expect(screen.queryByTestId('event-event-2')).not.toBeInTheDocument()
      })

      jest.useRealTimers()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      renderCalendarDashboard()

      await waitFor(() => {
        expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Calendar Dashboard')
      })

      expect(screen.getByRole('search')).toHaveAttribute('aria-label', 'Search classes')
      expect(screen.getByRole('button', { name: /sync to google/i })).toHaveAttribute(
        'aria-describedby',
        expect.any(String)
      )
    })

    it('should support keyboard navigation', async () => {
      renderCalendarDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('search-input')).toBeInTheDocument()
      })

      const searchInput = screen.getByTestId('search-input')
      searchInput.focus()

      // Tab to sync button
      await user.tab()
      expect(screen.getByRole('button', { name: /sync to google/i })).toHaveFocus()

      // Enter should trigger sync
      await user.keyboard('{Enter}')
      expect(screen.getByText('Syncing...')).toBeInTheDocument()
    })

    it('should announce important changes to screen readers', async () => {
      renderCalendarDashboard()

      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument()
      })

      // Apply filter
      await user.type(screen.getByTestId('search-input'), 'Computer')

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('Showing 1 of 2 events')
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockApi.getEvents.mockRejectedValue(new Error('Network error'))

      renderCalendarDashboard()

      await waitFor(() => {
        expect(screen.getByText('Failed to load events')).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    it('should retry failed requests', async () => {
      mockApi.getEvents
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockEvents)

      renderCalendarDashboard()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /retry/i }))

      await waitFor(() => {
        expect(screen.getByTestId('event-event-1')).toBeInTheDocument()
      })
    })

    it('should handle offline state', async () => {
      // Mock offline state
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      })

      renderCalendarDashboard()

      expect(screen.getByText('You are offline')).toBeInTheDocument()
      expect(screen.getByText('Some features may not be available')).toBeInTheDocument()
    })
  })
})
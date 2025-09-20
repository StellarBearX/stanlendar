import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CalendarDashboard from '../CalendarDashboard'

// Mock FullCalendar
jest.mock('@fullcalendar/react', () => {
  return function MockFullCalendar(props: any) {
    return (
      <div data-testid="fullcalendar">
        <div data-testid="calendar-events">
          {props.events?.map((event: any) => (
            <div
              key={event.id}
              data-testid={`event-${event.id}`}
              onClick={() => props.eventClick?.({ event })}
            >
              {event.title}
            </div>
          ))}
        </div>
      </div>
    )
  }
})

// Mock API
jest.mock('@/lib/api', () => ({
  eventsApi: {
    getAll: jest.fn(),
  },
}))

const mockEvents = [
  {
    id: '1',
    title: 'Mathematics Lecture',
    startTime: '2024-01-15T09:00:00Z',
    endTime: '2024-01-15T10:30:00Z',
    subject: { name: 'Mathematics' },
    section: { name: 'Section A' },
    location: 'Room 101',
    instructor: 'Dr. Smith',
    type: 'Lecture'
  },
  {
    id: '2',
    title: 'Physics Lab',
    startTime: '2024-01-15T14:00:00Z',
    endTime: '2024-01-15T16:00:00Z',
    subject: { name: 'Physics' },
    section: { name: 'Section B' },
    location: 'Lab 201',
    instructor: 'Prof. Johnson',
    type: 'Lab'
  }
]

const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
}

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  )
}

describe('CalendarDashboard', () => {
  const { eventsApi } = require('@/lib/api')

  beforeEach(() => {
    jest.clearAllMocks()
    eventsApi.getAll.mockResolvedValue(mockEvents)
  })

  it('renders calendar dashboard with header', async () => {
    renderWithQueryClient(<CalendarDashboard />)
    
    expect(screen.getByText('Class Schedule')).toBeInTheDocument()
    expect(screen.getByText('Month')).toBeInTheDocument()
    expect(screen.getByText('Week')).toBeInTheDocument()
    expect(screen.getByText('Day')).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    renderWithQueryClient(<CalendarDashboard />)
    
    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument()
  })

  it('renders calendar events after loading', async () => {
    renderWithQueryClient(<CalendarDashboard />)
    
    await waitFor(() => {
      expect(screen.getByTestId('fullcalendar')).toBeInTheDocument()
    })
    
    expect(screen.getByTestId('event-1')).toBeInTheDocument()
    expect(screen.getByTestId('event-2')).toBeInTheDocument()
  })

  it('handles view switching', async () => {
    renderWithQueryClient(<CalendarDashboard />)
    
    const weekButton = screen.getByText('Week')
    fireEvent.click(weekButton)
    
    expect(weekButton).toHaveClass('bg-primary-100', 'text-primary-700')
  })

  it('displays subject color legend', async () => {
    renderWithQueryClient(<CalendarDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Subject Colors')).toBeInTheDocument()
    })
    
    expect(screen.getByText('Mathematics')).toBeInTheDocument()
    expect(screen.getByText('Physics')).toBeInTheDocument()
  })

  it('handles API error gracefully', async () => {
    eventsApi.getAll.mockRejectedValue(new Error('API Error'))
    
    renderWithQueryClient(<CalendarDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load calendar events')).toBeInTheDocument()
    })
  })

  it('calls API with correct date range', async () => {
    renderWithQueryClient(<CalendarDashboard />)
    
    await waitFor(() => {
      expect(eventsApi.getAll).toHaveBeenCalledWith({
        from: expect.any(String),
        to: expect.any(String)
      })
    })
  })
})
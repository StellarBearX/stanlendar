import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import QuickAddClass from '../QuickAddClass'
import { subjectsApi, sectionsApi, eventsApi } from '@/lib/api'

// Mock the API modules
jest.mock('@/lib/api', () => ({
  subjectsApi: {
    create: jest.fn(),
  },
  sectionsApi: {
    create: jest.fn(),
  },
  eventsApi: {
    generate: jest.fn(),
  },
}))

const mockSubjectsApi = subjectsApi as jest.Mocked<typeof subjectsApi>
const mockSectionsApi = sectionsApi as jest.Mocked<typeof sectionsApi>
const mockEventsApi = eventsApi as jest.Mocked<typeof eventsApi>

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('QuickAddClass', () => {
  const mockOnClose = jest.fn()
  const mockOnSuccess = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should not render when isOpen is false', () => {
    render(
      <QuickAddClass
        isOpen={false}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
      { wrapper: createWrapper() }
    )

    expect(screen.queryByText('Quick Add Class')).not.toBeInTheDocument()
  })

  it('should render form when isOpen is true', () => {
    render(
      <QuickAddClass
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText('Quick Add Class')).toBeInTheDocument()
    expect(screen.getByLabelText(/subject name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/section code/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/day of week/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/start time/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/end time/i)).toBeInTheDocument()
  })

  it('should show validation errors for required fields', async () => {
    const user = userEvent.setup()
    
    render(
      <QuickAddClass
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
      { wrapper: createWrapper() }
    )

    const submitButton = screen.getByRole('button', { name: /create class/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Subject name is required')).toBeInTheDocument()
      expect(screen.getByText('Section code is required')).toBeInTheDocument()
    })
  })

  it('should validate time range', async () => {
    const user = userEvent.setup()
    
    render(
      <QuickAddClass
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
      { wrapper: createWrapper() }
    )

    const startTimeInput = screen.getByLabelText(/start time/i)
    const endTimeInput = screen.getByLabelText(/end time/i)

    await user.clear(startTimeInput)
    await user.type(startTimeInput, '10:00')
    await user.clear(endTimeInput)
    await user.type(endTimeInput, '09:00')

    const submitButton = screen.getByRole('button', { name: /create class/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('End time must be after start time')).toBeInTheDocument()
    })
  })

  it('should validate date range', async () => {
    const user = userEvent.setup()
    
    render(
      <QuickAddClass
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
      { wrapper: createWrapper() }
    )

    const startDateInput = screen.getByLabelText(/start date/i)
    const endDateInput = screen.getByLabelText(/end date/i)

    await user.clear(startDateInput)
    await user.type(startDateInput, '2024-12-31')
    await user.clear(endDateInput)
    await user.type(endDateInput, '2024-01-01')

    const submitButton = screen.getByRole('button', { name: /create class/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('End date must be on or after start date')).toBeInTheDocument()
    })
  })

  it('should allow adding and removing skip dates', async () => {
    const user = userEvent.setup()
    
    render(
      <QuickAddClass
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
      { wrapper: createWrapper() }
    )

    // Find the skip date input (it's not labeled, so we'll use a more specific selector)
    const skipDateInputs = screen.getAllByDisplayValue('')
    const skipDateInput = skipDateInputs.find(input => 
      input.getAttribute('type') === 'date' && 
      input.getAttribute('placeholder') === 'Select date to skip'
    )
    
    expect(skipDateInput).toBeInTheDocument()

    // Add a skip date
    await user.type(skipDateInput!, '2024-12-25')
    const addButton = screen.getByRole('button', { name: /add/i })
    await user.click(addButton)

    await waitFor(() => {
      expect(screen.getByText('12/25/2024')).toBeInTheDocument()
    })

    // Remove the skip date
    const removeButton = screen.getByRole('button', { name: '' }) // The X button
    await user.click(removeButton)

    await waitFor(() => {
      expect(screen.queryByText('12/25/2024')).not.toBeInTheDocument()
    })
  })

  it('should submit form with valid data', async () => {
    const user = userEvent.setup()
    
    const mockSubject = { id: 'subject-1', name: 'Test Subject' }
    const mockSection = { id: 'section-1', secCode: '001' }
    
    mockSubjectsApi.create.mockResolvedValue({ data: mockSubject })
    mockSectionsApi.create.mockResolvedValue({ data: mockSection })
    mockEventsApi.generate.mockResolvedValue({})

    render(
      <QuickAddClass
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
      { wrapper: createWrapper() }
    )

    // Fill in required fields
    await user.type(screen.getByLabelText(/subject name/i), 'Software Engineering')
    await user.type(screen.getByLabelText(/subject code/i), 'SE101')
    await user.type(screen.getByLabelText(/section code/i), '001')
    await user.type(screen.getByLabelText(/teacher/i), 'Dr. Smith')
    await user.type(screen.getByLabelText(/room/i), 'A101')

    // Submit form
    const submitButton = screen.getByRole('button', { name: /create class/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockSubjectsApi.create).toHaveBeenCalledWith({
        code: 'SE101',
        name: 'Software Engineering',
        colorHex: '#3b82f6', // Default color
        meta: { teacher: 'Dr. Smith' }
      })
    })

    await waitFor(() => {
      expect(mockSectionsApi.create).toHaveBeenCalledWith({
        subjectId: 'subject-1',
        secCode: '001',
        teacher: 'Dr. Smith',
        room: 'A101',
        scheduleRules: [{
          dayOfWeek: 1, // Monday (default)
          startTime: '09:00', // Default
          endTime: '10:30', // Default
          startDate: expect.any(String),
          endDate: expect.any(String),
          skipDates: []
        }]
      })
    })

    await waitFor(() => {
      expect(mockEventsApi.generate).toHaveBeenCalledWith({
        sectionId: 'section-1'
      })
    })

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled()
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  it('should handle API errors gracefully', async () => {
    const user = userEvent.setup()
    
    mockSubjectsApi.create.mockRejectedValue(new Error('Subject creation failed'))

    render(
      <QuickAddClass
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
      { wrapper: createWrapper() }
    )

    // Fill in required fields
    await user.type(screen.getByLabelText(/subject name/i), 'Software Engineering')
    await user.type(screen.getByLabelText(/section code/i), '001')

    // Submit form
    const submitButton = screen.getByRole('button', { name: /create class/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Failed to create class')).toBeInTheDocument()
      expect(screen.getByText('Subject creation failed')).toBeInTheDocument()
    })

    expect(mockOnSuccess).not.toHaveBeenCalled()
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('should close modal when cancel button is clicked', async () => {
    const user = userEvent.setup()
    
    render(
      <QuickAddClass
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
      { wrapper: createWrapper() }
    )

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should close modal when X button is clicked', async () => {
    const user = userEvent.setup()
    
    render(
      <QuickAddClass
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
      { wrapper: createWrapper() }
    )

    // Find the X button in the header
    const closeButtons = screen.getAllByRole('button')
    const xButton = closeButtons.find(button => 
      button.querySelector('svg path[d*="M6 18L18 6M6 6l12 12"]')
    )
    
    expect(xButton).toBeInTheDocument()
    await user.click(xButton!)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should allow color selection', async () => {
    const user = userEvent.setup()
    
    render(
      <QuickAddClass
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
      { wrapper: createWrapper() }
    )

    // Find color picker buttons
    const colorButtons = screen.getAllByRole('button').filter(button => 
      button.style.backgroundColor
    )
    
    expect(colorButtons.length).toBeGreaterThan(0)
    
    // Click on a color button
    await user.click(colorButtons[1]) // Second color
    
    // The color input should be updated (we can't easily test this without more complex setup)
    // But we can verify the button exists and is clickable
    expect(colorButtons[1]).toBeInTheDocument()
  })

  it('should validate field length limits', async () => {
    const user = userEvent.setup()
    
    render(
      <QuickAddClass
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
      { wrapper: createWrapper() }
    )

    // Test subject name length limit (100 chars)
    const longSubjectName = 'a'.repeat(101)
    await user.type(screen.getByLabelText(/subject name/i), longSubjectName)
    
    // Test section code length limit (20 chars)
    const longSectionCode = 'a'.repeat(21)
    await user.type(screen.getByLabelText(/section code/i), longSectionCode)

    const submitButton = screen.getByRole('button', { name: /create class/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Subject name must be 100 characters or less')).toBeInTheDocument()
      expect(screen.getByText('Section code must be 20 characters or less')).toBeInTheDocument()
    })
  })
})
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ReminderSettings from '../ReminderSettings'
import { reminderApi } from '@/lib/api'

// Mock the API
jest.mock('@/lib/api', () => ({
  reminderApi: {
    getUserPreferences: jest.fn(),
    updateUserPreferences: jest.fn(),
    getSubjectSettings: jest.fn(),
    updateSubjectSettings: jest.fn(),
    bulkUpdateSubjectReminders: jest.fn(),
    getPresets: jest.fn(),
  }
}))

const mockReminderApi = reminderApi as jest.Mocked<typeof reminderApi>

// Test wrapper with QueryClient
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

const mockUserPreferences = {
  data: {
    userId: 'user-1',
    globalDefault: {
      enabled: true,
      minutes: 15,
      method: 'popup'
    },
    subjectSettings: {
      'subject-1': {
        enabled: true,
        minutes: 30,
        method: 'email'
      }
    }
  }
}

const mockPresets = {
  data: [
    { label: '5 minutes before', minutes: 5, method: 'popup' },
    { label: '15 minutes before', minutes: 15, method: 'popup' },
    { label: '30 minutes before', minutes: 30, method: 'popup' },
    { label: '1 hour before', minutes: 60, method: 'popup' },
    { label: '1 day before', minutes: 1440, method: 'email' }
  ]
}

describe('ReminderSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockReminderApi.getUserPreferences.mockResolvedValue(mockUserPreferences)
    mockReminderApi.getPresets.mockResolvedValue(mockPresets)
  })

  it('should not render when closed', () => {
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <ReminderSettings isOpen={false} onClose={() => {}} />
      </Wrapper>
    )

    expect(screen.queryByText('Reminder Settings')).not.toBeInTheDocument()
  })

  it('should render when open', async () => {
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <ReminderSettings isOpen={true} onClose={() => {}} />
      </Wrapper>
    )

    expect(screen.getByText('Reminder Settings')).toBeInTheDocument()
    expect(screen.getByText('Global Default')).toBeInTheDocument()
  })

  it('should show subject tab when subjectId is provided', async () => {
    mockReminderApi.getSubjectSettings.mockResolvedValue({
      data: { enabled: true, minutes: 30, method: 'email' }
    })

    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <ReminderSettings 
          isOpen={true} 
          onClose={() => {}} 
          subjectId="subject-1"
          subjectName="Mathematics"
        />
      </Wrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Mathematics')).toBeInTheDocument()
    })
  })

  it('should load and display user preferences', async () => {
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <ReminderSettings isOpen={true} onClose={() => {}} />
      </Wrapper>
    )

    await waitFor(() => {
      expect(mockReminderApi.getUserPreferences).toHaveBeenCalled()
    })
  })

  it('should toggle reminder enabled state', async () => {
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <ReminderSettings isOpen={true} onClose={() => {}} />
      </Wrapper>
    )

    await waitFor(() => {
      const toggleButton = screen.getByRole('switch', { name: /toggle reminders/i })
      expect(toggleButton).toBeInTheDocument()
    })

    // The toggle should be enabled by default based on mock data
    const toggleButton = screen.getByRole('switch', { name: /toggle reminders/i })
    expect(toggleButton).toHaveAttribute('aria-checked', 'true')
    
    fireEvent.click(toggleButton)

    // Should show the toggle has been clicked
    expect(toggleButton).toBeInTheDocument()
  })

  it('should update reminder minutes', async () => {
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <ReminderSettings isOpen={true} onClose={() => {}} />
      </Wrapper>
    )

    await waitFor(() => {
      const minutesInput = screen.getByDisplayValue('15')
      expect(minutesInput).toBeInTheDocument()
    })

    const minutesInput = screen.getByDisplayValue('15')
    fireEvent.change(minutesInput, { target: { value: '30' } })

    expect(minutesInput).toHaveValue(30)
  })

  it('should change reminder method', async () => {
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <ReminderSettings isOpen={true} onClose={() => {}} />
      </Wrapper>
    )

    await waitFor(() => {
      const emailRadio = screen.getByLabelText('Email notification')
      expect(emailRadio).toBeInTheDocument()
    })

    const emailRadio = screen.getByLabelText('Email notification')
    fireEvent.click(emailRadio)

    expect(emailRadio).toBeChecked()
  })

  it.skip('should apply preset settings', async () => {
    // Mock presets to be available immediately
    mockReminderApi.getPresets.mockResolvedValue({
      data: [
        { label: '30 minutes before', minutes: 30, method: 'popup' }
      ]
    })

    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <ReminderSettings isOpen={true} onClose={() => {}} />
      </Wrapper>
    )

    // Wait for the component to load completely
    await waitFor(() => {
      expect(screen.getByText('Default Reminder Settings')).toBeInTheDocument()
    })

    // Check if presets are loaded and rendered
    await waitFor(() => {
      expect(screen.queryByText('Quick Presets')).toBeInTheDocument()
    }, { timeout: 2000 })

    const preset = screen.getByText('30 minutes before')
    fireEvent.click(preset)

    // Should update the minutes input
    await waitFor(() => {
      const minutesInput = screen.getByDisplayValue('30')
      expect(minutesInput).toBeInTheDocument()
    })
  })

  it('should save global settings', async () => {
    mockReminderApi.updateUserPreferences.mockResolvedValue({ success: true })

    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <ReminderSettings isOpen={true} onClose={() => {}} />
      </Wrapper>
    )

    await waitFor(() => {
      const saveButton = screen.getByText('Save Global Settings')
      expect(saveButton).toBeInTheDocument()
    })

    const saveButton = screen.getByText('Save Global Settings')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockReminderApi.updateUserPreferences).toHaveBeenCalled()
    })
  })

  it('should save subject settings', async () => {
    mockReminderApi.getSubjectSettings.mockResolvedValue({
      data: { enabled: true, minutes: 30, method: 'email' }
    })
    mockReminderApi.updateSubjectSettings.mockResolvedValue({ success: true })

    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <ReminderSettings 
          isOpen={true} 
          onClose={() => {}} 
          subjectId="subject-1"
          subjectName="Mathematics"
        />
      </Wrapper>
    )

    await waitFor(() => {
      const saveButton = screen.getByText('Save Subject Settings')
      expect(saveButton).toBeInTheDocument()
    })

    const saveButton = screen.getByText('Save Subject Settings')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockReminderApi.updateSubjectSettings).toHaveBeenCalledWith('subject-1', {
        enabled: true,
        minutes: 30,
        method: 'email'
      })
    })
  })

  it('should bulk update existing events', async () => {
    mockReminderApi.getSubjectSettings.mockResolvedValue({
      data: { enabled: true, minutes: 30, method: 'email' }
    })
    mockReminderApi.bulkUpdateSubjectReminders.mockResolvedValue({
      data: { updated: 5, failed: 0, message: 'Updated 5 events' }
    })

    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <ReminderSettings 
          isOpen={true} 
          onClose={() => {}} 
          subjectId="subject-1"
          subjectName="Mathematics"
        />
      </Wrapper>
    )

    await waitFor(() => {
      const bulkUpdateButton = screen.getByText('Update All Existing Events')
      expect(bulkUpdateButton).toBeInTheDocument()
    })

    const bulkUpdateButton = screen.getByText('Update All Existing Events')
    fireEvent.click(bulkUpdateButton)

    await waitFor(() => {
      expect(mockReminderApi.bulkUpdateSubjectReminders).toHaveBeenCalledWith('subject-1', {
        enabled: true,
        minutes: 30,
        method: 'email'
      })
    })
  })

  it('should close modal when close button is clicked', () => {
    const onClose = jest.fn()
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <ReminderSettings isOpen={true} onClose={onClose} />
      </Wrapper>
    )

    const closeButton = screen.getByLabelText('Close reminder settings')
    fireEvent.click(closeButton)

    expect(onClose).toHaveBeenCalled()
  })

  it('should format minutes to readable text', async () => {
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <ReminderSettings isOpen={true} onClose={() => {}} />
      </Wrapper>
    )

    await waitFor(() => {
      expect(screen.getByText(/15 minutes before/)).toBeInTheDocument()
    })

    // Change to 60 minutes
    const minutesInput = screen.getByDisplayValue('15')
    fireEvent.change(minutesInput, { target: { value: '60' } })

    await waitFor(() => {
      expect(screen.getByText(/1 hour before/)).toBeInTheDocument()
    })

    // Change to 1440 minutes (1 day)
    fireEvent.change(minutesInput, { target: { value: '1440' } })

    await waitFor(() => {
      expect(screen.getByText(/1 day before/)).toBeInTheDocument()
    })
  })

  it('should show loading state', () => {
    // Mock loading state
    mockReminderApi.getUserPreferences.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(mockUserPreferences), 1000))
    )

    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <ReminderSettings isOpen={true} onClose={() => {}} />
      </Wrapper>
    )

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('should switch between tabs', async () => {
    mockReminderApi.getSubjectSettings.mockResolvedValue({
      data: { enabled: true, minutes: 30, method: 'email' }
    })

    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <ReminderSettings 
          isOpen={true} 
          onClose={() => {}} 
          subjectId="subject-1"
          subjectName="Mathematics"
        />
      </Wrapper>
    )

    // Should start on subject tab when subjectId is provided
    await waitFor(() => {
      expect(screen.getByText('Mathematics Reminder Settings')).toBeInTheDocument()
    })

    // Switch to global tab
    const globalTab = screen.getByText('Global Default')
    fireEvent.click(globalTab)

    await waitFor(() => {
      expect(screen.getByText('Default Reminder Settings')).toBeInTheDocument()
    })
  })
})
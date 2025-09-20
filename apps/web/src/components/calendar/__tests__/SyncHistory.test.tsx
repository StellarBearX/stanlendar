import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SyncHistory from '../SyncHistory'
import { syncApi } from '@/lib/api'

// Mock the API
jest.mock('@/lib/api', () => ({
  syncApi: {
    getHistory: jest.fn(),
  }
}))

const mockSyncApi = syncApi as jest.Mocked<typeof syncApi>

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

const mockHistoryEntry = {
  id: '1',
  userId: 'user-1',
  startedAt: '2024-01-15T10:00:00Z',
  completedAt: '2024-01-15T10:02:30Z',
  status: 'completed' as const,
  options: {
    direction: 'upsert-to-google',
    range: { from: '2024-01-01', to: '2024-03-31' },
    dryRun: false
  },
  result: {
    summary: { created: 5, updated: 2, skipped: 1, failed: 0 },
    quotaUsed: 7,
    conflicts: 0
  }
}

describe('SyncHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders history button', () => {
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <SyncHistory />
      </Wrapper>
    )

    expect(screen.getByText('Sync History')).toBeInTheDocument()
  })

  it('opens history panel when clicked', async () => {
    mockSyncApi.getHistory.mockResolvedValue({ data: [] })
    
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <SyncHistory />
      </Wrapper>
    )

    fireEvent.click(screen.getByText('Sync History'))
    
    await waitFor(() => {
      expect(screen.getByText('No sync history')).toBeInTheDocument()
      expect(mockSyncApi.getHistory).toHaveBeenCalled()
    })
  })

  it('shows loading state', async () => {
    // Mock a slow API call
    mockSyncApi.getHistory.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ data: [] }), 1000))
    )
    
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <SyncHistory />
      </Wrapper>
    )

    fireEvent.click(screen.getByText('Sync History'))
    
    expect(screen.getByRole('status')).toBeInTheDocument() // Loading spinner
  })

  it('shows empty state when no history', async () => {
    mockSyncApi.getHistory.mockResolvedValue({ data: [] })
    
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <SyncHistory />
      </Wrapper>
    )

    fireEvent.click(screen.getByText('Sync History'))
    
    await waitFor(() => {
      expect(screen.getByText('No sync history')).toBeInTheDocument()
      expect(screen.getByText('Your sync operations will appear here')).toBeInTheDocument()
    })
  })

  it('displays history entries', async () => {
    mockSyncApi.getHistory.mockResolvedValue({ data: [mockHistoryEntry] })
    
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <SyncHistory />
      </Wrapper>
    )

    fireEvent.click(screen.getByText('Sync History'))
    
    await waitFor(() => {
      expect(screen.getByText('completed')).toBeInTheDocument()
      expect(screen.getByText('1/15/2024, 5:00:00 PM')).toBeInTheDocument()
      expect(screen.getByText(/Range:.*2024-01-01.*to.*2024-03-31/)).toBeInTheDocument()
      expect(screen.getByText('5 created, 2 updated, 1 skipped')).toBeInTheDocument()
    })
  })

  it('shows different status icons', async () => {
    const entries = [
      { ...mockHistoryEntry, id: '1', status: 'completed' as const },
      { ...mockHistoryEntry, id: '2', status: 'failed' as const },
      { ...mockHistoryEntry, id: '3', status: 'pending' as const },
      { ...mockHistoryEntry, id: '4', status: 'cancelled' as const }
    ]
    
    mockSyncApi.getHistory.mockResolvedValue({ data: entries })
    
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <SyncHistory />
      </Wrapper>
    )

    fireEvent.click(screen.getByText('Sync History'))
    
    await waitFor(() => {
      expect(screen.getAllByText('completed')).toHaveLength(1)
      expect(screen.getAllByText('failed')).toHaveLength(1)
      expect(screen.getAllByText('pending')).toHaveLength(1)
      expect(screen.getAllByText('cancelled')).toHaveLength(1)
    })
  })

  it('shows dry run badge', async () => {
    const dryRunEntry = {
      ...mockHistoryEntry,
      options: { ...mockHistoryEntry.options, dryRun: true }
    }
    
    mockSyncApi.getHistory.mockResolvedValue({ data: [dryRunEntry] })
    
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <SyncHistory />
      </Wrapper>
    )

    fireEvent.click(screen.getByText('Sync History'))
    
    await waitFor(() => {
      expect(screen.getByText('Dry Run')).toBeInTheDocument()
    })
  })

  it('shows conflicts warning', async () => {
    const conflictEntry = {
      ...mockHistoryEntry,
      result: { ...mockHistoryEntry.result!, conflicts: 3 }
    }
    
    mockSyncApi.getHistory.mockResolvedValue({ data: [conflictEntry] })
    
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <SyncHistory />
      </Wrapper>
    )

    fireEvent.click(screen.getByText('Sync History'))
    
    await waitFor(() => {
      expect(screen.getByText('(3 conflicts)')).toBeInTheDocument()
    })
  })

  it('shows error message for failed entries', async () => {
    const failedEntry = {
      ...mockHistoryEntry,
      status: 'failed' as const,
      error: 'Network timeout'
    }
    
    mockSyncApi.getHistory.mockResolvedValue({ data: [failedEntry] })
    
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <SyncHistory />
      </Wrapper>
    )

    fireEvent.click(screen.getByText('Sync History'))
    
    await waitFor(() => {
      expect(screen.getByText('Error: Network timeout')).toBeInTheDocument()
    })
  })

  it('opens detailed modal when entry is clicked', async () => {
    mockSyncApi.getHistory.mockResolvedValue({ data: [mockHistoryEntry] })
    
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <SyncHistory />
      </Wrapper>
    )

    fireEvent.click(screen.getByText('Sync History'))
    
    await waitFor(() => {
      const entryElement = screen.getByText('5 created, 2 updated, 1 skipped').closest('div')
      fireEvent.click(entryElement!)
    })
    
    expect(screen.getByText('Sync Details')).toBeInTheDocument()
    expect(screen.getByText('Basic Information')).toBeInTheDocument()
    expect(screen.getByText('Results')).toBeInTheDocument()
  })

  it('shows detailed information in modal', async () => {
    mockSyncApi.getHistory.mockResolvedValue({ data: [mockHistoryEntry] })
    
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <SyncHistory />
      </Wrapper>
    )

    fireEvent.click(screen.getByText('Sync History'))
    
    await waitFor(() => {
      const entryElement = screen.getByText('5 created, 2 updated, 1 skipped').closest('div')
      fireEvent.click(entryElement!)
    })
    
    expect(screen.getByText('Full Sync')).toBeInTheDocument()
    expect(screen.getByText('Started:')).toBeInTheDocument()
    expect(screen.getByText('Completed:')).toBeInTheDocument()
    expect(screen.getByText(/7.*API calls/)).toBeInTheDocument()
  })

  it('closes modal when close button is clicked', async () => {
    mockSyncApi.getHistory.mockResolvedValue({ data: [mockHistoryEntry] })
    
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <SyncHistory />
      </Wrapper>
    )

    fireEvent.click(screen.getByText('Sync History'))
    
    await waitFor(() => {
      const entryElement = screen.getByText('5 created, 2 updated, 1 skipped').closest('div')
      fireEvent.click(entryElement!)
    })
    
    expect(screen.getByText('Sync Details')).toBeInTheDocument()
    
    fireEvent.click(screen.getByText('Close'))
    
    expect(screen.queryByText('Sync Details')).not.toBeInTheDocument()
  })

  it('handles API errors gracefully', async () => {
    mockSyncApi.getHistory.mockRejectedValue(new Error('API Error'))
    
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <SyncHistory />
      </Wrapper>
    )

    fireEvent.click(screen.getByText('Sync History'))
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load sync history')).toBeInTheDocument()
      expect(screen.getByText('API Error')).toBeInTheDocument()
    })
  })

  it('formats duration correctly', async () => {
    const entries = [
      {
        ...mockHistoryEntry,
        id: '1',
        startedAt: '2024-01-15T10:00:00Z',
        completedAt: '2024-01-15T10:00:30Z' // 30 seconds
      },
      {
        ...mockHistoryEntry,
        id: '2',
        startedAt: '2024-01-15T10:00:00Z',
        completedAt: '2024-01-15T10:02:00Z' // 2 minutes
      },
      {
        ...mockHistoryEntry,
        id: '3',
        startedAt: '2024-01-15T10:00:00Z',
        completedAt: '2024-01-15T12:00:00Z' // 2 hours
      }
    ]
    
    mockSyncApi.getHistory.mockResolvedValue({ data: entries })
    
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <SyncHistory />
      </Wrapper>
    )

    fireEvent.click(screen.getByText('Sync History'))
    
    await waitFor(() => {
      expect(screen.getByText('30s')).toBeInTheDocument()
      expect(screen.getByText('2m')).toBeInTheDocument()
      expect(screen.getByText('2h')).toBeInTheDocument()
    })
  })
})
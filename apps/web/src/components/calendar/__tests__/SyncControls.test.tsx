import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SyncControls from '../SyncControls'
import { syncApi } from '@/lib/api'

// Mock the API
jest.mock('@/lib/api', () => ({
  syncApi: {
    syncToGoogle: jest.fn(),
    getHistory: jest.fn(),
    resolveConflicts: jest.fn(),
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

describe('SyncControls', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders sync button', () => {
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <SyncControls />
      </Wrapper>
    )

    expect(screen.getByText('Sync to Google')).toBeInTheDocument()
  })

  it('opens sync options panel when clicked', () => {
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <SyncControls />
      </Wrapper>
    )

    fireEvent.click(screen.getByText('Sync to Google'))
    
    expect(screen.getByText('Sync Options')).toBeInTheDocument()
    expect(screen.getByText('Date Range')).toBeInTheDocument()
    expect(screen.getByText('Quick Presets')).toBeInTheDocument()
  })

  it('allows setting custom date range', () => {
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <SyncControls />
      </Wrapper>
    )

    fireEvent.click(screen.getByText('Sync to Google'))
    
    const fromInput = screen.getByLabelText('From')
    const toInput = screen.getByLabelText('To')
    
    fireEvent.change(fromInput, { target: { value: '2024-01-01' } })
    fireEvent.change(toInput, { target: { value: '2024-03-31' } })
    
    expect(fromInput).toHaveValue('2024-01-01')
    expect(toInput).toHaveValue('2024-03-31')
  })

  it('applies quick date presets', () => {
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <SyncControls />
      </Wrapper>
    )

    fireEvent.click(screen.getByText('Sync to Google'))
    fireEvent.click(screen.getByText('Next 3 Months'))
    
    const fromInput = screen.getByLabelText('From')
    const toInput = screen.getByLabelText('To')
    
    // Should set today as from date
    const today = new Date().toISOString().split('T')[0]
    expect(fromInput).toHaveValue(today)
    
    // Should set 90 days from now as to date
    const futureDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    expect(toInput).toHaveValue(futureDate)
  })

  it('performs dry run sync', async () => {
    const mockResult = {
      summary: { created: 5, updated: 2, skipped: 1, failed: 0 },
      details: [],
      conflicts: [],
      quotaUsed: 7,
      isDryRun: true
    }
    
    mockSyncApi.syncToGoogle.mockResolvedValue({ data: mockResult })
    
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <SyncControls />
      </Wrapper>
    )

    fireEvent.click(screen.getByText('Sync to Google'))
    fireEvent.click(screen.getByText('Preview Changes'))
    
    await waitFor(() => {
      expect(mockSyncApi.syncToGoogle).toHaveBeenCalledWith(
        expect.objectContaining({
          dryRun: true,
          direction: 'upsert-to-google'
        })
      )
    })

    await waitFor(() => {
      expect(screen.getByText(/Dry run: 5 created, 2 updated, 1 skipped/)).toBeInTheDocument()
    })
  })

  it('performs actual sync', async () => {
    const mockResult = {
      summary: { created: 5, updated: 2, skipped: 1, failed: 0 },
      details: [],
      conflicts: [],
      quotaUsed: 7,
      isDryRun: false
    }
    
    mockSyncApi.syncToGoogle.mockResolvedValue({ data: mockResult })
    
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <SyncControls />
      </Wrapper>
    )

    fireEvent.click(screen.getByText('Sync to Google'))
    fireEvent.click(screen.getByText('Sync Now'))
    
    await waitFor(() => {
      expect(mockSyncApi.syncToGoogle).toHaveBeenCalledWith(
        expect.objectContaining({
          dryRun: false,
          direction: 'upsert-to-google'
        })
      )
    })

    await waitFor(() => {
      expect(screen.getByText(/Last sync: 5 created, 2 updated, 1 skipped/)).toBeInTheDocument()
    })
  })

  it('shows conflict resolution modal when conflicts exist', async () => {
    const mockResult = {
      summary: { created: 3, updated: 1, skipped: 0, failed: 1 },
      details: [],
      conflicts: [
        {
          localEventId: '1',
          googleEventId: 'google-1',
          conflictType: 'etag_mismatch',
          localEvent: { title: 'Math Class', subject: { name: 'Mathematics' } },
          suggestedResolution: { action: 'use_local', reason: 'Local version is newer' }
        }
      ],
      quotaUsed: 5,
      isDryRun: false
    }
    
    mockSyncApi.syncToGoogle.mockResolvedValue({ data: mockResult })
    
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <SyncControls />
      </Wrapper>
    )

    fireEvent.click(screen.getByText('Sync to Google'))
    fireEvent.click(screen.getByText('Sync Now'))
    
    await waitFor(() => {
      expect(screen.getByText('Resolve Sync Conflicts (1)')).toBeInTheDocument()
      expect(screen.getByText('Math Class')).toBeInTheDocument()
      expect(screen.getByText('Event was modified both locally and on Google Calendar')).toBeInTheDocument()
    })
  })

  it('calls onSyncComplete callback', async () => {
    const mockResult = {
      summary: { created: 1, updated: 0, skipped: 0, failed: 0 },
      details: [],
      conflicts: [],
      quotaUsed: 1,
      isDryRun: false
    }
    
    mockSyncApi.syncToGoogle.mockResolvedValue({ data: mockResult })
    
    const onSyncComplete = jest.fn()
    const Wrapper = createWrapper()
    
    render(
      <Wrapper>
        <SyncControls onSyncComplete={onSyncComplete} />
      </Wrapper>
    )

    fireEvent.click(screen.getByText('Sync to Google'))
    fireEvent.click(screen.getByText('Sync Now'))
    
    await waitFor(() => {
      expect(onSyncComplete).toHaveBeenCalledWith(mockResult)
    })
  })

  it('disables sync button when no date range is set', () => {
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <SyncControls />
      </Wrapper>
    )

    fireEvent.click(screen.getByText('Sync to Google'))
    
    // Clear the date inputs
    const fromInput = screen.getByLabelText('From')
    const toInput = screen.getByLabelText('To')
    
    fireEvent.change(fromInput, { target: { value: '' } })
    fireEvent.change(toInput, { target: { value: '' } })
    
    const syncButton = screen.getByText('Sync Now')
    expect(syncButton).toBeDisabled()
  })

  it('shows loading state during sync', async () => {
    // Mock a slow sync operation
    let resolveSync: (value: any) => void
    const syncPromise = new Promise(resolve => {
      resolveSync = resolve
    })
    mockSyncApi.syncToGoogle.mockReturnValue(syncPromise)
    
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <SyncControls />
      </Wrapper>
    )

    fireEvent.click(screen.getByText('Sync to Google'))
    fireEvent.click(screen.getByText('Sync Now'))
    
    // Check for loading text in button
    await waitFor(() => {
      expect(screen.getByText('Syncing...')).toBeInTheDocument()
      expect(screen.getByText('Syncing events...')).toBeInTheDocument()
    })
    
    // Resolve the sync
    resolveSync!({ data: {} })
    
    // Wait for sync to complete
    await waitFor(() => {
      expect(screen.queryByText('Syncing...')).not.toBeInTheDocument()
    })
  })

  it('handles sync errors gracefully', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockSyncApi.syncToGoogle.mockRejectedValue(new Error('Network error'))
    
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <SyncControls />
      </Wrapper>
    )

    fireEvent.click(screen.getByText('Sync to Google'))
    fireEvent.click(screen.getByText('Sync Now'))
    
    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith('Sync failed:', expect.any(Error))
    })
    
    consoleError.mockRestore()
  })
})
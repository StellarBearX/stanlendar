import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SpotlightFilter } from '../SpotlightFilter'
import { useSpotlightStore } from '@/store/spotlight'

// Mock the store
jest.mock('@/store/spotlight')
const mockUseSpotlightStore = useSpotlightStore as jest.MockedFunction<typeof useSpotlightStore>

// Mock the API
jest.mock('@/lib/api', () => ({
  spotlightApi: {
    search: jest.fn(),
    getSuggestions: {
      subjects: jest.fn(),
      rooms: jest.fn(),
      teachers: jest.fn(),
      sections: jest.fn(),
    }
  }
}))

// Mock Heroicons
jest.mock('@heroicons/react/24/outline', () => ({
  MagnifyingGlassIcon: () => <div data-testid="search-icon" />,
  FunnelIcon: () => <div data-testid="filter-icon" />,
  XMarkIcon: () => <div data-testid="close-icon" />,
}))

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  )
}

describe('SpotlightFilter', () => {
  const mockStore = {
    searchText: '',
    isActive: false,
    isLoading: false,
    error: null,
    activeFilters: [],
    isFilterPanelOpen: false,
    results: null,
    setSearchText: jest.fn(),
    debouncedSearch: jest.fn(),
    toggleFilterPanel: jest.fn(),
    clearAllFilters: jest.fn(),
    performSearch: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseSpotlightStore.mockReturnValue(mockStore)
  })

  it('renders search input correctly', () => {
    renderWithQueryClient(<SpotlightFilter />)
    
    expect(screen.getByPlaceholderText(/search subjects, rooms, teachers/i)).toBeInTheDocument()
    expect(screen.getByTestId('search-icon')).toBeInTheDocument()
    expect(screen.getByTestId('filter-icon')).toBeInTheDocument()
  })

  it('calls setSearchText when input changes', () => {
    renderWithQueryClient(<SpotlightFilter />)
    
    const input = screen.getByPlaceholderText(/search subjects, rooms, teachers/i)
    fireEvent.change(input, { target: { value: 'mathematics' } })
    
    expect(mockStore.setSearchText).toHaveBeenCalledWith('mathematics')
  })

  it('calls debouncedSearch when input has value', () => {
    renderWithQueryClient(<SpotlightFilter />)
    
    const input = screen.getByPlaceholderText(/search subjects, rooms, teachers/i)
    fireEvent.change(input, { target: { value: 'math' } })
    
    expect(mockStore.debouncedSearch).toHaveBeenCalledWith('math')
  })

  it('shows loading indicator when loading', () => {
    mockUseSpotlightStore.mockReturnValue({
      ...mockStore,
      isLoading: true
    })
    
    renderWithQueryClient(<SpotlightFilter />)
    
    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument()
  })

  it('shows error message when there is an error', () => {
    mockUseSpotlightStore.mockReturnValue({
      ...mockStore,
      error: 'Search failed'
    })
    
    renderWithQueryClient(<SpotlightFilter />)
    
    expect(screen.getByText('Search failed')).toBeInTheDocument()
  })

  it('shows results summary when results are available', () => {
    mockUseSpotlightStore.mockReturnValue({
      ...mockStore,
      isActive: true,
      results: {
        events: [],
        subjects: [],
        sections: [],
        totalCount: 100,
        filteredCount: 25
      }
    })
    
    renderWithQueryClient(<SpotlightFilter />)
    
    expect(screen.getByText(/showing 25 of 100 events/i)).toBeInTheDocument()
  })

  it('shows clear all button when filters are active', () => {
    mockUseSpotlightStore.mockReturnValue({
      ...mockStore,
      isActive: true,
      activeFilters: [
        {
          id: '1',
          label: 'Mathematics',
          type: 'subject',
          value: 'math-id'
        }
      ]
    })
    
    renderWithQueryClient(<SpotlightFilter />)
    
    expect(screen.getByTitle('Clear All Filters')).toBeInTheDocument()
  })

  it('calls clearAllFilters when clear button is clicked', () => {
    mockUseSpotlightStore.mockReturnValue({
      ...mockStore,
      isActive: true
    })
    
    renderWithQueryClient(<SpotlightFilter />)
    
    const clearButton = screen.getByTitle('Clear All Filters')
    fireEvent.click(clearButton)
    
    expect(mockStore.clearAllFilters).toHaveBeenCalled()
  })

  it('calls toggleFilterPanel when filter button is clicked', () => {
    renderWithQueryClient(<SpotlightFilter />)
    
    const filterButton = screen.getByTitle('Advanced Filters')
    fireEvent.click(filterButton)
    
    expect(mockStore.toggleFilterPanel).toHaveBeenCalled()
  })

  it('highlights filter button when panel is open or filters are active', () => {
    mockUseSpotlightStore.mockReturnValue({
      ...mockStore,
      isFilterPanelOpen: true
    })
    
    renderWithQueryClient(<SpotlightFilter />)
    
    const filterButton = screen.getByTitle('Advanced Filters')
    expect(filterButton).toHaveClass('bg-blue-100', 'text-blue-600')
  })

  it('calls onResultsChange when results change', () => {
    const onResultsChange = jest.fn()
    const results = {
      events: [],
      subjects: [],
      sections: [],
      totalCount: 10,
      filteredCount: 5
    }
    
    mockUseSpotlightStore.mockReturnValue({
      ...mockStore,
      results
    })
    
    renderWithQueryClient(<SpotlightFilter onResultsChange={onResultsChange} />)
    
    expect(onResultsChange).toHaveBeenCalledWith(results)
  })
})
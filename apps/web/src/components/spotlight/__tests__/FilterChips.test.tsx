import { render, screen, fireEvent } from '@testing-library/react'
import { FilterChips } from '../FilterChips'
import { useSpotlightStore } from '@/store/spotlight'

// Mock the store
jest.mock('@/store/spotlight')
const mockUseSpotlightStore = useSpotlightStore as jest.MockedFunction<typeof useSpotlightStore>

// Mock Heroicons
jest.mock('@heroicons/react/20/solid', () => ({
  XMarkIcon: () => <div data-testid="x-mark-icon" />,
}))

jest.mock('@heroicons/react/24/outline', () => ({
  AcademicCapIcon: () => <div data-testid="academic-cap-icon" />,
  MapPinIcon: () => <div data-testid="map-pin-icon" />,
  UserIcon: () => <div data-testid="user-icon" />,
  HashtagIcon: () => <div data-testid="hashtag-icon" />,
  CalendarIcon: () => <div data-testid="calendar-icon" />,
}))

describe('FilterChips', () => {
  const mockStore = {
    activeFilters: [],
    removeFilter: jest.fn(),
    performSearch: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseSpotlightStore.mockReturnValue(mockStore)
  })

  it('renders nothing when no active filters', () => {
    const { container } = render(<FilterChips />)
    expect(container.firstChild).toBeNull()
  })

  it('renders filter chips correctly', () => {
    mockUseSpotlightStore.mockReturnValue({
      ...mockStore,
      activeFilters: [
        {
          id: '1',
          label: 'Mathematics',
          type: 'subject',
          value: 'math-id',
          color: 'bg-blue-100 text-blue-800'
        },
        {
          id: '2',
          label: 'A101',
          type: 'room',
          value: 'A101',
          color: 'bg-purple-100 text-purple-800'
        }
      ]
    })

    render(<FilterChips />)

    expect(screen.getByText('Mathematics')).toBeInTheDocument()
    expect(screen.getByText('A101')).toBeInTheDocument()
    expect(screen.getByTestId('academic-cap-icon')).toBeInTheDocument()
    expect(screen.getByTestId('map-pin-icon')).toBeInTheDocument()
  })

  it('calls removeFilter when remove button is clicked', async () => {
    mockUseSpotlightStore.mockReturnValue({
      ...mockStore,
      activeFilters: [
        {
          id: '1',
          label: 'Mathematics',
          type: 'subject',
          value: 'math-id',
          color: 'bg-blue-100 text-blue-800'
        }
      ]
    })

    render(<FilterChips />)

    const removeButton = screen.getByTitle('Remove filter')
    fireEvent.click(removeButton)

    expect(mockStore.removeFilter).toHaveBeenCalledWith('1')
  })

  it('formats date range filter labels correctly', () => {
    mockUseSpotlightStore.mockReturnValue({
      ...mockStore,
      activeFilters: [
        {
          id: '1',
          label: 'Date Range',
          type: 'date',
          value: { from: '2024-01-01', to: '2024-01-31' },
          color: 'bg-gray-100 text-gray-800'
        }
      ]
    })

    render(<FilterChips />)

    expect(screen.getByText(/Jan 1 - Jan 31/)).toBeInTheDocument()
  })

  it('formats single date filter labels correctly', () => {
    mockUseSpotlightStore.mockReturnValue({
      ...mockStore,
      activeFilters: [
        {
          id: '1',
          label: 'Date Range',
          type: 'date',
          value: { from: '2024-01-01' },
          color: 'bg-gray-100 text-gray-800'
        }
      ]
    })

    render(<FilterChips />)

    expect(screen.getByText(/From Jan 1/)).toBeInTheDocument()
  })

  it('applies correct color classes for different filter types', () => {
    mockUseSpotlightStore.mockReturnValue({
      ...mockStore,
      activeFilters: [
        {
          id: '1',
          label: 'Mathematics',
          type: 'subject',
          value: 'math-id'
        },
        {
          id: '2',
          label: '001',
          type: 'section',
          value: '001'
        }
      ]
    })

    render(<FilterChips />)

    const subjectChip = screen.getByText('Mathematics').closest('div')
    const sectionChip = screen.getByText('001').closest('div')

    expect(subjectChip).toHaveClass('bg-blue-100', 'text-blue-800', 'border-blue-200')
    expect(sectionChip).toHaveClass('bg-green-100', 'text-green-800', 'border-green-200')
  })

  it('truncates long filter labels', () => {
    mockUseSpotlightStore.mockReturnValue({
      ...mockStore,
      activeFilters: [
        {
          id: '1',
          label: 'Very Long Subject Name That Should Be Truncated',
          type: 'subject',
          value: 'long-subject-id'
        }
      ]
    })

    render(<FilterChips />)

    const labelSpan = screen.getByText('Very Long Subject Name That Should Be Truncated')
    expect(labelSpan).toHaveClass('max-w-32', 'truncate')
    expect(labelSpan).toHaveAttribute('title', 'Very Long Subject Name That Should Be Truncated')
  })
})
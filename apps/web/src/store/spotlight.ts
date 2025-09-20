import { create } from 'zustand'
import { SpotlightQuery, SpotlightResult, FilterChip } from '@/types/spotlight'
import { spotlightApi } from '@/lib/api'

interface SpotlightState {
  // Filter state
  query: SpotlightQuery
  isActive: boolean
  results: SpotlightResult | null
  isLoading: boolean
  error: string | null
  
  // UI state
  isFilterPanelOpen: boolean
  viewMode: 'hide_others' | 'dim_others'
  activeFilters: FilterChip[]
  
  // Search input state
  searchText: string
  searchDebounceTimer: NodeJS.Timeout | null
  
  // Actions
  setQuery: (query: Partial<SpotlightQuery>) => void
  clearQuery: () => void
  performSearch: () => Promise<void>
  setSearchText: (text: string) => void
  debouncedSearch: (text: string) => void
  
  // Filter management
  addFilter: (filter: FilterChip) => void
  removeFilter: (filterId: string) => void
  clearAllFilters: () => void
  toggleFilterPanel: () => void
  setViewMode: (mode: 'hide_others' | 'dim_others') => void
  
  // UI actions
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useSpotlightStore = create<SpotlightState>((set, get) => ({
  // Initial state
  query: {},
  isActive: false,
  results: null,
  isLoading: false,
  error: null,
  
  isFilterPanelOpen: false,
  viewMode: 'hide_others',
  activeFilters: [],
  
  searchText: '',
  searchDebounceTimer: null,
  
  // Actions
  setQuery: (newQuery) => {
    const currentQuery = get().query
    const updatedQuery = { ...currentQuery, ...newQuery }
    set({ 
      query: updatedQuery,
      isActive: Object.keys(updatedQuery).some(key => {
        const value = updatedQuery[key as keyof SpotlightQuery]
        return Array.isArray(value) ? value.length > 0 : Boolean(value)
      })
    })
  },

  clearQuery: () => {
    set({ 
      query: {},
      isActive: false,
      results: null,
      activeFilters: [],
      searchText: '',
      error: null
    })
  },

  performSearch: async () => {
    const { query, setLoading, setError } = get()
    
    if (!get().isActive) {
      set({ results: null })
      return
    }

    setLoading(true)
    setError(null)

    try {
      const results = await spotlightApi.search(query, 100, 0)
      set({ results })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Search failed'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  },

  setSearchText: (text) => {
    set({ searchText: text })
  },

  debouncedSearch: (text) => {
    const { searchDebounceTimer } = get()
    
    // Clear existing timer
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer)
    }
    
    // Set new timer
    const timer = setTimeout(() => {
      get().setQuery({ text: text.trim() || undefined })
      get().performSearch()
    }, 300)
    
    set({ searchDebounceTimer: timer })
  },

  // Filter management
  addFilter: (filter) => {
    const { activeFilters, setQuery } = get()
    
    // Remove existing filter of same type and value if it exists
    const filteredFilters = activeFilters.filter(f => 
      !(f.type === filter.type && f.value === filter.value)
    )
    
    const newFilters = [...filteredFilters, filter]
    set({ activeFilters: newFilters })
    
    // Update query based on filters
    const query: Partial<SpotlightQuery> = {}
    
    newFilters.forEach(f => {
      switch (f.type) {
        case 'subject':
          if (!query.subjectIds) query.subjectIds = []
          query.subjectIds.push(f.value)
          break
        case 'section':
          if (!query.sectionIds) query.sectionIds = []
          query.sectionIds.push(f.value)
          break
        case 'room':
          query.room = f.value
          break
        case 'teacher':
          query.teacher = f.value
          break
        case 'date':
          if (f.value.from) query.dateFrom = f.value.from
          if (f.value.to) query.dateTo = f.value.to
          break
      }
    })
    
    setQuery(query)
  },

  removeFilter: (filterId) => {
    const { activeFilters } = get()
    const newFilters = activeFilters.filter(f => f.id !== filterId)
    set({ activeFilters: newFilters })
    
    // Rebuild query from remaining filters
    const query: Partial<SpotlightQuery> = {}
    
    newFilters.forEach(f => {
      switch (f.type) {
        case 'subject':
          if (!query.subjectIds) query.subjectIds = []
          query.subjectIds.push(f.value)
          break
        case 'section':
          if (!query.sectionIds) query.sectionIds = []
          query.sectionIds.push(f.value)
          break
        case 'room':
          query.room = f.value
          break
        case 'teacher':
          query.teacher = f.value
          break
        case 'date':
          if (f.value.from) query.dateFrom = f.value.from
          if (f.value.to) query.dateTo = f.value.to
          break
      }
    })
    
    set({ query })
  },

  clearAllFilters: () => {
    get().clearQuery()
  },

  toggleFilterPanel: () => {
    set({ isFilterPanelOpen: !get().isFilterPanelOpen })
  },

  setViewMode: (mode) => {
    set({ viewMode: mode })
    get().setQuery({ viewMode: mode })
  },

  // UI actions
  setLoading: (loading) => {
    set({ isLoading: loading })
  },

  setError: (error) => {
    set({ error })
  },
}))
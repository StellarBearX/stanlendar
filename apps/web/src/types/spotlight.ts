export interface SpotlightQuery {
  subjectIds?: string[]
  sectionIds?: string[]
  secCodes?: string[]
  text?: string
  room?: string
  teacher?: string
  dateFrom?: string
  dateTo?: string
  viewMode?: 'hide_others' | 'dim_others'
}

export interface SpotlightResult {
  events: any[]
  subjects: any[]
  sections: any[]
  totalCount: number
  filteredCount: number
}

export interface SpotlightFilterState {
  query: SpotlightQuery
  isActive: boolean
  results: SpotlightResult | null
  isLoading: boolean
  error: string | null
}

export interface FilterChip {
  id: string
  label: string
  type: 'subject' | 'section' | 'room' | 'teacher' | 'date'
  value: any
  color?: string
}

export interface SuggestionItem {
  value: string
  label: string
  type: 'subject' | 'room' | 'teacher' | 'section'
}
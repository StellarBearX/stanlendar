'use client'

import { useState, useRef, useEffect } from 'react'
import { MagnifyingGlassIcon, FunnelIcon, XMarkIcon, BookmarkIcon } from '@heroicons/react/24/outline'
import { useSpotlightStore } from '@/store/spotlight'
import { FilterChip } from '@/types/spotlight'
import { SpotlightSuggestions } from './SpotlightSuggestions'
import { FilterChips } from './FilterChips'
import { ViewModeToggle } from './ViewModeToggle'
import { AdvancedFilterPanel } from './AdvancedFilterPanel'
import { SavedFiltersManager } from './SavedFiltersManager'

interface SpotlightFilterProps {
  onResultsChange?: (results: any) => void
  className?: string
}

export function SpotlightFilter({ onResultsChange, className = '' }: SpotlightFilterProps) {
  const {
    searchText,
    isActive,
    isLoading,
    error,
    activeFilters,
    isFilterPanelOpen,
    results,
    setSearchText,
    debouncedSearch,
    toggleFilterPanel,
    clearAllFilters,
    performSearch
  } = useSpotlightStore()

  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionType, setSuggestionType] = useState<'subjects' | 'rooms' | 'teachers' | 'sections'>('subjects')
  const [showSavedFilters, setShowSavedFilters] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchText(value)
    
    if (value.trim()) {
      debouncedSearch(value)
      setShowSuggestions(true)
      // Determine suggestion type based on input patterns
      if (value.includes('room') || value.includes('Room')) {
        setSuggestionType('rooms')
      } else if (value.includes('dr') || value.includes('Dr') || value.includes('prof')) {
        setSuggestionType('teachers')
      } else if (/^\d/.test(value)) {
        setSuggestionType('sections')
      } else {
        setSuggestionType('subjects')
      }
    } else {
      setShowSuggestions(false)
      debouncedSearch('')
    }
  }

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: string, type: string) => {
    const filter: FilterChip = {
      id: `${type}-${Date.now()}`,
      label: suggestion,
      type: type as FilterChip['type'],
      value: suggestion,
      color: getFilterColor(type as FilterChip['type'])
    }
    
    useSpotlightStore.getState().addFilter(filter)
    setSearchText('')
    setShowSuggestions(false)
    performSearch()
  }

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Notify parent of results changes
  useEffect(() => {
    if (onResultsChange && results) {
      onResultsChange(results)
    }
  }, [results, onResultsChange])

  const getFilterColor = (type: FilterChip['type']): string => {
    const colors = {
      subject: 'bg-blue-100 text-blue-800',
      section: 'bg-green-100 text-green-800',
      room: 'bg-purple-100 text-purple-800',
      teacher: 'bg-orange-100 text-orange-800',
      date: 'bg-gray-100 text-gray-800'
    }
    return colors[type] || colors.subject
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Main Search Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center p-4">
          {/* Search Icon */}
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 mr-3" />
          
          {/* Search Input */}
          <div className="flex-1 relative">
            <input
              ref={searchInputRef}
              type="text"
              value={searchText}
              onChange={handleSearchChange}
              placeholder="Search subjects, rooms, teachers, or sections..."
              className="w-full border-0 p-0 text-gray-900 placeholder-gray-500 focus:ring-0 focus:outline-none"
              onFocus={() => searchText.trim() && setShowSuggestions(true)}
            />
            
            {/* Loading indicator */}
            {isLoading && (
              <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>
          
          {/* Saved Filters Button */}
          <button
            onClick={() => setShowSavedFilters(true)}
            className="ml-3 p-2 rounded-md transition-colors text-gray-400 hover:text-gray-600"
            title="Saved Filters"
          >
            <BookmarkIcon className="h-5 w-5" />
          </button>
          
          {/* Filter Toggle Button */}
          <button
            onClick={toggleFilterPanel}
            className={`ml-3 p-2 rounded-md transition-colors ${
              isFilterPanelOpen || activeFilters.length > 0
                ? 'bg-blue-100 text-blue-600'
                : 'text-gray-400 hover:text-gray-600'
            }`}
            title="Advanced Filters"
          >
            <FunnelIcon className="h-5 w-5" />
          </button>
          
          {/* Clear All Button */}
          {isActive && (
            <button
              onClick={clearAllFilters}
              className="ml-2 p-2 text-gray-400 hover:text-gray-600 rounded-md transition-colors"
              title="Clear All Filters"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}
        </div>
        
        {/* Active Filter Chips */}
        {activeFilters.length > 0 && (
          <div className="px-4 pb-4">
            <FilterChips />
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="px-4 pb-4">
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}
        
        {/* Results Summary */}
        {results && isActive && (
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>
                Showing {results.filteredCount} of {results.totalCount} events
              </span>
              <ViewModeToggle />
            </div>
          </div>
        )}
      </div>
      
      {/* Advanced Filter Panel */}
      <AdvancedFilterPanel
        isOpen={isFilterPanelOpen}
        onClose={() => useSpotlightStore.getState().toggleFilterPanel()}
      />
      
      {/* Suggestions Dropdown */}
      {showSuggestions && searchText.trim() && !isFilterPanelOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1">
          <SpotlightSuggestions
            searchText={searchText}
            type={suggestionType}
            onSelect={handleSuggestionSelect}
            onClose={() => setShowSuggestions(false)}
          />
        </div>
      )}
      
      {/* Saved Filters Manager */}
      <SavedFiltersManager
        isOpen={showSavedFilters}
        onClose={() => setShowSavedFilters(false)}
      />
    </div>
  )
}

export default SpotlightFilter
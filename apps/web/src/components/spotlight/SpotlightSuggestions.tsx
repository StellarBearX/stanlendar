'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { spotlightApi } from '@/lib/api'
import { 
  AcademicCapIcon, 
  MapPinIcon, 
  UserIcon, 
  HashtagIcon,
  MagnifyingGlassIcon 
} from '@heroicons/react/24/outline'

interface SpotlightSuggestionsProps {
  searchText: string
  type: 'subjects' | 'rooms' | 'teachers' | 'sections'
  onSelect: (suggestion: string, type: string) => void
  onClose: () => void
}

export function SpotlightSuggestions({ 
  searchText, 
  type, 
  onSelect, 
  onClose 
}: SpotlightSuggestionsProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Fetch suggestions based on type
  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['spotlight-suggestions', type, searchText],
    queryFn: () => {
      switch (type) {
        case 'subjects':
          return spotlightApi.getSuggestions.subjects(searchText)
        case 'rooms':
          return spotlightApi.getSuggestions.rooms(searchText)
        case 'teachers':
          return spotlightApi.getSuggestions.teachers(searchText)
        case 'sections':
          return spotlightApi.getSuggestions.sections(searchText)
        default:
          return []
      }
    },
    enabled: searchText.length >= 2,
    staleTime: 30000, // 30 seconds
  })

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!suggestions.length) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev => 
            prev < suggestions.length - 1 ? prev + 1 : 0
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : suggestions.length - 1
          )
          break
        case 'Enter':
          e.preventDefault()
          if (suggestions[selectedIndex]) {
            onSelect(suggestions[selectedIndex], type)
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [suggestions, selectedIndex, onSelect, onClose, type])

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(0)
  }, [suggestions])

  const getIcon = () => {
    switch (type) {
      case 'subjects':
        return AcademicCapIcon
      case 'rooms':
        return MapPinIcon
      case 'teachers':
        return UserIcon
      case 'sections':
        return HashtagIcon
      default:
        return MagnifyingGlassIcon
    }
  }

  const getTypeLabel = () => {
    switch (type) {
      case 'subjects':
        return 'Subjects'
      case 'rooms':
        return 'Rooms'
      case 'teachers':
        return 'Teachers'
      case 'sections':
        return 'Sections'
      default:
        return 'Results'
    }
  }

  const Icon = getIcon()

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-sm text-gray-600">Loading suggestions...</span>
        </div>
      </div>
    )
  }

  if (!suggestions.length) {
    return (
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <div className="flex items-center text-gray-500">
          <Icon className="h-5 w-5 mr-2" />
          <span className="text-sm">No {type} found matching "{searchText}"</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 max-h-64 overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center text-sm font-medium text-gray-700">
          <Icon className="h-4 w-4 mr-2" />
          {getTypeLabel()}
        </div>
      </div>
      
      {/* Suggestions List */}
      <div className="py-1">
        {suggestions.map((suggestion, index) => (
          <button
            key={`${suggestion}-${index}`}
            onClick={() => onSelect(suggestion, type)}
            className={`w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors ${
              index === selectedIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
            }`}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className="flex items-center">
              <Icon className={`h-4 w-4 mr-3 ${
                index === selectedIndex ? 'text-blue-500' : 'text-gray-400'
              }`} />
              <span className="text-sm">
                {highlightMatch(suggestion, searchText)}
              </span>
            </div>
          </button>
        ))}
      </div>
      
      {/* Footer with keyboard hints */}
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Use ↑↓ to navigate</span>
          <span>Enter to select • Esc to close</span>
        </div>
      </div>
    </div>
  )
}

// Helper function to highlight matching text
function highlightMatch(text: string, searchText: string): React.ReactNode {
  if (!searchText.trim()) return text

  const regex = new RegExp(`(${searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)

  return parts.map((part, index) => 
    regex.test(part) ? (
      <mark key={index} className="bg-yellow-200 text-yellow-900 px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  )
}
'use client'

import { XMarkIcon } from '@heroicons/react/20/solid'
import { 
  AcademicCapIcon, 
  MapPinIcon, 
  UserIcon, 
  HashtagIcon,
  CalendarIcon 
} from '@heroicons/react/24/outline'
import { useSpotlightStore } from '@/store/spotlight'
import { FilterChip } from '@/types/spotlight'

export function FilterChips() {
  const { activeFilters, removeFilter, performSearch } = useSpotlightStore()

  const handleRemoveFilter = async (filterId: string) => {
    removeFilter(filterId)
    await performSearch()
  }

  const getFilterIcon = (type: FilterChip['type']) => {
    switch (type) {
      case 'subject':
        return AcademicCapIcon
      case 'section':
        return HashtagIcon
      case 'room':
        return MapPinIcon
      case 'teacher':
        return UserIcon
      case 'date':
        return CalendarIcon
      default:
        return AcademicCapIcon
    }
  }

  const getFilterColor = (type: FilterChip['type']) => {
    const colors = {
      subject: 'bg-blue-100 text-blue-800 border-blue-200',
      section: 'bg-green-100 text-green-800 border-green-200',
      room: 'bg-purple-100 text-purple-800 border-purple-200',
      teacher: 'bg-orange-100 text-orange-800 border-orange-200',
      date: 'bg-gray-100 text-gray-800 border-gray-200'
    }
    return colors[type] || colors.subject
  }

  const formatFilterLabel = (filter: FilterChip) => {
    if (filter.type === 'date' && typeof filter.value === 'object') {
      const { from, to } = filter.value
      if (from && to) {
        return `${formatDate(from)} - ${formatDate(to)}`
      } else if (from) {
        return `From ${formatDate(from)}`
      } else if (to) {
        return `Until ${formatDate(to)}`
      }
    }
    return filter.label
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  if (activeFilters.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-2">
      {activeFilters.map((filter) => {
        const Icon = getFilterIcon(filter.type)
        const colorClasses = getFilterColor(filter.type)
        
        return (
          <div
            key={filter.id}
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border ${colorClasses} transition-all duration-200 hover:shadow-sm`}
          >
            <Icon className="h-3.5 w-3.5 mr-1.5" />
            <span className="max-w-32 truncate" title={formatFilterLabel(filter)}>
              {formatFilterLabel(filter)}
            </span>
            <button
              onClick={() => handleRemoveFilter(filter.id)}
              className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-black hover:bg-opacity-10 transition-colors"
              title="Remove filter"
            >
              <XMarkIcon className="h-3 w-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
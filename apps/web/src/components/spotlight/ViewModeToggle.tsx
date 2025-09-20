'use client'

import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useSpotlightStore } from '@/store/spotlight'

export function ViewModeToggle() {
  const { viewMode, setViewMode, performSearch } = useSpotlightStore()

  const handleViewModeChange = async (mode: 'hide_others' | 'dim_others') => {
    setViewMode(mode)
    await performSearch()
  }

  return (
    <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => handleViewModeChange('hide_others')}
        className={`flex items-center px-2 py-1 text-xs font-medium rounded-md transition-colors ${
          viewMode === 'hide_others'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        title="Hide non-matching events"
      >
        <EyeSlashIcon className="h-3.5 w-3.5 mr-1" />
        Hide Others
      </button>
      
      <button
        onClick={() => handleViewModeChange('dim_others')}
        className={`flex items-center px-2 py-1 text-xs font-medium rounded-md transition-colors ${
          viewMode === 'dim_others'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        title="Dim non-matching events"
      >
        <EyeIcon className="h-3.5 w-3.5 mr-1" />
        Dim Others
      </button>
    </div>
  )
}
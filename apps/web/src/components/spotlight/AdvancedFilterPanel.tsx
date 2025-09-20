'use client'

import { useState } from 'react'
import { XMarkIcon, CalendarIcon, MapPinIcon, UserIcon } from '@heroicons/react/24/outline'
import { useSpotlightStore } from '@/store/spotlight'
import { FilterChip } from '@/types/spotlight'

interface AdvancedFilterPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function AdvancedFilterPanel({ isOpen, onClose }: AdvancedFilterPanelProps) {
  const { addFilter, performSearch } = useSpotlightStore()
  
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [roomFilter, setRoomFilter] = useState('')
  const [teacherFilter, setTeacherFilter] = useState('')

  const handleApplyDateFilter = async () => {
    if (dateFrom || dateTo) {
      const filter: FilterChip = {
        id: `date-${Date.now()}`,
        label: `Date Range`,
        type: 'date',
        value: { from: dateFrom || undefined, to: dateTo || undefined },
        color: 'bg-gray-100 text-gray-800'
      }
      
      addFilter(filter)
      await performSearch()
      
      // Reset form
      setDateFrom('')
      setDateTo('')
    }
  }

  const handleApplyRoomFilter = async () => {
    if (roomFilter.trim()) {
      const filter: FilterChip = {
        id: `room-${Date.now()}`,
        label: roomFilter.trim(),
        type: 'room',
        value: roomFilter.trim(),
        color: 'bg-purple-100 text-purple-800'
      }
      
      addFilter(filter)
      await performSearch()
      setRoomFilter('')
    }
  }

  const handleApplyTeacherFilter = async () => {
    if (teacherFilter.trim()) {
      const filter: FilterChip = {
        id: `teacher-${Date.now()}`,
        label: teacherFilter.trim(),
        type: 'teacher',
        value: teacherFilter.trim(),
        color: 'bg-orange-100 text-orange-800'
      }
      
      addFilter(filter)
      await performSearch()
      setTeacherFilter('')
    }
  }

  if (!isOpen) return null

  return (
    <div className="absolute top-full left-0 right-0 z-40 mt-1">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">Advanced Filters</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Date Range Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              <CalendarIcon className="h-4 w-4 inline mr-2" />
              Date Range
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <button
              onClick={handleApplyDateFilter}
              disabled={!dateFrom && !dateTo}
              className="mt-2 px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Apply Date Filter
            </button>
          </div>

          {/* Room Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              <MapPinIcon className="h-4 w-4 inline mr-2" />
              Room
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                placeholder="Enter room number or name..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && handleApplyRoomFilter()}
              />
              <button
                onClick={handleApplyRoomFilter}
                disabled={!roomFilter.trim()}
                className="px-3 py-2 text-xs bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Teacher Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              <UserIcon className="h-4 w-4 inline mr-2" />
              Teacher
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={teacherFilter}
                onChange={(e) => setTeacherFilter(e.target.value)}
                placeholder="Enter teacher name..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && handleApplyTeacherFilter()}
              />
              <button
                onClick={handleApplyTeacherFilter}
                disabled={!teacherFilter.trim()}
                className="px-3 py-2 text-xs bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Use the search bar above for quick subject and section filtering, or use these advanced options for more specific criteria.
          </p>
        </div>
      </div>
    </div>
  )
}
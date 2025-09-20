'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  BookmarkIcon, 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  DocumentDuplicateIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { spotlightApi } from '@/lib/api'
import { useSpotlightStore } from '@/store/spotlight'
import { SpotlightQuery } from '@/types/spotlight'

interface SavedFilter {
  id: string
  name: string
  query: SpotlightQuery
}

interface SavedFiltersManagerProps {
  isOpen: boolean
  onClose: () => void
}

export function SavedFiltersManager({ isOpen, onClose }: SavedFiltersManagerProps) {
  const queryClient = useQueryClient()
  const { setQuery, performSearch } = useSpotlightStore()
  
  const [editingFilter, setEditingFilter] = useState<SavedFilter | null>(null)
  const [newFilterName, setNewFilterName] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)

  // Fetch saved filters
  const { data: savedFilters = [], isLoading } = useQuery({
    queryKey: ['saved-filters'],
    queryFn: () => spotlightApi.savedFilters.getAll(),
    enabled: isOpen,
  })

  // Create filter mutation
  const createFilterMutation = useMutation({
    mutationFn: (data: { name: string; query: SpotlightQuery }) => 
      spotlightApi.savedFilters.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-filters'] })
      setShowCreateForm(false)
      setNewFilterName('')
    },
  })

  // Update filter mutation
  const updateFilterMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string; query: SpotlightQuery } }) =>
      spotlightApi.savedFilters.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-filters'] })
      setEditingFilter(null)
    },
  })

  // Delete filter mutation
  const deleteFilterMutation = useMutation({
    mutationFn: (id: string) => spotlightApi.savedFilters.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-filters'] })
    },
  })

  // Duplicate filter mutation
  const duplicateFilterMutation = useMutation({
    mutationFn: ({ id, newName }: { id: string; newName: string }) =>
      spotlightApi.savedFilters.duplicate(id, newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-filters'] })
    },
  })

  const handleApplyFilter = async (filter: SavedFilter) => {
    setQuery(filter.query)
    await performSearch()
    onClose()
  }

  const handleSaveCurrentFilter = () => {
    const currentQuery = useSpotlightStore.getState().query
    
    if (!hasActiveFilters(currentQuery)) {
      alert('No active filters to save')
      return
    }

    if (!newFilterName.trim()) {
      alert('Please enter a filter name')
      return
    }

    createFilterMutation.mutate({
      name: newFilterName.trim(),
      query: currentQuery
    })
  }

  const handleUpdateFilter = () => {
    if (!editingFilter || !editingFilter.name.trim()) {
      return
    }

    updateFilterMutation.mutate({
      id: editingFilter.id,
      data: {
        name: editingFilter.name.trim(),
        query: editingFilter.query
      }
    })
  }

  const handleDuplicateFilter = (filter: SavedFilter) => {
    const newName = prompt('Enter name for duplicated filter:', `${filter.name} (Copy)`)
    if (newName?.trim()) {
      duplicateFilterMutation.mutate({
        id: filter.id,
        newName: newName.trim()
      })
    }
  }

  const handleDeleteFilter = (filter: SavedFilter) => {
    if (confirm(`Are you sure you want to delete "${filter.name}"?`)) {
      deleteFilterMutation.mutate(filter.id)
    }
  }

  const handleExportFilters = async () => {
    try {
      const filters = await spotlightApi.savedFilters.export()
      const dataStr = JSON.stringify(filters, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'spotlight-filters.json'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      alert('Failed to export filters')
    }
  }

  const handleImportFilters = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const filters = JSON.parse(e.target?.result as string)
        await spotlightApi.savedFilters.import(filters)
        queryClient.invalidateQueries({ queryKey: ['saved-filters'] })
        alert('Filters imported successfully')
      } catch (error) {
        alert('Failed to import filters. Please check the file format.')
      }
    }
    reader.readAsText(file)
  }

  const hasActiveFilters = (query: SpotlightQuery): boolean => {
    return !!(
      query.text?.trim() ||
      (query.subjectIds && query.subjectIds.length > 0) ||
      (query.sectionIds && query.sectionIds.length > 0) ||
      (query.secCodes && query.secCodes.length > 0) ||
      query.room?.trim() ||
      query.teacher?.trim() ||
      query.dateFrom ||
      query.dateTo
    )
  }

  const formatQuerySummary = (query: SpotlightQuery): string => {
    const parts = []
    if (query.text) parts.push(`Text: "${query.text}"`)
    if (query.subjectIds?.length) parts.push(`${query.subjectIds.length} subject(s)`)
    if (query.sectionIds?.length) parts.push(`${query.sectionIds.length} section(s)`)
    if (query.room) parts.push(`Room: "${query.room}"`)
    if (query.teacher) parts.push(`Teacher: "${query.teacher}"`)
    if (query.dateFrom || query.dateTo) parts.push('Date range')
    
    return parts.length > 0 ? parts.join(', ') : 'No filters'
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <BookmarkIcon className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Saved Filters</h2>
          </div>
          <div className="flex items-center space-x-2">
            {/* Export/Import buttons */}
            <button
              onClick={handleExportFilters}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-md transition-colors"
              title="Export filters"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
            </button>
            <label className="p-2 text-gray-400 hover:text-gray-600 rounded-md transition-colors cursor-pointer" title="Import filters">
              <ArrowUpTrayIcon className="h-5 w-5" />
              <input
                type="file"
                accept=".json"
                onChange={handleImportFilters}
                className="hidden"
              />
            </label>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-md transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-96">
          {/* Save Current Filter Form */}
          {showCreateForm ? (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="text-sm font-medium text-blue-900 mb-3">Save Current Filter</h3>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newFilterName}
                  onChange={(e) => setNewFilterName(e.target.value)}
                  placeholder="Enter filter name..."
                  className="flex-1 px-3 py-2 border border-blue-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveCurrentFilter()}
                />
                <button
                  onClick={handleSaveCurrentFilter}
                  disabled={createFilterMutation.isPending || !newFilterName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {createFilterMutation.isPending ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false)
                    setNewFilterName('')
                  }}
                  className="px-4 py-2 text-gray-600 text-sm rounded-md hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-6">
              <button
                onClick={() => setShowCreateForm(true)}
                disabled={!hasActiveFilters(useSpotlightStore.getState().query)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Save Current Filter
              </button>
            </div>
          )}

          {/* Filters List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : savedFilters.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <BookmarkIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No saved filters yet</p>
              <p className="text-sm">Create some filters and save them for quick access</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedFilters.map((filter: SavedFilter) => (
                <div key={filter.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  {editingFilter?.id === filter.id ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editingFilter.name}
                        onChange={(e) => setEditingFilter({ ...editingFilter, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateFilter()}
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={handleUpdateFilter}
                          disabled={updateFilterMutation.isPending}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
                        >
                          {updateFilterMutation.isPending ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingFilter(null)}
                          className="px-3 py-1 text-gray-600 text-sm rounded-md hover:bg-gray-100 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 mb-1">{filter.name}</h4>
                          <p className="text-sm text-gray-600">{formatQuerySummary(filter.query)}</p>
                        </div>
                        <div className="flex items-center space-x-1 ml-4">
                          <button
                            onClick={() => handleApplyFilter(filter)}
                            className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                            title="Apply filter"
                          >
                            Apply
                          </button>
                          <button
                            onClick={() => setEditingFilter(filter)}
                            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            title="Edit filter"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDuplicateFilter(filter)}
                            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            title="Duplicate filter"
                          >
                            <DocumentDuplicateIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteFilter(filter)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
                            title="Delete filter"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
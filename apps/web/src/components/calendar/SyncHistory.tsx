'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { syncApi } from '@/lib/api'

interface SyncHistoryEntry {
  id: string
  userId: string
  startedAt: string
  completedAt?: string
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  options: {
    direction: string
    range: { from: string; to: string }
    dryRun: boolean
  }
  result?: {
    summary: {
      created: number
      updated: number
      skipped: number
      failed: number
    }
    quotaUsed: number
    conflicts: number
  }
  error?: string
}

interface SyncHistoryProps {
  className?: string
}

export default function SyncHistory({ className = '' }: SyncHistoryProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<SyncHistoryEntry | null>(null)

  const { data: history = [], isLoading, error } = useQuery({
    queryKey: ['sync-history'],
    queryFn: async () => {
      const response = await syncApi.getHistory()
      return response.data as SyncHistoryEntry[]
    },
    enabled: isOpen, // Only fetch when panel is open
    refetchInterval: 5000, // Refresh every 5 seconds to show live updates
  })

  const getStatusIcon = (status: SyncHistoryEntry['status']) => {
    switch (status) {
      case 'completed':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'failed':
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )
      case 'pending':
        return (
          <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )
      case 'cancelled':
        return (
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
          </svg>
        )
      default:
        return null
    }
  }

  const getStatusColor = (status: SyncHistoryEntry['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-700 bg-green-100'
      case 'failed':
        return 'text-red-700 bg-red-100'
      case 'pending':
        return 'text-blue-700 bg-blue-100'
      case 'cancelled':
        return 'text-gray-700 bg-gray-100'
      default:
        return 'text-gray-700 bg-gray-100'
    }
  }

  const formatDuration = (startedAt: string, completedAt?: string) => {
    const start = new Date(startedAt)
    const end = completedAt ? new Date(completedAt) : new Date()
    const duration = Math.round((end.getTime() - start.getTime()) / 1000)
    
    if (duration < 60) return `${duration}s`
    if (duration < 3600) return `${Math.round(duration / 60)}m`
    return `${Math.round(duration / 3600)}h`
  }

  const formatSummary = (result?: SyncHistoryEntry['result']) => {
    if (!result) return 'No result'
    
    const { summary } = result
    const total = summary.created + summary.updated + summary.skipped + summary.failed
    
    if (total === 0) return 'No events processed'
    
    const parts = []
    if (summary.created > 0) parts.push(`${summary.created} created`)
    if (summary.updated > 0) parts.push(`${summary.updated} updated`)
    if (summary.skipped > 0) parts.push(`${summary.skipped} skipped`)
    if (summary.failed > 0) parts.push(`${summary.failed} failed`)
    
    return parts.join(', ')
  }

  return (
    <div className={`relative ${className}`}>
      {/* History Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Sync History
      </button>

      {/* History Panel */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Sync History</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" role="status" aria-label="Loading sync history"></div>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="text-center py-8">
                <div className="text-red-600 mb-2">Failed to load sync history</div>
                <div className="text-sm text-gray-500">{error.message}</div>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && history.length === 0 && (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-gray-600 mb-2">No sync history</div>
                <div className="text-sm text-gray-500">Your sync operations will appear here</div>
              </div>
            )}

            {/* History List */}
            {!isLoading && !error && history.length > 0 && (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedEntry(entry)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(entry.status)}
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(entry.status)}`}>
                          {entry.status}
                        </span>
                        {entry.options.dryRun && (
                          <span className="px-2 py-1 text-xs font-medium text-purple-700 bg-purple-100 rounded-full">
                            Dry Run
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDuration(entry.startedAt, entry.completedAt)}
                      </div>
                    </div>

                    <div className="text-sm text-gray-900 mb-1">
                      {new Date(entry.startedAt).toLocaleString()}
                    </div>

                    <div className="text-xs text-gray-600 mb-2">
                      Range: {entry.options.range.from} to {entry.options.range.to}
                    </div>

                    {entry.result && (
                      <div className="text-xs text-gray-600">
                        {formatSummary(entry.result)}
                        {entry.result.conflicts > 0 && (
                          <span className="ml-2 text-amber-600">
                            ({entry.result.conflicts} conflicts)
                          </span>
                        )}
                      </div>
                    )}

                    {entry.error && (
                      <div className="text-xs text-red-600 mt-1">
                        Error: {entry.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detailed Entry Modal */}
      {selectedEntry && (
        <SyncHistoryDetailModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </div>
  )
}

// Detailed Entry Modal Component
interface SyncHistoryDetailModalProps {
  entry: SyncHistoryEntry
  onClose: () => void
}

function SyncHistoryDetailModal({ entry, onClose }: SyncHistoryDetailModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">
              Sync Details
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-6 py-4 max-h-96 overflow-y-auto">
          {/* Basic Info */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Status:</span>
                <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${entry.status === 'completed' ? 'text-green-700 bg-green-100' : entry.status === 'failed' ? 'text-red-700 bg-red-100' : 'text-blue-700 bg-blue-100'}`}>
                  {entry.status}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Type:</span>
                <span className="ml-2 text-gray-900">
                  {entry.options.dryRun ? 'Dry Run' : 'Full Sync'}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Started:</span>
                <span className="ml-2 text-gray-900">
                  {new Date(entry.startedAt).toLocaleString()}
                </span>
              </div>
              {entry.completedAt && (
                <div>
                  <span className="text-gray-500">Completed:</span>
                  <span className="ml-2 text-gray-900">
                    {new Date(entry.completedAt).toLocaleString()}
                  </span>
                </div>
              )}
              <div>
                <span className="text-gray-500">Date Range:</span>
                <span className="ml-2 text-gray-900">
                  {entry.options.range.from} to {entry.options.range.to}
                </span>
              </div>
              {entry.result?.quotaUsed && (
                <div>
                  <span className="text-gray-500">Quota Used:</span>
                  <span className="ml-2 text-gray-900">
                    {entry.result.quotaUsed} API calls
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Results */}
          {entry.result && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Results</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-gray-500">Created:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {entry.result.summary.created}
                  </span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                  <span className="text-gray-500">Updated:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {entry.result.summary.updated}
                  </span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-gray-500 rounded-full mr-2"></div>
                  <span className="text-gray-500">Skipped:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {entry.result.summary.skipped}
                  </span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                  <span className="text-gray-500">Failed:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {entry.result.summary.failed}
                  </span>
                </div>
              </div>

              {entry.result.conflicts > 0 && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-amber-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="text-sm font-medium text-amber-800">
                      {entry.result.conflicts} conflicts detected
                    </span>
                  </div>
                  <p className="text-sm text-amber-700 mt-1">
                    Some events had conflicts that need manual resolution.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {entry.error && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Error Details</h3>
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700">{entry.error}</p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { syncApi } from '@/lib/api'

interface SyncOptions {
  direction: 'upsert-to-google'
  range: {
    from: string
    to: string
  }
  eventIds?: string[]
  dryRun?: boolean
  idempotencyKey: string
}

interface SyncResult {
  summary: {
    created: number
    updated: number
    skipped: number
    failed: number
  }
  details: SyncDetail[]
  conflicts: EventConflict[]
  quotaUsed: number
  isDryRun: boolean
}

interface SyncDetail {
  localEventId: string
  googleEventId?: string
  action: 'created' | 'updated' | 'skipped' | 'failed'
  error?: string
  etag?: string
}

interface EventConflict {
  localEventId: string
  googleEventId: string
  conflictType: 'etag_mismatch' | 'deleted_on_google' | 'modified_externally'
  localEvent: any
  googleEvent?: any
  suggestedResolution: {
    action: 'use_local' | 'use_google' | 'merge' | 'recreate' | 'unlink'
    reason: string
  }
}

interface SyncControlsProps {
  onSyncComplete?: (result: SyncResult) => void
  className?: string
}

export default function SyncControls({ onSyncComplete, className = '' }: SyncControlsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [syncOptions, setSyncOptions] = useState<Partial<SyncOptions>>({
    direction: 'upsert-to-google',
    range: {
      from: new Date().toISOString().split('T')[0],
      to: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 90 days
    },
    dryRun: false
  })
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)
  const [showConflictResolution, setShowConflictResolution] = useState(false)

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async (options: SyncOptions) => {
      const response = await syncApi.syncToGoogle({
        ...options,
        idempotencyKey: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      })
      return response.data as SyncResult
    },
    onSuccess: (result) => {
      setLastSyncResult(result)
      if (result?.conflicts?.length > 0) {
        setShowConflictResolution(true)
      }
      onSyncComplete?.(result)
    },
    onError: (error) => {
      console.error('Sync failed:', error)
    }
  })

  // Get sync history
  const { data: syncHistory } = useQuery({
    queryKey: ['sync-history'],
    queryFn: () => syncApi.getHistory(),
    enabled: false // Only fetch when needed
  })

  const handleSync = () => {
    if (!syncOptions.range?.from || !syncOptions.range?.to) {
      return
    }

    syncMutation.mutate({
      direction: 'upsert-to-google',
      range: syncOptions.range,
      eventIds: syncOptions.eventIds,
      dryRun: syncOptions.dryRun || false,
      idempotencyKey: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    })
  }

  const handleDryRun = () => {
    if (!syncOptions.range?.from || !syncOptions.range?.to) {
      return
    }

    syncMutation.mutate({
      direction: 'upsert-to-google',
      range: syncOptions.range,
      eventIds: syncOptions.eventIds,
      dryRun: true,
      idempotencyKey: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    })
  }

  const formatSyncSummary = (result: SyncResult) => {
    if (!result || !result.summary) return 'No result'
    
    const { summary } = result
    const total = summary.created + summary.updated + summary.skipped + summary.failed
    
    if (total === 0) return 'No events to sync'
    
    const parts = []
    if (summary.created > 0) parts.push(`${summary.created} created`)
    if (summary.updated > 0) parts.push(`${summary.updated} updated`)
    if (summary.skipped > 0) parts.push(`${summary.skipped} skipped`)
    if (summary.failed > 0) parts.push(`${summary.failed} failed`)
    
    return parts.join(', ')
  }

  return (
    <div className={`relative ${className}`}>
      {/* Sync Button */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={syncMutation.isPending}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {syncMutation.isPending ? (
            <>
              <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Syncing...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sync to Google
            </>
          )}
        </button>

        {/* Progress indicator */}
        {syncMutation.isPending && (
          <div className="text-sm text-gray-600">
            Syncing events...
          </div>
        )}

        {/* Last sync result */}
        {lastSyncResult && !syncMutation.isPending && (
          <div className="text-sm text-gray-600">
            {lastSyncResult.isDryRun ? 'Dry run: ' : 'Last sync: '}
            {formatSyncSummary(lastSyncResult)}
            {lastSyncResult.conflicts && lastSyncResult.conflicts.length > 0 && (
              <span className="ml-2 text-amber-600">
                ({lastSyncResult.conflicts.length} conflicts)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Sync Options Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Sync Options</h3>
            
            {/* Date Range */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Range
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="sync-from-date" className="block text-xs text-gray-500 mb-1">From</label>
                  <input
                    id="sync-from-date"
                    type="date"
                    value={syncOptions.range?.from || ''}
                    onChange={(e) => setSyncOptions(prev => ({
                      ...prev,
                      range: { ...prev.range!, from: e.target.value }
                    }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="sync-to-date" className="block text-xs text-gray-500 mb-1">To</label>
                  <input
                    id="sync-to-date"
                    type="date"
                    value={syncOptions.range?.to || ''}
                    onChange={(e) => setSyncOptions(prev => ({
                      ...prev,
                      range: { ...prev.range!, to: e.target.value }
                    }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Quick Date Presets */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick Presets
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'This Month', days: 30 },
                  { label: 'Next 3 Months', days: 90 },
                  { label: 'This Semester', days: 120 },
                  { label: 'Full Year', days: 365 }
                ].map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      const from = new Date().toISOString().split('T')[0]
                      const to = new Date(Date.now() + preset.days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                      setSyncOptions(prev => ({ ...prev, range: { from, to } }))
                    }}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="flex space-x-2">
                <button
                  onClick={handleDryRun}
                  disabled={syncMutation.isPending}
                  className="px-3 py-2 text-sm text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
                >
                  Preview Changes
                </button>
                <button
                  onClick={handleSync}
                  disabled={syncMutation.isPending || !syncOptions.range?.from || !syncOptions.range?.to}
                  className="px-3 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sync Now
                </button>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Resolution Modal */}
      {showConflictResolution && lastSyncResult?.conflicts && (
        <ConflictResolutionModal
          conflicts={lastSyncResult.conflicts}
          onResolve={(resolutions) => {
            // Handle conflict resolutions
            setShowConflictResolution(false)
          }}
          onClose={() => setShowConflictResolution(false)}
        />
      )}
    </div>
  )
}

// Conflict Resolution Modal Component
interface ConflictResolutionModalProps {
  conflicts: EventConflict[]
  onResolve: (resolutions: Array<{ action: string; reason?: string }>) => void
  onClose: () => void
}

function ConflictResolutionModal({ conflicts, onResolve, onClose }: ConflictResolutionModalProps) {
  const [resolutions, setResolutions] = useState<Array<{ action: string; reason?: string }>>(
    conflicts.map(conflict => ({
      action: conflict.suggestedResolution.action,
      reason: conflict.suggestedResolution.reason
    }))
  )

  const handleResolutionChange = (index: number, action: string) => {
    setResolutions(prev => prev.map((res, i) => 
      i === index ? { ...res, action } : res
    ))
  }

  const getConflictDescription = (conflict: EventConflict) => {
    switch (conflict.conflictType) {
      case 'etag_mismatch':
        return 'Event was modified both locally and on Google Calendar'
      case 'deleted_on_google':
        return 'Event was deleted on Google Calendar but exists locally'
      case 'modified_externally':
        return 'Event was modified externally on Google Calendar'
      default:
        return 'Unknown conflict type'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Resolve Sync Conflicts ({conflicts.length})
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Some events have conflicts that need your attention before syncing can continue.
          </p>
        </div>

        <div className="px-6 py-4 max-h-96 overflow-y-auto">
          {conflicts.map((conflict, index) => (
            <div key={conflict.localEventId} className="mb-6 p-4 border border-gray-200 rounded-lg">
              <div className="mb-3">
                <h3 className="font-medium text-gray-900">
                  {conflict.localEvent.title || `${conflict.localEvent.subject?.name} - ${conflict.localEvent.section?.name}`}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {getConflictDescription(conflict)}
                </p>
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Resolution Action
                </label>
                <select
                  value={resolutions[index]?.action || ''}
                  onChange={(e) => handleResolutionChange(index, e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="use_local">Use Local Version</option>
                  <option value="use_google">Use Google Version</option>
                  <option value="merge">Merge Changes</option>
                  <option value="recreate">Recreate Event</option>
                  <option value="unlink">Unlink from Google</option>
                </select>
              </div>

              <div className="text-xs text-gray-500">
                <strong>Suggested:</strong> {conflict.suggestedResolution.reason}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={() => onResolve(resolutions)}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Apply Resolutions
          </button>
        </div>
      </div>
    </div>
  )
}
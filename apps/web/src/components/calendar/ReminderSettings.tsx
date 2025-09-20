'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { reminderApi } from '@/lib/api'

interface ReminderSettings {
  enabled: boolean
  minutes: number
  method: 'email' | 'popup'
}

interface UserReminderPreferences {
  userId: string
  globalDefault: ReminderSettings
  subjectSettings: Record<string, ReminderSettings>
}

interface ReminderPreset {
  label: string
  minutes: number
  method: 'email' | 'popup'
}

interface ReminderSettingsProps {
  isOpen: boolean
  onClose: () => void
  subjectId?: string
  subjectName?: string
}

export default function ReminderSettings({ 
  isOpen, 
  onClose, 
  subjectId, 
  subjectName 
}: ReminderSettingsProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'global' | 'subject'>('global')
  const [globalSettings, setGlobalSettings] = useState<ReminderSettings>({
    enabled: true,
    minutes: 15,
    method: 'popup'
  })
  const [subjectSettings, setSubjectSettings] = useState<ReminderSettings>({
    enabled: true,
    minutes: 15,
    method: 'popup'
  })

  // Get user reminder preferences
  const { data: preferences, isLoading } = useQuery({
    queryKey: ['reminder-preferences'],
    queryFn: () => reminderApi.getUserPreferences(),
    enabled: isOpen
  })

  // Get reminder presets
  const { data: presets = [] } = useQuery({
    queryKey: ['reminder-presets'],
    queryFn: () => reminderApi.getPresets(),
    enabled: isOpen
  })

  // Get subject-specific settings if subjectId is provided
  const { data: currentSubjectSettings } = useQuery({
    queryKey: ['subject-reminder-settings', subjectId],
    queryFn: () => reminderApi.getSubjectSettings(subjectId!),
    enabled: isOpen && !!subjectId
  })

  // Update global preferences mutation
  const updateGlobalMutation = useMutation({
    mutationFn: (settings: ReminderSettings) => 
      reminderApi.updateUserPreferences({ globalDefault: settings }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminder-preferences'] })
    }
  })

  // Update subject preferences mutation
  const updateSubjectMutation = useMutation({
    mutationFn: (settings: ReminderSettings) => 
      reminderApi.updateSubjectSettings(subjectId!, settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminder-preferences'] })
      queryClient.invalidateQueries({ queryKey: ['subject-reminder-settings', subjectId] })
    }
  })

  // Bulk update subject events mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: (settings: ReminderSettings) => 
      reminderApi.bulkUpdateSubjectReminders(subjectId!, settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminder-preferences'] })
    }
  })

  // Initialize settings when data loads
  useEffect(() => {
    if (preferences) {
      setGlobalSettings(preferences.data.globalDefault)
      if (subjectId && preferences.data.subjectSettings[subjectId]) {
        setSubjectSettings(preferences.data.subjectSettings[subjectId])
      }
    }
  }, [preferences, subjectId])

  useEffect(() => {
    if (currentSubjectSettings) {
      setSubjectSettings(currentSubjectSettings.data)
    }
  }, [currentSubjectSettings])

  // Set active tab based on whether we have a subject
  useEffect(() => {
    if (subjectId) {
      setActiveTab('subject')
    }
  }, [subjectId])

  const handleGlobalSave = () => {
    updateGlobalMutation.mutate(globalSettings)
  }

  const handleSubjectSave = () => {
    if (!subjectId) return
    updateSubjectMutation.mutate(subjectSettings)
  }

  const handleBulkUpdate = () => {
    if (!subjectId) return
    bulkUpdateMutation.mutate(subjectSettings)
  }

  const applyPreset = (preset: ReminderPreset, target: 'global' | 'subject') => {
    const newSettings = {
      enabled: true,
      minutes: preset.minutes,
      method: preset.method
    }

    if (target === 'global') {
      setGlobalSettings(newSettings)
    } else {
      setSubjectSettings(newSettings)
    }
  }

  const formatMinutesToText = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60)
      return `${hours} hour${hours !== 1 ? 's' : ''}`
    } else {
      const days = Math.floor(minutes / 1440)
      return `${days} day${days !== 1 ? 's' : ''}`
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">
              Reminder Settings
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close reminder settings"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('global')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'global'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Global Default
            </button>
            {subjectId && (
              <button
                onClick={() => setActiveTab('subject')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'subject'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {subjectName || 'Subject Settings'}
              </button>
            )}
          </nav>
        </div>

        <div className="px-6 py-4 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" role="status" aria-label="Loading reminder settings"></div>
            </div>
          ) : (
            <>
              {/* Global Settings Tab */}
              {activeTab === 'global' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3">
                      Default Reminder Settings
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      These settings will be applied to all new events unless overridden by subject-specific settings.
                    </p>
                  </div>

                  <ReminderForm
                    settings={globalSettings}
                    onChange={setGlobalSettings}
                    presets={presets}
                    onApplyPreset={(preset) => applyPreset(preset, 'global')}
                  />

                  <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleGlobalSave}
                      disabled={updateGlobalMutation.isPending}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {updateGlobalMutation.isPending ? 'Saving...' : 'Save Global Settings'}
                    </button>
                  </div>
                </div>
              )}

              {/* Subject Settings Tab */}
              {activeTab === 'subject' && subjectId && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3">
                      {subjectName} Reminder Settings
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      These settings will override the global default for all events in this subject.
                    </p>
                  </div>

                  <ReminderForm
                    settings={subjectSettings}
                    onChange={setSubjectSettings}
                    presets={presets}
                    onApplyPreset={(preset) => applyPreset(preset, 'subject')}
                  />

                  <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                    <div className="flex">
                      <svg className="w-5 h-5 text-amber-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <div>
                        <h4 className="text-sm font-medium text-amber-800">
                          Update Existing Events
                        </h4>
                        <p className="text-sm text-amber-700 mt-1">
                          You can apply these reminder settings to all existing events in this subject that are already synced to Google Calendar.
                        </p>
                        <button
                          onClick={handleBulkUpdate}
                          disabled={bulkUpdateMutation.isPending}
                          className="mt-2 px-3 py-1 text-xs font-medium text-amber-800 bg-amber-100 border border-amber-300 rounded-md hover:bg-amber-200 disabled:opacity-50"
                        >
                          {bulkUpdateMutation.isPending ? 'Updating...' : 'Update All Existing Events'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubjectSave}
                      disabled={updateSubjectMutation.isPending}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {updateSubjectMutation.isPending ? 'Saving...' : 'Save Subject Settings'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Reminder Form Component
interface ReminderFormProps {
  settings: ReminderSettings
  onChange: (settings: ReminderSettings) => void
  presets: ReminderPreset[]
  onApplyPreset: (preset: ReminderPreset) => void
}

function ReminderForm({ settings, onChange, presets, onApplyPreset }: ReminderFormProps) {
  const formatMinutesToText = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60)
      return `${hours} hour${hours !== 1 ? 's' : ''}`
    } else {
      const days = Math.floor(minutes / 1440)
      return `${days} day${days !== 1 ? 's' : ''}`
    }
  }

  return (
    <div className="space-y-4">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-gray-900">
            Enable Reminders
          </label>
          <p className="text-sm text-gray-600">
            Turn reminders on or off for events
          </p>
        </div>
        <button
          onClick={() => onChange({ ...settings, enabled: !settings.enabled })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings.enabled ? 'bg-blue-600' : 'bg-gray-200'
          }`}
          aria-label="Toggle reminders"
          role="switch"
          aria-checked={settings.enabled}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {settings.enabled && (
        <>
          {/* Reminder Time */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Remind me
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="1"
                max="40320"
                value={settings.minutes}
                onChange={(e) => onChange({ ...settings, minutes: parseInt(e.target.value) || 15 })}
                className="w-20 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="text-sm text-gray-600">
                minutes before ({formatMinutesToText(settings.minutes)} before)
              </span>
            </div>
          </div>

          {/* Reminder Method */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Reminder Method
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="popup"
                  checked={settings.method === 'popup'}
                  onChange={(e) => onChange({ ...settings, method: e.target.value as 'popup' | 'email' })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">Popup notification</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="email"
                  checked={settings.method === 'email'}
                  onChange={(e) => onChange({ ...settings, method: e.target.value as 'popup' | 'email' })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">Email notification</span>
              </label>
            </div>
          </div>

          {/* Quick Presets */}
          {presets.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Quick Presets
              </label>
              <div className="grid grid-cols-2 gap-2">
                {presets.map((preset, index) => (
                  <button
                    key={index}
                    onClick={() => onApplyPreset(preset)}
                    className="px-3 py-2 text-sm text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
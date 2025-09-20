'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { subjectsApi, sectionsApi, eventsApi } from '@/lib/api'

interface QuickAddFormData {
  subjectName: string
  subjectCode?: string
  subjectColor: string
  sectionCode: string
  teacher?: string
  room?: string
  dayOfWeek: number
  startTime: string
  endTime: string
  startDate: string
  endDate: string
  skipDates?: string[]
}

interface QuickAddClassProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

const DEFAULT_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
]

export default function QuickAddClass({ isOpen, onClose, onSuccess }: QuickAddClassProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [skipDateInput, setSkipDateInput] = useState('')
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors }
  } = useForm<QuickAddFormData>({
    defaultValues: {
      subjectColor: DEFAULT_COLORS[0],
      dayOfWeek: 1, // Monday
      startTime: '09:00',
      endTime: '10:30',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 4 months from now
      skipDates: []
    }
  })

  const skipDates = watch('skipDates') || []

  const createClassMutation = useMutation({
    mutationFn: async (data: QuickAddFormData) => {
      // Use the quick-add endpoint that handles everything in one call
      const quickAddData = {
        subjectName: data.subjectName,
        subjectCode: data.subjectCode,
        subjectColor: data.subjectColor,
        sectionCode: data.sectionCode,
        teacher: data.teacher,
        room: data.room,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        startDate: data.startDate,
        endDate: data.endDate,
        skipDates: data.skipDates || []
      }

      const response = await subjectsApi.quickAdd(quickAddData)
      return response.data || response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['subjects'] })
      queryClient.invalidateQueries({ queryKey: ['sections'] })
      reset()
      onSuccess?.()
      onClose()
    },
    onError: (error) => {
      console.error('Failed to create class:', error)
    }
  })

  const onSubmit = async (data: QuickAddFormData) => {
    setIsSubmitting(true)
    try {
      await createClassMutation.mutateAsync(data)
    } finally {
      setIsSubmitting(false)
    }
  }

  const addSkipDate = () => {
    if (skipDateInput && !skipDates.includes(skipDateInput)) {
      setValue('skipDates', [...skipDates, skipDateInput])
      setSkipDateInput('')
    }
  }

  const removeSkipDate = (dateToRemove: string) => {
    setValue('skipDates', skipDates.filter(date => date !== dateToRemove))
  }

  const validateTimeRange = (endTime: string) => {
    const startTime = watch('startTime')
    if (!startTime || !endTime) return true
    
    const start = new Date(`2000-01-01T${startTime}:00`)
    const end = new Date(`2000-01-01T${endTime}:00`)
    
    return end > start || 'End time must be after start time'
  }

  const validateDateRange = (endDate: string) => {
    const startDate = watch('startDate')
    if (!startDate || !endDate) return true
    
    return new Date(endDate) >= new Date(startDate) || 'End date must be on or after start date'
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Quick Add Class</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={isSubmitting}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {/* Subject Information */}
          <div className="space-y-4">
            <h3 className="text-md font-medium text-gray-900">Subject Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="subjectName" className="block text-sm font-medium text-gray-700 mb-1">
                  Subject Name *
                </label>
                <input
                  {...register('subjectName', { 
                    required: 'Subject name is required',
                    maxLength: { value: 100, message: 'Subject name must be 100 characters or less' }
                  })}
                  id="subjectName"
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Software Project Management"
                />
                {errors.subjectName && (
                  <p className="mt-1 text-sm text-red-600">{errors.subjectName.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="subjectCode" className="block text-sm font-medium text-gray-700 mb-1">
                  Subject Code
                </label>
                <input
                  {...register('subjectCode', {
                    maxLength: { value: 20, message: 'Subject code must be 20 characters or less' }
                  })}
                  id="subjectCode"
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., SPM, 960200"
                />
                {errors.subjectCode && (
                  <p className="mt-1 text-sm text-red-600">{errors.subjectCode.message}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="subjectColor" className="block text-sm font-medium text-gray-700 mb-1">
                Subject Color *
              </label>
              <div className="flex items-center space-x-2">
                <Controller
                  name="subjectColor"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="color"
                      className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                    />
                  )}
                />
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setValue('subjectColor', color)}
                      className="w-6 h-6 rounded border-2 border-gray-300 hover:border-gray-400"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section Information */}
          <div className="space-y-4">
            <h3 className="text-md font-medium text-gray-900">Section Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="sectionCode" className="block text-sm font-medium text-gray-700 mb-1">
                  Section Code *
                </label>
                <input
                  {...register('sectionCode', { 
                    required: 'Section code is required',
                    maxLength: { value: 20, message: 'Section code must be 20 characters or less' }
                  })}
                  id="sectionCode"
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 001, A, Sec.01"
                />
                {errors.sectionCode && (
                  <p className="mt-1 text-sm text-red-600">{errors.sectionCode.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="teacher" className="block text-sm font-medium text-gray-700 mb-1">
                  Teacher
                </label>
                <input
                  {...register('teacher', {
                    maxLength: { value: 100, message: 'Teacher name must be 100 characters or less' }
                  })}
                  id="teacher"
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Dr. Smith"
                />
                {errors.teacher && (
                  <p className="mt-1 text-sm text-red-600">{errors.teacher.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="room" className="block text-sm font-medium text-gray-700 mb-1">
                  Room
                </label>
                <input
                  {...register('room', {
                    maxLength: { value: 50, message: 'Room must be 50 characters or less' }
                  })}
                  id="room"
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., A101, Lab 1"
                />
                {errors.room && (
                  <p className="mt-1 text-sm text-red-600">{errors.room.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Schedule Information */}
          <div className="space-y-4">
            <h3 className="text-md font-medium text-gray-900">Schedule Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="dayOfWeek" className="block text-sm font-medium text-gray-700 mb-1">
                  Day of Week *
                </label>
                <Controller
                  name="dayOfWeek"
                  control={control}
                  rules={{ required: 'Day of week is required' }}
                  render={({ field }) => (
                    <select
                      {...field}
                      id="dayOfWeek"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {DAYS_OF_WEEK.map((day) => (
                        <option key={day.value} value={day.value}>
                          {day.label}
                        </option>
                      ))}
                    </select>
                  )}
                />
                {errors.dayOfWeek && (
                  <p className="mt-1 text-sm text-red-600">{errors.dayOfWeek.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time *
                </label>
                <input
                  {...register('startTime', { 
                    required: 'Start time is required',
                    pattern: {
                      value: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
                      message: 'Start time must be in HH:MM format'
                    }
                  })}
                  id="startTime"
                  type="time"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {errors.startTime && (
                  <p className="mt-1 text-sm text-red-600">{errors.startTime.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-1">
                  End Time *
                </label>
                <input
                  {...register('endTime', { 
                    required: 'End time is required',
                    pattern: {
                      value: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
                      message: 'End time must be in HH:MM format'
                    },
                    validate: validateTimeRange
                  })}
                  id="endTime"
                  type="time"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {errors.endTime && (
                  <p className="mt-1 text-sm text-red-600">{errors.endTime.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date *
                </label>
                <input
                  {...register('startDate', { 
                    required: 'Start date is required'
                  })}
                  id="startDate"
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {errors.startDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.startDate.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                  End Date *
                </label>
                <input
                  {...register('endDate', { 
                    required: 'End date is required',
                    validate: validateDateRange
                  })}
                  id="endDate"
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {errors.endDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.endDate.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Skip Dates */}
          <div className="space-y-4">
            <h3 className="text-md font-medium text-gray-900">Skip Dates (Optional)</h3>
            <p className="text-sm text-gray-600">Add dates when this class should be skipped (e.g., holidays, breaks)</p>
            
            <div className="flex gap-2">
              <input
                type="date"
                value={skipDateInput}
                onChange={(e) => setSkipDateInput(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Select date to skip"
              />
              <button
                type="button"
                onClick={addSkipDate}
                disabled={!skipDateInput}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>

            {skipDates.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Skip dates:</p>
                <div className="flex flex-wrap gap-2">
                  {skipDates.map((date) => (
                    <div
                      key={date}
                      className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-sm"
                    >
                      <span>{new Date(date).toLocaleDateString()}</span>
                      <button
                        type="button"
                        onClick={() => removeSkipDate(date)}
                        className="text-gray-500 hover:text-red-500"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {isSubmitting ? 'Creating Class...' : 'Create Class'}
            </button>
          </div>
        </form>

        {createClassMutation.error && (
          <div className="px-6 pb-4">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Failed to create class
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    {createClassMutation.error.message}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
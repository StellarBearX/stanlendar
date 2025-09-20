import { Metadata } from 'next'
import CalendarDashboard from '@/components/calendar/CalendarDashboard'

export const metadata: Metadata = {
  title: 'Dashboard - Class Schedule Sync',
  description: 'View and manage your class schedule',
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Class Schedule</h1>
            <p className="mt-2 text-sm text-gray-600">
              View and manage your academic calendar
            </p>
          </div>
          <CalendarDashboard />
        </div>
      </div>
    </div>
  )
}
import { Metadata } from 'next'
import SettingsForm from '@/components/settings/SettingsForm'

export const metadata: Metadata = {
  title: 'Settings - Class Schedule Sync',
  description: 'Manage your account and sync preferences',
}

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            <p className="mt-2 text-sm text-gray-600">
              Manage your account and synchronization preferences
            </p>
          </div>
          <SettingsForm />
        </div>
      </div>
    </div>
  )
}
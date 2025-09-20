import { Metadata } from 'next'
import { Suspense } from 'react'
import AuthCallback from '@/components/auth/AuthCallback'

export const metadata: Metadata = {
  title: 'Authenticating - Class Schedule Sync',
  description: 'Completing authentication...',
}

export default function CallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Completing authentication...
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Please wait while we set up your account
          </p>
        </div>
        <Suspense fallback={
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="text-sm text-gray-600 mt-4">Loading...</p>
          </div>
        }>
          <AuthCallback />
        </Suspense>
      </div>
    </div>
  )
}
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { authApi, apiClient } from '@/lib/api'

export default function AuthCallback() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setAuth, setLoading } = useAuthStore()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        setLoading(true)
        
        // Get parameters from URL
        const code = searchParams.get('code')
        const state = searchParams.get('state')
        const error = searchParams.get('error')
        
        if (error) {
          throw new Error(`OAuth error: ${error}`)
        }
        
        if (!code || !state) {
          throw new Error('Missing authorization code or state parameter')
        }
        
        // Verify state parameter
        const storedState = sessionStorage.getItem('oauth_state')
        if (state !== storedState) {
          throw new Error('Invalid state parameter')
        }
        
        // Get code verifier
        const codeVerifier = sessionStorage.getItem('code_verifier')
        if (!codeVerifier) {
          throw new Error('Missing code verifier')
        }
        
        // Exchange code for tokens
        const response = await authApi.login({
          code,
          codeVerifier,
          redirectUri: `${window.location.origin}/callback`,
        }) as { user: any; accessToken: string }
        
        // Set authentication state
        setAuth(response.user, response.accessToken)
        apiClient.setToken(response.accessToken)
        
        // Clean up session storage
        sessionStorage.removeItem('code_verifier')
        sessionStorage.removeItem('oauth_state')
        
        // Redirect to dashboard
        router.push('/dashboard')
        
      } catch (error) {
        console.error('Authentication failed:', error)
        setError(error instanceof Error ? error.message : 'Authentication failed')
        setLoading(false)
      }
    }

    handleCallback()
  }, [searchParams, router, setAuth, setLoading])

  if (error) {
    return (
      <div className="text-center">
        <div className="mb-4">
          <svg
            className="mx-auto h-12 w-12 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Authentication Failed
        </h3>
        <p className="text-sm text-gray-600 mb-4">{error}</p>
        <button
          onClick={() => router.push('/login')}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className="text-center">
      <div className="mb-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
      </div>
      <p className="text-sm text-gray-600">
        Setting up your account...
      </p>
    </div>
  )
}
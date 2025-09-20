'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { apiClient } from '@/lib/api'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter()
  const { isAuthenticated, token, setLoading, clearAuth } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated || !token) {
      router.push('/login')
      return
    }

    // Set token in API client
    apiClient.setToken(token)

    // Verify token is still valid
    const verifyAuth = async () => {
      try {
        setLoading(true)
        // This will throw if token is invalid
        await apiClient.get('/api/auth/me')
      } catch (error) {
        console.error('Token verification failed:', error)
        clearAuth()
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    verifyAuth()
  }, [isAuthenticated, token, router, setLoading, clearAuth])

  if (!isAuthenticated || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
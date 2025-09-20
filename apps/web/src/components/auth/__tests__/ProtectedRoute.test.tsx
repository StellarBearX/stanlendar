import { render, screen } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '../ProtectedRoute'
import { useAuthStore } from '@/store/auth'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock auth store
jest.mock('@/store/auth', () => ({
  useAuthStore: jest.fn(),
}))

// Mock API client
jest.mock('@/lib/api', () => ({
  apiClient: {
    setToken: jest.fn(),
    get: jest.fn(),
  },
}))

const mockPush = jest.fn()
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>

describe('ProtectedRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseRouter.mockReturnValue({
      push: mockPush,
    } as any)
  })

  it('redirects to login when not authenticated', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      token: null,
      setLoading: jest.fn(),
      clearAuth: jest.fn(),
    } as any)

    render(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>
    )

    expect(mockPush).toHaveBeenCalledWith('/login')
    expect(screen.getByText('Redirecting to login...')).toBeInTheDocument()
  })

  it('shows loading spinner when not authenticated', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      token: null,
      setLoading: jest.fn(),
      clearAuth: jest.fn(),
    } as any)

    render(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>
    )

    expect(screen.getByText('Redirecting to login...')).toBeInTheDocument()
  })

  it('renders children when authenticated', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      token: 'valid-token',
      setLoading: jest.fn(),
      clearAuth: jest.fn(),
    } as any)

    render(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>
    )

    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })
})
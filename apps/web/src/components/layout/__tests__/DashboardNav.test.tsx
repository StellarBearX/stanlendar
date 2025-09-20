import { render, screen, fireEvent } from '@testing-library/react'
import { usePathname, useRouter } from 'next/navigation'
import DashboardNav from '../DashboardNav'
import { useAuthStore } from '@/store/auth'

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}))

// Mock auth store
jest.mock('@/store/auth', () => ({
  useAuthStore: jest.fn(),
}))

// Mock API
jest.mock('@/lib/api', () => ({
  authApi: {
    logout: jest.fn(),
  },
}))

const mockPush = jest.fn()
const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>

describe('DashboardNav', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseRouter.mockReturnValue({
      push: mockPush,
    } as any)
    mockUseAuthStore.mockReturnValue({
      user: {
        id: '1',
        email: 'test@example.com',
        displayName: 'Test User',
      },
      clearAuth: jest.fn(),
    } as any)
  })

  it('renders navigation items', () => {
    mockUsePathname.mockReturnValue('/dashboard')
    
    render(<DashboardNav />)
    
    expect(screen.getByText('Class Schedule Sync')).toBeInTheDocument()
    expect(screen.getByText('Calendar')).toBeInTheDocument()
    expect(screen.getByText('Import')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('highlights active navigation item', () => {
    mockUsePathname.mockReturnValue('/dashboard/import')
    
    render(<DashboardNav />)
    
    const importLink = screen.getByText('Import').closest('a')
    expect(importLink).toHaveClass('border-primary-500', 'text-gray-900')
  })

  it('displays user information', () => {
    mockUsePathname.mockReturnValue('/dashboard')
    
    render(<DashboardNav />)
    
    expect(screen.getByText('Test User')).toBeInTheDocument()
  })

  it('handles logout when logout button is clicked', async () => {
    mockUsePathname.mockReturnValue('/dashboard')
    const mockClearAuth = jest.fn()
    mockUseAuthStore.mockReturnValue({
      user: {
        id: '1',
        email: 'test@example.com',
        displayName: 'Test User',
      },
      clearAuth: mockClearAuth,
    } as any)
    
    render(<DashboardNav />)
    
    const logoutButton = screen.getByRole('button', { name: /logout/i })
    fireEvent.click(logoutButton)
    
    expect(mockClearAuth).toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/login')
  })
})
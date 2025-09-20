import { render, screen, fireEvent } from '@testing-library/react'
import LoginForm from '../LoginForm'

// Mock window.location
delete (window as any).location
;(window as any).location = {
  href: '',
  origin: 'http://localhost:3000',
}

// Mock sessionStorage
const mockSessionStorage = {
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}
Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
})

// Mock crypto
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: jest.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256)
      }
      return arr
    }),
    subtle: {
      digest: jest.fn(() => Promise.resolve(new ArrayBuffer(32))),
    },
  },
})

// Mock btoa
global.btoa = jest.fn((str) => Buffer.from(str, 'binary').toString('base64'))

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(window as any).location.href = ''
  })

  it('renders login form with Google sign-in button', () => {
    render(<LoginForm />)
    
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument()
    expect(screen.getByText(/By signing in, you agree to sync/)).toBeInTheDocument()
  })

  it('shows loading state when button is clicked', async () => {
    render(<LoginForm />)
    
    const button = screen.getByRole('button', { name: /Sign in with Google/ })
    fireEvent.click(button)
    
    expect(screen.getByText('Signing in...')).toBeInTheDocument()
    expect(button).toBeDisabled()
  })

  it('generates PKCE parameters and redirects to Google OAuth', async () => {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = 'test-client-id'
    
    render(<LoginForm />)
    
    const button = screen.getByRole('button', { name: /Sign in with Google/ })
    fireEvent.click(button)
    
    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 100))
    
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith('code_verifier', expect.any(String))
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith('oauth_state', expect.any(String))
    
    expect((window as any).location.href).toContain('https://accounts.google.com/o/oauth2/v2/auth')
    expect((window as any).location.href).toContain('client_id=test-client-id')
    expect((window as any).location.href).toContain('code_challenge_method=S256')
  })
})
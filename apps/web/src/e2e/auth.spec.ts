import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies()
    await page.evaluate(() => localStorage.clear())
    await page.evaluate(() => sessionStorage.clear())
  })

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/')
    
    // Should redirect to login page
    await expect(page).toHaveURL('/login')
    
    // Should show login form
    await expect(page.getByText('Sign in to your account')).toBeVisible()
    await expect(page.getByText('Sign in with Google')).toBeVisible()
  })

  test('should show login page elements', async ({ page }) => {
    await page.goto('/login')
    
    // Check page title and description
    await expect(page.getByText('Sign in to your account')).toBeVisible()
    await expect(page.getByText('Connect your Google Calendar to get started')).toBeVisible()
    
    // Check Google sign-in button
    const signInButton = page.getByRole('button', { name: /sign in with google/i })
    await expect(signInButton).toBeVisible()
    await expect(signInButton).toBeEnabled()
    
    // Check privacy notice
    await expect(page.getByText(/by signing in, you agree to sync/i)).toBeVisible()
  })

  test('should handle Google OAuth initiation', async ({ page }) => {
    await page.goto('/login')
    
    // Mock the OAuth redirect to prevent actual Google OAuth
    await page.route('https://accounts.google.com/o/oauth2/v2/auth*', async route => {
      // Simulate successful OAuth callback
      const url = new URL(route.request().url())
      const redirectUri = url.searchParams.get('redirect_uri')
      const state = url.searchParams.get('state')
      
      if (redirectUri && state) {
        await route.fulfill({
          status: 302,
          headers: {
            'Location': `${redirectUri}?code=mock_auth_code&state=${state}`
          }
        })
      } else {
        await route.continue()
      }
    })
    
    // Mock the API auth endpoint
    await page.route('/api/auth/google', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: '1',
            email: 'test@example.com',
            displayName: 'Test User'
          },
          accessToken: 'mock_access_token'
        })
      })
    })
    
    // Click the Google sign-in button
    const signInButton = page.getByRole('button', { name: /sign in with google/i })
    await signInButton.click()
    
    // Should show loading state
    await expect(page.getByText('Signing in...')).toBeVisible()
  })

  test('should handle authentication callback', async ({ page }) => {
    // Mock the API endpoints
    await page.route('/api/auth/google', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: '1',
            email: 'test@example.com',
            displayName: 'Test User'
          },
          accessToken: 'mock_access_token'
        })
      })
    })
    
    await page.route('/api/auth/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '1',
          email: 'test@example.com',
          displayName: 'Test User'
        })
      })
    })
    
    // Set up session storage with OAuth parameters
    await page.goto('/callback')
    await page.evaluate(() => {
      sessionStorage.setItem('oauth_state', 'test_state')
      sessionStorage.setItem('code_verifier', 'test_verifier')
    })
    
    // Navigate to callback with mock parameters
    await page.goto('/callback?code=mock_code&state=test_state')
    
    // Should show processing message
    await expect(page.getByText('Setting up your account...')).toBeVisible()
  })

  test('should handle authentication errors', async ({ page }) => {
    await page.goto('/callback?error=access_denied')
    
    // Should show error message
    await expect(page.getByText('Authentication Failed')).toBeVisible()
    await expect(page.getByText('OAuth error: access_denied')).toBeVisible()
    
    // Should have try again button
    const tryAgainButton = page.getByRole('button', { name: /try again/i })
    await expect(tryAgainButton).toBeVisible()
    
    // Clicking try again should redirect to login
    await tryAgainButton.click()
    await expect(page).toHaveURL('/login')
  })

  test('should protect dashboard routes', async ({ page }) => {
    // Try to access dashboard without authentication
    await page.goto('/dashboard')
    
    // Should redirect to login
    await expect(page).toHaveURL('/login')
  })

  test('should show dashboard after successful authentication', async ({ page }) => {
    // Mock authentication state
    await page.goto('/dashboard')
    await page.evaluate(() => {
      localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          user: {
            id: '1',
            email: 'test@example.com',
            displayName: 'Test User'
          },
          token: 'mock_token',
          isAuthenticated: true
        },
        version: 0
      }))
    })
    
    // Mock API endpoints
    await page.route('/api/auth/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '1',
          email: 'test@example.com',
          displayName: 'Test User'
        })
      })
    })
    
    await page.route('/api/events*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      })
    })
    
    // Reload to apply auth state
    await page.reload()
    
    // Should show dashboard
    await expect(page.getByText('Class Schedule Sync')).toBeVisible()
    await expect(page.getByText('Test User')).toBeVisible()
  })
})
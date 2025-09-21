import { test, expect, Page } from '@playwright/test'

test.describe('Critical User Journeys', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    
    // Mock API endpoints
    await page.route('/api/**', async route => {
      const url = route.request().url()
      const method = route.request().method()
      
      // Auth endpoints
      if (url.includes('/api/auth/google/url')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test',
            state: 'test-state',
            codeVerifier: 'test-verifier',
          }),
        })
      } else if (url.includes('/api/auth/google/callback')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: 'user-123',
              email: 'test@example.com',
              displayName: 'Test User',
            },
            accessToken: 'mock-access-token',
            refreshToken: 'mock-refresh-token',
          }),
        })
      } else if (url.includes('/api/auth/me')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'user-123',
            email: 'test@example.com',
            displayName: 'Test User',
          }),
        })
      }
      // Data endpoints
      else if (url.includes('/api/subjects') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      } else if (url.includes('/api/subjects') && method === 'POST') {
        const body = route.request().postDataJSON()
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'subject-123',
            ...body,
            createdAt: new Date().toISOString(),
          }),
        })
      } else if (url.includes('/api/sections') && method === 'POST') {
        const body = route.request().postDataJSON()
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'section-123',
            ...body,
            createdAt: new Date().toISOString(),
          }),
        })
      } else if (url.includes('/api/events/generate')) {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            eventsCreated: 15,
            events: Array.from({ length: 15 }, (_, i) => ({
              id: `event-${i}`,
              title: 'CS101 Computer Science (001)',
              start: `2024-01-${String(i + 1).padStart(2, '0')}T09:00:00+07:00`,
              end: `2024-01-${String(i + 1).padStart(2, '0')}T10:30:00+07:00`,
            })),
          }),
        })
      } else if (url.includes('/api/events') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'event-1',
              title: 'CS101 Computer Science (001)',
              start: '2024-01-15T09:00:00+07:00',
              end: '2024-01-15T10:30:00+07:00',
              backgroundColor: '#3B82F6',
              extendedProps: {
                subjectId: 'subject-123',
                sectionId: 'section-123',
                room: 'Room 101',
                teacher: 'Dr. Smith',
              },
            },
          ]),
        })
      } else if (url.includes('/api/sync/google')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            summary: { created: 15, updated: 0, failed: 0, skipped: 0 },
            details: [],
            conflicts: [],
            quotaUsed: 15,
          }),
        })
      } else {
        await route.continue()
      }
    })

    // Mock Google OAuth redirect
    await page.route('https://accounts.google.com/o/oauth2/v2/auth*', async route => {
      const url = new URL(route.request().url())
      const redirectUri = url.searchParams.get('redirect_uri')
      const state = url.searchParams.get('state')
      
      if (redirectUri && state) {
        await route.fulfill({
          status: 302,
          headers: {
            'Location': `${redirectUri}?code=mock_auth_code&state=${state}`,
          },
        })
      }
    })
  })

  test.afterEach(async () => {
    await page.close()
  })

  test('Complete Authentication Flow', async () => {
    // Start at home page
    await page.goto('/')
    
    // Should redirect to login
    await expect(page).toHaveURL('/login')
    
    // Click Google sign-in
    await page.click('button:has-text("Sign in with Google")')
    
    // Should show loading state
    await expect(page.locator('text=Signing in...')).toBeVisible()
    
    // Should redirect to callback and then dashboard
    await expect(page).toHaveURL('/dashboard')
    
    // Should show user info
    await expect(page.locator('text=Test User')).toBeVisible()
    
    // Should show empty calendar state
    await expect(page.locator('text=No classes scheduled')).toBeVisible()
    await expect(page.locator('text=Add your first class to get started')).toBeVisible()
  })

  test('Quick Add Class Journey', async () => {
    // Login first
    await page.goto('/login')
    await page.click('button:has-text("Sign in with Google")')
    await expect(page).toHaveURL('/dashboard')
    
    // Click Quick Add Class
    await page.click('button:has-text("Quick Add Class")')
    
    // Fill out the form
    await page.fill('input[name="subjectCode"]', 'CS101')
    await page.fill('input[name="subjectName"]', 'Computer Science')
    await page.fill('input[name="sectionCode"]', '001')
    await page.fill('input[name="teacher"]', 'Dr. Smith')
    await page.fill('input[name="room"]', 'Room 101')
    
    // Select days
    await page.check('input[value="MO"]')
    await page.check('input[value="WE"]')
    await page.check('input[value="FR"]')
    
    // Set time
    await page.fill('input[name="startTime"]', '09:00')
    await page.fill('input[name="endTime"]', '10:30')
    
    // Set date range
    await page.fill('input[name="startDate"]', '2024-01-15')
    await page.fill('input[name="endDate"]', '2024-05-15')
    
    // Submit form
    await page.click('button:has-text("Add Class")')
    
    // Should show success message
    await expect(page.locator('text=Class added successfully')).toBeVisible()
    
    // Should show events generated message
    await expect(page.locator('text=15 events created')).toBeVisible()
    
    // Should close modal and show events in calendar
    await expect(page.locator('text=CS101 Computer Science (001)')).toBeVisible()
  })

  test('Import CSV Journey', async () => {
    // Login first
    await page.goto('/login')
    await page.click('button:has-text("Sign in with Google")')
    await expect(page).toHaveURL('/dashboard')
    
    // Navigate to import page
    await page.click('text=Import')
    await expect(page).toHaveURL('/dashboard/import')
    
    // Create mock CSV file
    const csvContent = `Subject Code,Subject Name,Section,Teacher,Room,Days,Start Time,End Time,Start Date,End Date
CS101,Computer Science,001,Dr. Smith,Room 101,MO WE FR,09:00,10:30,2024-01-15,2024-05-15
MATH201,Mathematics,002,Dr. Johnson,Room 102,TU TH,11:00,12:30,2024-01-15,2024-05-15`
    
    // Mock file upload
    await page.route('/api/import/upload', async route => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          jobId: 'import-job-123',
          preview: {
            totalRows: 2,
            validRows: 2,
            errors: [],
            data: [
              {
                'Subject Code': 'CS101',
                'Subject Name': 'Computer Science',
                'Section': '001',
                'Teacher': 'Dr. Smith',
                'Room': 'Room 101',
                'Days': 'MO WE FR',
                'Start Time': '09:00',
                'End Time': '10:30',
                'Start Date': '2024-01-15',
                'End Date': '2024-05-15',
              },
              {
                'Subject Code': 'MATH201',
                'Subject Name': 'Mathematics',
                'Section': '002',
                'Teacher': 'Dr. Johnson',
                'Room': 'Room 102',
                'Days': 'TU TH',
                'Start Time': '11:00',
                'End Time': '12:30',
                'Start Date': '2024-01-15',
                'End Date': '2024-05-15',
              },
            ],
          },
        }),
      })
    })
    
    // Upload file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    })
    
    // Should show preview
    await expect(page.locator('text=Import Preview')).toBeVisible()
    await expect(page.locator('text=2 rows found')).toBeVisible()
    await expect(page.locator('text=CS101')).toBeVisible()
    await expect(page.locator('text=MATH201')).toBeVisible()
    
    // Map columns
    await page.selectOption('select[data-column="Subject Code"]', 'code')
    await page.selectOption('select[data-column="Subject Name"]', 'name')
    await page.selectOption('select[data-column="Section"]', 'sectionCode')
    await page.selectOption('select[data-column="Teacher"]', 'teacher')
    await page.selectOption('select[data-column="Room"]', 'room')
    
    // Mock import application
    await page.route('/api/import/import-job-123/apply', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          summary: {
            subjectsCreated: 2,
            sectionsCreated: 2,
            eventsCreated: 30,
            errors: 0,
          },
          details: [],
        }),
      })
    })
    
    // Apply import
    await page.click('button:has-text("Import Classes")')
    
    // Should show progress
    await expect(page.locator('text=Importing...')).toBeVisible()
    
    // Should show success
    await expect(page.locator('text=Import completed successfully')).toBeVisible()
    await expect(page.locator('text=2 subjects created')).toBeVisible()
    await expect(page.locator('text=2 sections created')).toBeVisible()
    await expect(page.locator('text=30 events created')).toBeVisible()
    
    // Should have option to view calendar
    await page.click('button:has-text("View Calendar")')
    await expect(page).toHaveURL('/dashboard')
  })

  test('Sync to Google Calendar Journey', async () => {
    // Login and add some classes first
    await page.goto('/login')
    await page.click('button:has-text("Sign in with Google")')
    await expect(page).toHaveURL('/dashboard')
    
    // Mock events exist
    await page.route('/api/events*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'event-1',
            title: 'CS101 Computer Science (001)',
            start: '2024-01-15T09:00:00+07:00',
            end: '2024-01-15T10:30:00+07:00',
            backgroundColor: '#3B82F6',
            extendedProps: {
              subjectId: 'subject-123',
              sectionId: 'section-123',
              room: 'Room 101',
              teacher: 'Dr. Smith',
              status: 'planned',
            },
          },
        ]),
      })
    })
    
    // Should show events
    await expect(page.locator('text=CS101 Computer Science (001)')).toBeVisible()
    
    // Click sync button
    await page.click('button:has-text("Sync to Google")')
    
    // Should show sync options modal
    await expect(page.locator('text=Sync Options')).toBeVisible()
    
    // Select date range
    await page.fill('input[name="fromDate"]', '2024-01-01')
    await page.fill('input[name="toDate"]', '2024-05-31')
    
    // Start sync
    await page.click('button:has-text("Start Sync")')
    
    // Should show progress
    await expect(page.locator('text=Syncing to Google Calendar...')).toBeVisible()
    
    // Should show success
    await expect(page.locator('text=Sync completed successfully')).toBeVisible()
    await expect(page.locator('text=15 events created')).toBeVisible()
    
    // Should update event status
    await expect(page.locator('[data-status="synced"]')).toBeVisible()
  })

  test('Spotlight Filter Journey', async () => {
    // Login first
    await page.goto('/login')
    await page.click('button:has-text("Sign in with Google")')
    await expect(page).toHaveURL('/dashboard')
    
    // Mock multiple events
    await page.route('/api/events*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'event-1',
            title: 'CS101 Computer Science (001)',
            start: '2024-01-15T09:00:00+07:00',
            end: '2024-01-15T10:30:00+07:00',
            backgroundColor: '#3B82F6',
            extendedProps: {
              subjectId: 'subject-1',
              sectionId: 'section-1',
              room: 'Room 101',
              teacher: 'Dr. Smith',
            },
          },
          {
            id: 'event-2',
            title: 'MATH201 Mathematics (002)',
            start: '2024-01-15T11:00:00+07:00',
            end: '2024-01-15T12:30:00+07:00',
            backgroundColor: '#EF4444',
            extendedProps: {
              subjectId: 'subject-2',
              sectionId: 'section-2',
              room: 'Room 102',
              teacher: 'Dr. Johnson',
            },
          },
        ]),
      })
    })
    
    // Mock subjects for filter
    await page.route('/api/subjects*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'subject-1', code: 'CS101', name: 'Computer Science', colorHex: '#3B82F6' },
          { id: 'subject-2', code: 'MATH201', name: 'Mathematics', colorHex: '#EF4444' },
        ]),
      })
    })
    
    // Should show both events
    await expect(page.locator('text=CS101 Computer Science (001)')).toBeVisible()
    await expect(page.locator('text=MATH201 Mathematics (002)')).toBeVisible()
    
    // Use text search
    await page.fill('input[placeholder*="Search"]', 'Computer')
    
    // Should filter to show only CS101
    await expect(page.locator('text=CS101 Computer Science (001)')).toBeVisible()
    await expect(page.locator('text=MATH201 Mathematics (002)')).not.toBeVisible()
    
    // Clear search
    await page.fill('input[placeholder*="Search"]', '')
    
    // Should show both events again
    await expect(page.locator('text=CS101 Computer Science (001)')).toBeVisible()
    await expect(page.locator('text=MATH201 Mathematics (002)')).toBeVisible()
    
    // Use subject filter
    await page.click('button:has-text("Computer Science")')
    
    // Should filter to show only CS101
    await expect(page.locator('text=CS101 Computer Science (001)')).toBeVisible()
    await expect(page.locator('text=MATH201 Mathematics (002)')).not.toBeVisible()
    
    // Test filter mode toggle
    await page.click('button[aria-label="Filter mode"]')
    await page.click('text=Dim Others')
    
    // Should show both events but one dimmed
    await expect(page.locator('text=CS101 Computer Science (001)')).toBeVisible()
    await expect(page.locator('text=MATH201 Mathematics (002)')).toBeVisible()
    await expect(page.locator('[data-dimmed="true"]')).toBeVisible()
  })

  test('Error Handling Journey', async () => {
    // Test network error handling
    await page.goto('/login')
    
    // Mock network error
    await page.route('/api/auth/google/url', async route => {
      await route.abort('failed')
    })
    
    await page.click('button:has-text("Sign in with Google")')
    
    // Should show error message
    await expect(page.locator('text=Connection failed')).toBeVisible()
    await expect(page.locator('button:has-text("Try Again")')).toBeVisible()
    
    // Fix network and retry
    await page.route('/api/auth/google/url', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test',
          state: 'test-state',
          codeVerifier: 'test-verifier',
        }),
      })
    })
    
    await page.click('button:has-text("Try Again")')
    
    // Should proceed with authentication
    await expect(page.locator('text=Signing in...')).toBeVisible()
  })

  test('Offline Handling Journey', async () => {
    // Login first
    await page.goto('/login')
    await page.click('button:has-text("Sign in with Google")')
    await expect(page).toHaveURL('/dashboard')
    
    // Go offline
    await page.context().setOffline(true)
    
    // Should show offline indicator
    await expect(page.locator('text=You are offline')).toBeVisible()
    
    // Try to add a class (should be queued)
    await page.click('button:has-text("Quick Add Class")')
    await page.fill('input[name="subjectCode"]', 'CS101')
    await page.fill('input[name="subjectName"]', 'Computer Science')
    await page.click('button:has-text("Add Class")')
    
    // Should show queued message
    await expect(page.locator('text=Action queued for when online')).toBeVisible()
    
    // Go back online
    await page.context().setOffline(false)
    
    // Should show online indicator
    await expect(page.locator('text=Back online')).toBeVisible()
    
    // Should process queued actions
    await expect(page.locator('text=Processing queued actions')).toBeVisible()
    await expect(page.locator('text=Class added successfully')).toBeVisible()
  })

  test('Performance Under Load', async () => {
    // Login first
    await page.goto('/login')
    await page.click('button:has-text("Sign in with Google")')
    await expect(page).toHaveURL('/dashboard')
    
    // Mock large dataset
    const manyEvents = Array.from({ length: 500 }, (_, i) => ({
      id: `event-${i}`,
      title: `Event ${i}`,
      start: `2024-01-${String((i % 28) + 1).padStart(2, '0')}T09:00:00+07:00`,
      end: `2024-01-${String((i % 28) + 1).padStart(2, '0')}T10:30:00+07:00`,
      backgroundColor: '#3B82F6',
    }))
    
    await page.route('/api/events*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(manyEvents),
      })
    })
    
    // Measure load time
    const startTime = Date.now()
    await page.reload()
    
    // Wait for calendar to load
    await expect(page.locator('[data-testid="calendar"]')).toBeVisible()
    
    const loadTime = Date.now() - startTime
    
    // Should load within reasonable time (5 seconds)
    expect(loadTime).toBeLessThan(5000)
    
    // Test filtering performance with large dataset
    const filterStartTime = Date.now()
    await page.fill('input[placeholder*="Search"]', 'Event 1')
    
    // Should filter quickly
    await expect(page.locator('text=Event 1')).toBeVisible()
    
    const filterTime = Date.now() - filterStartTime
    expect(filterTime).toBeLessThan(1000) // Should filter within 1 second
  })
})
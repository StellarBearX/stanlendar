const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: Record<string, any>
  }
}

class ApiClient {
  private baseURL: string
  private token: string | null = null

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  setToken(token: string | null) {
    this.token = token
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const errorData: ApiError = await response.json()
      throw new Error(errorData.error.message || 'API request failed')
    }

    return response.json()
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }
}

export const apiClient = new ApiClient(API_BASE_URL)

// Auth API
export const authApi = {
  login: (data: { code: string; codeVerifier: string; redirectUri: string }) => 
    apiClient.post('/api/auth/google', data),
  refresh: () => apiClient.post('/api/auth/refresh'),
  logout: () => apiClient.post('/api/auth/logout'),
  me: () => apiClient.get('/api/auth/me'),
}

// Subjects API
export const subjectsApi = {
  getAll: () => apiClient.get('/api/subjects'),
  create: (data: any) => apiClient.post('/api/subjects', data),
  quickAdd: (data: any) => apiClient.post('/api/subjects/quick-add', data),
  update: (id: string, data: any) => apiClient.put(`/api/subjects/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/subjects/${id}`),
}

// Sections API
export const sectionsApi = {
  getAll: () => apiClient.get('/api/sections'),
  create: (data: any) => apiClient.post('/api/sections', data),
  update: (id: string, data: any) => apiClient.put(`/api/sections/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/sections/${id}`),
}

// Events API
export const eventsApi = {
  getAll: (params?: { from?: string; to?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.from) searchParams.set('from', params.from)
    if (params?.to) searchParams.set('to', params.to)
    const query = searchParams.toString()
    return apiClient.get(`/api/events${query ? `?${query}` : ''}`)
  },
  generate: (data: any) => apiClient.post('/api/events/generate', data),
}

// Sync API
export const syncApi = {
  syncToGoogle: (data: any) => apiClient.post('/api/sync/google', data),
  getHistory: () => apiClient.get('/api/sync/history'),
  resolveConflicts: (data: any) => apiClient.post('/api/sync/resolve-conflicts', data),
}

// Reminder API
export const reminderApi = {
  getUserPreferences: () => apiClient.get('/api/reminders'),
  updateUserPreferences: (data: any) => apiClient.put('/api/reminders', data),
  getSubjectSettings: (subjectId: string) => apiClient.get(`/api/reminders/subjects/${subjectId}`),
  updateSubjectSettings: (subjectId: string, data: any) => apiClient.put(`/api/reminders/subjects/${subjectId}`, data),
  bulkUpdateSubjectReminders: (subjectId: string, data: any) => apiClient.post(`/api/reminders/subjects/${subjectId}/bulk-update`, { reminderSettings: data }),
  getEventSettings: (eventId: string) => apiClient.get(`/api/reminders/events/${eventId}`),
  getPresets: () => apiClient.get('/api/reminders/presets'),
}

// Spotlight API
export const spotlightApi = {
  search: (query: any, limit?: number, offset?: number) => {
    const searchParams = new URLSearchParams()
    
    // Add query parameters
    if (query.text) searchParams.set('text', query.text)
    if (query.room) searchParams.set('room', query.room)
    if (query.teacher) searchParams.set('teacher', query.teacher)
    if (query.dateFrom) searchParams.set('dateFrom', query.dateFrom)
    if (query.dateTo) searchParams.set('dateTo', query.dateTo)
    if (query.viewMode) searchParams.set('viewMode', query.viewMode)
    
    // Add array parameters
    if (query.subjectIds?.length) {
      query.subjectIds.forEach((id: string) => searchParams.append('subjectIds', id))
    }
    if (query.sectionIds?.length) {
      query.sectionIds.forEach((id: string) => searchParams.append('sectionIds', id))
    }
    if (query.secCodes?.length) {
      query.secCodes.forEach((code: string) => searchParams.append('secCodes', code))
    }
    
    // Add pagination
    if (limit) searchParams.set('limit', limit.toString())
    if (offset) searchParams.set('offset', offset.toString())
    
    return apiClient.get(`/api/spotlight/search?${searchParams.toString()}`)
  },
  
  getSuggestions: {
    subjects: (text: string) => apiClient.get(`/api/spotlight/suggestions/subjects?text=${encodeURIComponent(text)}`),
    rooms: (text: string) => apiClient.get(`/api/spotlight/suggestions/rooms?text=${encodeURIComponent(text)}`),
    teachers: (text: string) => apiClient.get(`/api/spotlight/suggestions/teachers?text=${encodeURIComponent(text)}`),
    sections: (text: string) => apiClient.get(`/api/spotlight/suggestions/sections?text=${encodeURIComponent(text)}`),
  },

  // Saved Filters API
  savedFilters: {
    getAll: () => apiClient.get('/api/spotlight/saved-filters'),
    create: (data: { name: string; query: any }) => apiClient.post('/api/spotlight/saved-filters', data),
    get: (id: string) => apiClient.get(`/api/spotlight/saved-filters/${id}`),
    update: (id: string, data: { name: string; query: any }) => apiClient.put(`/api/spotlight/saved-filters/${id}`, data),
    delete: (id: string) => apiClient.delete(`/api/spotlight/saved-filters/${id}`),
    duplicate: (id: string, newName: string) => apiClient.post(`/api/spotlight/saved-filters/${id}/duplicate`, { newName }),
    export: () => apiClient.get('/api/spotlight/saved-filters/export/all'),
    import: (filters: Array<{ name: string; query: any }>) => apiClient.post('/api/spotlight/saved-filters/import', { filters }),
  }
}
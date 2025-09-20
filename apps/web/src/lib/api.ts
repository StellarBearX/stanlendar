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
}
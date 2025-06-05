import axios, { AxiosError, AxiosRequestConfig } from 'axios'
import { useAuthStore } from './auth'
import { withRetry, formatUserError } from './utils'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
})

// Request interceptor to add auth token and request ID
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  
  // Add request ID for tracking
  config.headers['X-Request-ID'] = Math.random().toString(36).substring(2, 15)
  
  return config
})

// Response interceptor to handle auth errors and retry logic
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }
    
    // Handle authentication errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      useAuthStore.getState().logout()
      
      // Redirect to login unless already on login/register page
      if (typeof window !== 'undefined' && 
          !window.location.pathname.includes('/login') && 
          !window.location.pathname.includes('/register')) {
        window.location.href = '/login'
      }
    }
    
    // Enhanced error handling
    const enhancedError = {
      ...error,
      userMessage: formatUserError(error),
      requestId: error.config?.headers?.['X-Request-ID']
    }
    
    return Promise.reject(enhancedError)
  }
)

// Wrapper function for API calls with retry logic
export const apiCall = async <T>(
  apiFunction: () => Promise<T>,
  options: { 
    maxRetries?: number
    retryDelay?: number
    retryCondition?: (error: any) => boolean
  } = {}
): Promise<T> => {
  const { 
    maxRetries = 2, 
    retryDelay = 1000,
    retryCondition = (error) => {
      // Retry on network errors or 5xx status codes
      return !error.response || (error.response.status >= 500 && error.response.status < 600)
    }
  } = options
  
  let lastError: any
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await apiFunction()
    } catch (error) {
      lastError = error
      
      // Don't retry if it's the last attempt or retry condition is not met
      if (attempt === maxRetries || !retryCondition(error)) {
        throw error
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)))
    }
  }
  
  throw lastError
}

// Auth API
export const authApi = {
  register: (data: {
    email: string
    username: string
    password: string
    firstName?: string
    lastName?: string
  }) => api.post('/api/auth/register', data),
  
  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }),
  
  getProfile: () => api.get('/api/auth/profile'),
}

// Events API
export const eventsApi = {
  getEvents: (params?: { start?: string; end?: string }) =>
    api.get('/api/events', { params }),
  
  getEvent: (id: string) => api.get(`/api/events/${id}`),
  
  createEvent: (data: any) => api.post('/api/events', data),
  
  updateEvent: (id: string, data: any) => api.put(`/api/events/${id}`, data),
  
  deleteEvent: (id: string) => api.delete(`/api/events/${id}`),
  
  submitVote: (eventId: string, data: {
    timeSlotId: number
    voteType: 'yes' | 'no' | 'maybe'
    email?: string
    name?: string
  }) => api.post(`/api/events/${eventId}/vote`, data),
  
  addTimeSlot: (eventId: string, data: {
    proposedStartTime: string
    proposedEndTime: string
  }) => api.post(`/api/events/${eventId}/time-slots`, data),
  
  generateGuestLink: (eventId: string, data: {
    email: string
    name: string
  }) => api.post(`/api/events/${eventId}/guest-link`, data),
  
  finalizeEvent: (eventId: string, data: {
    timeSlotId: number
  }) => api.post(`/api/events/${eventId}/finalize`, data),
}
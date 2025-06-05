import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Error handling utilities
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  
  if (typeof error === 'object' && error !== null) {
    if ('response' in error && typeof error.response === 'object' && error.response !== null) {
      const response = error.response as any
      if (response.data?.error) {
        return response.data.error
      }
      if (response.data?.message) {
        return response.data.message
      }
      if (response.statusText) {
        return `Request failed: ${response.statusText}`
      }
    }
    
    if ('message' in error && typeof error.message === 'string') {
      return error.message
    }
  }
  
  if (typeof error === 'string') {
    return error
  }
  
  return 'An unexpected error occurred'
}

// Format error for user display
export function formatUserError(error: unknown): string {
  const message = getErrorMessage(error)
  
  // Handle common error patterns
  if (message.includes('Network Error') || message.includes('connection')) {
    return 'Connection failed. Please check your internet connection and try again.'
  }
  
  if (message.includes('timeout')) {
    return 'Request timed out. Please try again.'
  }
  
  if (message.includes('401') || message.includes('Unauthorized')) {
    return 'Your session has expired. Please log in again.'
  }
  
  if (message.includes('403') || message.includes('Forbidden')) {
    return 'You do not have permission to perform this action.'
  }
  
  if (message.includes('404') || message.includes('Not Found')) {
    return 'The requested resource was not found.'
  }
  
  if (message.includes('500') || message.includes('Internal Server Error')) {
    return 'A server error occurred. Please try again later.'
  }
  
  // Return the original message for other cases
  return message
}

// Retry utility
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: unknown
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      if (i === maxRetries) {
        throw error
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)))
    }
  }
  
  throw lastError
}

// Date utilities
export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString()
}

export function formatDateTime(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleString()
}

export function formatTimeAgo(date: Date | string): string {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) {
    return `${days} day${days === 1 ? '' : 's'} ago`
  }
  if (hours > 0) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  }
  return 'Just now'
}

// Validation utilities
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function isValidPassword(password: string): boolean {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
  return passwordRegex.test(password)
}
'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({ errorInfo })
    
    // Log error to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to error tracking service (Sentry, etc.)
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center mb-4">
              <ExclamationTriangleIcon className="h-8 w-8 text-red-500 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Something went wrong</h2>
            </div>
            
            <p className="text-gray-600 mb-6">
              We're sorry, but something unexpected happened. Please try refreshing the page or contact support if the problem persists.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 p-4 bg-red-50 rounded-md">
                <h3 className="text-sm font-medium text-red-800 mb-2">Error Details:</h3>
                <pre className="text-xs text-red-700 overflow-auto">
                  {this.state.error.message}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={this.handleRetry}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <ArrowPathIcon className="h-4 w-4 mr-2" />
                Try Again
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
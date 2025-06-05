'use client'

import { Loader2, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'spinner' | 'pulse' | 'bounce' | 'dots' | 'calendar'
  className?: string
  text?: string
}

export default function LoadingSpinner({ 
  size = 'md', 
  variant = 'spinner',
  className,
  text 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  }

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl'
  }

  const renderSpinner = () => {
    switch (variant) {
      case 'spinner':
        return (
          <Loader2 className={cn(
            sizeClasses[size], 
            'animate-spin text-primary-500',
            className
          )} />
        )
      
      case 'pulse':
        return (
          <div className={cn(
            sizeClasses[size],
            'bg-primary-500 rounded-full animate-pulse',
            className
          )} />
        )
      
      case 'bounce':
        return (
          <div className="flex space-x-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  'w-2 h-2 bg-primary-500 rounded-full animate-bounce',
                  className
                )}
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        )
      
      case 'dots':
        return (
          <div className="flex space-x-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  'w-3 h-3 bg-primary-500 rounded-full animate-pulse',
                  className
                )}
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        )
      
      case 'calendar':
        return (
          <div className="relative">
            <Calendar className={cn(
              sizeClasses[size],
              'text-primary-500 animate-pulse',
              className
            )} />
            <div className="absolute inset-0 animate-ping">
              <Calendar className={cn(
                sizeClasses[size],
                'text-primary-300 opacity-75'
              )} />
            </div>
          </div>
        )
      
      default:
        return (
          <Loader2 className={cn(
            sizeClasses[size], 
            'animate-spin text-primary-500',
            className
          )} />
        )
    }
  }

  if (text) {
    return (
      <div className="flex flex-col items-center space-y-3">
        {renderSpinner()}
        <p className={cn(
          textSizeClasses[size],
          'text-gray-600 dark:text-gray-400 animate-pulse'
        )}>
          {text}
        </p>
      </div>
    )
  }

  return renderSpinner()
}

// Loading overlay component
export function LoadingOverlay({ 
  isLoading, 
  text = 'Loading...', 
  children 
}: {
  isLoading: boolean
  text?: string
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
          <LoadingSpinner size="lg" text={text} />
        </div>
      )}
    </div>
  )
}

// Page loading component
export function PageLoader({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <LoadingSpinner size="xl" text={text} />
    </div>
  )
}
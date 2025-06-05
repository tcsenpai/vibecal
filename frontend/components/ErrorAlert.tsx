'use client'

import { useState } from 'react'
import { 
  ExclamationTriangleIcon, 
  XMarkIcon, 
  InformationCircleIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'

interface ErrorAlertProps {
  variant?: 'error' | 'warning' | 'info' | 'success'
  title?: string
  message: string
  dismissible?: boolean
  onDismiss?: () => void
  className?: string
  actions?: React.ReactNode
}

const variantConfig = {
  error: {
    icon: XCircleIcon,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-red-400',
    titleColor: 'text-red-800',
    messageColor: 'text-red-700'
  },
  warning: {
    icon: ExclamationTriangleIcon,
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    iconColor: 'text-yellow-400',
    titleColor: 'text-yellow-800',
    messageColor: 'text-yellow-700'
  },
  info: {
    icon: InformationCircleIcon,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-400',
    titleColor: 'text-blue-800',
    messageColor: 'text-blue-700'
  },
  success: {
    icon: CheckCircleIcon,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    iconColor: 'text-green-400',
    titleColor: 'text-green-800',
    messageColor: 'text-green-700'
  }
}

export default function ErrorAlert({
  variant = 'error',
  title,
  message,
  dismissible = true,
  onDismiss,
  className = '',
  actions
}: ErrorAlertProps) {
  const [isVisible, setIsVisible] = useState(true)
  
  if (!isVisible) return null
  
  const config = variantConfig[variant]
  const Icon = config.icon
  
  const handleDismiss = () => {
    setIsVisible(false)
    onDismiss?.()
  }
  
  return (
    <div className={cn(
      'rounded-md border p-4',
      config.bgColor,
      config.borderColor,
      className
    )}>
      <div className="flex">
        <div className="flex-shrink-0">
          <Icon className={cn('h-5 w-5', config.iconColor)} />
        </div>
        
        <div className="ml-3 flex-1">
          {title && (
            <h3 className={cn('text-sm font-medium', config.titleColor)}>
              {title}
            </h3>
          )}
          
          <div className={cn('text-sm', title ? 'mt-2' : '', config.messageColor)}>
            {message}
          </div>
          
          {actions && (
            <div className="mt-4">
              {actions}
            </div>
          )}
        </div>
        
        {dismissible && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                type="button"
                className={cn(
                  'inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2',
                  config.bgColor,
                  config.iconColor,
                  'hover:bg-opacity-75 focus:ring-offset-2'
                )}
                onClick={handleDismiss}
              >
                <span className="sr-only">Dismiss</span>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Hook for managing alerts
export function useAlert() {
  const [alerts, setAlerts] = useState<Array<{
    id: string
    variant: 'error' | 'warning' | 'info' | 'success'
    title?: string
    message: string
    dismissible?: boolean
    autoRemove?: boolean
    duration?: number
  }>>([])
  
  const addAlert = (alert: Omit<typeof alerts[0], 'id'>) => {
    const id = Math.random().toString(36).substring(2, 15)
    const newAlert = { ...alert, id }
    
    setAlerts(prev => [...prev, newAlert])
    
    // Auto remove after duration
    if (alert.autoRemove !== false) {
      setTimeout(() => {
        removeAlert(id)
      }, alert.duration || 5000)
    }
    
    return id
  }
  
  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id))
  }
  
  const clearAlerts = () => {
    setAlerts([])
  }
  
  return {
    alerts,
    addAlert,
    removeAlert,
    clearAlerts,
    showError: (message: string, title?: string) => addAlert({ variant: 'error', message, title }),
    showWarning: (message: string, title?: string) => addAlert({ variant: 'warning', message, title }),
    showInfo: (message: string, title?: string) => addAlert({ variant: 'info', message, title }),
    showSuccess: (message: string, title?: string) => addAlert({ variant: 'success', message, title })
  }
}

// Alert container component
export function AlertContainer({ alerts, onRemove }: {
  alerts: ReturnType<typeof useAlert>['alerts']
  onRemove: (id: string) => void
}) {
  if (alerts.length === 0) return null
  
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {alerts.map(alert => (
        <ErrorAlert
          key={alert.id}
          variant={alert.variant}
          title={alert.title}
          message={alert.message}
          dismissible={alert.dismissible}
          onDismiss={() => onRemove(alert.id)}
          className="max-w-md shadow-lg"
        />
      ))}
    </div>
  )
}
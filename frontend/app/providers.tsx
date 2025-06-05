'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { ThemeProvider } from '@/components/ThemeProvider'
import ErrorBoundary from '@/components/ErrorBoundary'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        refetchOnWindowFocus: false,
        retry: (failureCount, error: any) => {
          // Don't retry on 4xx errors
          if (error?.response?.status >= 400 && error?.response?.status < 500) {
            return false
          }
          // Retry up to 3 times for other errors
          return failureCount < 3
        },
      },
    },
  }))

  return (
    <ErrorBoundary>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
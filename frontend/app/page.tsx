'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/auth'
import { Calendar, Users, Clock, Star } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/calendar')
    } else {
      router.push('/login')
    }
  }, [isAuthenticated, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse-soft dark:bg-primary-900 dark:opacity-30"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse-soft dark:bg-secondary-900 dark:opacity-30"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent-200 rounded-full mix-blend-multiply filter blur-xl opacity-50 animate-bounce-gentle dark:bg-accent-900 dark:opacity-20"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen px-4">
        <div className="max-w-2xl mx-auto text-center">
          {/* Logo and Title */}
          <div className="mb-8 animate-fade-in">
            <div className="inline-flex items-center justify-center w-20 h-20 mb-6 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-2xl shadow-glow">
              <Calendar className="w-10 h-10 text-white" />
            </div>
            
            <h1 className="text-6xl font-bold text-gradient mb-4">
              VibeCal
            </h1>
            
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-2">
              Self-Hosted Calendar with Voting Events
            </p>
            
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Collaborative scheduling made beautiful
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="grid md:grid-cols-3 gap-6 mb-12 animate-slide-in-up">
            <div className="card-glass p-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 mb-4 bg-primary-500/20 rounded-xl">
                <Calendar className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Smart Calendar</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Organize your events with style</p>
            </div>
            
            <div className="card-glass p-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 mb-4 bg-secondary-500/20 rounded-xl">
                <Users className="w-6 h-6 text-secondary-600 dark:text-secondary-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Collaborative</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Vote on events together</p>
            </div>
            
            <div className="card-glass p-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 mb-4 bg-accent-500/20 rounded-xl">
                <Star className="w-6 h-6 text-accent-600 dark:text-accent-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Self-Hosted</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Your data, your control</p>
            </div>
          </div>

          {/* Loading State */}
          <div className="animate-scale-in">
            <div className="flex items-center justify-center space-x-3 mb-6">
              <div className="relative">
                <div className="w-4 h-4 bg-primary-500 rounded-full animate-ping"></div>
                <div className="absolute top-0 left-0 w-4 h-4 bg-primary-600 rounded-full"></div>
              </div>
              <div className="relative">
                <div className="w-4 h-4 bg-secondary-500 rounded-full animate-ping" style={{ animationDelay: '0.1s' }}></div>
                <div className="absolute top-0 left-0 w-4 h-4 bg-secondary-600 rounded-full"></div>
              </div>
              <div className="relative">
                <div className="w-4 h-4 bg-accent-500 rounded-full animate-ping" style={{ animationDelay: '0.2s' }}></div>
                <div className="absolute top-0 left-0 w-4 h-4 bg-accent-600 rounded-full"></div>
              </div>
            </div>
            
            <p className="text-gray-600 dark:text-gray-400 text-sm flex items-center justify-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>Preparing your calendar experience...</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
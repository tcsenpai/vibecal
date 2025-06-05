'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import { ThemeToggle } from '@/components/ThemeToggle'

interface LoginForm {
  email: string
  password: string
}

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuthStore()
  const [error, setError] = useState<string>('')

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>()

  const loginMutation = useMutation({
    mutationFn: (data: LoginForm) => authApi.login(data.email, data.password),
    onSuccess: (response) => {
      const { user, token } = response.data
      login(user, token)
      router.push('/calendar')
    },
    onError: (error: any) => {
      setError(error.response?.data?.error || 'Login failed')
    },
  })

  const onSubmit = (data: LoginForm) => {
    setError('')
    loginMutation.mutate(data)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            Sign in to VibeCal
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Or{' '}
            <Link href="/register" className="font-medium text-primary-600 hover:text-primary-500">
              create a new account
            </Link>
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email address
              </label>
              <input
                {...register('email', { 
                  required: 'Email is required',
                  pattern: {
                    value: /^\S+@\S+$/,
                    message: 'Invalid email address'
                  }
                })}
                type="email"
                className="input mt-1"
                placeholder="Enter your email"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email.message}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <input
                {...register('password', { required: 'Password is required' })}
                type="password"
                className="input mt-1"
                placeholder="Enter your password"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.password.message}</p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="btn btn-primary w-full"
            >
              {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
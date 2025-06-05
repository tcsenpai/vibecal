'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'

interface RegisterForm {
  email: string
  username: string
  password: string
  confirmPassword: string
  firstName?: string
  lastName?: string
}

export default function RegisterPage() {
  const router = useRouter()
  const { login } = useAuthStore()
  const [error, setError] = useState<string>('')

  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterForm>()
  const password = watch('password')

  const registerMutation = useMutation({
    mutationFn: (data: Omit<RegisterForm, 'confirmPassword'>) => authApi.register(data),
    onSuccess: (response) => {
      const { user, token } = response.data
      login(user, token)
      router.push('/calendar')
    },
    onError: (error: any) => {
      setError(error.response?.data?.error || 'Registration failed')
    },
  })

  const onSubmit = (data: RegisterForm) => {
    setError('')
    const { confirmPassword, ...submitData } = data
    registerMutation.mutate(submitData)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link href="/login" className="font-medium text-primary-600 hover:text-primary-500">
              sign in to your existing account
            </Link>
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                  First name
                </label>
                <input
                  {...register('firstName')}
                  type="text"
                  className="input mt-1"
                  placeholder="John"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                  Last name
                </label>
                <input
                  {...register('lastName')}
                  type="text"
                  className="input mt-1"
                  placeholder="Doe"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
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
                placeholder="john@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <input
                {...register('username', { 
                  required: 'Username is required',
                  minLength: {
                    value: 3,
                    message: 'Username must be at least 3 characters'
                  }
                })}
                type="text"
                className="input mt-1"
                placeholder="johndoe"
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                {...register('password', { 
                  required: 'Password is required',
                  minLength: {
                    value: 6,
                    message: 'Password must be at least 6 characters'
                  }
                })}
                type="password"
                className="input mt-1"
                placeholder="Enter your password"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm password
              </label>
              <input
                {...register('confirmPassword', { 
                  required: 'Please confirm your password',
                  validate: value => value === password || 'Passwords do not match'
                })}
                type="password"
                className="input mt-1"
                placeholder="Confirm your password"
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="btn btn-primary w-full"
            >
              {registerMutation.isPending ? 'Creating account...' : 'Create account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
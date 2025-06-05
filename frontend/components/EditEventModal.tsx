'use client'

import { useState, Fragment, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { eventsApi } from '@/lib/api'
import { Event } from '@/types'
import { format } from 'date-fns'

interface EditEventModalProps {
  isOpen: boolean
  onClose: () => void
  event: Event
}

interface EditEventData {
  title: string
  description?: string
  startTime: string
  endTime: string
  location?: string
  isPublic: boolean
  isAllDay: boolean
}

export default function EditEventModal({ isOpen, onClose, event }: EditEventModalProps) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string>('')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EditEventData>()

  const updateEventMutation = useMutation({
    mutationFn: (data: EditEventData) => eventsApi.updateEvent(event.id.toString(), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['event', event.id] })
      onClose()
    },
    onError: (error: any) => {
      setError(error.response?.data?.error || 'Failed to update event')
    },
  })

  // Reset form when modal opens/closes or event changes
  useEffect(() => {
    if (isOpen && event) {
      setError('')
      
      const startTime = event.startTime ? new Date(event.startTime) : new Date()
      const endTime = event.endTime ? new Date(event.endTime) : new Date(startTime.getTime() + 60 * 60 * 1000)
      
      reset({
        title: event.title || '',
        description: event.description || '',
        startTime: format(startTime, "yyyy-MM-dd'T'HH:mm"),
        endTime: format(endTime, "yyyy-MM-dd'T'HH:mm"),
        location: event.location || '',
        isPublic: event.isPublic || false,
        isAllDay: event.isAllDay || false,
      })
    }
  }, [isOpen, event, reset])

  const onSubmit = (data: EditEventData) => {
    setError('')
    updateEventMutation.mutate(data)
  }

  // Don't allow editing voting events (they have complex time slot logic)
  if (event?.eventType === 'voting') {
    return (
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={onClose}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <div className="flex items-center justify-between mb-6">
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                      Edit Voting Event
                    </Dialog.Title>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="text-center py-8">
                    <p className="text-gray-600 mb-4">
                      Voting events cannot be edited due to their complex time slot structure and ongoing votes.
                    </p>
                    <p className="text-sm text-gray-500">
                      You can delete the voting event and create a new one if needed.
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={onClose}
                      className="btn btn-secondary"
                    >
                      Close
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    )
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between mb-6">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                    Edit Event
                  </Dialog.Title>
                  <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {error && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Title *
                    </label>
                    <input
                      {...register('title', { required: 'Title is required' })}
                      type="text"
                      className="input"
                      placeholder="Event title"
                    />
                    {errors.title && (
                      <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      {...register('description')}
                      rows={3}
                      className="input"
                      placeholder="Event description"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Time
                      </label>
                      <input
                        {...register('startTime')}
                        type="datetime-local"
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        End Time
                      </label>
                      <input
                        {...register('endTime')}
                        type="datetime-local"
                        className="input"
                      />
                    </div>
                  </div>

                  <div className="flex items-center">
                    <input
                      {...register('isAllDay')}
                      type="checkbox"
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      All day event
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Location
                    </label>
                    <input
                      {...register('location')}
                      type="text"
                      className="input"
                      placeholder="Event location"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      {...register('isPublic')}
                      type="checkbox"
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Public event (visible to all users)
                    </label>
                  </div>

                  <div className="flex justify-end space-x-3 pt-6">
                    <button
                      type="button"
                      onClick={onClose}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={updateEventMutation.isPending}
                      className="btn btn-primary"
                    >
                      {updateEventMutation.isPending ? 'Updating...' : 'Update Event'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
'use client'

import { useState, Fragment, useEffect } from 'react'
import { Dialog, Transition, Switch } from '@headlessui/react'
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useForm, useFieldArray } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { eventsApi } from '@/lib/api'
import { CreateEventData } from '@/types'
import { format } from 'date-fns'

interface CreateEventModalProps {
  isOpen: boolean
  onClose: () => void
  defaultSlot?: { start: Date; end: Date } | null
  forceVotingEvent?: boolean
}

export default function CreateEventModal({ isOpen, onClose, defaultSlot, forceVotingEvent }: CreateEventModalProps) {
  const queryClient = useQueryClient()
  const [isVotingEvent, setIsVotingEvent] = useState(false)
  const [error, setError] = useState<string>('')

  const getDefaultStartTime = () => {
    if (defaultSlot) return defaultSlot.start
    const now = new Date()
    // Round to next hour
    now.setMinutes(0, 0, 0)
    now.setHours(now.getHours() + 1)
    return now
  }

  const getDefaultEndTime = () => {
    if (defaultSlot) return defaultSlot.end
    const start = getDefaultStartTime()
    return new Date(start.getTime() + 60 * 60 * 1000) // +1 hour
  }

  const { register, handleSubmit, control, watch, reset, formState: { errors }, setValue } = useForm<CreateEventData>({
    defaultValues: {
      eventType: 'regular',
      isPublic: false,
      isAllDay: false,
      startTime: format(getDefaultStartTime(), "yyyy-MM-dd'T'HH:mm"),
      endTime: format(getDefaultEndTime(), "yyyy-MM-dd'T'HH:mm"),
      votingSettings: {
        allowGuestVoting: false,
        allowMaybeVotes: true,
        autoFinalize: false,
        minVotesRequired: 1,
      },
      timeSlots: [],
    },
  })

  const { fields: timeSlotFields, append: appendTimeSlot, remove: removeTimeSlot } = useFieldArray({
    control,
    name: 'timeSlots',
  })

  const eventType = watch('eventType')

  const createEventMutation = useMutation({
    mutationFn: (data: CreateEventData) => eventsApi.createEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      onClose()
      reset()
    },
    onError: (error: any) => {
      setError(error.response?.data?.error || 'Failed to create event')
    },
  })

  const handleEventTypeChange = (newEventType: 'regular' | 'voting') => {
    setIsVotingEvent(newEventType === 'voting')
    setValue('eventType', newEventType)
    
    // Reset time slots when switching event types
    if (newEventType === 'voting') {
      // Clear existing time slots
      timeSlotFields.forEach((_, index) => removeTimeSlot(index))
      // Add two default time slots for voting
      setTimeout(() => {
        addTimeSlot()
        addTimeSlot()
      }, 0)
    } else {
      // Clear time slots for regular events
      timeSlotFields.forEach((_, index) => removeTimeSlot(index))
    }
  }

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setError('')
      const shouldUseVoting = forceVotingEvent || false
      setIsVotingEvent(shouldUseVoting)
      
      // Reset with proper default values
      reset({
        eventType: shouldUseVoting ? 'voting' : 'regular',
        isPublic: false,
        isAllDay: false,
        startTime: format(getDefaultStartTime(), "yyyy-MM-dd'T'HH:mm"),
        endTime: format(getDefaultEndTime(), "yyyy-MM-dd'T'HH:mm"),
        votingSettings: {
          allowGuestVoting: false,
          allowMaybeVotes: true,
          autoFinalize: false,
          minVotesRequired: 1,
        },
        timeSlots: [],
      })
      
      // Auto-add time slots if it's a voting event
      if (shouldUseVoting) {
        setTimeout(() => {
          addTimeSlot()
          addTimeSlot()
        }, 100)
      }
    }
  }, [isOpen, reset, defaultSlot, forceVotingEvent])

  const onSubmit = (data: CreateEventData) => {
    setError('')
    
    // Validation for voting events
    if (data.eventType === 'voting') {
      if (!data.timeSlots || data.timeSlots.length === 0) {
        setError('Voting events must have at least one time slot option')
        return
      }
      
      // Validate that all time slots have both start and end times
      const invalidSlots = data.timeSlots.some(slot => !slot.proposedStartTime || !slot.proposedEndTime)
      if (invalidSlots) {
        setError('All time slots must have both start and end times')
        return
      }
    }
    
    // Set default times if provided and not voting event
    if (defaultSlot && data.eventType === 'regular') {
      data.startTime = defaultSlot.start.toISOString()
      data.endTime = defaultSlot.end.toISOString()
    }

    createEventMutation.mutate(data)
  }

  const addTimeSlot = () => {
    const now = new Date()
    // Round to next hour
    now.setMinutes(0, 0, 0)
    now.setHours(now.getHours() + 1)
    
    const start = new Date(now.getTime() + (timeSlotFields.length + 1) * 24 * 60 * 60 * 1000)
    const end = new Date(start.getTime() + 60 * 60 * 1000) // +1 hour
    
    appendTimeSlot({
      proposedStartTime: format(start, "yyyy-MM-dd'T'HH:mm"),
      proposedEndTime: format(end, "yyyy-MM-dd'T'HH:mm"),
    })
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
                    Create New Event
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
                      Event Type
                    </label>
                    <select
                      {...register('eventType')}
                      className="input"
                      onChange={(e) => handleEventTypeChange(e.target.value as 'regular' | 'voting')}
                    >
                      <option value="regular">📅 Regular Event - Set a specific date and time</option>
                      <option value="voting">🗳️ Voting Event - Let people vote on multiple time options</option>
                    </select>
                    
                    {eventType === 'voting' && (
                      <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                        <p className="text-sm text-amber-800">
                          <strong>Voting Event:</strong> Add multiple time slot options below. Participants will vote on their preferred times, and you can finalize the event later.
                        </p>
                      </div>
                    )}
                  </div>

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

                  {eventType === 'regular' && (
                    <>
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
                    </>
                  )}

                  {eventType === 'voting' && (
                    <div className="space-y-4 border-2 border-amber-200 bg-amber-50 p-4 rounded-lg">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="text-lg font-medium text-gray-900">🗳️ Proposed Time Options</h4>
                            <p className="text-sm text-gray-600 mt-1">Add multiple time slots that participants can vote on</p>
                          </div>
                          <button
                            type="button"
                            onClick={addTimeSlot}
                            className="btn btn-primary flex items-center"
                          >
                            <PlusIcon className="h-4 w-4 mr-1" />
                            Add Time Option
                          </button>
                        </div>

                        {timeSlotFields.length === 0 && (
                          <div className="text-center py-8 text-gray-500">
                            <p>No time options yet. Add some time slots for people to vote on!</p>
                          </div>
                        )}

                        {timeSlotFields.map((field, index) => (
                          <div key={field.id} className="bg-white p-4 rounded-lg border border-gray-200 mb-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">Option {index + 1}</span>
                              <button
                                type="button"
                                onClick={() => removeTimeSlot(index)}
                                className="text-red-500 hover:text-red-700 text-sm"
                                disabled={timeSlotFields.length <= 1}
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
                                <input
                                  {...register(`timeSlots.${index}.proposedStartTime` as const)}
                                  type="datetime-local"
                                  className="input w-full"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">End Time</label>
                                <input
                                  {...register(`timeSlots.${index}.proposedEndTime` as const)}
                                  type="datetime-local"
                                  className="input w-full"
                                  required
                                />
                              </div>
                            </div>
                          </div>
                        ))}

                        {timeSlotFields.length < 10 && (
                          <button
                            type="button"
                            onClick={addTimeSlot}
                            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-amber-400 hover:text-amber-600 transition-colors"
                          >
                            <PlusIcon className="h-5 w-5 mx-auto mb-1" />
                            Add Another Time Option
                          </button>
                        )}
                      </div>

                      <div className="border-t border-amber-200 pt-4">
                        <h5 className="text-md font-medium text-gray-900 mb-3">Voting Settings</h5>
                        <div className="space-y-3">
                          <div className="flex items-center">
                            <input
                              {...register('votingSettings.allowGuestVoting')}
                              type="checkbox"
                              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            />
                            <label className="ml-2 block text-sm text-gray-900">
                              Allow guest voting (people without accounts can vote)
                            </label>
                          </div>

                          <div className="flex items-center">
                            <input
                              {...register('votingSettings.allowMaybeVotes')}
                              type="checkbox"
                              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            />
                            <label className="ml-2 block text-sm text-gray-900">
                              Allow "maybe" votes (in addition to yes/no)
                            </label>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Voting Deadline (optional)
                            </label>
                            <input
                              {...register('votingSettings.votingDeadline')}
                              type="datetime-local"
                              className="input"
                              placeholder="When should voting end?"
                            />
                            <p className="mt-1 text-xs text-gray-500">Leave empty for no deadline</p>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-amber-200 pt-4">
                        <h6 className="text-sm font-medium text-gray-700 mb-2">Quick Add Time Slots</h6>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              const today = new Date()
                              for (let i = 0; i < 3; i++) {
                                const start = new Date(today.getTime() + (i + 1) * 24 * 60 * 60 * 1000)
                                start.setHours(14, 0, 0, 0) // 2 PM
                                const end = new Date(start.getTime() + 60 * 60 * 1000) // +1 hour
                                appendTimeSlot({
                                  proposedStartTime: format(start, "yyyy-MM-dd'T'HH:mm"),
                                  proposedEndTime: format(end, "yyyy-MM-dd'T'HH:mm"),
                                })
                              }
                            }}
                            className="text-xs px-3 py-1 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                          >
                            Next 3 afternoons
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const today = new Date()
                              for (let i = 0; i < 5; i++) {
                                const start = new Date(today.getTime() + (i + 1) * 24 * 60 * 60 * 1000)
                                start.setHours(10, 0, 0, 0) // 10 AM
                                const end = new Date(start.getTime() + 60 * 60 * 1000) // +1 hour
                                appendTimeSlot({
                                  proposedStartTime: format(start, "yyyy-MM-dd'T'HH:mm"),
                                  proposedEndTime: format(end, "yyyy-MM-dd'T'HH:mm"),
                                })
                              }
                            }}
                            className="text-xs px-3 py-1 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                          >
                            Weekday mornings
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

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
                      disabled={createEventMutation.isPending || (eventType === 'voting' && timeSlotFields.length === 0)}
                      className="btn btn-primary"
                    >
                      {createEventMutation.isPending 
                        ? 'Creating...' 
                        : eventType === 'voting' 
                          ? 'Create Voting Event' 
                          : 'Create Event'
                      }
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
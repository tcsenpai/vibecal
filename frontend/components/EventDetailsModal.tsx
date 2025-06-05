'use client'

import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, CalendarIcon, MapPinIcon, UserIcon } from '@heroicons/react/24/outline'
import { useQuery } from '@tanstack/react-query'
import { eventsApi } from '@/lib/api'
import { Event } from '@/types'
import { format } from 'date-fns'
import VotingInterface from './VotingInterface'

interface EventDetailsModalProps {
  event: Event
  isOpen: boolean
  onClose: () => void
}

export default function EventDetailsModal({ event, isOpen, onClose }: EventDetailsModalProps) {
  const { data: eventDetails, isLoading } = useQuery({
    queryKey: ['event', event.id],
    queryFn: () => eventsApi.getEvent(event.id.toString()),
    enabled: isOpen,
  })

  const eventData = eventDetails?.data

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
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                      {event.title}
                    </Dialog.Title>
                    {event.eventType === 'voting' && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        Voting Event
                      </span>
                    )}
                  </div>
                  <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Event Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        {eventData?.description && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 mb-2">Description</h4>
                            <p className="text-gray-700">{eventData.description}</p>
                          </div>
                        )}

                        <div className="flex items-center text-sm text-gray-600">
                          <UserIcon className="h-4 w-4 mr-2" />
                          Created by {eventData?.creatorName}
                        </div>

                        {eventData?.location && (
                          <div className="flex items-center text-sm text-gray-600">
                            <MapPinIcon className="h-4 w-4 mr-2" />
                            {eventData.location}
                          </div>
                        )}

                        {eventData?.startTime && eventData?.endTime && (
                          <div className="flex items-center text-sm text-gray-600">
                            <CalendarIcon className="h-4 w-4 mr-2" />
                            {eventData.isAllDay ? (
                              `All day - ${format(new Date(eventData.startTime), 'MMM d, yyyy')}`
                            ) : (
                              `${format(new Date(eventData.startTime), 'MMM d, yyyy h:mm a')} - ${format(new Date(eventData.endTime), 'h:mm a')}`
                            )}
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {eventData?.isPublic ? 'Public' : 'Private'}
                          </span>
                        </div>

                        {eventData?.participantCount !== undefined && (
                          <div className="text-sm text-gray-600">
                            {eventData.participantCount} participants
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Voting Interface */}
                    {eventData?.eventType === 'voting' && eventData.timeSlots && (
                      <div className="border-t pt-6">
                        <VotingInterface
                          event={eventData}
                          timeSlots={eventData.timeSlots}
                          votingSettings={eventData.votingSettings}
                        />
                      </div>
                    )}
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
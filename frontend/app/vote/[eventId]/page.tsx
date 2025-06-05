'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { eventsApi } from '@/lib/api'
import VotingInterface from '@/components/VotingInterface'
import { CalendarIcon, MapPinIcon, UserIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'

export default function VotePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const eventId = params.eventId as string
  const token = searchParams.get('token')

  const { data: eventDetails, isLoading, error } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => eventsApi.getEvent(eventId),
    enabled: !!eventId,
  })

  const event = eventDetails?.data

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading voting event...</p>
        </div>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Event Not Found</h1>
          <p className="text-gray-600">The voting event you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    )
  }

  if (event.eventType !== 'voting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-yellow-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Not a Voting Event</h1>
          <p className="text-gray-600">This is a regular calendar event, not a voting event.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800 mb-4">
            🗳️ Voting Event
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{event.title}</h1>
          {token && (
            <p className="text-sm text-gray-600">You've been invited to vote on this event</p>
          )}
        </div>

        {/* Event Details */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {event.description && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Description</h3>
                  <p className="text-gray-700">{event.description}</p>
                </div>
              )}

              <div className="flex items-center text-sm text-gray-600">
                <UserIcon className="h-4 w-4 mr-2" />
                Created by {event.creatorName}
              </div>

              {event.location && (
                <div className="flex items-center text-sm text-gray-600">
                  <MapPinIcon className="h-4 w-4 mr-2" />
                  {event.location}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {event.votingSettings?.votingDeadline && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Voting Deadline</h3>
                  <div className="flex items-center text-sm text-gray-600">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {format(new Date(event.votingSettings.votingDeadline), 'MMM d, yyyy h:mm a')}
                  </div>
                </div>
              )}

              <div className="text-sm text-gray-600">
                <div className="flex items-center justify-between">
                  <span>Guest voting:</span>
                  <span className={`font-medium ${event.votingSettings?.allowGuestVoting ? 'text-green-600' : 'text-red-600'}`}>
                    {event.votingSettings?.allowGuestVoting ? 'Allowed' : 'Not allowed'}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span>Maybe votes:</span>
                  <span className={`font-medium ${event.votingSettings?.allowMaybeVotes ? 'text-green-600' : 'text-red-600'}`}>
                    {event.votingSettings?.allowMaybeVotes ? 'Allowed' : 'Not allowed'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Voting Interface */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {event.timeSlots && event.timeSlots.length > 0 ? (
            <VotingInterface
              event={event}
              timeSlots={event.timeSlots}
              votingSettings={event.votingSettings}
            />
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Time Slots Available</h3>
              <p className="text-gray-600">The event creator hasn't added any time slot options yet.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>Powered by VibeCal - Self-hosted calendar with voting events</p>
        </div>
      </div>
    </div>
  )
}
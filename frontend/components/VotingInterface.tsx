'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckIcon, XMarkIcon, QuestionMarkCircleIcon, UserIcon } from '@heroicons/react/24/outline'
import { eventsApi } from '@/lib/api'
import { VotingTimeSlot, VotingEventSettings, VotingEvent } from '@/types'
import { useAuthStore } from '@/lib/auth'
import { format } from 'date-fns'

interface VotingInterfaceProps {
  event: VotingEvent
  timeSlots: VotingTimeSlot[]
  votingSettings?: VotingEventSettings
}

export default function VotingInterface({ event, timeSlots, votingSettings }: VotingInterfaceProps) {
  const queryClient = useQueryClient()
  const { user, isAuthenticated } = useAuthStore()
  const [guestInfo, setGuestInfo] = useState({ email: '', name: '' })
  const [showGuestForm, setShowGuestForm] = useState(false)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<number | null>(null)

  const voteMutation = useMutation({
    mutationFn: ({ timeSlotId, voteType, email, name }: {
      timeSlotId: number
      voteType: 'yes' | 'no' | 'maybe'
      email?: string
      name?: string
    }) => eventsApi.submitVote(event.id.toString(), { timeSlotId, voteType, email, name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', event.id] })
      setShowGuestForm(false)
      setSelectedTimeSlot(null)
    },
  })

  const addTimeSlotMutation = useMutation({
    mutationFn: (data: { proposedStartTime: string; proposedEndTime: string }) =>
      eventsApi.addTimeSlot(event.id.toString(), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', event.id] })
    },
  })

  const finalizeMutation = useMutation({
    mutationFn: (timeSlotId: number) =>
      eventsApi.finalizeEvent(event.id.toString(), { timeSlotId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', event.id] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })

  const handleVote = (timeSlotId: number, voteType: 'yes' | 'no' | 'maybe') => {
    if (!isAuthenticated && votingSettings?.allowGuestVoting) {
      setSelectedTimeSlot(timeSlotId)
      setShowGuestForm(true)
      return
    }

    voteMutation.mutate({ timeSlotId, voteType })
  }

  const handleGuestVote = (voteType: 'yes' | 'no' | 'maybe') => {
    if (!selectedTimeSlot || !guestInfo.email || !guestInfo.name) return

    voteMutation.mutate({
      timeSlotId: selectedTimeSlot,
      voteType,
      email: guestInfo.email,
      name: guestInfo.name,
    })
  }

  const getUserVote = (timeSlot: VotingTimeSlot) => {
    if (!isAuthenticated) return null
    return timeSlot.votes?.find(vote => vote.userId === user?.id)
  }

  const canVote = isAuthenticated || votingSettings?.allowGuestVoting
  const isCreator = user?.id === event.creatorId
  const votingDeadlinePassed = votingSettings?.votingDeadline && 
    new Date() > new Date(votingSettings.votingDeadline)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-medium text-gray-900">Vote for your preferred time</h4>
        {votingSettings?.votingDeadline && (
          <div className="text-sm text-gray-600">
            Voting ends: {format(new Date(votingSettings.votingDeadline), 'MMM d, yyyy h:mm a')}
          </div>
        )}
      </div>

      {votingDeadlinePassed && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-yellow-800">Voting deadline has passed.</p>
        </div>
      )}

      <div className="space-y-4">
        {timeSlots.map((timeSlot) => {
          const userVote = getUserVote(timeSlot)
          const totalVotes = timeSlot.voteCount.yes + timeSlot.voteCount.no + timeSlot.voteCount.maybe

          return (
            <div key={timeSlot.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h5 className="font-medium text-gray-900">
                    {format(new Date(timeSlot.proposedStartTime), 'MMM d, yyyy h:mm a')} - 
                    {format(new Date(timeSlot.proposedEndTime), 'h:mm a')}
                  </h5>
                  <p className="text-sm text-gray-600">{totalVotes} votes</p>
                </div>

                {isCreator && totalVotes > 0 && (
                  <button
                    onClick={() => finalizeMutation.mutate(timeSlot.id)}
                    disabled={finalizeMutation.isPending}
                    className="btn btn-primary text-sm"
                  >
                    Finalize
                  </button>
                )}
              </div>

              {/* Vote Counts */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-green-600 font-semibold text-lg">{timeSlot.voteCount.yes}</div>
                  <div className="text-sm text-gray-600">Yes</div>
                </div>
                <div className="text-center">
                  <div className="text-red-600 font-semibold text-lg">{timeSlot.voteCount.no}</div>
                  <div className="text-sm text-gray-600">No</div>
                </div>
                {votingSettings?.allowMaybeVotes && (
                  <div className="text-center">
                    <div className="text-yellow-600 font-semibold text-lg">{timeSlot.voteCount.maybe}</div>
                    <div className="text-sm text-gray-600">Maybe</div>
                  </div>
                )}
              </div>

              {/* Voting Buttons */}
              {canVote && !votingDeadlinePassed && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleVote(timeSlot.id, 'yes')}
                    disabled={voteMutation.isPending}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                      userVote?.voteType === 'yes'
                        ? 'bg-green-100 text-green-800 border border-green-200'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <CheckIcon className="h-4 w-4 mr-1" />
                    Yes
                  </button>
                  
                  <button
                    onClick={() => handleVote(timeSlot.id, 'no')}
                    disabled={voteMutation.isPending}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                      userVote?.voteType === 'no'
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <XMarkIcon className="h-4 w-4 mr-1" />
                    No
                  </button>
                  
                  {votingSettings?.allowMaybeVotes && (
                    <button
                      onClick={() => handleVote(timeSlot.id, 'maybe')}
                      disabled={voteMutation.isPending}
                      className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                        userVote?.voteType === 'maybe'
                          ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <QuestionMarkCircleIcon className="h-4 w-4 mr-1" />
                      Maybe
                    </button>
                  )}
                </div>
              )}

              {/* Vote Details */}
              {timeSlot.votes && timeSlot.votes.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h6 className="text-sm font-medium text-gray-900 mb-2">Votes:</h6>
                  <div className="space-y-1">
                    {timeSlot.votes.map((vote) => (
                      <div key={vote.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center">
                          <UserIcon className="h-4 w-4 mr-2 text-gray-400" />
                          <span className="text-gray-700">
                            {vote.name || `User ${vote.userId}`}
                          </span>
                        </div>
                        <span className={`font-medium ${
                          vote.voteType === 'yes' ? 'text-green-600' :
                          vote.voteType === 'no' ? 'text-red-600' : 'text-yellow-600'
                        }`}>
                          {vote.voteType.charAt(0).toUpperCase() + vote.voteType.slice(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Guest Voting Form */}
      {showGuestForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h5 className="text-lg font-medium text-gray-900 mb-4">Guest Voting</h5>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={guestInfo.name}
                  onChange={(e) => setGuestInfo(prev => ({ ...prev, name: e.target.value }))}
                  className="input"
                  placeholder="Your name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={guestInfo.email}
                  onChange={(e) => setGuestInfo(prev => ({ ...prev, email: e.target.value }))}
                  className="input"
                  placeholder="Your email"
                />
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <button
                onClick={() => setShowGuestForm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              
              <div className="space-x-2">
                <button
                  onClick={() => handleGuestVote('yes')}
                  disabled={!guestInfo.email || !guestInfo.name}
                  className="btn bg-green-600 text-white hover:bg-green-700"
                >
                  Vote Yes
                </button>
                <button
                  onClick={() => handleGuestVote('no')}
                  disabled={!guestInfo.email || !guestInfo.name}
                  className="btn bg-red-600 text-white hover:bg-red-700"
                >
                  Vote No
                </button>
                {votingSettings?.allowMaybeVotes && (
                  <button
                    onClick={() => handleGuestVote('maybe')}
                    disabled={!guestInfo.email || !guestInfo.name}
                    className="btn bg-yellow-600 text-white hover:bg-yellow-700"
                  >
                    Vote Maybe
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {!isAuthenticated && !votingSettings?.allowGuestVoting && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <p className="text-blue-800">Please sign in to vote on this event.</p>
        </div>
      )}
    </div>
  )
}
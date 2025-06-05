export interface User {
  id: number
  email: string
  username: string
  firstName?: string
  lastName?: string
  isVerified: boolean
  createdAt: string
}

export interface Event {
  id: number
  title: string
  description?: string
  creatorId: number
  creatorName?: string
  startTime?: string
  endTime?: string
  location?: string
  isAllDay: boolean
  eventType: 'regular' | 'voting'
  isPublic: boolean
  participantCount?: number
  createdAt: string
}

export interface VotingTimeSlot {
  id: number
  proposedStartTime: string
  proposedEndTime: string
  createdBy?: number
  voteCount: {
    yes: number
    no: number
    maybe: number
  }
  votes: VotingResponse[]
}

export interface VotingResponse {
  id: number
  userId?: number
  email?: string
  name?: string
  voteType: 'yes' | 'no' | 'maybe'
  createdAt: string
}

export interface VotingEventSettings {
  id: number
  eventId: number
  votingDeadline?: string
  allowGuestVoting: boolean
  allowMaybeVotes: boolean
  autoFinalize: boolean
  minVotesRequired: number
  createdAt: string
}

export interface VotingEvent extends Event {
  eventType: 'voting'
  votingSettings?: VotingEventSettings
  timeSlots?: VotingTimeSlot[]
}

export interface CreateEventData {
  title: string
  description?: string
  startTime?: string
  endTime?: string
  location?: string
  isAllDay?: boolean
  isRecurring?: boolean
  recurrenceRule?: string
  eventType: 'regular' | 'voting'
  isPublic?: boolean
  maxParticipants?: number
  participants?: number[]
  votingSettings?: {
    votingDeadline?: string
    allowGuestVoting?: boolean
    allowMaybeVotes?: boolean
    autoFinalize?: boolean
    minVotesRequired?: number
  }
  timeSlots?: {
    proposedStartTime: string
    proposedEndTime: string
  }[]
}
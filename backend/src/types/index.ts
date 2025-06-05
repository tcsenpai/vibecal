export interface User {
  id: number;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  isVerified: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Event {
  id: number;
  title: string;
  description?: string;
  creatorId: number;
  startTime?: Date;
  endTime?: Date;
  location?: string;
  isAllDay: boolean;
  isRecurring: boolean;
  recurrenceRule?: string;
  eventType: 'regular' | 'voting';
  isPublic: boolean;
  maxParticipants?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventParticipant {
  id: number;
  eventId: number;
  userId: number;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
}

export interface VotingTimeSlot {
  id: number;
  eventId: number;
  proposedStartTime: Date;
  proposedEndTime: Date;
  createdBy?: number;
  createdAt: Date;
  votes?: VotingResponse[];
  voteCount?: {
    yes: number;
    no: number;
    maybe: number;
  };
}

export interface VotingResponse {
  id: number;
  timeSlotId: number;
  userId?: number;
  email?: string;
  name?: string;
  voteType: 'yes' | 'no' | 'maybe';
  createdAt: Date;
  updatedAt: Date;
}

export interface VotingEventSettings {
  id: number;
  eventId: number;
  votingDeadline?: Date;
  allowGuestVoting: boolean;
  allowMaybeVotes: boolean;
  autoFinalize: boolean;
  minVotesRequired: number;
  createdAt: Date;
}

export interface CalendarPermission {
  id: number;
  ownerId: number;
  sharedWithId: number;
  permissionLevel: 'read' | 'write' | 'admin';
  createdAt: Date;
}

export interface GuestToken {
  id: number;
  token: string;
  eventId: number;
  email?: string;
  name?: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

export interface CreateEventRequest {
  title: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  isAllDay?: boolean;
  isRecurring?: boolean;
  recurrenceRule?: string;
  eventType: 'regular' | 'voting';
  isPublic?: boolean;
  maxParticipants?: number;
  participants?: number[];
  votingSettings?: {
    votingDeadline?: string;
    allowGuestVoting?: boolean;
    allowMaybeVotes?: boolean;
    autoFinalize?: boolean;
    minVotesRequired?: number;
  };
  timeSlots?: {
    proposedStartTime: string;
    proposedEndTime: string;
  }[];
}

export interface CreateVoteRequest {
  timeSlotId: number;
  voteType: 'yes' | 'no' | 'maybe';
  email?: string;
  name?: string;
}

export interface AuthTokenPayload {
  userId: number;
  email: string;
  username: string;
}
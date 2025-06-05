-- Performance optimization indexes for VibeCal
-- Run this after the main database.sql to add performance improvements

-- Compound indexes for better query performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_creator_time 
ON events(creator_id, start_time, end_time) 
WHERE start_time IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_public_time 
ON events(is_public, start_time, end_time) 
WHERE is_public = true AND start_time IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_type_time 
ON events(event_type, start_time, end_time) 
WHERE start_time IS NOT NULL;

-- Voting-specific indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voting_responses_slot_user 
ON voting_responses(time_slot_id, user_id, vote_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voting_responses_slot_email 
ON voting_responses(time_slot_id, email, vote_type) 
WHERE email IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voting_time_slots_event_time 
ON voting_time_slots(event_id, proposed_start_time);

-- Event participants index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_participants_user_status 
ON event_participants(user_id, status, event_id);

-- Guest tokens index for faster lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_guest_tokens_token_active 
ON guest_tokens(token, expires_at) 
WHERE used_at IS NULL;

-- Calendar permissions for sharing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calendar_permissions_shared_level 
ON calendar_permissions(shared_with_id, permission_level);

-- Add partial indexes for common filters
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_active_public 
ON events(id, title, start_time, end_time) 
WHERE is_public = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_voting_active 
ON events(id, title) 
WHERE event_type = 'voting';

-- Add indexes for calendar objects (WebDAV support)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calendar_objects_calendar_time 
ON calendar_objects(calendar_id, dtstart, dtend) 
WHERE dtstart IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calendar_objects_uid_calendar 
ON calendar_objects(uid, calendar_id);

-- Optimize sync operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sync_changes_calendar_time 
ON sync_changes(calendar_id, created_at, change_type);

-- Statistics update for better query planning
ANALYZE events;
ANALYZE event_participants;
ANALYZE voting_responses;
ANALYZE voting_time_slots;
ANALYZE calendar_objects;
ANALYZE sync_changes;
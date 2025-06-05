-- VibeCal Database Schema

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Calendar events table
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    location VARCHAR(255),
    is_all_day BOOLEAN DEFAULT FALSE,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_rule TEXT, -- JSON string for recurrence rules
    event_type VARCHAR(50) DEFAULT 'regular', -- 'regular' or 'voting'
    is_public BOOLEAN DEFAULT FALSE,
    max_participants INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Event participants (for regular events)
CREATE TABLE event_participants (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, user_id)
);

-- Voting events - proposed time slots
CREATE TABLE voting_time_slots (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    proposed_start_time TIMESTAMP NOT NULL,
    proposed_end_time TIMESTAMP NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User votes for time slots
CREATE TABLE voting_responses (
    id SERIAL PRIMARY KEY,
    time_slot_id INTEGER REFERENCES voting_time_slots(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255), -- For guest voters
    name VARCHAR(255), -- For guest voters  
    vote_type VARCHAR(20) NOT NULL, -- 'yes', 'no', 'maybe'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(time_slot_id, user_id),
    UNIQUE(time_slot_id, email)
);

-- Voting event settings
CREATE TABLE voting_event_settings (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE UNIQUE,
    voting_deadline TIMESTAMP,
    allow_guest_voting BOOLEAN DEFAULT FALSE,
    allow_maybe_votes BOOLEAN DEFAULT TRUE,
    auto_finalize BOOLEAN DEFAULT FALSE, -- Auto-create event when deadline reached
    min_votes_required INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Calendar sharing permissions
CREATE TABLE calendar_permissions (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    shared_with_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    permission_level VARCHAR(20) DEFAULT 'read', -- 'read', 'write', 'admin'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(owner_id, shared_with_id)
);

-- Guest access tokens for voting events
CREATE TABLE guest_tokens (
    id SERIAL PRIMARY KEY,
    token VARCHAR(255) UNIQUE NOT NULL,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    email VARCHAR(255),
    name VARCHAR(255),
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_events_creator_id ON events(creator_id);
CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_event_participants_event_id ON event_participants(event_id);
CREATE INDEX idx_event_participants_user_id ON event_participants(user_id);
CREATE INDEX idx_voting_time_slots_event_id ON voting_time_slots(event_id);
CREATE INDEX idx_voting_responses_time_slot_id ON voting_responses(time_slot_id);
CREATE INDEX idx_voting_responses_user_id ON voting_responses(user_id);
CREATE INDEX idx_calendar_permissions_owner_id ON calendar_permissions(owner_id);
CREATE INDEX idx_calendar_permissions_shared_with_id ON calendar_permissions(shared_with_id);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_voting_responses_updated_at BEFORE UPDATE ON voting_responses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- CalDAV/WebDAV Extensions

-- Calendar collections for CalDAV
CREATE TABLE calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    description TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6',
    timezone VARCHAR(50) DEFAULT 'UTC',
    sync_token VARCHAR(255) NOT NULL DEFAULT gen_random_uuid()::text,
    is_default BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,
    webdav_enabled BOOLEAN DEFAULT TRUE,
    webcal_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Calendar objects (events in iCalendar format)
CREATE TABLE calendar_objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE, -- Link to existing events
    uid VARCHAR(255) NOT NULL, -- iCalendar UID
    etag VARCHAR(255) NOT NULL DEFAULT gen_random_uuid()::text,
    icalendar_data TEXT NOT NULL, -- Raw iCalendar data
    component_type VARCHAR(20) NOT NULL DEFAULT 'VEVENT', -- VEVENT, VTODO, VJOURNAL, etc.
    summary VARCHAR(255),
    dtstart TIMESTAMP,
    dtend TIMESTAMP,
    dtstamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sequence INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'CONFIRMED', -- TENTATIVE, CONFIRMED, CANCELLED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(calendar_id, uid)
);

-- WebDAV properties
CREATE TABLE webdav_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_path VARCHAR(500) NOT NULL,
    namespace VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(resource_path, namespace, name)
);

-- Sync changes for incremental sync
CREATE TABLE sync_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
    object_id UUID REFERENCES calendar_objects(id) ON DELETE CASCADE,
    change_type VARCHAR(10) NOT NULL, -- 'create', 'update', 'delete'
    sync_token VARCHAR(255) NOT NULL,
    resource_path VARCHAR(500),
    etag VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WebDAV locks
CREATE TABLE webdav_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_path VARCHAR(500) NOT NULL,
    lock_token VARCHAR(255) NOT NULL UNIQUE,
    lock_type VARCHAR(20) NOT NULL DEFAULT 'write', -- 'write' or 'read'
    lock_scope VARCHAR(20) NOT NULL DEFAULT 'exclusive', -- 'exclusive' or 'shared'
    depth VARCHAR(10) NOT NULL DEFAULT '0', -- '0', '1', 'infinity'
    owner_info TEXT,
    timeout_seconds INTEGER DEFAULT 3600, -- 1 hour default
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

-- Calendar subscriptions (for external calendar feeds)
CREATE TABLE calendar_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    color VARCHAR(7) DEFAULT '#6B7280',
    refresh_interval INTEGER DEFAULT 3600, -- seconds
    last_sync TIMESTAMP,
    sync_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'syncing', 'success', 'error'
    error_message TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for CalDAV performance
CREATE INDEX idx_calendars_user_id ON calendars(user_id);
CREATE INDEX idx_calendars_sync_token ON calendars(sync_token);
CREATE INDEX idx_calendar_objects_calendar_id ON calendar_objects(calendar_id);
CREATE INDEX idx_calendar_objects_uid ON calendar_objects(uid);
CREATE INDEX idx_calendar_objects_dtstart ON calendar_objects(dtstart);
CREATE INDEX idx_calendar_objects_component_type ON calendar_objects(component_type);
CREATE INDEX idx_calendar_objects_event_id ON calendar_objects(event_id);
CREATE INDEX idx_webdav_properties_resource_path ON webdav_properties(resource_path);
CREATE INDEX idx_sync_changes_calendar_id ON sync_changes(calendar_id);
CREATE INDEX idx_sync_changes_sync_token ON sync_changes(sync_token);
CREATE INDEX idx_webdav_locks_resource_path ON webdav_locks(resource_path);
CREATE INDEX idx_webdav_locks_expires_at ON webdav_locks(expires_at);
CREATE INDEX idx_calendar_subscriptions_user_id ON calendar_subscriptions(user_id);

-- Additional triggers for CalDAV tables
CREATE TRIGGER update_calendars_updated_at BEFORE UPDATE ON calendars FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_calendar_objects_updated_at BEFORE UPDATE ON calendar_objects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_webdav_properties_updated_at BEFORE UPDATE ON webdav_properties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_calendar_subscriptions_updated_at BEFORE UPDATE ON calendar_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate new sync token when calendar changes
CREATE OR REPLACE FUNCTION generate_sync_token()
RETURNS TRIGGER AS $$
BEGIN
    -- Update calendar sync token
    UPDATE calendars 
    SET sync_token = gen_random_uuid()::text,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = COALESCE(NEW.calendar_id, OLD.calendar_id);
    
    -- Log the change
    INSERT INTO sync_changes (calendar_id, object_id, change_type, sync_token, resource_path, etag)
    VALUES (
        COALESCE(NEW.calendar_id, OLD.calendar_id),
        COALESCE(NEW.id, OLD.id),
        CASE 
            WHEN TG_OP = 'INSERT' THEN 'create'
            WHEN TG_OP = 'UPDATE' THEN 'update'
            WHEN TG_OP = 'DELETE' THEN 'delete'
        END,
        (SELECT sync_token FROM calendars WHERE id = COALESCE(NEW.calendar_id, OLD.calendar_id)),
        '/calendars/' || COALESCE(NEW.calendar_id, OLD.calendar_id)::text || '/' || COALESCE(NEW.id, OLD.id)::text || '.ics',
        COALESCE(NEW.etag, OLD.etag)
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Triggers to automatically update sync tokens
CREATE TRIGGER calendar_objects_sync_trigger
    AFTER INSERT OR UPDATE OR DELETE ON calendar_objects
    FOR EACH ROW EXECUTE FUNCTION generate_sync_token();

-- Function to clean up expired locks
CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM webdav_locks WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ language 'plpgsql';

-- Create default calendar for existing users
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT id, username FROM users LOOP
        INSERT INTO calendars (user_id, name, display_name, is_default)
        VALUES (user_record.id, 'default', user_record.username || '''s Calendar', TRUE)
        ON CONFLICT DO NOTHING;
    END LOOP;
END;
$$;
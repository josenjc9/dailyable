CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('participant', 'supporter')),
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS pairing_invites (
  id text PRIMARY KEY,
  participant_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  claimed_by text REFERENCES users(id),
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS invites_participant_idx ON pairing_invites(participant_id);
CREATE TABLE IF NOT EXISTS support_relationships (
  id text PRIMARY KEY,
  participant_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supporter_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending_confirmation','active','revoked')),
  scopes_json jsonb NOT NULL DEFAULT '[]',
  confirmed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(participant_id, supporter_id)
);
CREATE INDEX IF NOT EXISTS relationships_participant_idx ON support_relationships(participant_id, status);
CREATE INDEX IF NOT EXISTS relationships_supporter_idx ON support_relationships(supporter_id, status);
CREATE TABLE IF NOT EXISTS check_ins (
  id text PRIMARY KEY, participant_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  input_json jsonb NOT NULL, result_json jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS checkins_participant_idx ON check_ins(participant_id, created_at);
CREATE TABLE IF NOT EXISTS support_plans (
  id text PRIMARY KEY, relationship_id text NOT NULL REFERENCES support_relationships(id) ON DELETE CASCADE,
  content_json jsonb NOT NULL, created_by text NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS plans_relationship_idx ON support_plans(relationship_id);
CREATE TABLE IF NOT EXISTS follow_ups (
  id text PRIMARY KEY, relationship_id text NOT NULL REFERENCES support_relationships(id) ON DELETE CASCADE,
  actor_id text NOT NULL REFERENCES users(id), action text NOT NULL CHECK (action IN ('contacted','scheduled','closed')),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS followups_relationship_idx ON follow_ups(relationship_id, created_at);
CREATE TABLE IF NOT EXISTS consent_events (
  id text PRIMARY KEY, relationship_id text NOT NULL REFERENCES support_relationships(id) ON DELETE CASCADE,
  actor_id text NOT NULL REFERENCES users(id), event_type text NOT NULL,
  details_json jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS consent_relationship_idx ON consent_events(relationship_id, created_at);
CREATE TABLE IF NOT EXISTS audit_events (
  id text PRIMARY KEY, actor_id text REFERENCES users(id), event_type text NOT NULL,
  subject_type text NOT NULL, subject_id text NOT NULL, details_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS audit_subject_idx ON audit_events(subject_type, subject_id, created_at);

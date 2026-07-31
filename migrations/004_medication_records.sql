-- Medication is recorded, not judged. One row per intake, so "what was taken", "when" and
-- "how many times today" all fall out of the same records without the product ever having
-- to score adherence or tell someone what to do about a missed dose.

CREATE TABLE IF NOT EXISTS medication_records (
  id text PRIMARY KEY,
  participant_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  taken_at timestamptz NOT NULL,
  name text,
  note text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS medications_participant_idx ON medication_records(participant_id, taken_at DESC);

-- Counting doses only means something against what was supposed to happen. Without the
-- prescribed pattern, "two doses yesterday" is a number with nothing to compare it to, and
-- neither the person nor their supporter can tell whether that is the usual day or not.
--
-- The plan is what the participant enters about their own prescription. The product does
-- not prescribe, does not alter a plan, and does not tell anyone what to do about a day
-- that does not match — it only makes the difference visible.

CREATE TABLE IF NOT EXISTS medication_plans (
  id text PRIMARY KEY,
  participant_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  times_per_day integer,
  instructions text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS medication_plans_participant_idx ON medication_plans(participant_id, active);

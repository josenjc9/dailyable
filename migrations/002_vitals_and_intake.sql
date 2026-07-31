-- Body records kept the way nursing documentation expects them, so that what a
-- participant logs at home is still readable to a clinician at the appointment.
--
-- Two shapes matter here and the earlier prototype got both wrong:
--   * blood pressure is systolic AND diastolic (pulse and posture belong with it);
--     a single number cannot be read against any reference range
--   * a glucose value is meaningless without the timing context, because the
--     fasting and two-hour-post-meal ranges are different
--
-- Every measurement column is nullable on purpose. People log what they can on the
-- day they can; a partial record is still a real record.

CREATE TABLE IF NOT EXISTS vital_records (
  id text PRIMARY KEY,
  participant_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  measured_at timestamptz NOT NULL,
  systolic integer CHECK (systolic IS NULL OR systolic BETWEEN 40 AND 300),
  diastolic integer CHECK (diastolic IS NULL OR diastolic BETWEEN 20 AND 200),
  pulse integer CHECK (pulse IS NULL OR pulse BETWEEN 20 AND 250),
  posture text CHECK (posture IS NULL OR posture IN ('sitting', 'lying', 'standing', 'unspecified')),
  glucose numeric CHECK (glucose IS NULL OR glucose BETWEEN 10 AND 800),
  glucose_context text CHECK (glucose_context IS NULL OR glucose_context IN ('fasting', 'post-meal-2h', 'random', 'unspecified')),
  water_ml integer CHECK (water_ml IS NULL OR water_ml BETWEEN 0 AND 10000),
  note text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS vitals_participant_idx ON vital_records(participant_id, measured_at DESC);

CREATE TABLE IF NOT EXISTS meal_records (
  id text PRIMARY KEY,
  participant_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  eaten_at timestamptz NOT NULL,
  meal_slot text CHECK (meal_slot IS NULL OR meal_slot IN ('breakfast', 'lunch', 'dinner', 'snack', 'unspecified')),
  description text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS meals_participant_idx ON meal_records(participant_id, eaten_at DESC);

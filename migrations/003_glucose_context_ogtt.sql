-- An ordinary reading two hours after eating and the second hour of a 75 g oral glucose
-- tolerance test are different measurements. Only the OGTT has a published threshold, so
-- they must be stored as separate contexts; collapsing them would let a diagnostic number
-- be applied to a reading that cannot carry it.

ALTER TABLE vital_records DROP CONSTRAINT IF EXISTS vital_records_glucose_context_check;
ALTER TABLE vital_records ADD CONSTRAINT vital_records_glucose_context_check
  CHECK (glucose_context IS NULL OR glucose_context IN ('fasting', 'post-meal-2h', 'ogtt-2h', 'random', 'unspecified'));

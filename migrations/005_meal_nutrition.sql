-- Meals gain the numbers a clinician and a participant actually talk about: energy,
-- carbohydrate and protein. Fat is kept alongside them because a food label carries it and
-- leaving it out would force people to drop information they already have in their hand.
--
-- All of them are nullable. Most people will write "congee and an egg" and nothing else,
-- and that entry has to stay just as valid as one with four numbers attached.
--
-- Ranges are enforced in the application rather than as column constraints: the migration
-- runner records applied versions so this file executes once, and the in-memory Postgres
-- used by the tests does not support the conditional forms.

ALTER TABLE meal_records ADD COLUMN kcal numeric;
ALTER TABLE meal_records ADD COLUMN carb_g numeric;
ALTER TABLE meal_records ADD COLUMN protein_g numeric;
ALTER TABLE meal_records ADD COLUMN fat_g numeric;

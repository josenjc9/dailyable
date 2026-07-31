// Turns a month of scattered entries into something a clinician can read in half a minute,
// and into the "this is different from your own usual" signal a supporter is allowed to see.
//
// The comparison is always against the person's own earlier readings — never against a
// population range, and never as a verdict. The output says what was recorded, what is
// missing, and where today sits relative to their own recent days. Nothing here decides
// what any of it means.

const DAY = 86400_000;

function within(records, field, now, days) {
  const cutoff = now - days * DAY;
  return records
    .filter((record) => Date.parse(record.measuredAt) >= cutoff)
    .map((record) => record[field])
    .filter((value) => value !== null && value !== undefined)
    .map(Number)
    .filter(Number.isFinite);
}

const average = (values) => (values.length ? values.reduce((total, value) => total + value, 0) / values.length : null);
const round = (value) => (value === null ? null : Math.round(value * 10) / 10);

// A reading counts as "different from usual" only when there is enough history to say so.
// With fewer than four earlier readings this returns null rather than guessing.
function deviation(recent, baseline) {
  if (recent === null || baseline === null) return null;
  const change = recent - baseline;
  return { change: round(change), direction: change > 0 ? 'higher' : change < 0 ? 'lower' : 'same' };
}

// Three months, because that is the span a clinician usually looks back over at a visit,
// and it leaves enough earlier readings for the recent week to be compared against.
const WINDOW_DAYS = 90;

// Nutrition is totalled per day and then averaged over the days that actually have
// numbers. Averaging over every day in the window would quietly punish anyone who wrote
// the food down but not the figures, and make it look like they ate almost nothing.
function buildMealSummary(meals, now) {
  const inWindow = meals.filter((record) => Date.parse(record.eatenAt) >= now - WINDOW_DAYS * DAY);
  const fields = [['kcal', 'kcal'], ['carbG', 'carbohydrate'], ['proteinG', 'protein'], ['fatG', 'fat']];
  const perDay = new Map();

  for (const record of inWindow) {
    const day = String(record.eatenAt).slice(0, 10);
    const totals = perDay.get(day) || { kcal: null, carbG: null, proteinG: null, fatG: null };
    for (const [key] of fields) {
      const value = record[key];
      if (value === null || value === undefined) continue;
      totals[key] = (totals[key] || 0) + Number(value);
    }
    perDay.set(day, totals);
  }

  const nutrition = {};
  for (const [key] of fields) {
    const days = [...perDay.values()].map((totals) => totals[key]).filter((value) => value !== null);
    nutrition[key] = {
      daysWithFigures: days.length,
      dailyAverage: days.length ? round(days.reduce((total, value) => total + value, 0) / days.length) : null
    };
  }

  return {
    entriesRecorded: inWindow.length,
    daysWithAnyMeal: perDay.size,
    // Entries where the food was written but no figures were attached — a normal thing to
    // do, and stated here rather than silently folded into the averages.
    entriesWithoutFigures: inWindow.filter((record) =>
      [record.kcal, record.carbG, record.proteinG, record.fatG].every((value) => value === null || value === undefined)
    ).length,
    nutrition,
    recentDays: [...perDay.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14)
  };
}

// Doses recorded against the pattern the participant said they were prescribed. This is
// arithmetic on their own two entries, not an adherence judgement: the summary reports the
// days that match and the days that do not, and stops there. Nobody is scored, and no
// advice is attached to a day that came up short.
function buildMedicationSummary(medications, plans, now) {
  const inWindow = medications.filter((record) => Date.parse(record.takenAt) >= now - WINDOW_DAYS * DAY);
  const perDay = new Map();
  for (const record of inWindow) {
    const day = String(record.takenAt).slice(0, 10);
    perDay.set(day, (perDay.get(day) || 0) + 1);
  }

  const expectedPerDay = plans
    .filter((plan) => plan.active !== false && Number.isFinite(Number(plan.timesPerDay)))
    .reduce((total, plan) => total + Number(plan.timesPerDay), 0);

  const byDay = [...perDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const daysMatchingPlan = expectedPerDay
    ? byDay.filter(([, count]) => count === expectedPerDay).length
    : null;
  const daysBelowPlan = expectedPerDay
    ? byDay.filter(([, count]) => count < expectedPerDay).length
    : null;

  return {
    daysRecorded: perDay.size,
    dosesRecorded: [...perDay.values()].reduce((total, count) => total + count, 0),
    plans: plans.map((plan) => ({ name: plan.name, timesPerDay: plan.timesPerDay ?? null, instructions: plan.instructions ?? null })),
    // Null means no plan with a daily count was entered, so there is nothing to compare
    // against — stated rather than defaulted to zero, which would read as a failure.
    expectedPerDay: expectedPerDay || null,
    daysMatchingPlan,
    daysBelowPlan,
    byDay: byDay.slice(0, 30)
  };
}

export function buildSummary({ vitals = [], medications = [], meals = [], medicationPlans = [], now = Date.now() } = {}) {
  const fields = ['systolic', 'diastolic', 'pulse', 'glucose', 'waterMl'];
  const measures = {};

  for (const field of fields) {
    const last7 = within(vitals, field, now, 7);
    const wholeWindow = within(vitals, field, now, WINDOW_DAYS);
    const earlier = wholeWindow.slice(last7.length);
    const recentAverage = average(last7);
    const baselineAverage = earlier.length >= 4 ? average(earlier) : null;
    measures[field] = {
      recordedInWindow: wholeWindow.length,
      recentAverage: round(recentAverage),
      baselineAverage: round(baselineAverage),
      // Null means "not enough of their own history to compare", which is stated rather
      // than filled in with a number that would look like a finding.
      comparedWithOwnBaseline: deviation(recentAverage, baselineAverage)
    };
  }

  const glucoseByContext = {};
  for (const record of vitals) {
    if (record.glucose === null || record.glucose === undefined) continue;
    if (Date.parse(record.measuredAt) < now - WINDOW_DAYS * DAY) continue;
    const context = record.glucoseContext || 'unspecified';
    glucoseByContext[context] = glucoseByContext[context] || [];
    glucoseByContext[context].push(Number(record.glucose));
  }
  const glucoseContexts = Object.entries(glucoseByContext).map(([context, values]) => ({
    context,
    count: values.length,
    average: round(average(values)),
    // Carried through so a clinician can see which readings cannot be compared to anything.
    interpretable: context !== 'unspecified'
  }));

  const daysWithAnyRecord = new Set([
    ...vitals.map((record) => String(record.measuredAt).slice(0, 10)),
    ...medications.map((record) => String(record.takenAt).slice(0, 10)),
    ...meals.map((record) => String(record.eatenAt).slice(0, 10))
  ]);

  return {
    generatedAt: new Date(now).toISOString(),
    windowDays: WINDOW_DAYS,
    measures,
    glucoseContexts,
    medication: buildMedicationSummary(medications, medicationPlans, now),
    meals: buildMealSummary(meals, now),
    coverage: { daysWithAnyRecord: daysWithAnyRecord.size },
    boundary: 'Recorded values and the person’s own trend. No diagnosis, no risk score, no interpretation.'
  };
}

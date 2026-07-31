import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import QRCode from 'qrcode';
import { createDailySupport, observationsFrom } from './support-engine.js';
import { knowledgeFor, safetyEntries } from './knowledge-engine.js';
import { careFor, HELPLINES, ATTRIBUTION, LTC_BENEFITS, LTC_ELIGIBILITY } from './care-knowledge.js';
import { analyse, llmStats } from './analysis-llm.js';
import { keepIfSafe } from './analysis-guard.js';
import { REFERENCE } from './reference-ranges.js';
import { buildSummary } from './summary.js';
import { searchFoods, nutritionFor } from './food-database.js';
import { connectDatabase } from './migrate.js';
import { MemoryStore, PostgresStore, newToken } from './store.js';
import { demoStateFor, rememberDemoEntry, forgetDemoState } from './demo-state.js';

const ROOT = join(fileURLToPath(new URL('..', import.meta.url)), 'public');
const MAX_BODY = 16 * 1024;

// Judges must be able to walk the whole product without an account. Demo access is a
// separate, read-only lane: it never creates a database row, never reaches a real
// relationship, and never opens the real sign-in path (POST /api/session stays 503).
export const DEMO_PERSONAS = new Map([
  ['alex', { id: 'alex', role: 'participant', displayName: 'Alex', blurb: 'Lower energy for three days; morning routine paused.' }],
  ['jordan', { id: 'jordan', role: 'supporter', displayName: 'Jordan', blurb: 'Supports Alex and reviews the shared follow-up each morning.' }]
]);

const DEMO_COOKIE = 'dailyable_demo';
const DEMO_VISIT_COOKIE = 'dailyable_demo_visit';

// Demo state is public by design, so the cookie carries no secret and survives restarts.
// Every value is validated against DEMO_PERSONAS before it becomes a user.
function demoUserFromRequest(req) {
  const cookies = String(req.headers.cookie || '');
  const match = cookies.match(/(?:^|;\s*)dailyable_demo=([^;]+)/);
  if (!match) return null;
  let personaId;
  try {
    personaId = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  const persona = DEMO_PERSONAS.get(personaId);
  if (!persona) return null;
  // 第二個 cookie 只是一個訪客編號，用來把這一輪填進去的東西跟別人的分開。它不帶任何
  // 身分或秘密——展示資料本來就是公開的——沒有它就退回只讀準備好的那份。
  const visit = cookies.match(/(?:^|;\s*)dailyable_demo_visit=([a-zA-Z0-9-]+)/);
  return {
    id: `demo-${persona.id}`,
    role: persona.role,
    displayName: persona.displayName,
    demo: true,
    // 編號只綁這一次瀏覽、不綁角色：本人剛填的東西，切到支持者那邊要看得到，
    // 那條「回報 → 支持者收到」的線才成立。
    stateId: visit ? visit[1] : null
  };
}

const POSTURES = new Set(['sitting', 'lying', 'standing', 'unspecified']);
// 'post-meal-2h' and 'ogtt-2h' are deliberately separate: only the oral glucose tolerance
// test has a published threshold, and applying it to an ordinary post-meal reading would
// attach a diagnostic meaning the number cannot carry.
const GLUCOSE_CONTEXTS = new Set(['fasting', 'post-meal-2h', 'ogtt-2h', 'random', 'unspecified']);
const MEAL_SLOTS = new Set(['breakfast', 'lunch', 'dinner', 'snack', 'unspecified']);

// Everything except the time is optional: people log what they can manage that day.
// A blank field stays blank rather than becoming a zero, so a gap reads as "not recorded"
// instead of a measurement that never happened.
function optionalNumber(value, { min, max, label }) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new RangeError(`Check the ${label} value.`);
  if (parsed < min || parsed > max) throw new RangeError(`${label} looks outside the range a home device would report.`);
  return parsed;
}

function optionalChoice(value, allowed, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return allowed.has(String(value)) ? String(value) : fallback;
}

function normalizeVitalInput(input, now) {
  const measuredAt = input.measuredAt ? new Date(input.measuredAt) : now;
  if (Number.isNaN(measuredAt.getTime())) throw new RangeError('Check the measurement time.');
  return {
    measuredAt: measuredAt.toISOString(),
    systolic: optionalNumber(input.systolic, { min: 40, max: 300, label: 'systolic' }),
    diastolic: optionalNumber(input.diastolic, { min: 20, max: 200, label: 'diastolic' }),
    pulse: optionalNumber(input.pulse, { min: 20, max: 250, label: 'pulse' }),
    posture: optionalChoice(input.posture, POSTURES, 'unspecified'),
    glucose: optionalNumber(input.glucose, { min: 10, max: 800, label: 'glucose' }),
    // Without the timing context a glucose number cannot be read against any range, so a
    // missing context is carried through as "unspecified" and shown that way to clinicians.
    glucoseContext: optionalChoice(input.glucoseContext, GLUCOSE_CONTEXTS, 'unspecified'),
    waterMl: optionalNumber(input.waterMl, { min: 0, max: 10000, label: 'water' }),
    note: String(input.note || '').trim().slice(0, 500) || null
  };
}

function recordHasAnyValue(record) {
  return ['systolic', 'diastolic', 'pulse', 'glucose', 'waterMl', 'note'].some((key) => record[key] !== null);
}

function normalizeMealInput(input, now) {
  const eatenAt = input.eatenAt ? new Date(input.eatenAt) : now;
  if (Number.isNaN(eatenAt.getTime())) throw new RangeError('Check the meal time.');
  return {
    eatenAt: eatenAt.toISOString(),
    mealSlot: optionalChoice(input.mealSlot, MEAL_SLOTS, 'unspecified'),
    description: String(input.description || '').trim().slice(0, 300) || null,
    // Optional like everything else: "congee and an egg" with no numbers is a real entry.
    kcal: optionalNumber(input.kcal, { min: 0, max: 10000, label: 'energy' }),
    carbG: optionalNumber(input.carbG, { min: 0, max: 2000, label: 'carbohydrate' }),
    proteinG: optionalNumber(input.proteinG, { min: 0, max: 2000, label: 'protein' }),
    fatG: optionalNumber(input.fatG, { min: 0, max: 2000, label: 'fat' })
  };
}

// The prepared set spans a month on purpose. Without earlier readings there is nothing to
// compare the recent week against, and the one thing worth showing — "this is different
// from your own usual" — would read as "not enough data" on every line.
// It also deliberately contains gaps and one entry with only a glucose reading, so the
// partial case a real person produces is visible rather than hidden behind tidy rows.
const DEMO_VITALS = [
  { id: 'demo-v-1', measuredAt: '2026-07-26T00:10:00.000Z', systolic: 148, diastolic: 92, pulse: 88, posture: 'sitting', glucose: 132, glucoseContext: 'fasting', waterMl: 600, note: 'Felt tired on waking.' },
  { id: 'demo-v-2', measuredAt: '2026-07-25T00:05:00.000Z', systolic: 144, diastolic: 90, pulse: 84, posture: 'sitting', glucose: null, glucoseContext: 'unspecified', waterMl: 1200, note: null },
  { id: 'demo-v-3', measuredAt: '2026-07-24T00:00:00.000Z', systolic: 141, diastolic: 88, pulse: 82, posture: 'sitting', glucose: 128, glucoseContext: 'fasting', waterMl: 1500, note: null },
  { id: 'demo-v-4', measuredAt: '2026-07-23T00:00:00.000Z', systolic: null, diastolic: null, pulse: null, posture: 'unspecified', glucose: 158, glucoseContext: 'post-meal-2h', waterMl: 900, note: 'Only had time for a glucose check.' },
  { id: 'demo-v-5', measuredAt: '2026-07-21T00:05:00.000Z', systolic: 139, diastolic: 86, pulse: 80, posture: 'sitting', glucose: 121, glucoseContext: 'fasting', waterMl: 1400, note: null },
  { id: 'demo-v-6', measuredAt: '2026-07-19T00:00:00.000Z', systolic: 131, diastolic: 82, pulse: 74, posture: 'sitting', glucose: null, glucoseContext: 'unspecified', waterMl: 1600, note: null },
  { id: 'demo-v-7', measuredAt: '2026-07-17T23:55:00.000Z', systolic: 128, diastolic: 80, pulse: 72, posture: 'sitting', glucose: 106, glucoseContext: 'fasting', waterMl: 1500, note: null },
  { id: 'demo-v-8', measuredAt: '2026-07-15T00:00:00.000Z', systolic: 126, diastolic: 79, pulse: 70, posture: 'sitting', glucose: null, glucoseContext: 'unspecified', waterMl: 1550, note: 'Walked after dinner.' },
  { id: 'demo-v-9', measuredAt: '2026-07-12T00:10:00.000Z', systolic: 129, diastolic: 81, pulse: 73, posture: 'sitting', glucose: 102, glucoseContext: 'fasting', waterMl: 1450, note: null },
  { id: 'demo-v-10', measuredAt: '2026-07-09T00:00:00.000Z', systolic: 124, diastolic: 78, pulse: 71, posture: 'sitting', glucose: 149, glucoseContext: 'random', waterMl: 1500, note: null },
  { id: 'demo-v-11', measuredAt: '2026-07-05T00:00:00.000Z', systolic: 127, diastolic: 80, pulse: 72, posture: 'sitting', glucose: 99, glucoseContext: 'fasting', waterMl: 1600, note: null },
  { id: 'demo-v-12', measuredAt: '2026-07-02T00:00:00.000Z', systolic: 125, diastolic: 78, pulse: 70, posture: 'sitting', glucose: null, glucoseContext: 'unspecified', waterMl: 1500, note: null },
  { id: 'demo-v-13', measuredAt: '2026-06-27T00:00:00.000Z', systolic: 123, diastolic: 77, pulse: 69, posture: 'sitting', glucose: 101, glucoseContext: 'fasting', waterMl: 1550, note: null },
  { id: 'demo-v-14', measuredAt: '2026-06-22T00:00:00.000Z', systolic: 126, diastolic: 79, pulse: 71, posture: 'sitting', glucose: null, glucoseContext: 'unspecified', waterMl: 1400, note: 'Busy week, forgot most days.' },
  { id: 'demo-v-15', measuredAt: '2026-06-16T00:00:00.000Z', systolic: 122, diastolic: 76, pulse: 68, posture: 'sitting', glucose: 97, glucoseContext: 'fasting', waterMl: 1600, note: null },
  { id: 'demo-v-16', measuredAt: '2026-06-09T00:00:00.000Z', systolic: 124, diastolic: 78, pulse: 70, posture: 'sitting', glucose: 152, glucoseContext: 'post-meal-2h', waterMl: 1500, note: null },
  { id: 'demo-v-17', measuredAt: '2026-06-02T00:00:00.000Z', systolic: 121, diastolic: 76, pulse: 68, posture: 'sitting', glucose: 96, glucoseContext: 'fasting', waterMl: 1650, note: null },
  { id: 'demo-v-18', measuredAt: '2026-05-24T00:00:00.000Z', systolic: 123, diastolic: 77, pulse: 69, posture: 'sitting', glucose: null, glucoseContext: 'unspecified', waterMl: 1500, note: null },
  { id: 'demo-v-19', measuredAt: '2026-05-15T00:00:00.000Z', systolic: 120, diastolic: 75, pulse: 67, posture: 'sitting', glucose: 94, glucoseContext: 'fasting', waterMl: 1600, note: null },
  { id: 'demo-v-20', measuredAt: '2026-05-06T00:00:00.000Z', systolic: 122, diastolic: 76, pulse: 68, posture: 'sitting', glucose: 188, glucoseContext: 'ogtt-2h', waterMl: 1550, note: 'Tolerance test at the clinic.' }
];

const DEMO_MEDICATION_PLANS = [
  { id: 'demo-plan-1', name: 'Metformin 500 mg', timesPerDay: 2, instructions: 'With breakfast and dinner', active: true },
  { id: 'demo-plan-2', name: 'Amlodipine 5 mg', timesPerDay: 1, instructions: 'In the morning', active: true }
];

const DEMO_MEDICATIONS = [
  { id: 'demo-rx-1', takenAt: '2026-07-26T00:20:00.000Z', name: 'Metformin 500 mg', note: 'With breakfast' },
  { id: 'demo-rx-2', takenAt: '2026-07-25T12:10:00.000Z', name: 'Metformin 500 mg', note: null },
  { id: 'demo-rx-3', takenAt: '2026-07-25T00:15:00.000Z', name: 'Metformin 500 mg', note: 'With breakfast' },
  { id: 'demo-rx-4', takenAt: '2026-07-25T00:15:00.000Z', name: 'Amlodipine 5 mg', note: null },
  { id: 'demo-rx-5', takenAt: '2026-07-24T00:15:00.000Z', name: 'Metformin 500 mg', note: null },
  { id: 'demo-rx-6', takenAt: '2026-07-21T00:20:00.000Z', name: 'Metformin 500 mg', note: null },
  { id: 'demo-rx-7', takenAt: '2026-07-21T12:05:00.000Z', name: 'Metformin 500 mg', note: null },
  { id: 'demo-rx-8', takenAt: '2026-07-17T00:10:00.000Z', name: 'Amlodipine 5 mg', note: null },
  { id: 'demo-rx-9', takenAt: '2026-07-12T00:15:00.000Z', name: 'Metformin 500 mg', note: null },
  { id: 'demo-rx-10', takenAt: '2026-06-27T00:20:00.000Z', name: 'Metformin 500 mg', note: null },
  { id: 'demo-rx-11', takenAt: '2026-06-16T00:15:00.000Z', name: 'Amlodipine 5 mg', note: null },
  { id: 'demo-rx-12', takenAt: '2026-06-02T00:10:00.000Z', name: 'Metformin 500 mg', note: null },
  { id: 'demo-rx-13', takenAt: '2026-05-15T00:15:00.000Z', name: 'Metformin 500 mg', note: null }
];

// Some entries carry figures and some carry only the food, because that is how people
// actually record meals. The summary reports both rather than pretending every day has
// numbers attached.
const DEMO_MEALS = [
  { id: 'demo-m-1', eatenAt: '2026-07-26T00:30:00.000Z', mealSlot: 'breakfast', description: 'Congee, one boiled egg', kcal: 320, carbG: 48, proteinG: 11, fatG: 8 },
  { id: 'demo-m-2', eatenAt: '2026-07-25T11:00:00.000Z', mealSlot: 'dinner', description: 'Rice, stir-fried greens, tofu', kcal: 610, carbG: 82, proteinG: 24, fatG: 18 },
  { id: 'demo-m-3', eatenAt: '2026-07-25T04:00:00.000Z', mealSlot: 'lunch', description: 'Noodle soup', kcal: 480, carbG: 70, proteinG: 18, fatG: 12 },
  { id: 'demo-m-4', eatenAt: '2026-07-23T00:40:00.000Z', mealSlot: 'breakfast', description: 'Toast and soy milk', kcal: 350, carbG: 52, proteinG: 12, fatG: 9 },
  { id: 'demo-m-5', eatenAt: '2026-07-21T11:30:00.000Z', mealSlot: 'dinner', description: 'Braised pork rice, pickled greens', kcal: 780, carbG: 96, proteinG: 26, fatG: 30 },
  { id: 'demo-m-6', eatenAt: '2026-07-17T04:20:00.000Z', mealSlot: 'lunch', description: 'Bento — rice, egg, cabbage' },
  { id: 'demo-m-7', eatenAt: '2026-07-12T00:35:00.000Z', mealSlot: 'breakfast', description: 'Congee' },
  { id: 'demo-m-8', eatenAt: '2026-06-27T11:45:00.000Z', mealSlot: 'dinner', description: 'Fish, rice, greens' },
  { id: 'demo-m-9', eatenAt: '2026-06-16T04:10:00.000Z', mealSlot: 'lunch', description: 'Noodles with beef' },
  { id: 'demo-m-10', eatenAt: '2026-06-02T00:30:00.000Z', mealSlot: 'breakfast', description: 'Steamed bun and tea' },
  { id: 'demo-m-11', eatenAt: '2026-05-15T11:50:00.000Z', mealSlot: 'dinner', description: 'Rice, tofu, soup' }
];

// Three entries were enough to fill a "recent check-ins" list and nothing else: picking a
// month or a quarter showed almost the same three days. This set covers a quarter with the
// same arc the readings tell — steady through May, unsettled from late June, hardest in the
// last fortnight — and the same honest gaps, because a real person misses days.
//
// It also carries only fields the check-in actually collects. The old set had a `mood` of
// "flat" and an `energy` of "medium", neither of which the form offers; demo data that
// answers questions the product never asks will eventually be built on.
const DEMO_CHECK_INS = [
  { id: 'demo-ci-34', createdAt: '2026-07-26T08:12:00.000Z', energy: 'very-low', routine: 'off-track', concern: 'none', note: 'Skipped breakfast, slept badly.', nextStep: 'Sit down, drink water, and eat something small before anything else.' },
  { id: 'demo-ci-33', createdAt: '2026-07-25T08:05:00.000Z', energy: 'low', routine: 'off-track', concern: 'none', note: 'Morning routine paused again.', nextStep: 'Pick one part of the routine and do only that part today.' },
  { id: 'demo-ci-32', createdAt: '2026-07-24T07:58:00.000Z', energy: 'low', routine: 'changed', concern: 'none', note: 'Walked ten minutes after lunch.', nextStep: 'Repeat the ten-minute walk and note how it felt.' },
  { id: 'demo-ci-31', createdAt: '2026-07-23T08:20:00.000Z', energy: 'low', routine: 'changed', concern: 'none', note: 'Woke up late again.', nextStep: 'Set out tomorrow’s clothes tonight.' },
  { id: 'demo-ci-30', createdAt: '2026-07-22T08:02:00.000Z', energy: 'low', routine: 'changed', concern: 'none', note: null, nextStep: 'Keep the same wake-up time for two days.' },
  { id: 'demo-ci-29', createdAt: '2026-07-21T07:55:00.000Z', energy: 'steady', routine: 'changed', concern: 'none', note: 'Better night.', nextStep: 'Note what was different about last night.' },
  { id: 'demo-ci-28', createdAt: '2026-07-19T08:30:00.000Z', energy: 'low', routine: 'changed', concern: 'none', note: null, nextStep: 'One small thing from the usual routine.' },
  { id: 'demo-ci-27', createdAt: '2026-07-18T08:10:00.000Z', energy: 'low', routine: 'on-track', concern: 'none', note: null, nextStep: 'Same again tomorrow.' },
  { id: 'demo-ci-26', createdAt: '2026-07-17T07:50:00.000Z', energy: 'steady', routine: 'on-track', concern: 'none', note: 'Slept through.', nextStep: 'Keep the bedtime that worked.' },
  { id: 'demo-ci-25', createdAt: '2026-07-15T08:05:00.000Z', energy: 'steady', routine: 'on-track', concern: 'none', note: null, nextStep: 'Nothing to change today.' },
  { id: 'demo-ci-24', createdAt: '2026-07-14T08:15:00.000Z', energy: 'low', routine: 'changed', concern: 'none', note: 'Late night.', nextStep: 'Aim for the usual bedtime tonight.' },
  { id: 'demo-ci-23', createdAt: '2026-07-12T08:00:00.000Z', energy: 'steady', routine: 'on-track', concern: 'none', note: null, nextStep: 'Keep going.' },
  { id: 'demo-ci-22', createdAt: '2026-07-11T07:58:00.000Z', energy: 'steady', routine: 'on-track', concern: 'none', note: null, nextStep: 'Keep going.' },
  { id: 'demo-ci-21', createdAt: '2026-07-09T08:22:00.000Z', energy: 'low', routine: 'changed', concern: 'none', note: 'Busy day, ate late.', nextStep: 'Put one meal at a fixed time tomorrow.' },
  { id: 'demo-ci-20', createdAt: '2026-07-07T08:04:00.000Z', energy: 'steady', routine: 'on-track', concern: 'none', note: null, nextStep: 'Nothing to change today.' },
  { id: 'demo-ci-19', createdAt: '2026-07-05T07:52:00.000Z', energy: 'steady', routine: 'on-track', concern: 'none', note: 'Walked in the morning.', nextStep: 'Same walk tomorrow.' },
  { id: 'demo-ci-18', createdAt: '2026-07-03T08:18:00.000Z', energy: 'low', routine: 'changed', concern: 'none', note: null, nextStep: 'One part of the routine only.' },
  { id: 'demo-ci-17', createdAt: '2026-07-02T08:00:00.000Z', energy: 'steady', routine: 'on-track', concern: 'none', note: null, nextStep: 'Keep going.' },
  { id: 'demo-ci-16', createdAt: '2026-06-30T07:45:00.000Z', energy: 'steady', routine: 'on-track', concern: 'none', note: null, nextStep: 'Keep going.' },
  { id: 'demo-ci-15', createdAt: '2026-06-27T08:26:00.000Z', energy: 'low', routine: 'changed', concern: 'none', note: 'Off schedule all week.', nextStep: 'Pick the easiest part of the routine and start there.' },
  { id: 'demo-ci-14', createdAt: '2026-06-25T08:02:00.000Z', energy: 'steady', routine: 'changed', concern: 'none', note: null, nextStep: 'Note what pushed the routine.' },
  { id: 'demo-ci-13', createdAt: '2026-06-22T07:55:00.000Z', energy: 'steady', routine: 'on-track', concern: 'none', note: 'Busy week, forgot most days.', nextStep: 'Record when you can; gaps are fine.' },
  { id: 'demo-ci-12', createdAt: '2026-06-18T08:08:00.000Z', energy: 'steady', routine: 'on-track', concern: 'none', note: null, nextStep: 'Keep going.' },
  { id: 'demo-ci-11', createdAt: '2026-06-16T07:50:00.000Z', energy: 'steady', routine: 'on-track', concern: 'none', note: null, nextStep: 'Keep going.' },
  { id: 'demo-ci-10', createdAt: '2026-06-13T08:12:00.000Z', energy: 'low', routine: 'on-track', concern: 'none', note: 'Tired but kept to the plan.', nextStep: 'Rest earlier tonight.' },
  { id: 'demo-ci-9', createdAt: '2026-06-09T08:00:00.000Z', energy: 'steady', routine: 'on-track', concern: 'none', note: null, nextStep: 'Nothing to change today.' },
  { id: 'demo-ci-8', createdAt: '2026-06-05T07:58:00.000Z', energy: 'steady', routine: 'on-track', concern: 'none', note: null, nextStep: 'Keep going.' },
  { id: 'demo-ci-7', createdAt: '2026-06-02T08:04:00.000Z', energy: 'steady', routine: 'on-track', concern: 'none', note: 'Good week.', nextStep: 'Keep the routine that is working.' },
  { id: 'demo-ci-6', createdAt: '2026-05-28T08:10:00.000Z', energy: 'steady', routine: 'on-track', concern: 'none', note: null, nextStep: 'Keep going.' },
  { id: 'demo-ci-5', createdAt: '2026-05-24T07:52:00.000Z', energy: 'low', routine: 'changed', concern: 'none', note: 'Travelled, slept badly.', nextStep: 'Back to the usual bedtime tonight.' },
  { id: 'demo-ci-4', createdAt: '2026-05-19T08:00:00.000Z', energy: 'steady', routine: 'on-track', concern: 'none', note: null, nextStep: 'Keep going.' },
  { id: 'demo-ci-3', createdAt: '2026-05-15T07:56:00.000Z', energy: 'steady', routine: 'on-track', concern: 'none', note: null, nextStep: 'Nothing to change today.' },
  { id: 'demo-ci-2', createdAt: '2026-05-09T08:06:00.000Z', energy: 'steady', routine: 'on-track', concern: 'none', note: null, nextStep: 'Keep going.' },
  { id: 'demo-ci-1', createdAt: '2026-05-06T08:00:00.000Z', energy: 'steady', routine: 'on-track', concern: 'none', note: 'Started recording.', nextStep: 'Record again in a few days.' }
];

// One shape for every identifier that arrives in a path. Stored relationships use UUIDs and
// the prepared demo uses readable ids like demo-rel-1; writing a route for only one of those
// makes the other a 404, which reads to a visitor as missing data rather than a wrong route.
const RELATIONSHIP_ID = '[a-z0-9-]+';

// The prepared relationship is the one shared story the demo follows from both roles.
// It uses the same status vocabulary as stored relationships and starts active so a reviewer
// can inspect the already-consented summary and trend, then withdraw or change that sharing.
const DEMO_RELATIONSHIPS = [
  // 真實產品預設給最少，多分享一層要本人自己選。展示這一組設定成「已連結一週，
  // 本人已選擇分享走勢形狀」，讓支持者端能看見授權後的完整流程。
  { id: 'demo-rel-1', participantId: 'alex-01', status: 'active', sharingLevel: 'trend', scopes: ['checkin_summary', 'trend_chart'], participantName: 'Alex', supporterName: 'Jordan', sharing: 'Daily summary and trend shape', confirmedAt: '2026-07-20T02:00:00.000Z' }
];

// The stored list names the other person; the prepared one carried both names and no answer
// to "who is this", so every demo card was headed "Your connection" — on the one page whose
// subject is who you are connected to.
// 這一輪展示訪客看到的資料。有訪客編號就用他自己那份（他填過的都在裡面），沒有就退回
// 準備好的那份——舊連結、爬蟲、或 cookie 被擋掉的情況都還是看得到完整的展示。
function demoDataFor(user) {
  const seed = {
    checkIns: DEMO_CHECK_INS,
    vitals: DEMO_VITALS,
    meals: DEMO_MEALS,
    medications: DEMO_MEDICATIONS,
    medicationPlans: DEMO_MEDICATION_PLANS,
    relationships: DEMO_RELATIONSHIPS,
    queue: DEMO_QUEUE
  };
  // 沒有訪客編號時給的是複本，不是那份共用的原始資料——不然一個沒帶 cookie 的請求寫進來，
  // 就會改到之後每一位訪客看到的東西。
  return demoStateFor(user?.stateId, seed) || Object.fromEntries(
    Object.entries(seed).map(([name, entries]) => [name, [...entries]])
  );
}

function demoRecordCounts(state, sharedCheckIns) {
  const dates = [
    ...sharedCheckIns.map((entry) => entry.createdAt),
    ...state.vitals.map((entry) => entry.measuredAt),
    ...state.medications.map((entry) => entry.takenAt),
    ...state.meals.map((entry) => entry.eatenAt)
  ].filter(Boolean).sort();
  return {
    checkIns: sharedCheckIns.length,
    vitals: state.vitals.length,
    medications: state.medications.length,
    meals: state.meals.length,
    from: dates[0] || null,
    to: dates.at(-1) || null
  };
}

// 三階，每一階包含前一階。預設是最少的那一階——多分享一層要本人主動往下選，
// 不是預設給了再讓他去關。
const SHARING_LEVELS = ['summary', 'trend', 'values'];

// 第二階答應的是「看得到形狀，看不到每一筆數字」。要做到這件事，數字就不能還躺在回應
// 裡等人打開開發者工具——每一項各自換算成 0 到 100 的相對位置再送出去，線的形狀一樣，
// 真正的數值留在伺服器。抹掉的是值，不是時間，所以哪一天有記、哪一天空著仍然看得到。
const SHAPE_KEYS = ['systolic', 'diastolic', 'pulse', 'waterMl', 'glucose'];
function shapeOf(records) {
  const spans = {};
  for (const key of SHAPE_KEYS) {
    const values = records.map((record) => record[key]).filter((value) => Number.isFinite(value));
    if (values.length) spans[key] = { low: Math.min(...values), high: Math.max(...values) };
  }
  return records.map((record) => {
    const shaped = { measuredAt: record.measuredAt, glucoseContext: record.glucoseContext || null };
    for (const key of SHAPE_KEYS) {
      const value = record[key];
      const span = spans[key];
      if (!Number.isFinite(value) || !span) { shaped[key] = null; continue; }
      const range = span.high - span.low;
      shaped[key] = range ? Math.round(((value - span.low) / range) * 100) : 50;
    }
    return shaped;
  });
}
function scopesForLevel(level) {
  const scopes = ['checkin_summary'];
  if (level === 'trend' || level === 'values') scopes.push('trend_chart');
  if (level === 'values') scopes.push('trend_values');
  return scopes;
}

function demoRelationshipsFor(role, relationships = DEMO_RELATIONSHIPS) {
  return relationships.map((relationship) => ({
    ...relationship,
    otherPartyName: role === 'participant' ? relationship.supporterName : relationship.participantName
  }));
}

function activeDemoRelationship(state, identifier = null) {
  return state.relationships.find((entry) => entry.status === 'active'
    && (!identifier || entry.id === identifier || entry.participantId === identifier));
}

const PAGE_ROUTES = new Map([
  ['/', 'index.html'],
  ['/demo', 'demo.html'],
  ['/about', 'about.html'],
  ['/how-it-works', 'how-it-works.html'],
  ['/app', 'participant-home.html'],
  ['/app/check-in', 'participant-check-in.html'],
  ['/app/records', 'participant-records.html'],
  ['/app/summary', 'participant-summary.html'],
  // 趨勢併進身體紀錄、連結管理併進資料授權（2026-07-28）。八頁對一個人來說太多，
  // 而且「記下來的數字」跟「那些數字的走勢」本來就是同一件事的兩面，硬拆成兩頁反而
  // 要多學一次架構。舊網址留著轉址，任何已經發出去的連結都不會斷。
  ['/app/support', 'participant-support.html'],
  ['/app/privacy', 'participant-privacy.html'],
  ['/check-in', 'participant-check-in.html'],
  ['/supporter', 'supporter-dashboard.html'],
  ['/supporter/queue', 'supporter-queue.html'],
  ['/supporter/follow-up', 'supporter-follow-up.html'],
  ['/supporter/method', 'supporter-method.html'],
  ['/supporter/connections', 'supporter-connections.html'],
  ['/session', 'session.html']
]);

const DEMO_QUEUE = [
  {
    id: 'alex-01',
    name: 'Alex',
    priority: 'check-now',
    priorityLabel: 'Check in now',
    connectionLevel: 'review',
    connectionLabel: 'Review outside support',
    updatedAt: 'Today, 09:10',
    observableReasons: ['Routine changed for three check-ins', 'Participant asked for a supporter check-in'],
    context: 'Alex reports lower energy and has paused the usual morning meal routine.',
    suggestedAction: 'Confirm what changed, ask what would make today easier, and record the agreed follow-up.',
    decisionBasis: [
      'Fact: the routine changed across three participant reports.',
      'Request: Alex explicitly asked for a supporter check-in.',
      'Function hypothesis · medium confidence: starting the morning routine may need more structure.',
      'Boundary: this pattern does not identify a diagnosis or cause.'
    ],
    exclusionsToCheck: [
      'Check whether the instructions or expected sequence changed.',
      'Check sensory load, sleep, medicine, pain, and physical comfort with Alex.',
      'Check whether time, place, tools, support, or relationships changed.'
    ],
    evaluationSignals: [
      'Alex can choose and begin one visible first action.',
      'Alex reports that the morning feels more manageable.',
      'The supporter records what helped, what did not, and a review time.'
    ],
    functionalSignals: [
      { area: 'Task initiation', signal: 'Morning routine has been harder to start', support: 'Reduce the first task to one visible action' },
      { area: 'Understanding', signal: 'No evidence of misunderstanding yet', support: 'Use one question at a time and ask Alex to choose' },
      { area: 'Communication', signal: 'Alex explicitly requested contact', support: 'Begin with Alex’s request instead of interpreting the score' },
      { area: 'Environment', signal: 'The usual meal cue was missed', support: 'Check whether time, place, tools, or another person changed' }
    ],
    recommendedPlan: [
      'Contact Alex within the agreed window and confirm immediate safety first.',
      'Ask one context question: “What made the morning harder to start?”',
      'Offer a visual two-step plan and let Alex choose the first action.',
      'Record what helped, what did not, and the next review time.'
    ],
    connectionOptions: [
      { label: 'Social welfare consultation', when: 'Use when support needs extend beyond the current service or the household needs welfare navigation.', url: 'https://www.mohw.gov.tw/cp-2621-9307-1.html', source: 'Taiwan MOHW · 1957' },
      { label: 'Vocational rehabilitation and workplace accommodation', when: 'Use when work participation, job adjustment, or structured vocational support is needed.', url: 'https://www.mol.gov.tw/1607/28690/82583/82589/82746/lpsimplelist', source: 'Taiwan Ministry of Labor' },
      { label: 'Long-term care consultation', when: 'Use when daily living or caregiver support needs require formal assessment.', url: 'https://1966.gov.tw/', source: 'Taiwan MOHW · 1966' }
    ],
    consent: 'May contact Jordan by phone · no automatic sharing with other services',
    status: 'Open'
  }
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8'
};

function applyHeaders(res) {
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=()');
  res.setHeader('Cache-Control', 'no-store');
}

function json(res, status, value) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const body = JSON.stringify(value);
  if (res.headOnly) {
    res.setHeader('Content-Length', Buffer.byteLength(body));
    res.end();
  } else res.end(body);
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > MAX_BODY) throw new TypeError('Request too large');
  }
  return JSON.parse(raw || '{}');
}

// A versioned asset is held for a year, so the address has to change whenever the bytes do.
// The stamps used to be typed by hand, and on 2026-07-27 one was not: trends.js was rewritten
// twice while its address stayed ?v=20260727c. Anyone who had loaded the earlier file was
// holding it under a year-long instruction never to check again, so a rewritten chart could
// not reach them at all — and it could not be reproduced with a fresh request, which made it
// look like the fix had worked. Stamps are now the file's own content hash, so an edit always
// changes the address and forgetting is not something anyone can do.
const assetStamps = new Map();

async function stampFor(assetPath) {
  if (assetStamps.has(assetPath)) return assetStamps.get(assetPath);
  let stamp = '0';
  try {
    stamp = createHash('sha256').update(await readFile(join(ROOT, assetPath))).digest('hex').slice(0, 10);
  } catch {
    // A page may name something that is not there; leaving the stamp alone keeps the
    // existing behaviour rather than turning a missing file into a failed page.
  }
  assetStamps.set(assetPath, stamp);
  return stamp;
}

async function withCurrentStamps(html) {
  const references = [...html.matchAll(/(?:src|href)="\/([\w.-]+\.(?:js|css))\?v=[^"]*"/g)];
  let output = html;
  for (const [match, asset] of references) {
    output = output.replace(match, match.replace(/\?v=[^"]*"/, `?v=${await stampFor(asset)}"`));
  }
  return output;
}

async function serveFile(req, res, fileName) {
  let body = await readFile(join(ROOT, fileName));
  if (fileName.endsWith('.html')) body = Buffer.from(await withCurrentStamps(body.toString('utf8')), 'utf8');
  const type = MIME[extname(fileName)] || 'application/octet-stream';
  const canCompress = /^(text\/|application\/json)/.test(type) && /\bgzip\b/i.test(String(req.headers['accept-encoding'] || ''));
  const payload = canCompress ? gzipSync(body) : body;
  res.statusCode = 200;
  res.setHeader('Content-Type', type);
  if (canCompress) {
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Vary', 'Accept-Encoding');
  }
  if (/\.(css|js|svg|png)$/.test(fileName)) {
    const versioned = new URL(req.url, 'http://localhost').searchParams.has('v');
    res.setHeader('Cache-Control', versioned ? 'public, max-age=31536000, immutable' : 'no-cache');
  }
  // The pages carry the ?v= stamps that decide which script a browser fetches, so a stale
  // page pins a stale script for as long as the browser keeps it. With no header at all a
  // browser is free to guess how long to hold it — which is how a shipped fix can sit on
  // the server while someone still sees the old screen. Pages always revalidate.
  // Pages that already asked for something stricter (no-store, for the ones that can carry
  // personal readings) keep it — no-store revalidates too, so it covers this as well.
  if (/\.html$/.test(fileName) && !res.getHeader('Cache-Control')) res.setHeader('Cache-Control', 'no-cache');
  if (req.method === 'HEAD') {
    res.setHeader('Content-Length', payload.length);
    res.end();
  } else res.end(payload);
}

function cookieToken(req) {
  const match = String(req.headers.cookie || '').match(/(?:^|;\s*)dailyable_session=([^;]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function requestIsSecure(req, context) {
  if (req.socket.encrypted) return true;
  return context.trustProxy && String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

function requestOrigin(req, context) {
  const protocol = requestIsSecure(req, context) ? 'https' : 'http';
  const host = String(context.trustProxy ? req.headers['x-forwarded-host'] || req.headers.host : req.headers.host || '')
    .split(',')[0].trim();
  return new URL(`${protocol}://${host}`).origin;
}

function browserOriginAllowed(req, context) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    const expectedHost = String(context.trustProxy ? req.headers['x-forwarded-host'] || req.headers.host : req.headers.host || '').split(',')[0].trim();
    const expectedProtocol = context.trustProxy
      ? String(req.headers['x-forwarded-proto'] || (req.socket.encrypted ? 'https' : 'http')).split(',')[0].trim()
      : req.socket.encrypted ? 'https' : 'http';
    const parsed = new URL(origin);
    return parsed.host === expectedHost && parsed.protocol === `${expectedProtocol}:`;
  } catch {
    return false;
  }
}

function csrfTokenFor(token, context) {
  // A demo visitor has no session token. The hash refuses a null outright, which turned the
  // token request into a 500 and stopped the page before it could submit anything.
  return createHmac('sha256', context.csrfSecret).update(String(token || '')).digest('base64url');
}

function csrfTokenAllowed(req, token, context) {
  const supplied = Buffer.from(String(req.headers['x-csrf-token'] || ''));
  const expected = Buffer.from(csrfTokenFor(token, context));
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function recordClaimAttempt(key, now, context) {
  const windowStart = now - 5 * 60_000;
  for (const [storedKey, attempts] of context.claimAttempts) {
    const current = attempts.filter((time) => time > windowStart);
    if (current.length) context.claimAttempts.set(storedKey, current);
    else context.claimAttempts.delete(storedKey);
  }
  const recent = context.claimAttempts.get(key) || [];
  if (recent.length >= 8) return false;
  if (!context.claimAttempts.has(key) && context.claimAttempts.size >= 1000) {
    context.claimAttempts.delete(context.claimAttempts.keys().next().value);
  }
  recent.push(now);
  context.claimAttempts.set(key, recent);
  return true;
}

function claimAllowed(user, code, context) {
  const normalized = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 64);
  const codeBucket = createHash('sha256').update(normalized).digest('hex').slice(0, 24);
  const now = context.now().getTime();
  return recordClaimAttempt(`account:${user.id}`, now, context)
    && recordClaimAttempt(`account-code:${user.id}:${codeBucket}`, now, context);
}

async function handle(req, res, context) {
  applyHeaders(res);
  if (requestIsSecure(req, context)) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.headOnly = req.method === 'HEAD';
  const url = new URL(req.url, 'http://localhost');
  const method = req.method === 'HEAD' ? 'GET' : req.method;
  const token = cookieToken(req);
  const realUser = token ? await context.store.getSession(token, context.now()) : null;
  // A real session always wins; the demo lane only fills in when nobody is signed in.
  const user = realUser || demoUserFromRequest(req);
  if (realUser && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
      && !browserOriginAllowed(req, context) && !csrfTokenAllowed(req, token, context)) {
    json(res, 403, { error: 'Cross-site request rejected.' });
    return;
  }

  if (method === 'GET' && ['/api/ping', '/api/health'].includes(url.pathname)) {
    json(res, 200, { ok: true, service: 'dailyable', version: '0.1.0' });
    return;
  }

  // 併頁之後的舊網址。轉址而不是回 404——已經寫在文件、簡報或聊天室裡的連結還是會有人點。
  const MERGED = new Map([
    ['/app/insights', '/app/records'],
    ['/app/connections', '/app/privacy']
  ]);
  if (method === 'GET' && MERGED.has(url.pathname)) {
    res.statusCode = 301;
    res.setHeader('Location', MERGED.get(url.pathname));
    res.end();
    return;
  }

  // Demo lane: pick a persona, land in that role's space, or clear it again.
  if (method === 'GET' && url.pathname === '/demo/enter') {
    const persona = DEMO_PERSONAS.get(String(url.searchParams.get('persona') || ''));
    if (!persona) return json(res, 400, { error: 'Choose one of the demo people.' });
    const secure = requestIsSecure(req, context) ? '; Secure' : '';
    // 選了人就開一輪新的：換人重來時，上一輪填的東西不該還留在畫面上。
    res.setHeader('Set-Cookie', [
      `${DEMO_COOKIE}=${encodeURIComponent(persona.id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${secure}`,
      `${DEMO_VISIT_COOKIE}=${randomUUID()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${secure}`
    ]);
    res.statusCode = 303;
    res.setHeader('Location', persona.role === 'supporter' ? '/supporter' : '/app');
    res.end();
    return;
  }

  // "Switch to the participant view" has to actually switch. Pointing it at /session sent
  // a demo visitor to a sign-in screen that could only offer to change persona, which
  // reads as the link throwing you out rather than taking you there.
  if (method === 'GET' && url.pathname === '/demo/switch') {
    const current = demoUserFromRequest(req);
    if (!current) {
      res.statusCode = 303;
      res.setHeader('Location', '/demo');
      res.end();
      return;
    }
    const wanted = current.role === 'supporter' ? 'participant' : 'supporter';
    const persona = [...DEMO_PERSONAS.values()].find((entry) => entry.role === wanted);
    const secure = requestIsSecure(req, context) ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${DEMO_COOKIE}=${encodeURIComponent(persona.id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${secure}`);
    res.statusCode = 303;
    res.setHeader('Location', wanted === 'supporter' ? '/supporter' : '/app');
    res.end();
    return;
  }

  if (method === 'GET' && url.pathname === '/demo/reset') {
    const secure = requestIsSecure(req, context) ? '; Secure' : '';
    // 「重來一次」要真的乾淨：連這一輪填過的東西一起丟掉。
    const current = demoUserFromRequest(req);
    if (current?.stateId) forgetDemoState(current.stateId);
    res.setHeader('Set-Cookie', [
      `${DEMO_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
      `${DEMO_VISIT_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
    ]);
    res.statusCode = 303;
    res.setHeader('Location', '/demo');
    res.end();
    return;
  }

  if (method === 'GET' && url.pathname === '/api/demo/state') {
    json(res, 200, {
      demoData: true,
      active: Boolean(user?.demo),
      persona: user?.demo ? { id: user.id.replace(/^demo-/, ''), role: user.role, displayName: user.displayName } : null,
      people: [...DEMO_PERSONAS.values()]
    });
    return;
  }

  // Invitations are the one demo write that still has to render something real: the panel
  // shows a QR image, a code and an expiry. This mints a throwaway code that exists only
  // in the response — it is never stored, so it can never be claimed by anyone.
  if (req.method === 'POST' && url.pathname === '/api/pairing/invites' && user?.demo) {
    const code = 'DEMO0000';
    const expiresAt = new Date(context.now().getTime() + 15 * 60_000);
    const inviteUrl = new URL(`/connect?invite=${code}`, requestOrigin(req, context)).href;
    const qrDataUrl = await QRCode.toDataURL(inviteUrl, { errorCorrectionLevel: 'M', margin: 2, width: 320 });
    json(res, 201, {
      demoData: true,
      saved: false,
      code,
      inviteUrl,
      qrDataUrl,
      expiresAt: expiresAt.toISOString(),
      sharing: 'Demo invitation. It is not stored and cannot be claimed.'
    });
    return;
  }

  // 展示不寫資料庫，也永遠碰不到真人的邀請碼或連結——這道關卡擋的是那個。
  //
  // 但「不寫資料庫」被做成了「什麼都不留」，於是評審填完回報、存了一筆血壓，畫面說成功、
  // 重新整理就沒了，趨勢圖也不會多一個點。整條流程看起來是四個各自獨立的畫面。
  // 現在自己處理過的那幾條路徑先放行，它們會把東西記在這一輪的記憶體裡（服務重開就沒），
  // 其餘照舊擋下。
  const demoWriteHandled = new Set([
    '/api/check-in', '/api/session', '/api/vitals', '/api/meals',
    '/api/medications', '/api/medication-plans'
  ]);
  const demoWriteExempt = demoWriteHandled.has(url.pathname)
    || /^\/api\/check-ins\/[a-z0-9-]+\/share$/.test(url.pathname)
    || /^\/api\/pairing\/relationships\/[a-z0-9-]+(\/confirm|\/scopes)?$/.test(url.pathname)
    || /^\/api\/supporter\/queue\/[a-z0-9-]+\/follow-up$/.test(url.pathname);
  if (user?.demo && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
      && url.pathname.startsWith('/api/') && !demoWriteExempt) {
    json(res, 200, { demoData: true, ok: true, saved: false, note: 'Demo mode shows the flow without storing anything.' });
    return;
  }

  if (method === 'GET' && url.pathname === '/api/session') {
    if (!user) return json(res, 401, { error: 'No active session.' });
    json(res, 200, { user, identityVerificationPending: true, demoData: Boolean(user.demo) });
    return;
  }

  if (method === 'GET' && url.pathname === '/api/csrf') {
    if (!user) return json(res, 401, { error: 'Sign in required.' });
    // The check above only guards real sessions, so a demo one is handed a token it will
    // never be asked for. The pages ask for it before every submission and that request
    // has to succeed, or the form stops on an error that has nothing to do with the form.
    json(res, 200, { token: csrfTokenFor(token, context), demoData: user.demo === true });
    return;
  }

  // Leaving is not a data write. This has to run before the demo guard below, and it has
  // to clear the demo cookie as well — otherwise someone in the demo can neither sign out
  // nor switch to the other role, because the persona quietly survives the request.
  if (req.method === 'DELETE' && url.pathname === '/api/session') {
    if (token) await context.store.deleteSession(token);
    const secure = requestIsSecure(req, context) ? '; Secure' : '';
    res.setHeader('Set-Cookie', [
      `dailyable_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
      `${DEMO_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
    ]);
    json(res, 200, { ok: true });
    return;
  }

  if (method === 'GET' && url.pathname === '/participant') {
    res.statusCode = 308;
    res.setHeader('Location', '/app');
    res.end();
    return;
  }

  if (method === 'GET' && url.pathname === '/connect') {
    const code = String(url.searchParams.get('invite') || '').toUpperCase();
    if (!/^[A-Z0-9]{8}$/.test(code)) return json(res, 400, { error: 'Use a valid eight-character invitation code.' });
    res.statusCode = 303;
    res.setHeader('Location', !user
      ? `/session?next=${encodeURIComponent(`/connect?invite=${code}`)}`
      : user.role === 'supporter' ? `/supporter/connections?invite=${code}` : '/app/privacy');
    res.end();
    return;
  }

  if (method === 'GET' && url.pathname === '/og-image.png') {
    res.statusCode = 308;
    res.setHeader('Location', '/og-dailyable.png');
    res.end();
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/session') {
    if (!context.prototypeAuth) return json(res, 503, { error: 'Verified identity is required before persistent access can be created.' });
    try {
      const input = await readJson(req);
      if (!['participant', 'supporter'].includes(input.role) || !String(input.displayName || '').trim()) throw new TypeError();
      const created = await context.store.createUser({ role: input.role, displayName: String(input.displayName).trim().slice(0, 120) });
      const sessionToken = newToken();
      await context.store.createSession(created.id, sessionToken, new Date(context.now().getTime() + 7 * 86400_000));
      const secure = requestIsSecure(req, context) ? '; Secure' : '';
      res.setHeader('Set-Cookie', `dailyable_session=${encodeURIComponent(sessionToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`);
      json(res, 201, { user: created, identityVerificationPending: true });
    } catch { json(res, 400, { error: 'Choose a role and enter a display name.' }); }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/pairing/invites') {
    if (!user) return json(res, 401, { error: 'Sign in required.' });
    if (user.role !== 'participant') return json(res, 403, { error: 'Participant role required.' });
    const code = newToken().replace(/[^A-Z0-9]/gi, '').slice(0, 8).toUpperCase();
    const expiresAt = new Date(context.now().getTime() + 15 * 60_000);
    await context.store.createInvite(user.id, code, expiresAt);
    const inviteUrl = new URL(`/connect?invite=${encodeURIComponent(code)}`, requestOrigin(req, context)).href;
    const qrDataUrl = await QRCode.toDataURL(inviteUrl, { errorCorrectionLevel: 'M', margin: 2, width: 320 });
    json(res, 201, { code, inviteUrl, qrDataUrl, expiresAt: expiresAt.toISOString(), sharing: 'The supporter sees only your display name until you confirm.' });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/pairing/claim') {
    if (!user) return json(res, 401, { error: 'Sign in required.' });
    if (user.role !== 'supporter') return json(res, 403, { error: 'Supporter role required.' });
    const input = await readJson(req).catch(() => ({}));
    const code = String(input.code || '').toUpperCase();
    if (!claimAllowed(user, code, context)) return json(res, 429, { error: 'Too many attempts. Wait five minutes and ask for a fresh code.' });
    const result = await context.store.claimInvite(code, user.id, context.now());
    if (result.error === 'expired') return json(res, 410, { error: 'This invitation expired. Ask the participant for a new code.' });
    if (result.error) return json(res, 404, { error: 'Invitation not available.' });
    json(res, 200, result); return;
  }

  if (method === 'GET' && url.pathname === '/api/pairing/relationships') {
    if (!user) return json(res, 401, { error: 'Sign in required.' });
    if (user.demo) return json(res, 200, { demoData: true, relationships: demoRelationshipsFor(user.role, demoDataFor(user).relationships) });
    json(res, 200, { relationships: await context.store.listRelationships(user) }); return;
  }

  // Identifiers here are matched loosely on purpose. Real ones are UUIDs, but the prepared
  // demo uses readable ids like demo-rel-1, and a pattern written for hex only silently
  // turned those into 404s — the supporter demo could open a person's page and then find
  // the shared check-ins missing, with nothing to say why. See RELATIONSHIP_ID below.
  // 本人自己開關某一項分享。只有本人能改，而且一次只動一項，畫面上看得到現在給了什麼。
  const scopeMatch = url.pathname.match(new RegExp(`^/api/pairing/relationships/(${RELATIONSHIP_ID})/scopes$`));
  if (req.method === 'POST' && scopeMatch) {
    if (!user) return json(res, 401, { error: 'Sign in required.' });
    if (user.role !== 'participant') return json(res, 403, { error: 'Only the participant can change what is shared.' });
    const input = await readJson(req).catch(() => ({}));
    // 分享程度是一階一階的，不是一個開關。「讓人知道我最近不太好」跟「讓人看到我的血壓
    // 數字」是兩件事，本人應該選得到中間那一階：看得到形狀，看不到每一筆數字。
    const level = String(input.level || '');
    if (level) {
      if (!SHARING_LEVELS.includes(level)) return json(res, 400, { error: 'Unknown sharing level.' });
      if (!user.demo) return json(res, 501, { error: 'Not available outside the demo yet.' });
      const target = demoDataFor(user).relationships.find((entry) => entry.id === scopeMatch[1]);
      if (!target || target.status !== 'active') return json(res, 403, { error: 'Relationship access denied.' });
      target.sharingLevel = level;
      target.scopes = scopesForLevel(level);
      return json(res, 200, { demoData: true, saved: Boolean(user.stateId), sharingLevel: level, scopes: target.scopes });
    }
    const scope = String(input.scope || '');
    if (!['checkin_summary', 'trend_chart'].includes(scope)) return json(res, 400, { error: 'Unknown sharing item.' });
    if (!user.demo) return json(res, 501, { error: 'Not available outside the demo yet.' });
    const relationship = demoDataFor(user).relationships.find((entry) => entry.id === scopeMatch[1]);
    if (!relationship || relationship.status !== 'active') return json(res, 403, { error: 'Relationship access denied.' });
    const scopes = new Set(relationship.scopes || []);
    if (input.grant === false) scopes.delete(scope);
    else scopes.add(scope);
    relationship.scopes = [...scopes];
    return json(res, 200, { demoData: true, saved: Boolean(user.stateId), scopes: relationship.scopes });
  }

  const relationshipMatch = url.pathname.match(new RegExp(`^/api/pairing/relationships/(${RELATIONSHIP_ID})(?:/(confirm))?$`));
  if (relationshipMatch && (req.method === 'DELETE' || req.method === 'POST')) {
    if (!user) return json(res, 401, { error: 'Sign in required.' });
    const action = relationshipMatch[2] === 'confirm' ? 'confirm' : 'revoke';
    // 同意這一步是整個展示的重點，按了就要看得到結果：等待確認的變成已連結，停止授權的變
    // 成已結束。一樣只留在這一輪，不進資料庫。
    if (user.demo) {
      const state = demoDataFor(user);
      const relationship = state.relationships.find((entry) => entry.id === relationshipMatch[1]);
      if (!relationship) return json(res, 403, { error: 'Relationship access denied.' });
      if (action === 'confirm' && (user.role !== 'participant' || relationship.status !== 'pending_confirmation')) {
        return json(res, 403, { error: 'Relationship access denied.' });
      }
      relationship.status = action === 'confirm' ? 'active' : 'revoked';
      relationship.confirmedAt = action === 'confirm' ? context.now().toISOString() : null;
      relationship.sharing = action === 'confirm' ? 'Daily summary only' : 'Sharing has ended';
      return json(res, 200, { demoData: true, saved: Boolean(user.stateId), ...relationship });
    }
    const changed = await context.store.changeRelationship(relationshipMatch[1], user, action, context.now());
    if (!changed) return json(res, 403, { error: 'Relationship access denied.' });
    json(res, 200, changed); return;
  }

  // 長照資源是公開資訊，不看是誰在問——一個還沒登入的人也該查得到打哪支電話。
  // 這裡只送「有哪四類可以申請、誰能申請、怎麼問」，不送任何金額：
  // 官方兩種說法互相矛盾，而實際額度以各縣市長照中心核定為準（理由見 care-knowledge.js）。
  if (method === 'GET' && url.pathname === '/api/care-resources') {
    json(res, 200, {
      helplines: HELPLINES,
      benefits: LTC_BENEFITS,
      eligibility: LTC_ELIGIBILITY,
      attribution: ATTRIBUTION
    });
    return;
  }

  if (method === 'GET' && url.pathname === '/api/check-ins') {
    if (!user) return json(res, 401, { error: 'Sign in required.' });
    if (user.role !== 'participant') return json(res, 403, { error: 'Participant role required.' });
    if (user.demo) return json(res, 200, { demoData: true, checkIns: demoDataFor(user).checkIns });
    // 真帳號的列跟展示資料要長一樣。store 存的是 {input, result} 巢狀，展示資料是平的，
    // 而精神趨勢圖跟首頁七天條都讀 entry.energy——之前直接把巢狀列丟出去，
    // 展示身分圖都正常、真帳號的圖全是空的，而評審只看展示，永遠不會發現。
    const rows = await context.store.listCheckIns(user.id);
    json(res, 200, {
      checkIns: rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        energy: row.input?.energy || null,
        routine: row.input?.routine || null,
        concern: row.input?.concern || null,
        note: null,
        // 當時給的下一步跟著紀錄走。重開舊紀錄看到的是當時說的話，不是用今天的資料重算的
        nextStep: row.result?.nextSteps?.[0] || null
      }))
    });
    return;
  }

  const sharedCheckInsMatch = url.pathname.match(new RegExp(`^/api/relationships/(${RELATIONSHIP_ID})/check-ins$`));
  if (method === 'GET' && sharedCheckInsMatch) {
    if (!user) return json(res, 401, { error: 'Sign in required.' });
    if (user.role !== 'supporter') return json(res, 403, { error: 'Supporter role required.' });
    if (user.demo) {
      const state = demoDataFor(user);
      const relationship = activeDemoRelationship(state, sharedCheckInsMatch[1]);
      if (!relationship || !relationship.scopes?.includes('checkin_summary')) {
        return json(res, 403, { error: 'Active consent for check-in summaries is required.' });
      }
      const shared = state.checkIns
        .filter((entry) => entry.sharedWithSupporter !== false)
        .map((entry) => ({
          id: entry.id,
          createdAt: entry.createdAt,
          summary: entry.summary || { message: entry.nextStep || 'Check-in completed' }
        }));
      return json(res, 200, { demoData: true, checkIns: shared });
    }
    const checkIns = await context.store.listSharedCheckIns(sharedCheckInsMatch[1], user);
    if (!checkIns) return json(res, 403, { error: 'Active consent for check-in summaries is required.' });
    json(res, 200, { checkIns });
    return;
  }

  const shareCheckInMatch = url.pathname.match(/^\/api\/check-ins\/([a-z0-9-]+)\/share$/);
  if (req.method === 'POST' && shareCheckInMatch) {
    if (!user) return json(res, 401, { error: 'Sign in required.' });
    if (user.role !== 'participant') return json(res, 403, { error: 'Participant role required.' });
    if (!user.demo) return json(res, 501, { error: 'Per-check-in sharing is not available outside the demo yet.' });
    const input = await readJson(req).catch(() => ({}));
    const state = demoDataFor(user);
    const relationship = activeDemoRelationship(state, String(input.relationshipId || ''));
    if (!relationship || !relationship.scopes?.includes('checkin_summary')) {
      return json(res, 403, { error: 'Active consent for check-in summaries is required.' });
    }
    const entry = state.checkIns.find((item) => item.id === shareCheckInMatch[1]);
    if (!entry) return json(res, 404, { error: 'Check-in not found.' });
    if (entry.supportChoice !== 'supporter') {
      return json(res, 403, { error: 'This check-in was not offered to a supporter.' });
    }
    entry.sharedWithSupporter = true;
    entry.sharedAt ||= context.now().toISOString();
    return json(res, 200, {
      demoData: true,
      shared: true,
      supporterName: relationship.supporterName,
      sharedAt: entry.sharedAt
    });
  }

  const followUpMatch = url.pathname.match(new RegExp(`^/api/relationships/(${RELATIONSHIP_ID})/follow-ups$`));
  if (req.method === 'POST' && followUpMatch) {
    if (!user) return json(res, 401, { error: 'Sign in required.' });
    const input = await readJson(req).catch(() => ({}));
    if (!['contacted', 'scheduled', 'closed'].includes(input.action)) return json(res, 400, { error: 'Choose a valid follow-up action.' });
    const recorded = await context.store.recordFollowUp(followUpMatch[1], user, input.action);
    if (!recorded) return json(res, 403, { error: 'Active supporter relationship required.' });
    json(res, 201, recorded); return;
  }

  if (req.method === 'POST' && url.pathname === '/api/check-in') {
    try {
      const input = await readJson(req);
      // 依據要從本人自己的紀錄算，所以判斷引擎得先拿到那些紀錄
      const history = user?.role === 'participant'
        ? (user.demo
          ? { checkIns: demoDataFor(user).checkIns, vitals: demoDataFor(user).vitals }
          : { checkIns: await context.store.listCheckIns(user.id), vitals: await context.store.listVitalRecords(user.id) })
        : {};
      const result = createDailySupport(input, history, context.now().getTime());
      // 本人也拿得到東西，不是只有支持者拿得到分析。
      //
      // 給的是官方衛教，不是庇護知識庫的理論篇——後者實測會變成心理學名詞解釋，
      // 對一個剛過完難受一週的人沒有用。理由寫在 care-knowledge.js 開頭。
      if (result.basis?.enough) {
        result.care = careFor(result.basis.observations, 'participant');
        result.helplines = HELPLINES;
      }
      if (user?.role === 'participant' && !user.demo) await context.store.createCheckIn(user.id, input, result);
      // 展示身分也要留下這一筆，「這些日子的感覺」那張圖跟支持者收到的摘要才會跟著動。
      if (user?.role === 'participant' && user.demo) {
        const entry = rememberDemoEntry(demoDataFor(user), 'checkIns', {
          id: `demo-checkin-${randomUUID()}`,
          createdAt: context.now().toISOString(),
          energy: input.energy || null,
          mood: input.mood || null,
          sleep: input.sleep || null,
          nourishment: input.nourishment || null,
          taskLoad: input.taskLoad || null,
          thinking: input.thinking || null,
          moodDuration: input.moodDuration || null,
          selfHarmThoughts: input.selfHarmThoughts || null,
          memoryImpact: input.memoryImpact || null,
          perceptionSafety: input.perceptionSafety || null,
          routine: input.routine || null,
          concern: input.concern || null,
          supportChoice: input.supportChoice || null,
          sharedWithSupporter: false,
          note: null,
          // 當時的下一步存進紀錄，「之前的回報」那張表才有東西講——
          // 沒存的話，回頭看只剩選了哪些選項，產品當時說了什麼全忘了
          nextStep: result.nextSteps?.[0] || null,
          summary: { level: result.level || null, message: result.headline || null }
        });
        result.checkInId = entry.id;
        result.sharePending = input.supportChoice === 'supporter';
      }
      json(res, 200, result);
    } catch (error) {
      json(res, 400, { error: 'Please review the check-in choices and try again.' });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/vitals') {
    if (!user) return json(res, 401, { error: 'Sign in required.' });
    if (user.role !== 'participant') return json(res, 403, { error: 'Participant role required.' });
    try {
      const input = await readJson(req);
      const record = normalizeVitalInput(input, context.now());
      if (!recordHasAnyValue(record)) return json(res, 400, { error: 'Add at least one measurement before saving.' });
      // 這一輪記得住：存完之後趨勢圖、最近紀錄、就診摘要都要看得到這一筆。
      if (user.demo) {
        const saved = { id: `demo-vital-${randomUUID()}`, ...record };
        rememberDemoEntry(demoDataFor(user), 'vitals', saved);
        return json(res, 201, { demoData: true, saved: Boolean(user.stateId), record: saved });
      }
      json(res, 201, await context.store.createVitalRecord(user.id, record));
    } catch (error) {
      json(res, 400, { error: error instanceof RangeError ? error.message : 'Please check the values and try again.' });
    }
    return;
  }

  if (method === 'GET' && url.pathname === '/api/vitals') {
    if (!user) return json(res, 401, { error: 'Sign in required.' });
    if (user.role !== 'participant') return json(res, 403, { error: 'Participant role required.' });
    if (user.demo) return json(res, 200, { demoData: true, records: demoDataFor(user).vitals });
    json(res, 200, { records: await context.store.listVitalRecords(user.id) });
    return;
  }

  // What the participant says they were prescribed. It exists so a day's doses have
  // something to be compared against; the product never sets or changes a plan itself.
  if (req.method === 'POST' && url.pathname === '/api/medication-plans') {
    if (!user) return json(res, 401, { error: 'Sign in required.' });
    if (user.role !== 'participant') return json(res, 403, { error: 'Participant role required.' });
    try {
      const input = await readJson(req);
      const plan = {
        name: String(input.name || '').trim().slice(0, 200) || null,
        timesPerDay: optionalNumber(input.timesPerDay, { min: 1, max: 12, label: 'times per day' }),
        instructions: String(input.instructions || '').trim().slice(0, 300) || null
      };
      if (!plan.name) return json(res, 400, { error: 'Write down which medicine this is.' });
      if (user.demo) {
        const saved = { id: `demo-plan-${randomUUID()}`, active: true, ...plan };
        rememberDemoEntry(demoDataFor(user), 'medicationPlans', saved);
        return json(res, 201, { demoData: true, saved: Boolean(user.stateId), plan: saved });
      }
      json(res, 201, await context.store.createMedicationPlan(user.id, plan));
    } catch (error) {
      json(res, 400, { error: error instanceof RangeError ? error.message : 'Please check the entry and try again.' });
    }
    return;
  }

  if (method === 'GET' && url.pathname === '/api/medication-plans') {
    if (!user) return json(res, 401, { error: 'Sign in required.' });
    if (user.role !== 'participant') return json(res, 403, { error: 'Participant role required.' });
    if (user.demo) return json(res, 200, { demoData: true, plans: demoDataFor(user).medicationPlans });
    json(res, 200, { plans: await context.store.listMedicationPlans(user.id) });
    return;
  }

  const planMatch = url.pathname.match(/^\/api\/medication-plans\/([a-z0-9-]+)$/);
  if (req.method === 'DELETE' && planMatch) {
    if (!user) return json(res, 401, { error: 'Sign in required.' });
    if (user.role !== 'participant') return json(res, 403, { error: 'Participant role required.' });
    if (user.demo) return json(res, 200, { demoData: true, saved: false });
    const removed = await context.store.deactivateMedicationPlan(user.id, planMatch[1]);
    if (!removed) return json(res, 404, { error: 'That plan is not on your list.' });
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/medications') {
    if (!user) return json(res, 401, { error: 'Sign in required.' });
    if (user.role !== 'participant') return json(res, 403, { error: 'Participant role required.' });
    try {
      const input = await readJson(req);
      const takenAt = input.takenAt ? new Date(input.takenAt) : context.now();
      if (Number.isNaN(takenAt.getTime())) throw new RangeError('time');
      const record = {
        takenAt: takenAt.toISOString(),
        name: String(input.name || '').trim().slice(0, 200) || null,
        note: String(input.note || '').trim().slice(0, 300) || null
      };
      if (!record.name) return json(res, 400, { error: 'Write down what you took.' });
      if (user.demo) {
        const saved = { id: `demo-medication-${randomUUID()}`, ...record };
        rememberDemoEntry(demoDataFor(user), 'medications', saved);
        return json(res, 201, { demoData: true, saved: Boolean(user.stateId), record: saved });
      }
      json(res, 201, await context.store.createMedicationRecord(user.id, record));
    } catch {
      json(res, 400, { error: 'Please check the entry and try again.' });
    }
    return;
  }

  if (method === 'GET' && url.pathname === '/api/medications') {
    if (!user) return json(res, 401, { error: 'Sign in required.' });
    if (user.role !== 'participant') return json(res, 403, { error: 'Participant role required.' });
    if (user.demo) return json(res, 200, { demoData: true, records: demoDataFor(user).medications });
    json(res, 200, { records: await context.store.listMedicationRecords(user.id) });
    return;
  }

  // Search the food table so someone can pick "滷肉飯" and a portion instead of being
  // expected to know the grams of carbohydrate in it.
  if (method === 'GET' && url.pathname === '/api/foods') {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    json(res, 200, { foods: searchFoods(url.searchParams.get('q'), 8) });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/meals') {
    if (!user) return json(res, 401, { error: 'Sign in required.' });
    if (user.role !== 'participant') return json(res, 403, { error: 'Participant role required.' });
    try {
      const input = await readJson(req);
      // Picking a food and a portion fills the figures in, so nobody has to look them up.
      // Anything typed by hand wins, because the person may be reading an actual label.
      const computed = input.foodName ? nutritionFor(input.foodName, input.quantity) : null;
      if (computed) {
        input.kcal = input.kcal ?? computed.kcal;
        input.carbG = input.carbG ?? computed.carbG;
        input.proteinG = input.proteinG ?? computed.proteinG;
        input.fatG = input.fatG ?? computed.fatG;
        input.description = String(input.description || '').trim()
          || `${computed.name} ${computed.quantity}${computed.unit}`;
      }
      const record = normalizeMealInput(input, context.now());
      const hasNumbers = [record.kcal, record.carbG, record.proteinG, record.fatG].some((value) => value !== null);
      if (!record.description && !hasNumbers) return json(res, 400, { error: 'Add what you ate before saving.' });
      if (user.demo) {
        const saved = { id: `demo-meal-${randomUUID()}`, ...record };
        rememberDemoEntry(demoDataFor(user), 'meals', saved);
        return json(res, 201, { demoData: true, saved: Boolean(user.stateId), record: saved });
      }
      json(res, 201, await context.store.createMealRecord(user.id, record));
    } catch {
      json(res, 400, { error: 'Please check the entry and try again.' });
    }
    return;
  }

  if (method === 'GET' && url.pathname === '/api/meals') {
    if (!user) return json(res, 401, { error: 'Sign in required.' });
    if (user.role !== 'participant') return json(res, 403, { error: 'Participant role required.' });
    if (user.demo) return json(res, 200, { demoData: true, records: demoDataFor(user).meals });
    json(res, 200, { records: await context.store.listMealRecords(user.id) });
    return;
  }

  // The one page to take to an appointment: the person's own records and their own trend.
  if (method === 'GET' && url.pathname === '/api/clinical-summary') {
    if (!user) return json(res, 401, { error: 'Sign in required.' });
    if (user.role !== 'participant') return json(res, 403, { error: 'Participant role required.' });
    const [vitals, medications, meals, medicationPlans] = user.demo
      ? [DEMO_VITALS, DEMO_MEDICATIONS, DEMO_MEALS, DEMO_MEDICATION_PLANS]
      : await Promise.all([
        context.store.listVitalRecords(user.id),
        context.store.listMedicationRecords(user.id),
        context.store.listMealRecords(user.id),
        context.store.listMedicationPlans(user.id)
      ]);
    json(res, 200, {
      demoData: Boolean(user.demo),
      summary: buildSummary({ vitals, medications, meals, medicationPlans, now: context.now().getTime() }),
      series: vitals
    });
    return;
  }

  // A supporter reaches these only through an active relationship the participant confirmed,
  // and only when the shared-summary scope is part of it. The raw entries never travel.
  const bodyRecordsMatch = url.pathname.match(/^\/api\/relationships\/([a-z0-9-]+)\/body-records$/);
  if (method === 'GET' && bodyRecordsMatch) {
    if (!user) return json(res, 401, { error: 'Sign in required.' });
    if (user.role !== 'supporter') return json(res, 403, { error: 'Supporter role required.' });
    if (user.demo) {
      const state = demoDataFor(user);
      // 支持者從個案頁進來時可能帶 relationship id 或本人 id；兩者都必須明確對到同一條
      // active relationship，不能用「任一 active」fallback 代替授權判斷。
      const relationship = activeDemoRelationship(state, bodyRecordsMatch[1]);
      if (!relationship || !relationship.scopes?.includes('checkin_summary')) {
        return json(res, 403, { error: 'Active consent for shared summaries is required.' });
      }
      const scopes = relationship.scopes;
      const sharedCheckIns = state.checkIns.filter((entry) => entry.sharedWithSupporter !== false);
      const analysis = observationsFrom(
        { checkIns: sharedCheckIns, vitals: state.vitals },
        context.now().getTime()
      );
      const guidance = knowledgeFor(analysis.observations, {
        askedForHelp: sharedCheckIns.some((entry) => entry.supportChoice === 'supporter')
      });
      json(res, 200, {
        demoData: true,
        scopes,
        recordCounts: demoRecordCounts(state, sharedCheckIns),
        sharingLevel: relationship?.sharingLevel || 'summary',
        // 走勢只有在本人給到第二階時才送出去。沒給就連資料都不出門，而不是送過去再由畫面
        // 決定要不要顯示。第二階給的是形狀：時間留著、數值抹掉，圖畫得出來但讀不出數字。
        shapeOnly: scopes.includes('trend_chart') && !scopes.includes('trend_values'),
        series: scopes.includes('trend_chart')
          ? (scopes.includes('trend_values') ? state.vitals : shapeOf(state.vitals))
          : null,
        // 支持者拿到的是本人自己的紀錄，不是判讀結果。這句話要跟著資料一起走。
        disclaimer: {
          en: 'These are this person’s own recorded values and their own trend. They are not a diagnosis, not a clinical assessment, and not a threshold to act on. Sharing is chosen by the participant and can be withdrawn at any time.',
          zh: '這些是本人自己記下的數值與他自己的走勢，不是診斷、不是臨床評估，也不是可以照著做決定的門檻。分享由本人決定，隨時可以收回。'
        },
        summary: buildSummary({
          vitals: state.vitals,
          medications: state.medications,
          meals: state.meals,
          medicationPlans: state.medicationPlans,
          now: context.now().getTime()
        }),
        // 支持者看到的說法要跟本人看到的是同一份。兩邊各講各的，等於本人被討論的內容
        // 他自己沒看過——這在一個以授權為主張的產品裡不能成立。
        basis: analysis,
        // 支持者打開這頁的當下想知道的是「然後呢」。光給觀察等於把功課丟回給他，
        // 而他多半不是專業人員——是家屬、社工、庇護工場的輔導員。這一段把觀察接上
        // 知識庫裡的現場話術、介入模型與理論依據，每一條都指得出出處。
        guidance,
        // 庇護知識庫講的是怎麼陪、怎麼開口；這一段講的是官方衛教與可以打的電話。
        // 支持者常常是家屬，撐不住的時候需要的不是話術，是 0800-50-7272。
        care: careFor(analysis.observations, 'supporter'),
        helplines: HELPLINES,
        attribution: ATTRIBUTION,
        // LLM 把事實跟知識組成針對這個人今天的分析。沒金鑰、超時、或輸出踩到紅線都回 null，
        // 畫面照樣完整——上面那些決定性的內容本來就夠用，這一段是加值。
        narrative: keepIfSafe(await analyse({
          facts: analysis.observations,
          knowledge: guidance,
          audience: 'supporter',
          language: (req.headers['accept-language'] || '').startsWith('en') ? 'en' : 'zh'
        }))
      });
      return;
    }
    const shared = await context.store.listSharedCheckIns(bodyRecordsMatch[1], user);
    if (!shared) return json(res, 403, { error: 'Active consent for shared summaries is required.' });
    const participantId = await context.store.participantIdForRelationship?.(bodyRecordsMatch[1], user);
    if (!participantId) return json(res, 403, { error: 'Active consent for shared summaries is required.' });
    const [vitals, medications, meals, medicationPlans] = await Promise.all([
      context.store.listVitalRecords(participantId),
      context.store.listMedicationRecords(participantId),
      context.store.listMealRecords(participantId),
      context.store.listMedicationPlans(participantId)
    ]);
    json(res, 200, { summary: buildSummary({ vitals, medications, meals, medicationPlans, now: context.now().getTime() }) });
    return;
  }

  // Published reference ranges, served so the client never hard-codes a clinical number.
  if (method === 'GET' && url.pathname === '/api/reference-ranges') {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    json(res, 200, REFERENCE);
    return;
  }

  // LLM 現在是開著還關著、今天打了幾次、快取命中多少——部署後要看得到，不然
  // 「有沒有在用」只能用猜的。不含任何個人資料。
  if (method === 'GET' && url.pathname === '/api/llm-status') {
    json(res, 200, llmStats());
    return;
  }

  if (method === 'GET' && url.pathname === '/api/participant/support-status') {
    if (!user) return json(res, 401, { error: 'Sign in required.' });
    if (user.role !== 'participant') return json(res, 403, { error: 'Participant role required.' });
    if (!user.demo) return json(res, 501, { error: 'Support updates are not available outside the demo yet.' });
    const item = demoDataFor(user).queue.find((entry) => entry.id === 'alex-01');
    const followUp = item?.followUp
      ? {
          status: item.followUp.status,
          nextReviewAt: item.followUp.nextReviewAt,
          message: item.followUp.participantMessage || null
        }
      : null;
    json(res, 200, {
      supporterName: DEMO_PERSONAS.get('jordan').displayName,
      followUp
    });
    return;
  }

  if (method === 'GET' && url.pathname === '/api/supporter/queue') {
    if (context.enforcePageAuth && !user) return json(res, 401, { error: 'Sign in required.' });
    if (user && user.role !== 'supporter') return json(res, 403, { error: 'Supporter role required.' });
    const state = demoDataFor(user);
    if (user?.demo && !activeDemoRelationship(state, 'alex-01')) {
      return json(res, 403, { error: 'Active consent for supporter access is required.' });
    }
    json(res, 200, { demoData: true, generatedAt: new Date().toISOString(), items: state.queue });
    return;
  }

  const recordMatch = url.pathname.match(/^\/api\/supporter\/queue\/([a-z0-9-]+)$/);
  if (method === 'GET' && recordMatch) {
    if (context.enforcePageAuth && !user) return json(res, 401, { error: 'Sign in required.' });
    if (user && user.role !== 'supporter') return json(res, 403, { error: 'Supporter role required.' });
    const state = demoDataFor(user);
    if (user?.demo && !activeDemoRelationship(state, recordMatch[1])) {
      return json(res, 403, { error: 'Active consent for supporter access is required.' });
    }
    const item = state.queue.find((entry) => entry.id === recordMatch[1]);
    if (!item) return json(res, 404, { error: 'Record not found.' });
    json(res, 200, { demoData: true, item }); return;
  }

  if (req.method === 'POST' && /^\/api\/supporter\/queue\/[a-z0-9-]+\/follow-up$/.test(url.pathname)) {
    if (context.enforcePageAuth && !user) return json(res, 401, { error: 'Sign in required.' });
    if (user && user.role !== 'supporter') return json(res, 403, { error: 'Supporter role required.' });
    try {
      const input = await readJson(req);
      const action = String(input.action || '');
      if (!['contacted', 'scheduled', 'closed'].includes(action)) throw new TypeError('Invalid action');
      const participantMessage = String(input.participantMessage || '').trim();
      const internalNote = String(input.internalNote || '').trim();
      if (participantMessage.length > 600 || internalNote.length > 1200) throw new TypeError('Follow-up text is too long');
      if (/(?:diagnos|prescrib|change your dose|stop taking|診斷|開藥|處方|調藥|停藥|加量|減量)/i.test(participantMessage)) {
        return json(res, 400, { error: 'Keep participant feedback to support and agreed next steps; do not include diagnosis or medication instructions.' });
      }
      // 按了要看得到結果。以前這裡只回一句成功，佇列上那一項完全沒有變——支持者做完事情，
      // 畫面卻停在「立即關心」，等於他做的紀錄沒有去處。
      const id = url.pathname.split('/')[4];
      const state = demoDataFor(user);
      if (user?.demo && !activeDemoRelationship(state, id)) {
        return json(res, 403, { error: 'Active consent for supporter access is required.' });
      }
      const item = state.queue.find((entry) => entry.id === id);
      const recordedAt = context.now();
      const nextReviewAt = new Date(recordedAt.getTime() + (action === 'contacted' ? 1 : 7) * 86400000);
      if (item) {
        item.priority = action === 'contacted' ? 'review-today' : 'routine';
        item.priorityLabel = action === 'contacted'
          ? 'Contact recorded'
          : (action === 'scheduled' ? 'Follow-up scheduled' : 'Demo item closed');
        item.followUp = {
          status: action,
          recordedAt: recordedAt.toISOString(),
          nextReviewAt: action === 'closed' ? null : nextReviewAt.toISOString(),
          participantMessage: participantMessage || null,
          internalNote: internalNote || null
        };
        if (action === 'closed') item.closed = true;
      }
      json(res, 200, {
        ok: true, status: action, recordedAt: recordedAt.toISOString(), demoData: true,
        saved: Boolean(user?.stateId && item), item: item || null
      });
    } catch {
      json(res, 400, { error: 'Choose a valid follow-up action.' });
    }
    return;
  }

  const operatingRole = /^\/(?:app|check-in)(?:\/|$)/.test(url.pathname)
    ? 'participant'
    : (/^\/supporter(?:\/|$)/.test(url.pathname) ? 'supporter' : null);
  if (method === 'GET' && context.enforcePageAuth && operatingRole && user?.role !== operatingRole) {
    const destination = encodeURIComponent(url.pathname + url.search);
    res.statusCode = 303;
    res.setHeader('Location', `/session?next=${destination}`);
    res.end();
    return;
  }

  if (method === 'GET' && /^\/supporter\/people\/[a-z0-9-]+$/.test(url.pathname)) {
    await serveFile(req, res, 'supporter-person.html');
    return;
  }

  if (method === 'GET' && /^\/supporter\/plans\/[a-z0-9-]+$/.test(url.pathname)) {
    await serveFile(req, res, 'supporter-plan.html');
    return;
  }

  if (method === 'GET' && PAGE_ROUTES.has(url.pathname)) {
    await serveFile(req, res, PAGE_ROUTES.get(url.pathname));
    return;
  }

  // 靜態檔走白名單，不是整個資料夾對外開。新增檔案要記得加進來——
  // 忘了加的症狀是頁面靜悄悄少一塊，瀏覽器 404 但畫面不會壞，很容易以為是程式寫錯。
  if (method === 'GET' && /^\/(styles\.css|competition\.css|portal\.css|public-site\.css|v3\.css|v3\.js|app\.js|participant-support\.js|supporter\.js|connections\.js|session\.js|records\.js|summary-client\.js|trends\.js|home-strip\.js|care-resources\.js|i18n\.js|ui\.js|brand-mark\.svg|icons\.svg|og-dailyable\.png)$/.test(url.pathname)) {
    await serveFile(req, res, url.pathname.slice(1));
    return;
  }

  json(res, 404, { error: 'Not found' });
}

export function classifyStartupError(error) {
  const message = String(error?.message || '');
  if (message.includes('DATABASE_URL is required')) return 'database_url_missing';
  if (message.includes('PAIRING_SECRET is required')) return 'pairing_secret_missing';
  const reasons = {
    ENOTFOUND: 'database_host_unresolved',
    EAI_AGAIN: 'database_host_unresolved',
    ECONNREFUSED: 'database_unreachable',
    ETIMEDOUT: 'database_unreachable',
    '28P01': 'database_auth_failed',
    '3D000': 'database_not_found',
    '42601': 'database_migration_invalid'
  };
  return reasons[error?.code] || 'database_startup_failed';
}

export function startFailureServer(port = Number(process.env.PORT || 3000), error, options = {}) {
  const reason = classifyStartupError(error);
  const server = http.createServer((req, res) => {
    res.writeHead(503, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'retry-after': '30'
    });
    res.end(JSON.stringify({ status: 'unavailable', dependency: 'database', reason }));
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, options.host || '0.0.0.0', () => {
      server.off('error', reject);
      resolve(server);
    });
  });
}

export async function startServer(port = Number(process.env.PORT || 3000), options = {}) {
  let pool;
  let store = options.store;
  const demoMode = options.demoMode ?? process.env.DAILYABLE_DEMO_MODE === 'true';
  if (!store && process.env.DATABASE_URL) {
    if (!process.env.PAIRING_SECRET) throw new Error('PAIRING_SECRET is required with DATABASE_URL');
    pool = await connectDatabase();
    store = new PostgresStore(pool, { pairingSecret: process.env.PAIRING_SECRET });
  }
  if (!store && (demoMode || process.env.NODE_TEST_CONTEXT)) store = new MemoryStore();
  if (!store) throw new Error('DATABASE_URL is required unless DAILYABLE_DEMO_MODE=true');
  const prototypeAuth = options.prototypeAuth ?? (demoMode || process.env.DAILYABLE_PROTOTYPE_AUTH === 'true');
  const context = {
    store, demoMode, prototypeAuth,
    enforcePageAuth: options.enforcePageAuth ?? !process.env.NODE_TEST_CONTEXT,
    now: options.now || (() => new Date()),
    trustProxy: options.trustProxy ?? process.env.DAILYABLE_TRUST_PROXY === 'true',
    csrfSecret: options.csrfSecret || randomBytes(32),
    claimAttempts: new Map()
  };
  const server = http.createServer((req, res) => {
    handle(req, res, context).catch(() => json(res, 500, { error: 'Temporary server error' }));
  });
  server.on('close', () => pool?.end());
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, options.host || '0.0.0.0', () => {
      server.off('error', reject);
      resolve(server);
    });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer().then((server) => {
    const address = server.address();
    console.log(`DailyAble listening on port ${address.port}`);
  }).catch(async (error) => {
    const reason = classifyStartupError(error);
    console.error(`DailyAble startup unavailable: ${reason}`);
    const server = await startFailureServer(undefined, error);
    console.log(`DailyAble diagnostic health endpoint listening on port ${server.address().port}`);
  });
}

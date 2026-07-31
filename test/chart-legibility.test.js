import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// The trend chart lets someone put six readings on one timeline, which only works if the
// six lines can be told apart. They could not: the colours were borrowed from the interface
// palette, which holds three near-identical reds and three near-identical greens because
// that is what buttons and links need. Water and diastolic came out the same green, systolic
// and fasting glucose the same brick — six lines, four apparent colours, and a key that
// could not be matched to the chart.
//
// Checked here rather than by eye, because it was already missed by eye once.
const TRENDS = new URL('../public/trends.js', import.meta.url);

// Grouped per chart, because the rule is per chart: two lines drawn together must differ,
// and a colour may honestly appear again on a different chart the reader never sees beside
// it. A flat file-wide check said otherwise and flagged a reuse that was fine.
async function colourGroups() {
  const source = await readFile(TRENDS, 'utf8');
  const readings = [
    ...[...source.matchAll(/^\s*\{\s*key:.*colour:\s*'([^']+)'/gm)].map((match) => match[1]),
    ...[...source.matchAll(/^\s{4}'?[\w-]+'?:\s*'(#[0-9a-f]{6})'/gim)].map((match) => match[1])
  ];
  const feeling = [...source.matchAll(/id:\s*'(?:energy|routine)'.*?colour:\s*'([^']+)'/g)].map((match) => match[1]);
  return { readings, feeling };
}

async function colours() {
  const { readings, feeling } = await colourGroups();
  return [...readings, ...feeling];
}

test('no two lines drawn on the same chart share a colour', async () => {
  const { readings, feeling } = await colourGroups();
  assert.ok(readings.length >= 8, `expected the body-readings colours, found ${readings.length}`);
  assert.equal(feeling.length, 2, 'the check-in chart draws energy and routine');

  for (const [chart, used] of [['body readings', readings], ['check-in answers', feeling]]) {
    const seen = new Set();
    const clashes = [];
    for (const colour of used) {
      const key = colour.toLowerCase();
      if (seen.has(key)) clashes.push(key);
      seen.add(key);
    }
    assert.deepEqual(clashes, [], `on the ${chart} chart these colours are used twice: ${clashes.join(', ')}`);
  }
});

test('line colours are stated outright, not borrowed from interface tokens', async () => {
  const used = await colours();
  const borrowed = used.filter((colour) => colour.startsWith('var('));
  assert.deepEqual(
    borrowed,
    [],
    `interface tokens are chosen for buttons, not for telling series apart: ${borrowed.join(', ')}`
  );
});

// The ranges and the marks along the bottom, as specified: week / month / quarter, with
// every day named in a week, the 1st/5th/10th/15th/20th/25th and the month's real last day
// in a month, and month names across a quarter.
test('the three ranges are week, month and quarter', async () => {
  // 趨勢圖 2026-07-28 併進身體紀錄頁；舊的 /app/insights 仍轉址過來。
  const page = await readFile(new URL('../public/participant-records.html', import.meta.url), 'utf8');
  for (const days of ['7', '30', '90']) {
    assert.match(page, new RegExp(`data-range="${days}"`), `a ${days}-day range should be offered`);
  }
  assert.doesNotMatch(page, /data-range="365"/, 'the year range was replaced by the quarter');
  assert.match(page, /data-zh="這一季"/, 'the quarter needs its Chinese label');
});

test('the month ends on its own last day, never an assumed 30th', async () => {
  const source = await readFile(TRENDS, 'utf8');
  assert.match(source, /lastDayOf\s*=\s*\(year,\s*month\)\s*=>\s*new Date\(year,\s*month \+ 1,\s*0\)\.getDate\(\)/,
    'the last mark must come from the month itself, so February is the 28th and not the 30th');
  assert.match(source, /\[1,\s*5,\s*10,\s*15,\s*20,\s*25,\s*lastDayOf\(year,\s*month\)\]/,
    'the month marks are the 1st, 5th, 10th, 15th, 20th, 25th and the last day');
});

test('the timeline covers the stretch that was asked for, not the stretch with data in it', async () => {
  const source = await readFile(TRENDS, 'utf8');
  assert.match(source, /function domainFor\(rangeDays, now\)/,
    'the horizontal axis must be built from the chosen range');
  assert.match(source, /const domain = options\.domain/,
    'the chart must use that range rather than the extent of the points');
});

// The check-in asks about energy and routine. It does not ask anyone to score their mood,
// so nothing may be charted as if it had been scored.
test('the check-in chart draws only answers the check-in actually collects', async () => {
  const source = await readFile(TRENDS, 'utf8');
  const server = await readFile(new URL('../src/server.js', import.meta.url), 'utf8');

  assert.match(source, /ENERGY_SCALE = \{ 'very-low': 1, low: 2, steady: 3 \}/);
  assert.match(source, /ROUTINE_SCALE = \{ 'off-track': 1, changed: 2, 'on-track': 3 \}/);

  const demoBlock = server.slice(server.indexOf('const DEMO_CHECK_INS'), server.indexOf('const RELATIONSHIP_ID'));
  assert.doesNotMatch(demoBlock, /\bmood:/, 'the form never asks for a mood, so the demo must not answer one');
  for (const invented of ["'flat'", "'medium'"]) {
    assert.ok(!demoBlock.includes(invented), `${invented} is not one of the answers the form offers`);
  }
  const entries = demoBlock.match(/createdAt:/g) || [];
  assert.ok(entries.length >= 25, `a quarter needs more than ${entries.length} check-ins to show anything`);
});

// A chart of readings that cannot go below zero must never offer a negative number to read.
// A tick at -204 mmHg shipped once; it is not a cosmetic slip, it says the chart is not
// careful with the thing it measures.
test('the scale never drops below zero for readings that cannot', async () => {
  const source = await readFile(TRENDS, 'utf8');
  assert.match(
    source,
    /min\s*>=\s*0\s*\?\s*Math\.max\(0,\s*low\)/,
    'scale() must clamp the axis at zero when the readings are non-negative'
  );
});

// The dates along the bottom were asked for so a reading could be found by day. Drawn in a
// fixed 640-wide coordinate space and shown 283 wide on a phone, they came out under 5px —
// present in the markup, unreadable on the screen, and worse on the smaller device where the
// reading actually happens. Measured width is what keeps a unit equal to a pixel.
test('the chart is drawn at the width it will occupy, so a phone does not shrink the dates', async () => {
  const source = await readFile(TRENDS, 'utf8');
  assert.match(source, /function widthFor\(host\)/,
    'the drawing needs the container width measured before it is laid out');
  assert.match(source, /const W = options\.width \|\| BASE_W/,
    'drawCombined must lay out against the measured width, not a fixed constant');
  assert.match(source, /width: widthFor\(host\)/,
    'the callers must pass the measured width');
  assert.doesNotMatch(source, /^const W = \d+;/m,
    'a fixed module-wide width is what scaled the text down');
});

// Two marks land a day apart wherever a range crosses a month boundary — the 30th and the
// 1st. Printed on top of each other they read as neither.
test('two marks never print on top of each other', async () => {
  const source = await readFile(TRENDS, 'utf8');
  assert.match(source, /previous\.half \+ half \+ 6/,
    'a mark too close to the one before it must be dropped rather than overlapped');
});

// A reading that only exists in a longer range — a tolerance test taken in May — arrived
// switched off when the reader moved to the quarter, because the set held what had been
// chosen back when that reading did not exist. Nobody had switched it off.
test('a reading that only appears in a longer range arrives switched on', async () => {
  const source = await readFile(TRENDS, 'utf8');
  assert.match(source, /const hidden = new Set\(\)/,
    'the filter must remember what was switched off, not what was switched on');
  assert.match(source, /available\.filter\(\(entry\) => !hidden\.has\(entry\.id\)\)/,
    'everything available is drawn unless the reader hid it');
  assert.doesNotMatch(source, /if \(!selected\.size\) for \(const entry of available\)/,
    'seeding a chosen set on first render is what left later readings out');
});

// With nothing drawable there is no axis, so a key that defers to the axis states nothing:
// "Glucose · mg/dL", and the one reading the person did take is nowhere on the screen.
test('a reading that cannot be drawn as a line still says what it was', async () => {
  const source = await readFile(TRENDS, 'utf8');
  assert.match(source, /const numberedAxis = \(sharedUnit \|\| Boolean\(options\.band\)\) && drawable\.length > 0/,
    'there are only numbers on the axis when there is an axis');
  assert.match(source, /const axisSpeaksFor = numberedAxis && drawable\.includes\(entry\)/,
    'the key defers to the axis only for the lines the axis actually carries');
});

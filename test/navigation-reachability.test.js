import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

// Written after shipping two working pages that nobody could reach.
//
// /app/records and /app/summary were built, deployed and returning 200, and every unit
// test passed — but the sidebar is duplicated into each page and the links were only added
// to the two new files. From the outside the feature simply did not exist.
//
// A page that works but cannot be reached is not a delivered feature, so reachability is
// checked here rather than left to whoever remembers to update eight files by hand.

const PUBLIC = new URL('../public/', import.meta.url);

const PARTICIPANT_PAGES = [
  'participant-home.html',
  'participant-check-in.html',
  'participant-records.html',
  'participant-summary.html',
  'participant-support.html',
  'participant-privacy.html'
];

const REQUIRED_PARTICIPANT_LINKS = [
  '/app',
  '/app/check-in',
  '/app/records',
  '/app/summary',
  '/app/support',
  '/app/privacy'
];

// 併頁之後，舊網址不能變成死路。任何寫在文件、簡報或聊天室裡的連結還是會有人點。
test('a merged page’s old address still takes you somewhere', async () => {
  const { startServer } = await import('../src/server.js');
  const server = await startServer(0, { enforcePageAuth: false });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const [before, after] of [['/app/insights', '/app/records'], ['/app/connections', '/app/privacy']]) {
      const response = await fetch(`${base}${before}`, { redirect: 'manual' });
      assert.equal(response.status, 301, `${before} should redirect rather than 404`);
      assert.equal(response.headers.get('location'), after);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('every participant page can reach every other participant page', async () => {
  for (const page of PARTICIPANT_PAGES) {
    const html = await readFile(new URL(page, PUBLIC), 'utf8');
    for (const link of REQUIRED_PARTICIPANT_LINKS) {
      assert.ok(
        html.includes(`href="${link}"`),
        `${page} has no link to ${link} — the page would be unreachable from there`
      );
    }
  }
});

test('every participant page marks exactly one navigation item as current', async () => {
  for (const page of PARTICIPANT_PAGES) {
    const html = await readFile(new URL(page, PUBLIC), 'utf8');
    const current = html.match(/aria-current="page"/g) || [];
    assert.equal(current.length, 1, `${page} should mark exactly one nav item as the current page`);
  }
});

// Copy is applied in bulk from a review sheet, and a sheet says "leave this one alone" as
// well as "change it to this". A marker like that must never reach a page: it did once,
// and the body-records heading rendered as the literal words "保留現文".
const SHEET_MARKERS = ['保留現文', '保留原文', '待確認位置', 'TODO', 'FIXME', 'undefined'];

test('no editorial placeholder or review marker survives into a page', async () => {
  const files = (await readdir(PUBLIC)).filter((name) => name.endsWith('.html'));
  for (const file of files) {
    const html = await readFile(new URL(file, PUBLIC), 'utf8');
    for (const marker of SHEET_MARKERS) {
      assert.ok(!html.includes(marker), `${file} contains the review marker "${marker}"`);
    }
  }
});

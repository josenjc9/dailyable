import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const publicRoot = new URL('../public/', import.meta.url);
const read = (name) => readFile(new URL(name, publicRoot), 'utf8');

const operatingPages = [
  'session.html', 'demo.html',
  'participant-home.html', 'participant-check-in.html', 'participant-records.html',
  'participant-summary.html', 'participant-support.html', 'participant-privacy.html',
  'supporter-dashboard.html', 'supporter-queue.html', 'supporter-person.html',
  'supporter-plan.html', 'supporter-follow-up.html', 'supporter-method.html',
  'supporter-connections.html'
];

test('V3 is one product system across public, session, participant and supporter pages', async () => {
  for (const name of ['index.html', 'about.html', 'how-it-works.html', ...operatingPages]) {
    const html = await read(name);
    assert.match(html, /href="\/v3\.css\?v=/, name);
  }
});

test('public home leads with the Alex and Jordan support loop and one demo action', async () => {
  const html = await read('index.html');
  assert.match(html, /class="v3-hero/);
  assert.match(html, /class="support-loop-preview/);
  assert.match(html, /Alex/);
  assert.match(html, /Jordan/);
  assert.equal((html.match(/href="\/demo"/g) || []).length, 1);
  assert.doesNotMatch(html, /A hard day can still have one clear next step/);
});

test('evidence page treats the internet gap as a constraint with an honest response', async () => {
  const html = await read('about.html');
  assert.match(html, /class="access-constraint/);
  assert.match(html, /45\.9%/);
  assert.match(html, /data-en="What works now"/);
  assert.match(html, /data-en="What the pilot must add"/);
  assert.doesNotMatch(html, /class="evidence-grid"/);
});

test('method page replaces repeated card walls with an operable story', async () => {
  const html = await read('how-it-works.html');
  const js = await read('v3.js');
  assert.match(html, /class="method-story/);
  assert.match(html, /data-method-step="check-in"/);
  assert.match(html, /data-method-panel="follow-up"/);
  assert.doesNotMatch(html, /class="decision-evidence"/);
  assert.doesNotMatch(html, /class="support-patterns"/);
  assert.match(js, /aria-selected/);
  assert.match(js, /ArrowRight/);
});

test('session joins role choice to a visible Alex-Jordan journey', async () => {
  const html = await read('session.html');
  assert.match(html, /class="session-journey/);
  assert.match(html, /Alex/);
  assert.match(html, /Jordan/);
});

test('V3 CSS establishes distinct page-family compositions and resilient motion', async () => {
  const css = await read('v3.css');
  assert.match(css, /\.v3-hero/);
  assert.match(css, /\[data-role-shell="participant"\]/);
  assert.match(css, /\[data-role-shell="supporter"\]/);
  assert.match(css, /body\.session-shell/);
  assert.match(css, /@media\s*\(max-width:\s*720px\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
}
);

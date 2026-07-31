import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const publicDir = new URL('../public/', import.meta.url);

async function source(name) {
  return readFile(new URL(name, publicDir), 'utf8');
}

test('homepage headline can reflow without forced fragment lines', async () => {
  const html = await source('index.html');
  assert.doesNotMatch(html, /Small signals\.<br>Timely support\.<br>/);
});

test('display headings keep readable caps across desktop and narrow screens', async () => {
  const css = await source('v3.css');
  assert.match(css, /\.v3-hero h1\{[^}]*clamp\(3\.4rem,5vw,5\.8rem\)[^}]*line-height:\.96/);
  assert.match(css, /@media\(max-width:720px\)[\s\S]*?\.v3-hero h1\{[^}]*clamp\(2\.75rem,11vw,3\.8rem\)/);
  assert.match(css, /\[data-role-shell="participant"\] \.page-heading h1\{[^}]*font-size:clamp\(2\.35rem,5vw,4\.6rem\)!important/);
  assert.match(css, /@media\(max-width:720px\)[\s\S]*?\.portal-shell \.page-heading h1\{[^}]*font-size:clamp\(2rem,9vw,3rem\)!important/);
});

test('grid children and long copy cannot force horizontal clipping', async () => {
  const css = await source('v3.css');
  assert.match(css, /\.v3-hero-copy,\.support-loop-preview,\.v3-story-section>\*,\.v3-page-hero>\*,\.portal-shell main,\.portal-card\{min-width:0\}/);
  assert.match(css, /\.v3-public :is\(h1,h2,h3\),\.portal-shell :is\(h1,h2,h3\)\{[^}]*overflow-wrap:break-word/);
  assert.match(css, /@media\(max-width:720px\)[\s\S]*?\.portal-shell :is\(input,textarea,select\)\{[^}]*font-size:16px!important/);
});

test('tablet supporter layouts collapse before the rail can clip content', async () => {
  const css = await source('v3.css');
  assert.match(css, /@media\(max-width:980px\)[\s\S]*?\[data-role-shell="supporter"\] \.role-layout\{grid-template-columns:1fr!important\}/);
  assert.match(css, /@media\(max-width:980px\)[\s\S]*?\[data-role-shell="supporter"\] \.demo-role-story\{grid-template-columns:1fr!important\}/);
  assert.match(css, /@media\(max-width:980px\)[\s\S]*?\[data-role-shell="supporter"\] \.queue-row\{grid-template-columns:minmax\(130px,\.7fr\) minmax\(0,1\.3fr\)!important/);
});

test('mobile record tables stay inside a deliberate horizontal scroller', async () => {
  const css = await source('v3.css');
  const html = await source('participant-records.html');
  assert.match(css, /\.portal-shell \.table-scroll\{max-width:100%;min-width:0;overflow-x:auto/);
  assert.match(html, /data-en="Swipe sideways to see every recorded field\."/);
});

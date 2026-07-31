import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { startServer } from '../src/server.js';

// 2026-07-27: a fix for the trend charts was live on the server, matched the repo byte for
// byte, and the person testing still saw the old screen — dead range buttons and one chart
// per reading. Nothing was wrong with the fix. The pages carry the ?v= stamps that decide
// which script gets fetched, and the pages themselves went out with no caching instructions
// at all, so a browser was free to hold one for as long as it liked and keep asking for the
// script that page named. Shipping stopped meaning arriving.
//
// Two things are pinned here, because either one alone lets it happen again.
let server;
let baseUrl;
const PUBLIC_DIR = new URL('../public/', import.meta.url).pathname;

test.before(async () => {
  server = await startServer(0, { enforcePageAuth: false });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

test('pages are always revalidated, so a new build cannot be masked by an old page', async () => {
  for (const path of ['/', '/demo']) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200, `${path} should be served`);
    // no-store is the stricter answer some pages give because they can carry personal
    // readings; it revalidates as well, so either is fine here.
    assert.match(
      response.headers.get('cache-control') || '',
      /^no-(cache|store)$/,
      `${path} must tell the browser to check back, or a shipped fix can stay invisible`
    );
  }
});

test('a versioned asset may be held forever, since its address changes when it changes', async () => {
  const response = await fetch(`${baseUrl}/trends.js?v=test`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') || '', /immutable/);
});

// The half that was missing. Stamps existing is not the point — stamps *following the bytes*
// is. A hand-typed stamp that someone forgets to change while rewriting the file leaves every
// earlier visitor holding the old file under a year-long instruction not to check again, and
// a fresh request cannot reproduce it, so it looks fixed from the outside.
test('the stamp a page serves is the asset it actually names, and it moves with the bytes', async () => {
  const page = await (await fetch(`${baseUrl}/app/records`)).text();
  const named = page.match(/src="\/trends\.js\?v=([a-f0-9]+)"/);
  assert.ok(named, 'the page should name a stamped trends.js');

  const source = await readFile(join(PUBLIC_DIR, 'trends.js'));
  const expected = createHash('sha256').update(source).digest('hex').slice(0, 10);
  assert.equal(named[1], expected, 'the stamp must be the file’s own content hash, not typed by hand');
});

test('every script a page names carries a version stamp', async () => {
  const files = (await readdir(PUBLIC_DIR)).filter((name) => name.endsWith('.html'));
  assert.ok(files.length, 'there should be pages to check');

  const unstamped = [];
  for (const file of files) {
    const html = await readFile(join(PUBLIC_DIR, file), 'utf8');
    for (const [, src] of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
      if (src.startsWith('http')) continue;
      if (!src.includes('?v=')) unstamped.push(`${file} → ${src}`);
    }
    for (const [, href] of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) {
      if (href.startsWith('http')) continue;
      if (!href.includes('?v=')) unstamped.push(`${file} → ${href}`);
    }
  }

  assert.deepEqual(
    unstamped,
    [],
    `these would be cached under a name that never changes, so an edit would not reach anyone:\n${unstamped.join('\n')}`
  );
});

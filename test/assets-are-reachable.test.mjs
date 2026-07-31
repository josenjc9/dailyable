import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// 2026-07-29：加了 home-strip.js，頁面引用了它，伺服器的白名單沒加。
// 症狀是首頁靜悄悄少一塊——瀏覽器拿到 404，但畫面不會壞、主控台沒有紅字，
// 看起來就像我程式寫錯。花了幾分鐘才發現檔案根本沒送出去。
//
// 這條測試把「頁面說要什麼」跟「伺服器願意給什麼」對起來。

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'server.js');

test('every asset a page asks for is one the server will actually serve', async () => {
  const server = await readFile(SERVER, 'utf8');
  const pages = (await readdir(PUBLIC)).filter((name) => name.endsWith('.html'));
  assert.ok(pages.length > 0, '沒找到任何頁面，這條測試就沒有在測東西');

  const missing = [];
  for (const page of pages) {
    const html = await readFile(join(PUBLIC, page), 'utf8');
    for (const [, asset] of html.matchAll(/(?:src|href)="\/([\w.-]+\.(?:js|css))(?:\?[^"]*)?"/g)) {
      // 白名單是一條 regex，檔名在裡面會被跳脫成 name\.js
      const escaped = asset.replace('.', '\\.');
      if (!server.includes(escaped)) missing.push(`${page} → /${asset}`);
    }
  }

  assert.deepEqual(missing, [],
    `這些檔案頁面要，但伺服器不給（會 404，而且畫面不會報錯）：\n  ${missing.join('\n  ')}`);
});

test('the check is calibrated: take one file off the list and it fails', async () => {
  // 上面那條綠燈只代表「跑得完」。這條把白名單裡挖掉一個真的在用的檔案，
  // 確認同一套邏輯真的會叫——不然它只是一條永遠不會響的警報。
  const server = (await readFile(SERVER, 'utf8')).replace('home-strip\\.js|', '');
  const pages = (await readdir(PUBLIC)).filter((name) => name.endsWith('.html'));

  const missing = [];
  for (const page of pages) {
    const html = await readFile(join(PUBLIC, page), 'utf8');
    for (const [, asset] of html.matchAll(/(?:src|href)="\/([\w.-]+\.(?:js|css))(?:\?[^"]*)?"/g)) {
      if (!server.includes(asset.replace('.', '\\.'))) missing.push(`${page} → /${asset}`);
    }
  }

  assert.ok(missing.length > 0,
    '把 home-strip.js 從白名單拿掉之後還是全綠，代表上面那條檢查根本沒有在檢查');
  assert.ok(missing.some((line) => line.includes('home-strip.js')),
    '抓到的應該就是被拿掉的那一個');
});

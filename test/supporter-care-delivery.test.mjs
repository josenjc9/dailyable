import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../src/server.js';

// 2026-07-29 踩到的洞：伺服器把照顧者負荷（care）跟專線（helplines）放進了
// body-records 回應，但 supporter.js 一行都沒讀——資料出了門，畫面沒收。
// 測試全綠、patrol 也綠，因為兩邊各自都「沒壞」，壞的是中間那條線。
//
// 這支測的就是那條線的兩端：API 真的送，前端真的收。

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

let server;
let baseUrl;

test.before(async () => {
  server = await startServer(0, { enforcePageAuth: true });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

async function supporterCookie() {
  const entry = await fetch(`${baseUrl}/demo/enter?persona=jordan`, { redirect: 'manual' });
  return (entry.headers.get('set-cookie') || '').split(';')[0];
}

test('the API sends the supporter their own care block, not just material about the person', async () => {
  const cookie = await supporterCookie();
  const response = await fetch(`${baseUrl}/api/relationships/demo-rel-1/body-records`, { headers: { cookie } });
  assert.equal(response.status, 200);
  const payload = await response.json();

  assert.ok(payload.care?.enough, '展示資料的觀察量足夠，care 不該是空的');
  assert.ok(payload.care.entries.some((entry) => entry.id === 'carer-load'),
    '支持者的 care 裡要有「照顧者負荷」——那是唯一講他自己的一條');
  assert.ok((payload.helplines || []).some((line) => line.id === 'carer-0800'),
    '家庭照顧者關懷專線 0800-50-7272 要跟著送');
});

test('the supporter page actually reads what the API sends it', async () => {
  // 另一端：前端原始碼必須引用這幾個欄位。沒有這條，上面那條綠燈只證明資料出了門。
  const source = await readFile(join(PUBLIC, 'supporter.js'), 'utf8');
  for (const key of ['payload.care', 'payload.helplines']) {
    assert.ok(source.includes(key),
      `supporter.js 沒有讀 ${key}——API 送了但畫面不會出現，這正是 2026-07-29 踩過的洞`);
  }
  assert.ok(source.includes('carer-0800'),
    '照顧者專線要真的被挑出來顯示，不是只把陣列收下來');
});

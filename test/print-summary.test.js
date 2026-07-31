import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// 就診摘要那頁的重點是「帶得出去」——本人把它印出來、帶進診間交給醫生。
// 那顆列印按鈕從一開始就接好了，但沒有任何列印規則，按下去會把選單、切換角色、
// DEMO 標籤全印在紙上。這幾條釘的是紙上該有什麼、不該有什麼。
const PORTAL = new URL('../public/portal.css', import.meta.url);
const CLIENT = new URL('../public/summary-client.js', import.meta.url);

async function printRules() {
  const css = await readFile(PORTAL, 'utf8');
  const at = css.indexOf('@media print');
  assert.ok(at !== -1, 'the summary is meant to be printed, so there has to be a print stylesheet');
  return css.slice(at);
}

test('the page furniture does not follow the summary onto paper', async () => {
  const print = await printRules();
  for (const furniture of ['.participant-dock', '.portal-header', '.role-switch', '.demo-chip', '#print-summary']) {
    assert.ok(print.includes(furniture), `${furniture} has to be hidden when printing`);
  }
  assert.match(print, /display:\s*none\s*!important/, 'hiding has to beat the screen rules');
});

test('the paper is A4 with margins a printer can actually use', async () => {
  const print = await printRules();
  assert.match(print, /@page\{size:A4/, 'a summary for a clinic visit is A4');
  assert.match(print, /margin:1[0-9]mm/, 'edge-to-edge printing loses content on most printers');
});

// 表格是這頁的內容主體。捲動容器在紙上會裁掉看不到的部分，跨頁時表頭要重印，
// 一列被切成兩頁就讀不出那一列在講什麼。
test('the tables survive being put on paper', async () => {
  const print = await printRules();
  assert.match(print, /\.table-scroll\{overflow:visible!important\}/, 'a scroll box crops what it cannot show');
  assert.match(print, /thead\{display:table-header-group\}/, 'a table across two pages needs its header on both');
  assert.match(print, /tr\{break-inside:avoid\}/, 'a row split across pages cannot be read');
});

// 收起來的段落在紙上要攤開——印出來只有標題沒有內容，比不印還糟。
test('folded sections open up on paper', async () => {
  const print = await printRules();
  assert.match(print, /details\{display:block\}/);
  assert.match(print, /details>summary\{display:none\}/);
});

// 一張沒有日期的健康紀錄，醫生沒辦法拿它做任何判斷；一張沒說清楚來源的紙，
// 可能被當成檢驗報告。這兩件事都要印在紙上。
test('the printed page says what it is, when it was printed, and what it is not', async () => {
  const client = await readFile(CLIENT, 'utf8');
  assert.match(client, /beforeprint/, 'printing from the browser menu must stamp the footer too');
  assert.match(client, /toLocaleDateString/, 'the sheet has to carry the date it was printed');
  assert.match(client, /不是檢驗報告，也不是診斷/, 'the sheet must not read as a lab report');
  assert.match(client, /Not a lab report and not a diagnosis/);

  const print = await printRules();
  assert.match(print, /data-print-footer/, 'the footer has to be rendered on the printed page');
});

// 2026-07-29 實際產 PDF 才發現這頁印出來是兩頁——而頁面上的大標就寫著
// 「一頁，帶去看診就好」。根因是 `.record-table td` 的螢幕內距（上下各 12px）
// specificity 比 @media print 裡的 `th,td` 高，列印規則寫了根本沒生效，
// 每一列 69px。這幾條釘住那個修法，不然改天有人動 CSS 又會靜靜地變回兩頁。
test('the print rules are specific enough to actually beat the screen ones', async () => {
  const print = await printRules();
  assert.match(print, /\.record-table td/,
    '列印規則要指名 .record-table td，否則螢幕的內距贏過它、一列 69px 高');
  assert.match(print, /\.record-table\{[^}]*min-width:0/,
    '螢幕給了 min-width:520px，紙上要解掉');
});

test('the medicine days run along one line instead of ten', async () => {
  const print = await printRules();
  assert.match(print, /\.medication-days\{[^}]*flex/,
    '一天一列會吃掉快十行，把摘要擠到第二頁');
  assert.match(print, /\.medication-days li::before\{content:none!important\}/,
    '螢幕那顆綠點橫排之後會變成一排髒點');
});

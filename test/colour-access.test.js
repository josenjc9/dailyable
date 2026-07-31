import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// 顏色的無障礙有兩件事要顧，這裡兩件都用數字檢查，不靠眼睛判斷。
//
// 一、對比度。文字跟背景的亮度差不夠，弱視、老花、在陽光下看手機的人就讀不到。
//    WCAG 的標準是正常大小文字 4.5:1，大字與介面元件 3:1。
//
// 二、不能只用顏色分辨。紅綠色弱是最常見的色覺差異，我們圖上的磚紅、琥珀、橄欖綠在那樣
//    的眼裡會塌成很接近的黃褐色。所以每條線除了顏色，還要有自己的線型與端點形狀——這兩
//    樣印成黑白、轉成灰階都還在。WCAG 1.4.1 講的就是這件事。

const PUBLIC = new URL('../public/', import.meta.url);

function channel(value) {
  const srgb = value / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? [...clean].map((c) => c + c).join('') : clean;
  const [r, g, b] = [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((high + 0.05) / (low + 0.05)) * 100) / 100;
}

// 顏色不見得都在第一個 :root 裡——2026-07-28 加了一組版式變數之後，只讀第一個區塊就
// 讀不到任何顏色，這兩條檢查整個變成無效卻報「對比度不足」。掃全部的 :root 才對。
async function tokens() {
  const css = await readFile(new URL('styles.css', PUBLIC), 'utf8');
  const found = {};
  for (const block of css.matchAll(/:root\{([^}]*)\}/g)) {
    for (const match of block[1].matchAll(/--([a-z-]+):(#[0-9a-f]{3,8})/gi)) found[match[1]] = match[2];
  }
  return found;
}

test('text meets the published contrast minimum against the surface it sits on', async () => {
  const t = await tokens();
  const pairs = [
    ['ink-strong', 'canvas', 4.5, 'body text on the page'],
    ['ink-strong', 'surface', 4.5, 'body text on a card'],
    ['ink-soft', 'canvas', 4.5, 'secondary text on the page'],
    ['ink-soft', 'surface', 4.5, 'secondary text on a card'],
    ['coral-deep', 'canvas', 4.5, 'the small uppercase labels'],
    ['coral-deep', 'surface', 4.5, 'labels on a card'],
    ['focus', 'canvas', 3, 'the focus ring']
  ];
  const failures = [];
  for (const [ink, background, minimum, what] of pairs) {
    assert.ok(t[ink] && t[background], `missing token: ${ink} / ${background}`);
    const ratio = contrast(t[ink], t[background]);
    if (ratio < minimum) failures.push(`${what}: ${t[ink]} on ${t[background]} is ${ratio}:1, needs ${minimum}:1`);
  }
  assert.deepEqual(failures, [], `contrast below the minimum:\n${failures.join('\n')}`);
});

// 白色文字配珊瑚色按鈕是最容易悄悄失守的一組——它看起來很好看。
test('a filled button keeps its label readable', async () => {
  const t = await tokens();
  const ratio = contrast('#ffffff', t['coral-deep']);
  assert.ok(ratio >= 4.5, `white on ${t['coral-deep']} is ${ratio}:1, needs 4.5:1`);
});

// 上面那條只驗了頁面底色跟卡片底色，漏掉「整塊塗滿顏色」的那些區塊——首頁那張大卡、深色
// 的區段。Boss 2026-07-28 回報「紅配黑看不清楚」就是漏在這裡：珊瑚底配近黑字量出來 4.7:1
// 剛好過關，但在飽和的暖底上讀起來就是吃力，卡片內的小字更糟。
// 所以填色區塊要單獨驗，而且門檻拉到 4.5 之上留餘裕。
test('text on a filled block is not just barely passing', async () => {
  const filled = [
    ['#fffdf8', '#8f493b', 'the home stage card'],
    ['#f4e4de', '#8f493b', 'the small text on that card'],
    ['#f7f3ec', '#202927', 'a dark section'],
    ['#c2ccc7', '#202927', 'the lead text in a dark section'],
    ['#f7f3ec', '#17201f', 'the footer']
  ];
  const weak = [];
  for (const [ink, background, what] of filled) {
    const ratio = contrast(ink, background);
    if (ratio < 4.5) weak.push(`${what}: ${ink} on ${background} is ${ratio}:1`);
  }
  assert.deepEqual(weak, [], `filled blocks below the minimum:\n${weak.join('\n')}`);

  // 校準：被換掉的那組必須被抓出來，否則這條檢查沒有意義
  const before = contrast('#202725', '#c96f5b');
  assert.ok(before < 5, `the combination Boss reported should read as marginal, got ${before}:1`);
});

// 這條同時是檢查器自己的校準：拿一組「一定要被抓到」的顏色進來，如果它也過了，
// 那上面兩條的綠燈就不能信。順便把當初為什麼不用那組霓虹色記在程式裡。
test('the neon palette we were asked to consider is rejected on the numbers', () => {
  const neonOnPaper = contrast('#39ff14', '#fafaf5');
  assert.ok(neonOnPaper < 4.5, `this check is broken: ${neonOnPaper}:1 should not pass as body text`);
  const brand = contrast('#17201f', '#f7f3ec');
  assert.ok(brand > neonOnPaper * 3, `our own ink should be far clearer: ${brand}:1 vs ${neonOnPaper}:1`);
});

// 色盲模擬：把每個顏色換算成三種常見色覺（紅色弱、綠色弱、藍色弱）看到的樣子，再比對
// 任兩條線在那樣的眼裡是不是還分得開。這是把「考量色盲色弱」變成可以跑的數字，不是宣稱。
// 轉換矩陣用 Machado 等人的模型（線性 sRGB 下運算）。
function toLinear(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? [...clean].map((c) => c + c).join('') : clean;
  return [0, 2, 4].map((at) => channel(parseInt(full.slice(at, at + 2), 16)));
}

// 色相、飽和度、亮度。飽和度太低的當中性色看待——灰色談色相沒有意義。
function describe(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? [...clean].map((c) => c + c).join('') : clean;
  const [r, g, b] = [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  const span = max - min;
  const saturation = span === 0 ? 0 : span / (1 - Math.abs(2 * light - 1));
  let hue = 0;
  if (span !== 0) {
    if (max === r) hue = ((g - b) / span) % 6;
    else if (max === g) hue = (b - r) / span + 2;
    else hue = (r - g) / span + 4;
    hue = (hue * 60 + 360) % 360;
  }
  return { hue, saturation, light, grey: saturation < 0.18 };
}

function hueGap(a, b) {
  const raw = Math.abs(a - b) % 360;
  return raw > 180 ? 360 - raw : raw;
}

const CVD = {
  protanopia: [[0.1522, 1.1927, -0.3449], [0.1145, 0.9245, -0.0390], [-0.0038, -0.0164, 1.0202]],
  deuteranopia: [[0.3670, 0.8608, -0.2277], [0.2801, 0.6727, 0.0472], [-0.0118, 0.0421, 0.9697]],
  tritanopia: [[1.2555, -0.0771, -0.1784], [-0.0782, 0.9308, 0.1473], [0.0047, 0.6917, 0.3037]]
};

function simulate(hex, kind) {
  const [r, g, b] = toLinear(hex);
  const m = CVD[kind];
  return m.map((row) => Math.min(1, Math.max(0, row[0] * r + row[1] * g + row[2] * b)));
}

// 在線性空間量距離就夠判斷「看起來是不是同一個顏色」，不需要完整的 CIE 色差公式。
function apart(a, b, kind) {
  const one = simulate(a, kind);
  const two = simulate(b, kind);
  return Math.sqrt(one.reduce((total, value, at) => total + (value - two[at]) ** 2, 0));
}

// 這個檢查一開始寫成「任兩條在三種色覺下都要分得開」，跑出來十五組不合格。查下去才發現
// 那個要求本身是做不到的：一張圖上九條線，要一組顏色在紅色弱、綠色弱、藍色弱三種眼裡同
// 時兩兩可辨，超出顏色能承載的資訊量（文獻上大約五到六個就是上限）。
//
// 所以判準改成它真正該長的樣子，分工清楚：
//   顏色負責「不相近、看得見」——一般視覺下不會覺得兩條是同一色，且在米色底上有對比。
//   辨識負責「一定分得出來」——任兩條的線型或端點形狀至少有一樣不同，不依賴辨色。
// WCAG 1.4.1 要的是後者：顏色不能是唯一的辨識方式。前者是給眼睛舒服，兩件事都要，
// 但不能拿做不到的標準假裝達成。
test('no two lines look like the same colour, and none is too faint to see', async () => {
  const source = await readFile(new URL('trends.js', PUBLIC), 'utf8');
  const readings = [...source.matchAll(/key:\s*'\w+'[^}]*colour:\s*'(#[0-9a-f]{6})'/gi)].map((m) => m[1]);
  const glucoseBlock = source.slice(source.indexOf('const glucoseColours'), source.indexOf('const glucoseStyles'));
  const glucose = [...glucoseBlock.matchAll(/'(#[0-9a-f]{6})'/gi)].map((m) => m[1]);
  const colours = [...readings, ...glucose];
  assert.ok(colours.length >= 9, `expected every line's colour, found ${colours.length}`);

  // 米色底上要看得見：非文字元件的最低對比是 3:1
  const faint = colours.filter((colour) => contrast(colour, '#f7f3ec') < 3);
  assert.deepEqual(faint, [], `too faint on the page background: ${faint.join(', ')}`);

  // 「相近色」要量的是色相差，不是整體距離。
  //
  // 這一點是校準逼出來的：舊那組磚紅（#8f493b 與 #c9836b）在線性空間的距離是 0.363，
  // 用距離當門檻根本抓不到它——因為那兩個顏色差在深淺，色相幾乎一樣。而「同色系分深淺」
  // 正是要避免的東西：一般人覺得它們是同一類，色弱者更是同一個顏色。
  const alike = [];
  for (let i = 0; i < colours.length; i += 1) {
    for (let j = i + 1; j < colours.length; j += 1) {
      const a = describe(colours[i]);
      const b = describe(colours[j]);
      // 一邊有顏色、一邊是灰的，本來就分得開，不必比色相也不必比亮度
      if (a.grey !== b.grey) continue;
      if (a.grey && b.grey) {
        // 兩個都是中性色，色相沒有意義，改看亮度分不分得開
        if (Math.abs(a.light - b.light) < 0.12) {
          alike.push(`${colours[i]} / ${colours[j]}: 兩個都是中性色，亮度只差 ${Math.abs(a.light - b.light).toFixed(3)}`);
        }
        continue;
      }
      const gap = hueGap(a.hue, b.hue);
      if (gap < 25) alike.push(`${colours[i]} / ${colours[j]}: hue差只有 ${gap.toFixed(1)}°`);
    }
  }
  assert.deepEqual(alike, [], `these are the same family:\n${alike.join('\n')}`);
});

test('two lines never share both a line style and an end shape', async () => {
  const source = await readFile(new URL('trends.js', PUBLIC), 'utf8');
  const readings = [...source.matchAll(/dash:\s*'([^']*)',\s*mark:\s*'(\w+)'/g)].map((m) => `${m[1]}|${m[2]}`);
  const glucoseStyles = source.slice(source.indexOf('const glucoseStyles'), source.indexOf('const byContext'));
  const glucose = [...glucoseStyles.matchAll(/dash:\s*'([^']*)',\s*mark:\s*'(\w+)'/g)].map((m) => `${m[1]}|${m[2]}`);
  const all = [...new Set([...readings, ...glucose])];
  assert.ok(all.length >= 9, `expected a style for every line, found ${all.length}`);

  // 這是不依賴辨色的那條保證：任兩條線至少在線型或形狀上不一樣
  const duplicates = all.filter((style, at) => all.indexOf(style) !== at);
  assert.deepEqual(duplicates, [], `these lines cannot be told apart without colour: ${duplicates.join(', ')}`);
});

// 校準：舊那組「同色系分深淺」必須被這個檢查抓出來，否則綠燈沒有意義。
// 用的是跟上面那條檢查同一把尺（一般視覺下的線性距離），而不是另訂一個寬鬆的標準。
function lookAlike(a, b) {
  const one = toLinear(a);
  const two = toLinear(b);
  return Math.sqrt(one.reduce((total, value, at) => total + (value - two[at]) ** 2, 0));
}

test('the old same-family palette would have failed this check', () => {
  const brickPair = hueGap(describe('#8f493b').hue, describe('#c9836b').hue);
  const amberPair = hueGap(describe('#a8741f').hue, describe('#d9a441').hue);
  assert.ok(brickPair < 25, `the check must catch the brick pair: ${brickPair.toFixed(1)}°`);
  assert.ok(amberPair < 25, `and the amber pair: ${amberPair.toFixed(1)}°`);
  // 而距離那把尺抓不到它們——這就是為什麼改用色相
  assert.ok(lookAlike('#8f493b', '#c9836b') > 0.1, 'distance alone would have let the brick pair through');
  // 色弱模擬也要看得出那兩對更接近，否則模擬那段是白寫的
  assert.ok(apart('#8f493b', '#c9836b', 'deuteranopia') < apart('#0064a4', '#c14a00', 'deuteranopia'),
    'the simulation has to rank the old pair closer than the new one');
});

// 飲食的三條線（熱量、醣類、蛋白質）來自飲食紀錄，不是身體量測，所以上面那條「身體數據
// 剛好四項」的檢查照定義不含它們。但它們跟血壓血糖畫在同一張圖上，同一條規則就得成立：
// 任兩條線至少線型或端點形狀不一樣。沒有這條，新增一組線等於從側門繞過了那個保證。
// （顏色不必另外檢查——上面的色相檢查是掃整支檔案的，這三個色已經在裡面一起比過。）
test('the meal lines are told apart from every other line without relying on colour', async () => {
  const source = await readFile(new URL('trends.js', PUBLIC), 'utf8');
  const block = source.slice(source.indexOf('const NUTRITION_SERIES'), source.indexOf('const GLUCOSE_LABEL'));
  const meals = [...block.matchAll(/key:\s*'(\w+)'[^}]*mark:\s*'(\w+)',\s*dash:\s*'([^']*)'/g)]
    .map((entry) => ({ key: entry[1], style: `${entry[3]}|${entry[2]}` }));
  assert.equal(meals.length, 3, `expected energy, carbohydrate and protein, found ${meals.length}`);

  const others = [...source.matchAll(/dash:\s*'([^']*)',\s*mark:\s*'(\w+)'/g)].map((m) => `${m[1]}|${m[2]}`);
  assert.ok(others.length >= 9, `expected the readings and glucose styles, found ${others.length}`);

  const repeated = (styles) => styles.filter((style, at) => styles.indexOf(style) !== at);
  const mealStyles = meals.map((entry) => entry.style);
  const clashes = repeated([...others, ...mealStyles]).filter((style) => mealStyles.includes(style));
  assert.deepEqual(clashes, [], `these meal lines repeat a line style and end shape already in use: ${clashes.join(', ')}`);

  // 校準：同一把尺拿去量一個已知重複的組合，抓不到就代表上面的綠燈不能信
  assert.deepEqual(repeated([...others, others[0]]), [others[0]], 'a repeated style has to be visible to this check');
});

test('every line on the chart is told apart by more than its colour', async () => {
  const source = await readFile(new URL('trends.js', PUBLIC), 'utf8');

  // 四項身體數據，每一項都要有自己的線型與端點形狀
  const readings = [...source.matchAll(/key:\s*'(\w+)'[^}]*dash:\s*'([^']*)'[^}]*mark:\s*'(\w+)'/g)]
    .map((entry) => ({ key: entry[1], dash: entry[2], mark: entry[3] }));
  assert.equal(readings.length, 4, `expected four readings with a line style, found ${readings.length}`);
  assert.equal(new Set(readings.map((r) => r.dash)).size, 4, 'two readings share a line style');
  assert.equal(new Set(readings.map((r) => r.mark)).size, 4, 'two readings share an end shape');

  // 血糖幾條屬同一個色系，更需要靠線型分開
  const glucose = source.slice(source.indexOf('const glucoseStyles'), source.indexOf('const byContext'));
  const styles = [...glucose.matchAll(/dash:\s*'([^']*)',\s*mark:\s*'(\w+)'/g)];
  assert.ok(styles.length >= 5, `every glucose timing needs its own style, found ${styles.length}`);
  assert.equal(new Set(styles.map((s) => s[1])).size, styles.length, 'two glucose timings share a line style');
  assert.equal(new Set(styles.map((s) => s[2])).size, styles.length, 'two glucose timings share an end shape');

  // 畫的時候真的用上了，而且圖例也帶著同樣的樣式
  assert.match(source, /'stroke-dasharray': entry\.dash/, 'the line has to be drawn with its style');
  assert.match(source, /marker\(entry\.mark/, 'each point has to be drawn as its own shape');
  assert.match(source, /swatch\.append\(marker\(entry\.mark/, 'the key has to carry the same shape as the chart');
});

// 展示模式的階段記憶。
//
// 為什麼要有這個檔：評審填完今日回報、存了一筆血壓、按了確認連結，畫面都說成功，重新
// 整理卻什麼都沒有——趨勢圖不會多一個點，就診摘要不會變，支持者那邊也收不到。四個畫面
// 各講各的，串不成一條線，而這條線正是這個服務要展示的東西。
//
// 所以在同一個瀏覽階段裡把寫進去的東西留著：綁在一個訪客編號上、放在記憶體、服務重開就
// 清空。不寫資料庫，不影響設了 DATABASE_URL 的正式路徑，頁面上「模擬資料」的標示照樣留
// 著——這是讓展示看得懂，不是假裝有在保存。

const SESSIONS = new Map();
// 記憶體是有限的，而每個看過展示的人都會留下一份。超過就從最舊的開始丟。
const MAX_SESSIONS = 400;
const TTL_MS = 12 * 60 * 60 * 1000;

function prune(now) {
  for (const [id, session] of SESSIONS) {
    if (now - session.touchedAt > TTL_MS) SESSIONS.delete(id);
  }
  while (SESSIONS.size > MAX_SESSIONS) {
    const oldest = SESSIONS.keys().next().value;
    if (oldest === undefined) break;
    SESSIONS.delete(oldest);
  }
}

// 每個階段都從準備好的那份資料複製一份出來，之後各自長各自的。共用同一個陣列的話，
// 一個訪客填的東西會出現在下一個訪客眼前。
export function demoStateFor(id, seed, now = Date.now()) {
  if (!id) return null;
  prune(now);
  let session = SESSIONS.get(id);
  if (!session) {
    session = {
      touchedAt: now,
      data: {
        checkIns: (seed.checkIns || []).map((entry) => ({
          ...entry,
          // Prepared history represents summaries Alex had already shared before this visit.
          // A new entry explicitly sets this false until the final confirmation endpoint runs.
          sharedWithSupporter: entry.sharedWithSupporter !== false
        })),
        vitals: [...(seed.vitals || [])],
        meals: [...(seed.meals || [])],
        medications: [...(seed.medications || [])],
        medicationPlans: [...(seed.medicationPlans || [])],
        relationships: (seed.relationships || []).map((entry) => ({ ...entry })),
        queue: (seed.queue || []).map((entry) => ({ ...entry }))
      }
    };
    SESSIONS.set(id, session);
  }
  // Map 依插入順序走訪，重新插入才會讓還在用的階段排到後面、不被當成最舊的丟掉。
  SESSIONS.delete(id);
  session.touchedAt = now;
  SESSIONS.set(id, session);
  return session.data;
}

// 新的一筆排在最前面：所有讀取端都是「最近的在上面」。
export function rememberDemoEntry(state, collection, entry) {
  if (!state || !Array.isArray(state[collection])) return entry;
  state[collection].unshift(entry);
  return entry;
}

export function forgetDemoState(id) {
  if (id) SESSIONS.delete(id);
}

// 測試用：讓每個案例從乾淨的狀態開始。
export function resetDemoState() {
  SESSIONS.clear();
}

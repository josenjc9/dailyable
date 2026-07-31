(() => {
  const STORAGE_KEY = 'dailyable-language';
  const zh = {
    'Skip to main content':'跳到主要內容','Participant':'使用者前台','Supporter':'支持者後台','How it works':'運作方式','Main navigation':'主選單','Public navigation':'公開導覽','Participant navigation':'參與者導覽','Supporter navigation':'支持者導覽','Connection steps':'連結步驟','Filter follow-up queue':'篩選待跟進佇列','Pilot trust protections':'試行信任保護措施','Evidence':'證據','Method':'方法','ONE QUIET THREAD':'一條安靜清楚的路徑','TWO ROLES / TWO WORLDS':'兩種角色，兩套體驗','DESIGNED FOR REAL ACCESS':'為真實可及性而設計','2026 PILOT':'2026 試行','The demo queue could not load.':'無法載入展示清單。','Retry':'再試一次','Record unavailable':'無法開啟紀錄','The selected demo record could not be loaded.':'無法載入所選的展示紀錄。','Restart Alex demo':'重新載入 Alex 展示','This link points to an older or unavailable demo record.':'這個連結指向較舊或目前無法使用的展示紀錄。',
    'ACCESSIBLE DAILY SUPPORT · INTERACTIVE DEMO':'無障礙日常支持 · 互動展示','Make today easier to understand.':'讓今天變得更容易理解。','A two-minute check-in becomes one manageable next step, a participant-controlled support option, and a clearer conversation for the next visit.':'兩分鐘的日常回報，會變成做得到的下一步、由本人決定的支持選項，以及下次就診時更清楚的說明。','Try Alex’s check-in':'體驗 Alex 的日常回報','Open supporter workspace':'開啟支持者後台','Demo data only.':'僅使用展示資料。','No real health or personal information is used.':'沒有使用真實健康或個人資料。','TODAY':'今天','One small step':'先做一小步','Pause one task. Save one question for Friday.':'先暫停一件事，留下一個週五想問的問題。','Chosen by Alex':'由 Alex 自己選擇','target check-in':'目標回報時間','after each check-in':'每次回報後的一步','fact · context · action':'事實 · 脈絡 · 行動','diagnoses made':'不做任何診斷','THE GAP':'現況缺口','Daily changes rarely arrive as a neat report.':'日常變化很少會自己整理成完整報告。','People remember pieces: a missed routine, lower energy, a measurement they wanted to ask about, or a day when getting started was harder. Supporters see messages and isolated records. Visits begin with reconstruction instead of useful conversation.':'人們記得的常是片段：中斷的作息、較低的精神、想詢問的測量數值，或某天特別難開始行動。支持者看到的是零散訊息與紀錄，就診時只能先重建發生過什麼。','DailyAble organizes what the participant reports without deciding what it means medically.':'DailyAble 整理本人回報的內容，不替這些內容下醫療結論。','FOR THE PARTICIPANT':'給使用者','Understand the day. Keep the choice.':'看懂今天，保留自己的選擇。','Answer only what is useful now':'只回答現在有幫助的內容','Tap-first, plain-language questions with a clear exit.':'以點選為主、簡單易懂，隨時都能退出。','See what changed':'看見哪些地方有變化','Compared with the person’s usual pattern—not with a hidden risk score.':'與自己的平常狀態相比，不使用看不懂的隱藏風險分數。','Choose one next step':'選擇一個下一步','Keep it, change it, or ask a chosen supporter to check in.':'可以保留、調整，或請自己指定的支持者關心。','Walk through the participant flow →':'體驗使用者流程 →','FOR THE SUPPORTER':'給支持者','See who needs what—not another spreadsheet.':'一眼看出誰需要什麼，不用再一列一列翻。','Prioritized work queue':'有優先順序的工作清單','Check now, review today, and routine follow-up stay visibly separate.':'立即關心、今日檢視與例行追蹤清楚分開。','Observable reasons':'可觀察的原因','Time, trend, participant request, consent scope, and what has been tried.':'包含時間、趨勢、本人需求、授權範圍與已嘗試方法。','Close the loop':'完成支持閉環','Record contact, agreed action, and the next review.':'記錄聯絡、共同決定的行動與下次檢視。','Open the supporter workspace →':'開啟支持者後台 →','TRUST BY DESIGN':'以設計建立信任','Rules hold the safety boundary. AI improves understanding.':'規則守住安全邊界，AI 協助理解。','RULES':'規則','Safety and consent':'安全與同意','AI ASSISTANCE':'AI 協助','Language and summaries':'易讀說明與摘要','HUMANS':'真人','Judgement and care':'判斷與支持','Read the data and safety boundaries':'查看資料與安全邊界',
    'Demo journey:':'展示流程：','You are viewing Alex’s simulated check-in. No real personal data is used.':'目前是 Alex 的模擬回報，不含真實個人資料。','MONDAY · 9:10 AM':'星期一 · 上午 9:10','Good morning, Alex.':'早安，Alex。','Let’s make today easier to explain. You can stop at any time.':'一起把今天說清楚；任何時候都可以停止。','Thu':'四','Fri':'五','Sat':'六','Sun':'日','Today':'今天','A simple pattern view, not a diagnosis or clinical score.':'這只是簡單的變化圖，不是診斷或臨床分數。','What happens to my answers? →':'我的回答會怎麼使用？→','Tap an answer':'點選答案','See a clear reason':'看懂原因','Choose your next step':'自己選下一步','Step 1 of 4':'第 1 步，共 4 步','Step 2 of 4':'第 2 步，共 4 步','Step 3 of 4':'第 3 步，共 4 步','Step 4 of 4':'第 4 步，共 4 步','How much energy do you have right now?':'你現在有多少精神？','Choose the closest answer. There is no “good” score.':'選最接近的答案，沒有好壞分數。','Steady':'和平常差不多','Close to my usual level':'接近平常狀態','Low':'比較低','I need a lighter pace':'今天需要放慢一點','Very low':'很低','Starting feels difficult':'開始做事有點困難','How is your usual routine going?':'今天的日常作息如何？','Think about meals, rest, movement, or a plan you normally follow.':'可以想想用餐、休息、活動或平常會做的安排。','About usual':'大致和平常一樣','My routine is mostly in place':'多數作息都有維持','A little different':'有一些不同','One part changed today':'今天有一件事改變了','Hard to keep':'不太容易維持','Several parts feel off track':'好幾件日常事情都亂掉了','What kind of help fits right now?':'現在適合哪一種協助？','Immediate danger uses a fixed safety route. AI cannot override it.':'立即危險會走固定安全流程，AI 不能更改。','No urgent concern':'沒有立即危險','I want help planning the day':'我想整理今天怎麼安排','I need help today':'我今天需要協助','I want a person to help me decide':'我想找人一起決定','I may be in immediate danger':'我可能有立即危險','Show immediate human help':'顯示立即可找的真人協助','Would you like to involve Jordan?':'要讓 Jordan 一起協助嗎？','Jordan is Alex’s chosen supporter in this demo. Nothing is sent without confirmation.':'Jordan 是本展示中 Alex 指定的支持者，未確認前不會傳送任何內容。','Keep this with me':'先由我自己處理','I will use my next step myself':'我會自己進行下一步','Offer a Jordan check-in':'提供 Jordan 關心選項','Ask me once more before sending':'傳送前再讓我確認一次','Back':'上一步','Continue':'繼續','Show my next step':'查看下一步','YOUR DAILY SUPPORT':'今天的協助','IMMEDIATE HUMAN HELP':'立即真人協助','YOUR NEXT STEPS':'接下來可以做','Try another check-in':'重新體驗','See what a supporter receives →':'看看支持者會收到什麼 →','Choose the closest answer before continuing.':'請先選擇最接近的答案。','Preparing…':'正在整理…','We could not prepare the next step. Please try again.':'目前無法整理下一步，請再試一次。','Demo confirmed: Jordan would receive the observable reason and Alex’s request—not unrestricted records.':'展示確認：Jordan 只會收到可觀察原因與 Alex 的需求，不會取得未經限制的全部紀錄。','We could not share this check-in. Nothing was sent. Try again.':'目前無法分享這次回報，資料沒有送出，請再試一次。',
    'Simulated workspace:':'模擬工作台：','all names, events, and records are demo data.':'所有姓名、事件與紀錄都是展示資料。','COMMUNITY SUPPORT WORKSPACE':'社區支持工作台','Start with the person who asked.':'先處理主動提出需求的人。','Priorities use explicit rules and participant choices—not an AI risk label.':'優先順序來自明確規則與本人選擇，不是 AI 風險標籤。','check now':'立即關心','review today':'今日檢視','routine':'例行追蹤','Quick triage guide':'快速辨識指南','Red · connect now':'紅色 · 立即連結協助','Amber · review today':'橘色 · 今天確認','Green · routine support':'綠色 · 例行支持','External support':'外界協助','Use the person’s request, observable changes, and agreed safety rules.':'依本人需求、可觀察變化與已約定的安全規則判斷。','Follow-up queue':'待跟進清單','Loading…':'載入中…','All':'全部','Check now':'立即關心','Routine':'例行','Choose a person':'選擇一位使用者','Open a queue item to see observable reasons, consent, and the suggested follow-up.':'打開項目即可查看可觀察原因、授權範圍與建議跟進方式。','OBSERVABLE REASONS':'可觀察原因','CONTEXT TO CONFIRM':'需要確認的脈絡','FUNCTIONAL SUPPORT VIEW':'功能支持分析','SUGGESTED SUPPORT PLAN':'建議協助方案','WHEN TO CONNECT OUTSIDE HELP':'何時連結外界協助','PARTICIPANT PERMISSION':'本人授權範圍','Record contact':'記錄已聯絡','Schedule follow-up':'安排後續追蹤','Close demo item':'結束展示項目','Contact recorded':'已記錄聯絡','Follow-up scheduled':'已安排追蹤','Demo item closed':'展示項目已結束','Open':'待處理','Watching':'觀察中','Demo data · just now':'展示資料 · 剛剛更新','No demo items in this view.':'這個分類目前沒有展示項目。','The demo queue could not load. Refresh to try again.':'無法載入展示清單，請重新整理。','Unavailable':'目前無法使用',
    'SERVICE AND SAFETY BOUNDARIES':'服務與安全邊界','Useful support without pretending to know more than we do.':'提供有用協助，也誠實面對系統不知道的事。','DailyAble separates observable information, questions that still need human context, and actions a person can choose.':'DailyAble 將可觀察資訊、仍需真人確認的問題，以及本人可選擇的行動分開呈現。','THE SERVICE LOOP':'服務流程','Check in':'日常回報','Explain':'看懂變化','Choose':'選擇行動','Follow through':'完成跟進','RESPONSIBILITY MAP':'責任分工','Three layers. No blurred authority.':'三個層次，權責不模糊。','Layer':'層次','May do':'可以做','Must not do':'不能做','Language model':'語言模型','Humans':'真人','DATA MINIMIZATION':'資料最小化','If a field creates no help, action, or safety value, we do not need it.':'一個問題如果幫不上忙、讓人做不了什麼，也跟安全無關，那就不要問。','Participant control':'本人自主','Purpose limits':'用途限制','Prototype honesty':'誠實說明原型','TAIWAN CONTEXT':'台灣現況','Why accessible daily support matters':'為什麼需要容易使用的日常支持','Interactive competition prototype · demo data only':'競賽互動原型 · 僅使用展示資料',
    'Observable reasons':'可觀察原因','Time, trend, participant request, consent scope, and what has been tried.':'時間、變化趨勢、本人需求、授權範圍與已嘗試的方法。','Close the loop':'完成跟進','Record contact, agreed action, and the next review.':'記錄聯絡、共同決定的行動與下次檢視。','Open the supporter workspace →':'開啟支持者工作台 →','TRUST BY DESIGN':'從設計開始建立信任','Rules hold the safety boundary. AI improves understanding.':'規則守住安全邊界，AI 只協助理解。','RULES':'規則','Safety and consent':'安全與授權','Pre-defined escalation conditions, permission scope, and actions that the system must never improvise.':'預先定義升級條件、授權範圍，以及系統絕對不能自行決定的動作。','AI ASSISTANCE':'AI 協助','Language and summaries':'語言與摘要','Plain-language explanation, conversational pacing, and concise organization of participant-reported information.':'用白話說明、降低對話負擔，並精簡整理本人回報的資訊。','HUMANS':'真人','Judgement and care':'判斷與支持','The participant, supporter, and qualified professional keep authority over support, care, and urgent decisions.':'本人、支持者與合格專業人員保有支持、照顧與緊急決策權。','International Track prototype · 2026 Presidential Hackathon':'2026 總統盃黑客松國際松原型','Read the data and safety boundaries':'查看資料與安全邊界',
    'A short, accessible conversation about today. No copyrighted screening scale is reproduced in this prototype.':'用簡短、容易理解的對話回報今天；本原型未重製任何受著作權保護的篩檢量表。','Show what changed in plain language without converting it into a diagnosis or opaque risk score.':'用白話呈現變化，不轉換成診斷或看不懂的風險分數。','Offer one manageable next step and let the participant decide whether to involve a supporter.':'提供一個做得到的下一步，由本人決定是否邀請支持者。','Supporters see observable reasons, permission scope, and the agreed next review—not unrestricted health data.':'支持者只看到可觀察原因、授權範圍與約定的下次檢視，不會取得不受限制的健康資料。','Rules':'規則','Validate inputs, apply consent, route explicit safety conditions':'驗證輸入、套用授權，並處理明確的安全條件','Invent a new clinical threshold':'自行創造臨床門檻','Rewrite for clarity, organize summaries, suggest questions':'協助改寫成易懂文字、整理摘要與建議可詢問的問題','Diagnose, prescribe, decide an emergency, or contact people autonomously':'診斷、開立處置、判定緊急狀況或自行聯絡他人','Choose support, confirm context, make professional decisions':'選擇支持方式、確認脈絡並做專業決策','Treat the system output as a medical conclusion':'把系統輸出視為醫療結論','Choose the supporter, information scope, and when sharing ends. See who receives a notification before confirming it.':'由本人選擇支持者、資料範圍與分享終止時間；確認前可先看清楚通知對象。','No advertising segmentation, public labels, medical diagnosis, or model training from participant support data.':'支持資料不得用於廣告分眾、公開標籤、醫療診斷或模型訓練。','This deployment uses simulated records. In-memory demo actions reset when the service restarts.':'目前部署使用模擬紀錄；服務重新啟動後，記憶體中的展示操作會重設。','of persons with disabilities surveyed in 2024 had never used the internet.':'2024 年受訪身心障礙者從未使用網路。','Ministry of Digital Affairs source':'數位發展部資料來源','adult diabetes prevalence reported in Taiwan’s 2017–2020 nutrition and health survey.':'台灣 2017–2020 年國民營養健康狀況變遷調查所報告的成人糖尿病盛行率。','Health Promotion Administration source':'國民健康署資料來源','dementia prevalence among adults aged 65 and above in the 2020–2023 national community survey.':'2020–2023 年全國社區調查中，65 歲以上成人的失智症盛行率。','Ministry of Health and Welfare source':'衛生福利部資料來源','Population statistics describe the public challenge. They are not used to infer an individual participant’s condition.':'人口統計用於描述公共議題，不會拿來推論個別使用者的狀況。','Try the participant journey':'體驗使用者流程','YOUR NEXT STEPS':'你的下一步','Try another check-in':'重新回報一次','See what a supporter receives →':'查看支持者會收到什麼 →',
    'Three-step operation guide':'三步操作教學','Recent check-in pattern':'近期回報變化','Responsibility map':'權責分工表','Filter follow-up queue':'篩選待跟進清單','Service principles':'服務原則','DailyAble home':'DailyAble 首頁','Illustration of daily signals becoming practical support':'日常訊號轉成實際支持的圖像說明','Updated':'更新於','Check in now':'立即關心','Review today':'今日檢視','Routine follow-up':'例行追蹤','Today, 09:10':'今天 09:10','Today, 08:42':'今天 08:42','Yesterday, 18:05':'昨天 18:05',
    'Routine changed for three check-ins':'連續三次回報顯示作息改變','Participant asked for a supporter check-in':'本人主動要求支持者關心','Two self-reported measurements were marked for visit discussion':'本人標記兩項測量紀錄，準備就診討論',
    'Alex reports lower energy and has paused the usual morning meal routine.':'Alex 回報精神較低，也暫停了平常的早晨用餐作息。',
    'Describe support needs by function, not by diagnosis or personality.':'用功能需求描述協助，不用診斷或個性替人貼標籤。','The system recommends a connection point; the supporter confirms context and acts with the participant whenever possible.':'系統提供資源連結方向；支持者先確認脈絡，並盡可能與本人共同決定。',
    'Task initiation':'開始行動','Understanding':'理解資訊','Communication':'溝通表達','Environment':'環境條件','Planning':'規劃整理','Memory':'記憶提示','Routine':'例行','Routine pattern':'日常作息','Autonomy':'自主選擇',
    'Morning routine has been harder to start':'早晨作息比平常更難開始','No evidence of misunderstanding yet':'目前沒有觀察到理解錯誤','Alex explicitly requested contact':'Alex 明確表示希望有人聯絡','The usual meal cue was missed':'平常的用餐提示沒有出現','Reduce the first task to one visible action':'把第一件事縮成一個看得見的動作','Use one question at a time and ask Alex to choose':'一次只問一件事，讓 Alex 自己選擇','Begin with Alex’s request instead of interpreting the score':'先接住 Alex 的需求，不解讀成風險分數','Check whether time, place, tools, or another person changed':'確認時間、地點、工具或陪伴者是否有變化',
    'Contact Alex within the agreed window and confirm immediate safety first.':'在約定時間內聯絡 Alex，先確認目前是否安全。','Ask one context question: “What made the morning harder to start?”':'先問一個脈絡問題：「今天早上是什麼讓開始變得比較困難？」','Offer a visual two-step plan and let Alex choose the first action.':'提供視覺化的兩步計畫，讓 Alex 選第一個行動。','Record what helped, what did not, and the next review time.':'記錄有效與無效的方法，以及下次檢視時間。',
    'Social welfare consultation':'社會福利諮詢','Vocational rehabilitation and workplace accommodation':'職業重建與職場合理調整','Long-term care consultation':'長照服務諮詢','Qualified health professional':'合格醫療專業人員','No outside connection indicated':'目前不需連結外界協助','Review outside support':'檢視是否需要外界協助','Professional question to prepare':'準備詢問專業人員','No outside support indicated':'目前不需外界協助',
    'Use when support needs extend beyond the current service or the household needs welfare navigation.':'當需求超出目前服務範圍，或家庭需要福利資源導航時使用。','Use when work participation, job adjustment, or structured vocational support is needed.':'需要工作參與、職務調整或結構化就業支持時使用。','Use when daily living or caregiver support needs require formal assessment.':'日常生活或照顧支持需要正式評估時使用。','May contact Jordan by phone · no automatic sharing with other services':'可用電話聯絡 Jordan · 不會自動分享給其他服務',
    'Get immediate human help now':'現在就找真人協助','You selected an immediate safety concern.':'你選擇了立即安全疑慮。','Contact local emergency services or a trusted person who can reach you now.':'聯絡所在地緊急服務，或現在能到你身邊的可信任對象。','Stay with another person if you can do so safely.':'若情況允許且安全，先和另一個人待在一起。','Call Jordan now':'現在聯絡 Jordan',
    'Make today smaller':'把今天縮小一點','Your energy and routine look different from your usual pattern.':'你的精神與作息和平常狀態不同。','You asked for some help today.':'你今天表示希望有人協助。','Choose one planned task to pause or shorten.':'從原本計畫中選一件暫停或縮短。','Write one question you want to ask at your next visit.':'寫下一個下次就診想問的問題。','Ask Jordan to check in':'請 Jordan 關心一下',
    'Protect your pace':'保留自己的步調','One part of today feels different, while the rest of your routine is still in place.':'今天有一部分和平常不同，其餘作息仍有維持。','Keep your next task short and leave time to reset.':'下一件事做短一點，也留一些重新整理的時間。','Check back later only if it would be useful.':'只有在有幫助時，晚一點再回來確認。','One small step is enough':'先做一小步就夠了','Your self-reported energy and routine are close to your usual pattern.':'你回報的精神與作息接近平常狀態。','Keep one routine that already works for you.':'保留一個原本就有效的日常習慣。','Save one question if anything feels different later.':'之後若有不同，先留下一個想問的問題。',
    'DECISION BASIS':'判斷依據','WHAT TO RULE OUT':'需要先排除的因素','HOW WE WILL KNOW':'如何判斷支持有效',
    'Fact: the routine changed across three participant reports.':'事實：本人連續三次回報作息變化。','Request: Alex explicitly asked for a supporter check-in.':'需求：Alex 明確要求支持者關心。','Function hypothesis · medium confidence: starting the morning routine may need more structure.':'功能假設 · 中等信心：早晨作息的開始階段可能需要更多結構。','Boundary: this pattern does not identify a diagnosis or cause.':'邊界：這個變化無法用來判定診斷或原因。',
    'Check whether the instructions or expected sequence changed.':'確認指示或預期順序是否有改變。','Check sensory load, sleep, medicine, pain, and physical comfort with Alex.':'與 Alex 確認感官負荷、睡眠、藥物、疼痛與身體舒適度。','Check whether time, place, tools, support, or relationships changed.':'確認時間、地點、工具、支持方式或關係是否有改變。','Alex can choose and begin one visible first action.':'Alex 能選擇並開始一個看得見的第一步。','Alex reports that the morning feels more manageable.':'Alex 回報早晨變得比較容易處理。','The supporter records what helped, what did not, and a review time.':'支持者記錄有效與無效的方法，以及下次檢視時間。',
    'Record contact, agreed action, what helped, and the next review.':'記錄聯絡、共同決定的行動、有效的方法與下次檢視。','Supporters see observable reasons, permission scope, what was tried, and the agreed next review.':'支持者只看到可觀察原因、授權範圍、已嘗試的方法與約定的下次檢視。',
    '2026 PRESIDENTIAL HACKATHON · INTERNATIONAL TRACK':'2026 總統盃黑客松 · 國際松','THE PUBLIC-SERVICE GAP':'公共服務缺口','THE SERVICE LOGIC':'服務判斷邏輯','INNOVATION':'創新性','IMPACT MODEL · SDG 3 + SDG 10':'影響模型 · SDG 3 + SDG 10','GLOBAL ADAPTATION':'國際在地化','FEASIBILITY AND ROADMAP':'可行性與路線圖','SERVICE · JUDGEMENT · SAFETY':'服務 · 判斷 · 安全','TRANSPARENT DECISION PATH':'透明判斷路徑','DECISION EVIDENCE':'判斷證據','FUNCTION-FIRST SUPPORT':'功能優先支持','FACT':'事實','CONTEXT':'脈絡','HYPOTHESIS':'假設','ACTION':'行動','RESULT':'結果','INPUT':'投入','OUTPUT':'產出','OUTCOME':'成果','IMPACT':'影響',
    'Home':'首頁','Evidence & impact':'證據與影響','Enter participant app':'進入參與者前台','Enter supporter workspace':'進入支持者後台','Open follow-up queue':'開啟待跟進佇列','Open insights →':'查看我的趨勢 →','Review support →':'查看支持選項 →','Review permission →':'查看資料授權 →','Add today’s check-in':'新增今日回報','Start check-in':'開始回報','Review permission in check-in':'在回報中確認授權','Open support plan':'開啟支持方案','View follow-up record':'查看追蹤紀錄','Support plan':'支持方案','RECORD FOLLOW-UP':'記錄追蹤','This demo record was not found.':'找不到這筆模擬紀錄。','Could not record':'無法記錄','Message Alex can see':'給 Alex 的回覆','Acknowledge what Alex shared and write one agreed next step.':'接住 Alex 分享的內容，再寫下一個雙方同意的下一步。','Internal note · Jordan only':'內部備註 · 僅 Jordan 可見','Record service coordination details that Alex does not need to receive.':'記錄服務協調細節，不會傳給 Alex。','Use supportive language and agreed actions. Do not diagnose or give medication instructions.':'請使用支持性語言與共同約定的行動，不要下診斷或提供用藥指示。','Keep participant feedback to support and agreed next steps; do not include diagnosis or medication instructions.':'給 Alex 的回覆請限於支持與共同約定的下一步，不要包含診斷或用藥指示。','The demo queue could not load. Refresh to try again.':'無法載入模擬佇列，請重新整理後再試。','View my insights →':'查看我的趨勢 →','What happens to my answers? →':'我的回答會怎麼使用？→','← Back to person':'← 回到個別紀錄','← Back to queue':'← 回到待跟進佇列','SUPPORT PLAN':'支持方案','INDIVIDUAL RECORD':'個別紀錄','PROPOSED PILOT METRICS':'試辦衡量指標',
    'EVIDENCE · PILOT · PUBLIC VALUE':'證據 · 試辦 · 公共價值','THE CASE FOR ACCESSIBLE DESIGN':'無障礙設計的現實條件','PROPOSED PILOT MEASURES':'試辦衡量指標','INTERNATIONAL ADAPTATION':'國際在地化','NEXT REVIEW':'下一階段檢核','ONE SERVICE, TWO RESPONSIBILITIES':'同一套服務，兩種責任','EXPLORE THE PRODUCT':'體驗產品','WHY THIS DESERVES A PILOT':'為什麼值得試辦','TODAY · 08:40':'今天 · 08:40','01 · NOTICE':'01 · 察覺變化','02 · CHOOSE':'02 · 本人選擇','03 · FOLLOW UP':'03 · 後續支持','LANGUAGE':'語言','SERVICES':'服務資源','GOVERNANCE':'治理','EVIDENCE':'證據',
    'Start the pilot':'開始試行體驗','MY DAILYABLE':'我的 DailyAble','PARTICIPANT':'參與者','SUPPORTER':'支持者','Connections':'連結','My space':'我的空間','Alex':'Alex','Jordan’s workspace':'Jordan 的工作台','Support workspace':'支持工作台','SUPPORT OPERATIONS':'支持工作','MY INSIGHTS':'我的趨勢','LAST FIVE CHECK-INS':'最近五次回報','Today · 09:10':'今天 · 09:10','One next step':'一個下一步','Sunday':'星期日','Kept private':'保留為私人','Saturday':'星期六','Complete':'已完成','DATA & PERMISSION':'資料與授權','SUPPORT & RESOURCES':'支持與資源','SMALL STEP':'一小步','CHOSEN SUPPORTER':'指定支持者','FOLLOW-UP RECORD':'追蹤紀錄','DECISION METHOD':'判斷方法','Loading participant…':'正在載入參與者…','Loading the selected demo record.':'正在載入所選展示紀錄。','Loading support plan…':'正在載入支持方案…','FOLLOW-UP QUEUE':'待跟進佇列',
    // Wording that was rewritten in the pages after it was first translated here. A key that
    // no longer matches the page is not a missing translation anyone notices — the sentence
    // simply stays in English beside its translated neighbours, which is how three English
    // lines came to sit in the middle of a Chinese check-in.
    'Let’s make today easier to explain. You can stop here whenever you need to.':'一起把今天說清楚；你隨時想停就停。','Choose the answer that feels closest. There is no good or bad score.':'選最接近的答案，沒有好壞分數。','I need to slow down today':'今天需要放慢一點','Ask me again before anything is shared':'傳送任何內容前先再問我一次',
    'Step 1 of 5':'第 1 步，共 5 步','Step 2 of 5':'第 2 步，共 5 步','Step 3 of 5':'第 3 步，共 5 步','Step 4 of 5':'第 4 步，共 5 步','Step 5 of 5':'第 5 步，共 5 步',
    'SUPPORT':'支持','PERMISSION':'資料授權','Your connection':'你的連結對象',
    'Confirm what changed, ask what would make today easier, and record the agreed follow-up.':'確認有什麼變化，問問今天怎樣會比較好過，再把講好的跟進記下來。','No immediate action. Review at the next agreed weekly check-in.':'目前不用特別做什麼，等下次約好的每週檢視再看。',
    // 「之前的回報」表：展示資料裡當時的下一步與備註。沒有這批，中文介面下那張表會
    // 一句中文一句英文交錯——每一句展示資料都要有對應中文，這是加展示資料時的規矩。
    'Sit down, drink water, and eat something small before anything else.':'先坐下來，喝點水，吃一點東西再說。','Pick one part of the routine and do only that part today.':'挑作息裡的一件事，今天只做那一件。','Repeat the ten-minute walk and note how it felt.':'再走一次那十分鐘，記下感覺如何。','Set out tomorrow’s clothes tonight.':'今晚先把明天的衣服準備好。','Keep the same wake-up time for two days.':'連續兩天維持同一個起床時間。','Note what was different about last night.':'記下昨晚有什麼不一樣。','One small thing from the usual routine.':'從平常作息裡挑一件小事做。','Same again tomorrow.':'明天照樣做一次。','Keep the bedtime that worked.':'維持那個有效的就寢時間。','Nothing to change today.':'今天不用改什麼。','Aim for the usual bedtime tonight.':'今晚回到平常的就寢時間。','Keep going.':'照這樣繼續。','Put one meal at a fixed time tomorrow.':'明天把其中一餐固定在同一時間。','Same walk tomorrow.':'明天同樣散個步。','One part of the routine only.':'只做作息裡的一部分就好。','Pick the easiest part of the routine and start there.':'挑作息裡最容易的那件開始。','Note what pushed the routine.':'記下是什麼打亂了作息。','Record when you can; gaps are fine.':'有空再記就好，中斷沒關係。','Rest earlier tonight.':'今晚早點休息。','Back to the usual bedtime tonight.':'今晚回到平常的就寢時間。','Keep the routine that is working.':'維持目前有效的作息。','Record again in a few days.':'過幾天再記一次。',
    'Skipped breakfast, slept badly.':'沒吃早餐，睡得不好。','Morning routine paused again.':'早晨作息又停了。','Walked ten minutes after lunch.':'午餐後走了十分鐘。','Woke up late again.':'又睡過頭了。','Better night.':'睡得比較好。','Slept through.':'一覺到天亮。','Late night.':'晚睡。','Busy day, ate late.':'忙了一天，吃得晚。','Walked in the morning.':'早上有散步。','Off schedule all week.':'整週作息都亂了。','Busy week, forgot most days.':'這週很忙，大多忘了記。','Tired but kept to the plan.':'累，但有照計畫做。','Felt tired on waking.':'醒來就覺得累。','Good week.':'這週還不錯。','Started recording.':'開始記錄。','Only had time for a glucose check.':'只來得及量血糖。','Tolerance test at the clinic.':'在診所做耐受測試。','Travelled, slept badly.':'出門在外，睡得不好。','Walked after dinner.':'晚餐後散了步。','With breakfast':'跟早餐一起','Demo mode shows the flow without storing anything.':'展示模式只演流程，不會儲存任何內容。'
  };

  const reverse = Object.fromEntries(Object.entries(zh).map(([en, value]) => [value, en]));
  let language = 'en';
  let translating = false;

  function canonicalEnglish(value) {
    // 標題排版會在中文裡插入 U+2060（零寬不換行）把不該拆開的字綁住。查字典時要先拿掉，
    // 否則切回英文時對照不到、整句就卡在中文。
    const trimmed = value.replace(/⁠/g, '').trim();
    return reverse[trimmed] || trimmed;
  }

  function t(value) {
    const english = canonicalEnglish(String(value));
    return language === 'zh-TW' ? (zh[english] || english) : english;
  }

  function translateTextNode(node) {
    if (!node.nodeValue || !node.nodeValue.trim()) return;
    const parent = node.parentElement;
    if (!parent || ['SCRIPT', 'STYLE', 'SVG'].includes(parent.tagName) || parent.closest('[data-i18n-ignore], [data-en][data-zh]')) return;
    const original = canonicalEnglish(node.nodeValue);
    const leading = node.nodeValue.match(/^\s*/)?.[0] || '';
    const trailing = node.nodeValue.match(/\s*$/)?.[0] || '';
    const translated = t(original);
    if (node.nodeValue !== `${leading}${translated}${trailing}`) node.nodeValue = `${leading}${translated}${trailing}`;
  }

  function applyLanguage(root = document.body, emit = true) {
    translating = true;
    document.documentElement.lang = language;
    const scopedElements = root === document.body ? document : root;
    scopedElements.querySelectorAll('[data-en][data-zh]').forEach((element) => {
      element.textContent = language === 'zh-TW' ? element.dataset.zh : element.dataset.en;
    });
    scopedElements.querySelectorAll('[data-aria-en][data-aria-zh]').forEach((element) => {
      element.setAttribute('aria-label', language === 'zh-TW' ? element.dataset.ariaZh : element.dataset.ariaEn);
    });
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) translateTextNode(node);
    document.querySelectorAll('[aria-label]').forEach((element) => {
      const original = canonicalEnglish(element.getAttribute('aria-label'));
      element.setAttribute('aria-label', t(original));
    });
    const titleMap = {
      '/': ['DailyAble · Daily support, led by the person', 'DailyAble · 由本人帶領的日常支持'],
      '/about': ['Evidence and pilot plan · DailyAble', '證據與試辦計畫 · DailyAble'],
      '/how-it-works': ['How it works · DailyAble', '運作方式 · DailyAble'],
      '/app': ['Participant home · DailyAble', '參與者首頁 · DailyAble'],
      '/app/check-in': ['Today’s check-in · DailyAble', '今日回報 · DailyAble'],
      '/app/insights': ['My insights · DailyAble', '我的趨勢 · DailyAble'],
      '/app/support': ['Support and resources · DailyAble', '支持與資源 · DailyAble'],
      '/app/privacy': ['Data and permission · DailyAble', '資料與授權 · DailyAble'],
      '/app/connections': ['Support connections · DailyAble', '支持者連結 · DailyAble'],
      '/check-in': ['Today’s check-in · DailyAble', '今日回報 · DailyAble'],
      '/session': ['Choose your DailyAble space', '選擇你的 DailyAble 空間'],
      '/supporter': ['Supporter overview · DailyAble', '支持者總覽 · DailyAble'],
      '/supporter/queue': ['Follow-up queue · DailyAble', '待跟進佇列 · DailyAble'],
      '/supporter/follow-up': ['Follow-up record · DailyAble', '追蹤紀錄 · DailyAble'],
      '/supporter/method': ['Decision method · DailyAble', '判斷方法 · DailyAble'],
      '/supporter/connections': ['Participant invitations · DailyAble', '參與者邀請 · DailyAble']
    };
    const dynamicTitle = location.pathname.startsWith('/supporter/people/')
      ? ['Participant detail · DailyAble', '個別紀錄 · DailyAble']
      : (location.pathname.startsWith('/supporter/plans/') ? ['Support plan · DailyAble', '支持方案 · DailyAble'] : null);
    const titles = dynamicTitle || titleMap[location.pathname] || titleMap['/'];
    document.title = language === 'zh-TW' ? titles[1] : titles[0];
    const toggle = document.querySelector('#language-toggle');
    if (toggle) {
      toggle.textContent = language === 'zh-TW' ? 'English' : '繁體中文';
      toggle.setAttribute('aria-label', language === 'zh-TW' ? '切換為英文' : 'Switch to Traditional Chinese');
    }
    translating = false;
    if (emit) document.dispatchEvent(new CustomEvent('dailyable:languagechange', { detail: { language } }));
  }

  function setLanguage(next) {
    language = next === 'zh-TW' ? 'zh-TW' : 'en';
    // Store the choice either way. Clearing it would let the browser default win back on
    // the next page, which reads as the toggle not sticking.
    localStorage.setItem(STORAGE_KEY, next === 'zh-TW' ? 'zh-TW' : 'en');
    applyLanguage();
  }

  function init() {
    const requested = new URLSearchParams(location.search).get('lang');
    const saved = localStorage.getItem(STORAGE_KEY);
    // English is the default, because this is an international entry and a reviewer must
    // land in a language they can read. The browser's own language is deliberately not
    // consulted. What a visitor chooses is remembered, so the toggle only has to be used
    // once — the earlier version cleared the key when English was picked, which let the
    // default win the choice back on the next page and made the toggle look broken.
    language = requested === 'zh' || requested === 'zh-TW'
      ? 'zh-TW'
      : requested === 'en'
        ? 'en'
        : saved === 'zh-TW'
          ? 'zh-TW'
          : 'en';
    const toggleHost = document.querySelector('.site-header, .portal-header');
    if (toggleHost && !document.querySelector('#language-toggle')) {
      const button = document.createElement('button');
      button.id = 'language-toggle';
      button.type = 'button';
      button.className = 'language-toggle';
      button.dataset.i18nIgnore = 'true';
      button.addEventListener('click', () => setLanguage(language === 'en' ? 'zh-TW' : 'en'));
      toggleHost.append(button);
    }
    applyLanguage();
    const observer = new MutationObserver((mutations) => {
      if (translating) return;
      mutations.forEach((mutation) => mutation.addedNodes.forEach((added) => {
        if (added.nodeType === Node.TEXT_NODE) translateTextNode(added);
        else if (added.nodeType === Node.ELEMENT_NODE) applyLanguage(added, false);
      }));
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.DailyAbleI18n = { t, setLanguage, getLanguage: () => language, applyLanguage };
  document.addEventListener('DOMContentLoaded', init);
})();

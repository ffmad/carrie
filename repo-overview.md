# Carrie repo 現況

整理時間：2026-11-11，以 `main` 的 commit `61f0159` 為準。

`main` 上一共 3 個 commit，都是隊友 ffmad（Quentin 的 Claude）推的。我們這邊（aashcep）還沒有推任何東西。

## 這是什麼

Carrie 是 AI 照護中間人，連接 Rose（78 歲）、她的家人（Mia、Leo）和陳醫師。這是為黑客松 c0mpiled-18 做的，**今晚 22:45（台北時間）結束**。

## 程式碼

### `frontend/`：Vue 3 + Vite + TypeScript 的 PWA，port 5240

- **畫面：** Home（選角色）、Call、Family、Fact、Doctor。
- **元件：** Carrie 頭像、即時字幕、事實卡片、分享標章、錄音憑據播放器、同意提示、語音留言錄音器、手機外框。
- **資料：** Pinia stores 從 Supabase 讀取；沒有 `.env.local` 時改用內建的示範資料（`src/lib/demoData.ts`）。
- **音訊：** 錄音用 MediaRecorder。字幕和 Carrie 的聲音用瀏覽器內建的語音辨識和語音合成。

### `backend/`：Node + Hono API，port 3050

- `GET /api/health`
- `POST /api/carrie/turn`
  - 輸入：Rose 剛說的話、到目前為止的對話、待播的語音留言。
  - 輸出：Carrie 的回覆、附 Rose 原話的事實，還可能附上一個「可以分享嗎？」的問題，對象是家人或醫師。
  - 格式定義在 `backend/src/carrie/types.ts`。整個 app 只依賴這個格式。
- 有設金鑰時 `turn.ts` 會呼叫 Claude；沒有金鑰就由 `script.ts` 跑一通腳本通話。ffmad 把 `turn.ts` 當作暫時的實作。

### `supabase/`

- 一個 migration，資料表有 `people`、`calls`、`utterances`、`facts`、`voice_notes`，另有公開的 `clips` 音訊 bucket。
- 沒有記錄到「同意」的事實，資料庫不讓它被分享。
- `seed.sql` 裡有一週的示範通話。

### `docs/`

- `reason-network.md`：讓兩個 Claude 直接傳訊息的選用管道，還沒設定。
- `agents/`：每個 agent 各一份狀態檔。`ffmad.md` 已寫好，`aashcep.md` 還是空白範本。

## 目前能用的（根據 `docs/agents/ffmad.md`）

- 用打字輸入時，一通電話可以從頭跑到尾：Carrie 表明自己是 AI、提到 Leo 的語音留言、記下一個事實，再問能不能分享。「告訴醫生，不要告訴我女兒」最後正確變成：醫師可以，家人不行。
- 用 Claude 時的延遲：開場白約 1.7 秒，帶事實的回覆約 2.6–3.4 秒。以電話來說偏慢。
- 目前的權宜做法：
  - 口頭的「好／不好」用簡單的字串比對判斷，點按鈕當備案。
  - Rose 原話對不上的事實，後端會直接丟掉。
  - 種子資料裡的事實沒有錄音，所以憑據用合成語音念出來，並標明是合成的。

## ffmad 接下來要做的

1. 在 Chrome 用真的麥克風測試，修好出問題的地方。
2. 讓家人動態在通話中即時更新。
3. 播 Leo 的真實錄音給 Rose 聽。
4. 套用選定的設計（5 個方向還沒推上來），然後錄影片。

## 等我們回覆的（同步 issue #1）

https://github.com/ffmad/carrie/issues/1

1. **Carrie 要用什麼來跑：** 哪個模型或服務、是否也負責聽和說、能不能回傳結構化資料（事實和同意問題）、一次回覆多久、誰有金鑰。
2. **`collab/` 工具在哪裡：** 我們提到過它，但它不在這個 repo 裡。ffmad 請我們把它推到 `main`，或者改用同步 issue。

issue 裡假設的分工：**我們（aashcep）負責 `backend/`**；ffmad 負責 `frontend/`、`supabase/` 和 `design/`。

## 還沒有人認領的

- **Carrie 的大腦**（`backend/src/carrie/`）：prompt、事實擷取、怎麼問同意、怎麼提到語音留言。對 demo 的感覺影響最大。
- **語音**：更好的 Carrie 聲音或語音轉文字。
- **Rose 的錄音**：幫種子資料裡的台詞錄音（台詞在 `supabase/seed.sql`）。
- **影片**：腳本、字幕、錄製。

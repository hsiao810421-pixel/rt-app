# 中榮 RT 隨身站（PWA App）

臺中榮總胸腔部呼吸治療科的資訊整合 App。把呼吸器數量、工作守則、業務指引、班表、公告、新知識集中成一個手機可安裝的網頁 App。

## 目前進度：Phase 2（儀表板總覽首頁，可運行）

- 手機開網址 →「加到主畫面」即成 App icon，可離線使用
- **首頁＝儀表板總覽**（響應式：桌機左中右+下、手機自動堆疊），底部 5 分頁保留
- 版面：
  - 左｜今日出勤（iframe 班表系統）＋進入班表連結
  - 中｜Google 日曆（內嵌，桌機月曆／手機議程自動切）
  - 右｜各組公告（依組別分區，資料來自公告試算表 gviz CSV）
  - 下｜每日呼吸器剩餘數量（各類型剩餘/安全數，低於安全值標紅）
  - 最下｜RT資料庫（Drive 連結）＋新知識
- 分頁：呼吸器 / 守則（連現有網頁與文件）、班表（iframe 班表系統）、更多

> ⚠️ 改版後快取：`index.html` 用 `app.js?v=x` / `styles.css?v=x` 破快取，**每次改 JS/CSS 記得同步 bump 這個 v 值**（也決定使用者端何時拿到更新）。

## 本機預覽

```
python -m http.server 8123 --directory Dashboard
```
開 http://localhost:8123 。**注意**：PWA 的安裝與 Service Worker 需要 http/https，不能用 file:// 直接開。

## 檔案結構

```
Dashboard/
  index.html            App 外殼（header + 內容區 + 底部分頁）
  styles.css            樣式（支援手機安全區、深色模式）
  app.js                前端邏輯（hash 路由 + 各頁渲染）
  sw.js                 Service Worker（離線快取；含 push 事件雛形）
  manifest.webmanifest  PWA 資訊（名稱、圖示、顏色）
  icons/                App 圖示（make_icons.py 可重新產生）
  data/
    config.json         各功能連結（可編輯）
    announcements.json  公告區資料
    knowledge.json      新知識區資料
    schedule.json       班表資料（見下方格式）
```

## 待補的設定（data/config.json）

| 欄位 | 說明 | 現況 |
|---|---|---|
| links.ventilator | 呼吸器儀表板網址 | ✅ 已填短網址 |
| links.businessGuideDoc | 業務快速指引 Google 文件 | ✅ 已填 |
| links.scheduleApp | 班表系統網址 | ✅ 已填 |
| calendarEmbedUrl | Google 日曆內嵌網址 | ✅ 已填 (ccrt.vghtc) |
| announcementsCsvUrl | 公告試算表 gviz CSV | ✅ 已填（試算表需設「知道連結可檢視」） |
| links.guideWebsite | RT 守則網頁版網址 | ⬜ 待補 |
| links.lineBot | LINE 機器人加好友連結 | ⬜ 待補 |
| links.rtDatabase | RT 資料庫 Drive 資料夾連結 | ⬜ 待補（建置中） |
| ventJsonUrl | 呼吸器剩餘數量 JSON 端點 | ⬜ 待接（需改呼吸器 Apps Script） |

公告試算表欄位：`組別 | 日期 | 時間 | 內容`（組別填 總組長／教學／儀器／品管／資訊／兒醫）。

## 班表資料格式（schedule.json）

```jsonc
{
  "month": "2026-07",
  "legend": { "D": {"label":"白班","time":"07:30–15:30","color":"#2a9d8f"}, ... },
  "people": [
    { "name": "王小明", "unit": "ICU1",
      "shifts": { "2026-07-28": "D", "2026-07-29": "D", ... } }  // key=日期, value=legend代碼
  ]
}
```

## 接下來（規劃）

- **Phase 2 內容資料化**：公告 / 新知識 / 班表改由 Google 試算表當後台，用 Apps Script 輸出成這幾個 JSON（維護方式與其他專案一致，非工程人員也能改）。
- **Phase 3 Web Push**：Firebase FCM，公告更新可推播（免費、無則數上限，解決 LINE 額度問題）。
- **Phase 4 部署**：放上 GitHub Pages 或 Firebase Hosting（免費 HTTPS），發網址 + QR 給科內。

> 技術限制備忘：PWA 的安裝與推播**不能**掛在 Apps Script 網頁上（它跑在沙箱 iframe，無法註冊 Service Worker）。所以 App 外殼要放獨立網域，資料再從 Apps Script / 試算表抓進來。

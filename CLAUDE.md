# Tripboard (travel planner)

Single-file web app: `index.html` (HTML + CSS + JS, no build step). `tripboard-v1-snapshot.html` is the frozen v1 and should not change.
Published on claude.ai as an Artifact (v2, version 65 at handoff). Capabilities it relies on there: `sample` (AI Assistant) and `downloads` (Save as PDF/HTML). Outside claude.ai those two features do nothing; everything else works.

## Features
Itinerary by city and day (arrive/leave, address, map link, video, website, photos, cost, category, note, lock, copy/paste), auto-plan by shortest route, cities reorderable (itinerary + sidebar), sidebar Contents with Resources links, Draft tab with buckets, Vote tab, Budget tab (per-category targets, actuals from itinerary prices, two currencies with manual rate, per-category item dropdown linking to stops), print preview with Itinerary or Itinerary and Budget, PDF/HTML export, AI Assistant for any travel question plus route planning, dark mode, cover photo.

## State
`S` is saved to localStorage `tp_cur` by `save()`. Theme in `tp_theme`.
- `S.cities[]` {name,url,days,mv}  (`mv` = travel details INTO that city from the previous one)
- `S.it[][]` stops per global day; `S.dl[]` city index per day; `S.dm[]` per-day {name,date}. Keep all three in sync on every splice/push/reorder.
- Stop fields: id,time,out,link,addr,imgs,video,web,cost,cat,note,name,emoji,tm,tl,lock,m,r. Kind comes from `ALL[id].k` (stop|stay|travel), custom items made by `mkCustom(kind)` and stored in `S.custom` then `reg()`.
- `S.draft[]` (items may have `.bucket` and `.cat`, the budget category carried over by Add to and Copy/Paste), `S.buckets[]`, `S.polls[]`, `S.grp`, `S.budget` {cur,cats,targets,fx:{on,sym,rate}}, `S.resources[]`, `S.clip`, `S.cover`, `S.tripMap`, `S.album`, `S.start`, `S.name`.

## Vercel groups (api/)
`api/_lib.js` (helpers; underscore = not a route), `api/session.js` (GET who am I / POST sign in / DELETE sign out), `api/trip.js` (GET/PUT the group's trip, compare-and-set on a version number, 409 on conflict), `api/admin.js` (list/save/delete groups with `ADMIN_CODE`). Storage is Upstash Redis over REST via fetch (env `KV_REST_API_URL`/`KV_REST_API_TOKEN`), no npm dependencies. Keys: `g:<name>` group (salted scrypt hashes of the two codes), `t:<name>` trip JSON, `v:<name>` version, `groups` set, `rl:*` rate limits. Session is an HMAC-signed HttpOnly cookie `tb_session` {g,r,exp}.
In `index.html` the last block before the final `render();` handles it: it probes `/api/session`; if that doesn't answer `{server:true}` nothing changes. Otherwise it shows the `#tbgate` sign-in, loads `S` from the server and wraps `save` (now `let`) to autosave editors' changes 1.5 s after the last edit. `#tbpill` shows group/role/save state.
Local test: `node` server that serves `index.html`, runs `api/*.js` with `res.status().json()` shims and replaces `global.fetch` for the Upstash URL with an in-memory fake, driven by Playwright with separate browser contexts per user.

## How the code is organised
Features are appended as blocks near the end of the script, before the final `render();`. Later blocks override earlier functions by reassigning (`render`, `nav`, `itemRow`, `draft`, `budgetView`, `openPV`, `pvBody`, `money`, `parseAmount`...), and wrappers chain (`const _r=render; render=function(){_r(); ...}`). Several old versions of functions remain as dead code, so grep for ALL copies before editing and check which one is active (the last one wins). Declare overridable things with `function` or `let`, not `const`.
Events use document-level delegated listeners keyed on data-* attributes; capture-phase listeners intercept others with `stopPropagation`. The UI re-renders by replacing `#main` innerHTML, so focus is lost unless restored.
CSS goes in the FIRST `</style>` (the head). Beware: later `</style>` strings sit inside JS template strings, and inserting there silently breaks styling.

## Prices
`costText(raw)` renders a price for stop and Draft summaries: the typed text, plus the other currency when Two currencies is on ("¥60 · $8.33"; a bare number gets the main symbol). Budget tab uses `money()`, print uses `pvFmt()`; both already show both currencies. `goStop(gi,i)` opens the Itinerary at a stop and flashes it; `toastGo()` is a toast with a "Click here to view it" link to it.

## Layout gotchas
Phone layout (<=600px) lives in the "Phone layout" block appended just before the groups block, so it overrides earlier injected styles (an older 600px rule in the head is overridden by later `.slot` rules and does nothing). On phones city/day headers are not sticky, stops stack (times row, then 64px photo + body) and the AI tab reads "AI" (`.lg` span hidden).
Width via `--Wt` (90vw) / `--W`; `layoutToc()` positions the `#toc` sidebar from measured elements; `freeWidth()` forces max-width. Sticky offsets use `--hh` and `--ch`.

## Testing
No test suite. Method used: headless Chrome `--dump-dom` on a copy with seeded localStorage and a probe `<script>` inserted before the LAST `</body>` that clicks things and writes results into `document.title`. Syntax check: extract the last `<script>` and run `new Function(code)` in node.

## Known limits
No Google Maps lookups (sandboxed, no API key), short map links can't be resolved in-page, outside Vercel groups, votes/photos/budget live only in the browser (about 5MB localStorage), exchange rate is typed by hand, Draft/Vote ideas aren't in the budget.

## Ideas not done
Live updates while two editors have the page open (now only on tab focus), a read-only UI for viewers, real hosting with a Places API key, splitting the file into modules.

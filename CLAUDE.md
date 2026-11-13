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
- `S.draft[]` (items may have `.bucket`), `S.buckets[]`, `S.polls[]`, `S.grp`, `S.budget` {cur,cats,targets,fx:{on,sym,rate}}, `S.resources[]`, `S.clip`, `S.cover`, `S.tripMap`, `S.album`, `S.start`, `S.name`.

## How the code is organised
Features are appended as blocks near the end of the script, before the final `render();`. Later blocks override earlier functions by reassigning (`render`, `nav`, `itemRow`, `draft`, `budgetView`, `openPV`, `pvBody`, `money`, `parseAmount`...), and wrappers chain (`const _r=render; render=function(){_r(); ...}`). Several old versions of functions remain as dead code, so grep for ALL copies before editing and check which one is active (the last one wins). Declare overridable things with `function` or `let`, not `const`.
Events use document-level delegated listeners keyed on data-* attributes; capture-phase listeners intercept others with `stopPropagation`. The UI re-renders by replacing `#main` innerHTML, so focus is lost unless restored.
CSS goes in the FIRST `</style>` (the head). Beware: later `</style>` strings sit inside JS template strings, and inserting there silently breaks styling.

## Layout gotchas
Width via `--Wt` (90vw) / `--W`; `layoutToc()` positions the `#toc` sidebar from measured elements; `freeWidth()` forces max-width. Sticky offsets use `--hh` and `--ch`.

## Testing
No test suite. Method used: headless Chrome `--dump-dom` on a copy with seeded localStorage and a probe `<script>` inserted before the LAST `</body>` that clicks things and writes results into `document.title`. Syntax check: extract the last `<script>` and run `new Function(code)` in node.

## Known limits
No Google Maps lookups (sandboxed, no API key), short map links can't be resolved in-page, votes/photos/budget live only in the browser (about 5MB localStorage), exchange rate is typed by hand, Draft/Vote ideas aren't in the budget.

## Ideas not done
Shared storage so group votes sync, real hosting with a Places API key, splitting the file into modules.

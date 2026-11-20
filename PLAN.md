# PLAN

## The app
**What it does:** Pulls the menus from every UIUC dining hall, knows the student's meal plan (swipes and dining dollars), works out their calorie and macro targets, and tells them what to eat and what to buy to hit those targets.

**How it works (user flow):**
1. **Make a profile.** The app asks questions to work out your base calories (maintenance / TDEE).
2. **Pick a goal:** bulk, cut or maintain. The app now knows your daily calorie, protein and macro targets.
3. **Every day:** it tells you which dining hall to go to, what to eat there, and roughly how much of each item.

**Why I want it:** College students eat whatever is in front of them, and anyone with fitness goals struggles to hit their protein and macros from dining hall food. It's a personal project to make my resume stand out, and it could become a startup later.

## Done
- 2026-11-10: Project set up: Expo app in `mobile/`, CLAUDE.md, PLAN.md, README, public GitHub repo.
- 2026-11-10: Researched UIUC menu data. Two sources found, both working (see "UIUC data sources" below).
- 2026-11-10: Scraper prototype (`scraper/`). `npm run scrape` writes today's menus for all 4 halls with nutrition to `output/menu-YYYY-MM-DD.json`. First run: 1,136 items, 1,135 with nutrition, 521 requests, ~9 min. Later runs reuse the cache. 16 parser tests.
- 2026-11-19: Scraper cleanup: each hall now has real `meals` (with hours) plus an `allDay` list (Salad Bar, Cereal, Deli & Bagel Bar...). Live run on 2026-11-19: ~4.5 min, 148 new labels, 951 from cache. 21 tests.
- 2026-11-19: Supabase set up (free plan, org "EatSmart", project "EatSmart"). Tables from `supabase/migrations/0001_menus.sql` (pasted into the SQL Editor). The scraper now saves each day to Supabase as well as JSON. First save: 4 halls, 418 dishes, 1,094 menu items, 12 meal hours, 2 min (all labels cached). 27 tests.

## UIUC data sources
**1. Menus + hours: `web.housing.illinois.edu/diningmenus`** (UIUC's own site, JSON API)
- `POST https://web.housing.illinois.edu/DiningMenus/api/DiningMenu/GetOption/` with JSON `{"DiningOptionID": 3, "mealDate": "2026-11-10"}`, which returns a JSON array of menu items.
- Item fields: `FormalName`, `Meal` (Breakfast/Lunch/Dinner/Light Lunch/Kosher...), `ServingUnit` (station, e.g. Grillworks), `Course`, `Traits` (allergens + Vegan/Vegetarian/Halal, comma-separated), `ItemID`.
- Hall IDs: Ikenberry 1, PAR 2, ISR 3, Lincoln/Allen 5. Retail: Corner Cafe 6, 57 North 7, Caffeinator 9, Urbana South Market 14, TerraByte 18, InfiniTEA 30, Food Truck 31/32, Everybody Eats 35/36.
- Hours: an HTML table `#sTable` in the page itself (hall ID, date, meal, start and end times).
- **No calories or macros here.**

**2. Nutrition: CBORD NetNutrition at `eatsmart.housing.illinois.edu/NetNutrition/46`** (HTML, session-based)
- Full label per item: serving size, calories, fat, sat fat, carbs, fiber, sugar, protein, sodium, ingredients, allergens.
- Flow (server keeps state in the `CBORD.netnutrition2` cookie): GET home, then POST `Unit/SelectUnitFromUnitsList` `{unitOid}` (hall), then `Unit/SelectUnitFromChildUnitsList` (station), then `Menu/SelectMenu` `{menuOid}` (date + meal), and the rows hold `detailOid`s. Then POST `NutritionDetail/ShowItemNutritionLabel` `{detailOid, menuOid}`, which returns HTML to parse.
- Unit IDs: Ike 1, ISR 11, PAR 22, LAR 29 (each has child units per station, e.g. ISR Grillworks 15).
- Menus are published about 3 weeks ahead.
- HTTP only (no HTTPS). No robots.txt on either host.

**What we actually use (2026-11-10):** NetNutrition (source 2) for everything: halls, stations, meals, items, allergen and diet tags, serving sizes and nutrition. The UIUC page (source 1) is used only for the hours table. Source 1's menu API returns an empty response to non-browser clients, and we don't fake a browser (see Decisions). Nutrition labels are cached by item name + serving size, so repeat items cost no requests.

## Next
1. Daily GitHub Actions job: run the scraper every morning and save to Supabase. The secret key goes in GitHub Actions secrets. The same job deletes `menu_items` and `meal_hours` older than 7 days (see Decisions).
2. Data quality: flag dishes whose nutrition is for a whole batch, not one serving (e.g. "Flour Tortillas, 460 EA: 50,950 kcal", a whole pizza at 2,970 kcal). The recommender must never suggest these as-is. Ideas: flag `serving_grams` > ~1000 or calories > ~1500 per serving, and maybe scale by count when the serving says "460 EA".
3. App: browse today's menu by hall.
4. App: profile onboarding (sex, age, height, weight, activity, optional body fat %, goal + rate, dietary restrictions and allergies), then calorie and macro targets (see Decisions), with unit tests. Let the user override the targets, for example by typing in their own maintenance calories.
5. App: daily recommender, split per meal ("Lunch at ISR: 1.5 servings grilled chicken, 1 cup rice, ~45g protein"). Picks the open hall that best hits the targets. If several are close, show them as options to choose from. Portions in servings, not grams. Respects dietary restrictions. Unit tests.
6. App: enter meal plan by hand (swipes and dining dollars left), then budget-aware suggestions.
7. Later: "I'm at this hall no matter what, what do I eat?" mode. The user picks the hall and the app gives the best meal there.
8. Later: off-plan logging. The user logs what they actually ate when they didn't follow the plan, and it counts toward the day's calories and macros (the remaining meals adjust).
9. Later: learn real maintenance over time from "I ate this" logs plus weekly weigh-ins, like MacroFactor.
10. Later: health guardrails (calorie floor, no extreme deficits, no shame-based wording).
11. Later: pick the final app name, then rename the app, repo and store listing. EatSmart is a placeholder, and UIUC's own nutrition site is already called "EatSmart", so we can't keep it.
12. Later: legal considerations. It's a health-related app, so think about protection if the advice or data is wrong (e.g. bad nutrition numbers, allergy mistakes). Exactly what to add is still to be decided.

## Decisions
- 2026-11-10: **Expo (React Native + TypeScript)** for the app. One codebase for Android and iOS, I can test on my Android phone with Expo Go, and EAS can build for both stores without a Mac. *Alternatives:* Flutter (would mean learning Dart), native Kotlin and Swift (two codebases).
- 2026-11-10: **Supabase** planned as the backend. Hosted Postgres with sign-in built in and a free tier. *Alternatives:* Firebase (NoSQL, worse fit for structured nutrition data), a custom Node server (more to maintain).
- 2026-11-10: **Scrape on a schedule, not from the app.** A daily GitHub Actions job writes to the database. Keeps load on UIUC servers low and the app fast. *Alternative:* the app scrapes directly (slow, fragile, impolite).
- 2026-11-10: **How targets are calculated**, based on how MacroFactor and Carbon do it, plus protein research:
  - BMR: Mifflin-St Jeor by default, Katch-McArdle when body fat % is given (uses lean mass, like Carbon).
  - TDEE = BMR × activity multiplier (about 1.2 for sedentary up to 1.9 for very active).
  - Goal: cut / maintain / bulk, plus a weekly rate. Calories = TDEE ± (rate × ~3500 kcal/lb ÷ 7). Defaults: cut ~0.5–1% of body weight per week, bulk ~0.25–0.5% per week.
  - Protein ~1.6–2.2 g/kg (higher end when cutting). Fat ~25–30% of calories (minimum ~0.25 g/lb). Carbs fill the rest.
  - *Alternatives:* fixed macro ratios (ignore body weight), Harris-Benedict (older, less accurate).
- 2026-11-10: **Monorepo layout:** `mobile/` now, `scraper/` later, in one repo.
- 2026-11-10: **UIUC only** for v1. Meal plan entered by hand (no public API for meal plan balances).
- 2026-11-10: **Public repo** on GitHub, commits use the GitHub noreply email.
- 2026-11-10: **Scraper in TypeScript** (Node + cheerio, tsx, vitest). Same language as the app, so types can be shared later. *Alternative:* Python (requests + BeautifulSoup), which would add a second toolchain.
- 2026-11-10: **Scraper identifies itself honestly** (`EatSmartScraper/0.1` User-Agent with the repo link), waits 1s between requests, and is cached. It never spoofs a browser. If a source blocks non-browser clients, we treat that as "not allowed" and use a different source. *Alternative:* faking a browser User-Agent (works, but it's evading their filter).
- 2026-11-19: **Real meals vs all-day items:** a menu is a real meal only if UIUC's hours table lists it for that hall. Everything else (Salad Bar, Cereal, Deli & Bagel Bar, Beverages, Ice Cream, Waffle Bar, Condiments, all from the "Build Your Own" station) goes in the hall's `allDay` list. If the hours page is down, fall back to the station name and warn. *Alternative:* station name only (breaks if UIUC renames it).
- 2026-11-19: **How the app will use all-day items:** they're candidates at every meal while the hall is open, mixed in with that meal's hot food. They're often the best protein fillers (salad bar chicken, deli turkey, milk, Greek yogurt). Rules for the recommender: condiments only as add-ons (counted, never the point of a suggestion); cap servings so it never says "eat 4 bowls of cereal"; prefer the meal's hot food when it's close.
- 2026-11-19: **Database schema:**
  - `dishes`: each item at one serving size, nutrition stored once. Keyed by normalized "name|serving size", the same key as the scraper cache.
  - `menu_items`: date + hall + period + station → dish, with `is_all_day` set for the Build Your Own sections.
  - Also `halls` and `meal_hours`.
  - Each scrape replaces that date's menu and hours, so reruns don't duplicate. Dishes are upserted.
  - The scraper seeds its cache from `dishes`, so GitHub Actions needs no local cache file.
  - *Alternative:* one big table per day (duplicates nutrition thousands of times).
- 2026-11-19: **Security model:** RLS is on for every table, with "public read" policies and explicit `grant select` to anon/authenticated. Only the scraper writes, using the secret key (`sb_secret_...`, in `scraper/.env`, gitignored). The app will use the publishable key (`sb_publishable_...`). Project settings: Data API on, "grant API access automatically" off (no table gets exposed by accident), "RLS on new tables automatically" on.
- 2026-11-19: **Data retention:**
  - Daily menus (`menu_items`, `meal_hours`) are kept 7 days, then deleted.
  - Dishes are never deleted, since they're shared across days and future logs point to them.
  - Users' food logs are kept forever, so people can see how their eating habits changed.
  - Logs must be self-contained: dish ID + servings + a copy of the calories and macros at the time eaten. They never point at `menu_items`, so deleting old menus can't break history.
  - *Alternative:* keep 60 days or everything. Storage isn't the issue (~150 KB/day), but nothing needs menus older than a week once logs are self-contained.
- 2026-11-19: **Migrations are SQL files in `supabase/migrations/`**, pasted into the SQL Editor by hand. *Alternative:* Supabase CLI `db push` (~50 MB install). Revisit when there are many migrations.
- 2026-11-10: **Parsers are pure functions tested against saved real responses** (`scraper/test/fixtures/`). If UIUC changes a page, they throw `SiteChangedError` instead of silently returning nothing.

## Problems
- 2026-11-10: NetNutrition returned a "Start-up Error" page to the scraper. **Why:** its old ASP.NET code crashes without an `Accept-Language` header, and it sets the session cookie on a redirect, which `fetch` drops. **Fix:** always send `Accept-Language`, and follow redirects by hand while keeping cookies (`scraper/src/http.ts`).
- 2026-11-10: UIUC's menu JSON API (source 1) returns an empty 200 unless the User-Agent looks like a browser. **Why:** it filters out non-browser clients. **Fix:** we don't spoof. NetNutrition has the same menus, so we use it as the only menu source.
- 2026-11-10: A few items (1–3 a day, e.g. "Danish Assorted Alpha 2oz", "Ramen Soup Bar") have a nutrition label with no calories. **Why:** missing data on UIUC's side. **Fix:** saved with `nutrition: null`. On 2026-11-19 these got their own `MissingNutritionError`, so the log no longer says "site format changed?" for them. That warning is now only for real page changes.
- 2026-11-19: The scraper got 404 "Invalid path specified in request URL" from Supabase. **Why:** `SUPABASE_URL` was set to the "API URL" (`…supabase.co/rest/v1/`), and supabase-js adds `/rest/v1` again. **Fix:** `connect()` keeps only the URL origin, so both forms work.
- 2026-11-19: Some UIUC dishes list nutrition for a whole batch (tortillas "460 EA" = 50,950 kcal, a whole pizza). **Why:** UIUC data entry. **Fix:** open, see Next item 2.
- 2026-11-10: `tsc --noEmit` fails on the fresh Expo template (CSS module and `global.css` types missing, a ref type error in `app-tabs.web.tsx`). **Why:** the CSS typings come from `expo-env.d.ts`, which is only generated on the first `expo start`, and the ref error is an upstream template issue in a web-only file. **Fix:** open. Re-check after the first `expo start`, and the starter screens get replaced with real ones anyway.

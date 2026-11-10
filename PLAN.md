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

## Next
1. Find out how UIUC publishes dining menus and nutrition data (vendor, endpoints, scraping rules).
2. Menu scraper prototype: pull one day of menus for all halls into JSON.
3. Set up Supabase: schema for halls, menu items, nutrition and daily menus. The scraper writes to it daily via GitHub Actions.
4. App: browse today's menu by hall.
5. App: profile onboarding (sex, age, height, weight, activity, optional body fat %, goal + rate, dietary restrictions and allergies), then calorie and macro targets (see Decisions), with unit tests. Let the user override the targets, for example by typing in their own maintenance calories.
6. App: daily recommender, split per meal ("Lunch at ISR: 1.5 servings grilled chicken, 1 cup rice, ~45g protein"). Picks the open hall that best hits the targets. If several are close, show them as options to choose from. Portions in servings, not grams. Respects dietary restrictions. Unit tests.
7. App: enter meal plan by hand (swipes and dining dollars left), then budget-aware suggestions.
8. Later: "I'm at this hall no matter what, what do I eat?" mode. The user picks the hall and the app gives the best meal there.
9. Later: off-plan logging. The user logs what they actually ate when they didn't follow the plan, and it counts toward the day's calories and macros (the remaining meals adjust).
10. Later: learn real maintenance over time from "I ate this" logs plus weekly weigh-ins, like MacroFactor.
11. Later: health guardrails (calorie floor, no extreme deficits, no shame-based wording).
12. Later: pick the final app name (EatSmart is a placeholder) and rename the app, repo and store listing.

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

## Problems
- 2026-11-10: `tsc --noEmit` fails on the fresh Expo template (CSS module and `global.css` types missing, a ref type error in `app-tabs.web.tsx`). **Why:** the CSS typings come from `expo-env.d.ts`, which is only generated on the first `expo start`, and the ref error is an upstream template issue in a web-only file. **Fix:** open. Re-check after the first `expo start`, and the starter screens get replaced with real ones anyway.

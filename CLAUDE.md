# EatSmart

## Project
- **Vision:** Help UIUC students hit their calorie and macro goals using what is actually on the dining hall menus and what is left on their meal plan.
- **Platform/stack:** Expo (React Native + TypeScript, Expo Router) in `mobile/`. One codebase for Android and iOS. Planned: Supabase (Postgres) backend, plus a daily menu scraper in `scraper/` run by GitHub Actions.
- **Current milestone:** see "Next" in PLAN.md.
- **Scope:** UIUC only for now.

## How to run
- Install: `cd mobile && npm install`
- Run: `cd mobile && npx expo start`, then scan the QR code with Expo Go on Android (or press `a` for an emulator)
- Lint and typecheck: `cd mobile && npx expo lint && npx tsc --noEmit`
- Test: not set up yet (add jest-expo with the first logic module)
- Expo-specific guidance lives in `mobile/AGENTS.md`. Follow it, and check the docs for the installed SDK version instead of relying on memory.

## My preferences
- I'm fairly experienced. You do almost all of the technical work, and I'll say what to build.
- Explain the major concepts briefly as they come up so I learn them (architecture, data flow, auth, the optimizer). Skip basics.
- Before building a feature, ask me what "done" looks like.
- Ask before long runs or large installs.

## Rules
- Read PLAN.md at the start of every session.
- Update PLAN.md before any commit that finishes or changes a feature. Tiny fixes don't need it.
- Commit and push when something works and I've tried it.
- Never commit secrets, `.env` files or build output. Never force-push.
- The app bundle is public. Secret keys live only on the backend or scraper, never in `mobile/`. Only public keys (like the Supabase anon key) go in the app, through `EXPO_PUBLIC_` env vars.
- Scraping: pull UIUC menus at most once a day on a schedule, cache them in the database, and rate-limit requests. The app never scrapes directly.
- Nutrition math and the meal recommender must have unit tests. UI tests are optional.
- Keep this file short. Progress, decisions and problems go in PLAN.md.

# EatSmart

> Working name. The final name is still to be decided.

A mobile app that helps UIUC students hit their nutrition goals using what's actually on the dining hall menu today and what's left on their meal plan.

## The problem
Dining hall food plus a fixed meal plan makes it hard to hit protein and macro targets. Menus change every day, nutrition info is buried, and nobody wants to do the math between classes.

## What it will do
- Pull daily menus and nutrition data from every UIUC dining hall
- Work out personal calorie and macro targets from your profile and goals
- Recommend what to eat at a given hall to hit those targets
- Plan around your meal swipes and dining dollars

## Tech stack
- **App:** Expo / React Native, TypeScript, Expo Router (Android and iOS from one codebase)
- **Backend (planned):** Supabase (Postgres)
- **Data (planned):** a daily menu scraper on GitHub Actions

## Running locally
```bash
cd mobile
npm install
npx expo start
```
Scan the QR code with the [Expo Go](https://expo.dev/go) app on your phone, or press `a` to open an Android emulator.

## Status
Early development. See [PLAN.md](PLAN.md) for the roadmap.

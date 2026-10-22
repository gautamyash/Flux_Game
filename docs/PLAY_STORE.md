# Play Store launch pack

## Before you build
1. Edit `app/src/config.ts`: set `SUPPORT_EMAIL` and (after hosting) `PRIVACY_URL`. Use the same email in `docs/PRIVACY.md`.
2. Host `docs/PRIVACY.md` publicly (GitHub Pages, Notion public page, or any site). Paste the URL in `PRIVACY_URL` and in Play Console.
3. `cd app && npm install` (new packages: expo-audio, expo-constants, expo-splash-screen), then `npx expo-doctor`.
4. Test APK: `npm run build:apk`. Release: `npm run build:aab` (EAS manages the signing key; keep the EAS account safe).
5. App version lives in `app.json` (`version`); `versionCode` is auto-incremented by EAS for production builds.

## Store listing (draft)
**Title:** FLUX: One-Path Puzzle (max 30 chars)

**Short description (80):** Draw one path through every cell, in order. Calm, offline puzzles.

**Full description:**
FLUX is a calm path puzzle. Start at 1, drag one continuous line through every open cell, and reach the last number. Sounds simple. Then the board starts to push back.

- 100 hand-checked levels in 8 chapters, from 3x3 warm-ups to 8x8 masters
- Special cells: arrows, burn, portals, freeze, switches and gates, countdowns, bonus stars
- A new Daily puzzle every day, plus Rush, Chaos, Master and Endless modes
- 29 badges and a 3-star rating based on moves, time and hints
- Works fully offline. No ads. No accounts.
- Optional reminders for the daily puzzle and your streak
- Light and dark themes, colour-blind friendly patterns, high contrast, large numbers, left-handed layout, screen-reader support

**Category:** Games > Puzzle. **Tags:** puzzle, logic, offline, brain.

## Graphics you still need to make
- Icon 512x512 (export `assets/icon.png` scaled down)
- Feature graphic 1024x500
- 4-8 phone screenshots (take from a real phone: Home, a 5x5 level, an 8x8 level, Daily, Badges, dark theme)

## Content rating questionnaire
No violence, no sexual content, no user-generated content, no gambling, no purchases, no ads. Expected rating: Everyone.

## Data safety form
- Does the app collect user data? **Yes, only when the player signs in with Google.**
  - Personal info: **Name**, **Email address**, **User IDs** (collected from Google Sign-In). Purpose: **Account management** and **App functionality**.
  - App activity: game progress. Purpose: **App functionality** (cloud save).
- Shared with third parties? **No** (Google Firebase acts as our service provider, which Play does not count as sharing).
- Is data encrypted in transit? **Yes** (HTTPS).
- Can users request deletion? **Yes**: in-app Settings > Account > Delete my cloud data, and by email. Because the app has accounts, Play Console also asks for a **web link for account deletion**: host the privacy page with a "How to delete your data" section and paste its URL.
- Guest mode collects nothing.
- Declare: no ads, no financial features, not a children-directed app (but suitable for all ages), no health data.

## Permissions the app asks for
Only `POST_NOTIFICATIONS`, internet access (cloud save) and (when the player enables reminders) and standard vibration.

Google login needs extra setup: follow `docs/GOOGLE_LOGIN_SETUP.md` (Firebase project, SHA-1 fingerprints including the Play App Signing key). Microphone, storage and overlay permissions are explicitly blocked in `app.json`.

## Testing requirement
New personal developer accounts must run a closed test with at least 12 testers for 14 days before applying for production access (check the current rule in Play Console > Dashboard). Plan for it: recruit testers while you do the device QA below.

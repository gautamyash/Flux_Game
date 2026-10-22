# FLUX

Offline path-puzzle game (Expo + React Native + TypeScript). Design reference: `design/`, spec: `docs/PRD.md`.

## Run (Windows)
```
cd app
npm install
npx expo start        # scan QR with Expo Go, or press "a" for an Android emulator
```
Tests / checks: `npm test`, `npm run typecheck`, `npm run check:levels`.

## Play Store build
```
npm i -g eas-cli
eas login
eas build:configure
eas build -p android --profile production   # produces .aab
```
Replace `assets/icon.png` and the adaptive-icon files with final artwork first. Package id: `com.vaibhav.flux` (change in app.json if needed).

## Status
Done: engine + hint solver, 100 levels (open 4x4 to 8x8 boards, chapters add mechanics), all modes, 15 screens, themes, 29 badges, stats, offline save.
Not yet: sound effects/music (settings toggles exist), final icon/splash art, per-cell screen-reader labels, real-device playtesting.

## APK for testers (shareable link)
```
cd app
npm install
npm i -g eas-cli
eas login                  # free Expo account: https://expo.dev/signup
eas init                   # links the project to your account (answer Y)
npm run build:apk          # = eas build -p android --profile preview
```
The build runs in Expo's cloud (about 10–20 minutes, free tier is enough). When it finishes, EAS prints a link and a QR code: send that link to your testers, they open it on an Android phone and install the APK (they must allow "install unknown apps" once). Re-run `npm run build:apk` after every change to publish a new version.

## Player profile, resume and reminders
- Each player has a local profile (name, avatar colour, id) created at onboarding and editable in Settings. Progress, stars, badges, stats and settings are stored per profile on the phone.
- An unfinished classic/master/daily puzzle is saved after every move (and when the app is closed or backgrounded) and restored exactly, including time and hints used. Home shows a Resume card.
- Reminders (Settings > Puzzle reminders): daily puzzle at a chosen hour, "streak ends tonight" at 21:30, and come-back nudges after 2 and 6 days. They are local notifications, so no server is needed. Notifications need a real build (APK); in Expo Go on Android they may be limited.
- Not included yet: cloud accounts / cross-device sync and server push notifications (needs a Firebase project).

## Production readiness

- Crash safety: error boundary + local crash log (`app/src/lib/crash.ts`); Settings > Privacy has the policy and support link.
- Saved data is versioned and sanitised on load (`migrate` in `store.ts`); a damaged save is backed up, not wiped.
- Daily puzzle cannot be replayed by moving the phone clock back (`trustedNow`).
- Sound effects + music (`expo-audio`), stars from moves + time + hints, screen-reader cell labels, guided practice level.
- CI: `.github/workflows/ci.yml` runs tsc, jest and an Android bundle export.
- Before publishing read `docs/PLAY_STORE.md`, fill `app/src/config.ts`, and go through `docs/QA_CHECKLIST.md` on a real phone.
- Login: Google account (cloud save via Firebase) or Guest (this phone only). Setup: `docs/GOOGLE_LOGIN_SETUP.md`; rules: `firestore.rules`.

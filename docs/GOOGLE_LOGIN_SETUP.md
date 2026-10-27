# Firebase, Google sign-in and leaderboard setup

FLUX already has Firebase client configuration, Google sign-in, private cloud progress, and pseudonymous Global and Daily leaderboards. Guest gameplay remains available offline. Any Google account can sign in; FLUX does not use an email allowlist.

## Current app configuration

- Firebase project: `fluxgame-ed74a`.
- Android package: `com.gautamyash.flux` (from `app/app.json`).
- Firebase Web client ID and client configuration are in `app/src/config.ts`; the app does not contain a Web client secret.
- `app/google-services.json` is ignored by Git and is not consumed by the current Firebase JavaScript SDK configuration. Firebase Auth and Firestore initialize from `config.ts`; the Google Sign-In native plugin is configured in `app/app.json`. Keep the JSON local unless the native build architecture is changed to use the Google Services Gradle plugin.
- EAS previously reported that no Android keystore is configured. Do not start a build until an EAS-managed preview keystore has been explicitly authorized and configured.

## Android Google sign-in setup

Google Sign-In must be tested with an APK signed by the key used for that APK. Debug, EAS preview, and Play App Signing certificates may have different SHA-1 fingerprints. The current package must be `com.gautamyash.flux`; do not use fingerprints from older `com.vaibhav.flux` builds.

After the preview keystore has been configured and an APK is built, retrieve the EAS credential fingerprint with:

```powershell
cd app
npx eas-cli credentials -p android
```

Select Android, the `preview` profile, then **Keystore: Manage everything needed to build your project** and view its SHA-1 fingerprint. Do not download the keystore to the repo or commit signing credentials. Add the preview SHA-1 in Firebase Console > Project settings > General > Your apps > Android app `com.gautamyash.flux` > Add fingerprint. If testing a locally signed debug APK, also register that debug key's SHA-1. When distributing through Google Play, add the Play Console **App signing key certificate** SHA-1 for Play-installed builds.

Google is enabled as a Firebase Authentication provider. No email allowlist is required. Successful Google Sign-In creates a Firebase Auth session; this has not yet been verified on a physical Android device. Do not describe it as device-tested until that check succeeds.

## Firestore rules and indexes

The reviewed local rules are in `firestore.rules`; the Daily leaderboard composite index is in `firestore.indexes.json`. The repository cannot confirm whether the rules pasted in the Firebase Console have been published. Review and publish them in Firebase Console > Firestore Database > Rules when authorized. The app has no server-side score validation; scores submitted by clients are pseudonymous but not cheat-proof.

The root `firebase.json` maps those local files for later CLI deployment. After logging into Firebase CLI and reviewing the diff, deploy rules and index definitions with:

```powershell
firebase deploy --only firestore:rules,firestore:indexes --project fluxgame-ed74a
```

Do not run this command until production deployment is explicitly approved. The Daily query orders by stars descending, moves ascending, then time ascending and requires the composite index. The Global query uses a single-field score index, which Firestore maintains automatically.

## Leaderboard behavior

- Only Firebase sessions authenticated with the `google.com` provider can read or submit leaderboard data. Guest play and local progress remain offline.
- Global scores reuse the current all-level total stars and solved-level count. Daily scores reuse the completed puzzle's existing stars, moves, and time.
- Daily boards and puzzle generation use UTC date keys. A run captures its UTC day when started and submits to that same board if it crosses midnight.
- A stable run ID and atomic Firestore transaction prevent duplicate submissions. Public entries contain a random key, score values and non-account run metadata; they omit email, Firebase UID, Google name and photo.
- Account deletion removes private cloud progress and the UID-to-key mapping. Public pseudonymous score entries remain; Firestore rules do not allow clients to delete leaderboard rows.
- Energy remains device-local and is not included in cloud progress. The same device has one shared energy balance for its local FLUX data; another device has its own balance.

## Required real-device checks

After the preview SHA-1 is registered, install the newly built APK for package `com.gautamyash.flux` on a physical Android device and verify:

- Google sign-in succeeds for an account, and cancel/network-error paths leave Guest play usable.
- Existing Guest progress merges with that Google account; sign-out/account deletion preserve the local energy balance.
- Global and Daily boards require Google sign-in; completed eligible runs submit once, ties retain the better score, and retries do not duplicate a run.
- A Daily run started before UTC midnight submits to the captured date board.
- Guest play and saved progress work offline; reconnect and leaderboard retry behavior work.

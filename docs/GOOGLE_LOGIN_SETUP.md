# Google login + cloud save: one-time setup (about 20 minutes, free)

The app already contains the login screen, Guest mode, cloud sync and account deletion. It needs a Firebase project to talk to. Until you fill `app/src/config.ts`, "Continue with Google" shows "not set up yet" and Guest mode works normally.

## 1. Create the Firebase project
1. Go to https://console.firebase.google.com and click **Add project**. Name it "flux". Analytics: off.
2. **Build > Authentication > Get started > Sign-in method > Google > Enable**. Choose a support email and Save.
3. **Build > Firestore Database > Create database**. Choose a region close to your players, start in **production mode**.
4. Firestore > **Rules** tab: paste the content of `firestore.rules` (repo root) and Publish. This makes each player able to read and write only their own save.

## 2. Register the web app config
1. Project settings (gear) > **General > Your apps > Add app > Web (</>)**. Name "flux-web". Skip hosting.
2. Copy the `firebaseConfig` values into `app/src/config.ts` > `FIREBASE_CONFIG`.

## 3. The Google "web client ID"
1. Firebase console > Authentication > Sign-in method > **Google** > expand **Web SDK configuration**. Copy **Web client ID**.
2. Paste into `GOOGLE_WEB_CLIENT_ID` in `app/src/config.ts`.

## 4. Register your Android app (this is the step that most often goes wrong)
Google only accepts sign-in from apps whose package name and signing certificate it knows.
1. Firebase console > Project settings > General > **Add app > Android**. Package name: `com.vaibhav.flux`. You can skip downloading `google-services.json`.
2. Get the SHA-1 of the key EAS signs your build with:
   ```
   cd app
   npx eas-cli credentials
   ```
   Choose Android > the profile you build with (preview / production) > "Keystore: Manage everything needed to build your project" > view the keystore. Copy the **SHA-1** fingerprint.
3. In Firebase: Project settings > your Android app > **Add fingerprint** > paste SHA-1. Do this for the `preview` keystore (test APKs) and the `production` keystore.
4. When you publish to Play Store with **Play App Signing**, Google re-signs the app. Copy the **App signing key SHA-1** from Play Console > Setup > App signing and add it as a fingerprint too, or sign-in will fail for store installs.

## 5. Build and test
```
cd app
npm install
npm run build:apk
```
Install the APK on a phone with a Google account. Check:
- [ ] Login screen appears on first launch (Continue with Google / Continue as Guest)
- [ ] Guest: Home shows "GUEST · THIS PHONE ONLY", Settings > Account says progress is saved only on this phone
- [ ] Google: play a level, wait ~5 s, Settings shows "Synced just now"
- [ ] Uninstall, reinstall, sign in with the same account: levels, stars, badges and streak are back
- [ ] Sign in on a second phone: same progress; play on one, reopen on the other: merged
- [ ] Guest who already played taps "Sign in with Google" in Settings: guest progress is added to the account
- [ ] Airplane mode: game keeps working; reconnect: "Synced" returns
- [ ] Sign out: phone is cleared, login screen shows; sign in again: progress returns
- [ ] Delete my cloud data: save removed from Firestore, signed out

## How sync works (so nothing surprises you)
- Saved in the cloud: levels, stars, daily results, badges, stats, streak, settings, player name/avatar.
- Not saved in the cloud: the "resume" snapshot of an unfinished level (it stays on the phone).
- Two copies are merged, never overwritten: best stars/moves/time per level, all badges, all daily results, highest counters, the newer streak.
- "Reset progress" on a signed-in account is a deliberate wipe and wins over older copies on other phones.
- Settings stay per phone; a brand-new phone adopts the account's settings.
- Needs internet only to sync. All gameplay is offline.

## Cost
Firestore free tier (1 GiB, 50k reads and 20k writes per day) is far above what this app needs: one small document per player, written a few times per play session.

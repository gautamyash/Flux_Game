# Device QA checklist (do on a real phone with the APK)

Mark each line. Anything that fails: note phone model, Android version, what you did.

## Install and start
- [ ] Installs, icon shows the teal F mark (also check themed icon on Android 13+)
- [ ] Splash shows, then onboarding on first launch only
- [ ] Kill the app and reopen: name and progress are still there

## Gameplay (do on a 3x3, 5x5 and 8x8 level)
- [ ] Drag feels smooth, no lag, line never sticks
- [ ] Dragging fast around corners and diagonals works
- [ ] Dragging back over your own line retracts it
- [ ] Touching the edge of the board or outside does nothing bad
- [ ] Last number cannot be entered early, message is clear
- [ ] Undo, Hint (counts down), Restart (asks to confirm)
- [ ] Every special cell: arrow, burn, portal, freeze, switch/gate, countdown, bonus
- [ ] Solve: result card, stars, time vs target, hints row, next level
- [ ] Fail: fail screen offers undo/retry

## Resume
- [ ] Leave mid-level (home button) and reopen: Resume card on Home returns to the same board
- [ ] Switch to another app, come back: game is paused, tap to continue
- [ ] Swipe app away mid-level, reopen: resume works
- [ ] Daily: resume only on the same day

## Sound and haptics
- [ ] Effects play, are not too loud, tick is not annoying when dragging
- [ ] Sound toggle off = silent. Music toggle loops smoothly, stops in background
- [ ] Phone on silent: no sound. Bluetooth earphones: works
- [ ] Haptics intensity setting changes the feel

## Notifications
- [ ] Turn on reminders: Android 13+ shows the permission dialog
- [ ] Deny it: toggle goes back off with a clear message
- [ ] Allow it, set time to a few minutes ahead (change phone clock only for testing): reminder arrives
- [ ] Tap the notification: opens Daily or resumes the game
- [ ] Turn off: no more notifications

## Accessibility
- [ ] TalkBack on: board cells are read as "Row 2, column 3, ..." and double-tap moves there
- [ ] Largest system font size: no clipped text
- [ ] Large numbers, high contrast, reduce motion, left-handed all work
- [ ] Dark mode on every screen

## Devices
- [ ] Small phone (<= 5.5"), big phone, tablet or foldable
- [ ] Android 10 to 15 (at least old, middle, newest)
- [ ] Low-end phone (2-3 GB RAM): still smooth on 8x8
- [ ] Rotate the phone / split screen does not crash

## Edge cases
- [ ] Airplane mode: everything still works
- [ ] Low storage: app does not crash
- [ ] Settings > Reset progress then play again
- [ ] Phone clock set back a day: Daily does not repeat an older puzzle

## Login and cloud save (after Firebase setup)
- [ ] First launch shows Continue with Google / Continue as Guest, with the guest warning text
- [ ] Guest play works fully; Home says "GUEST · THIS PHONE ONLY"
- [ ] Google login works; progress syncs; reinstall + login restores it
- [ ] Cancel the Google dialog: no error, stays on the login screen
- [ ] No internet at login: clear message, Guest still possible
- [ ] Guest -> Settings -> Sign in with Google merges guest progress
- [ ] Sign out clears the phone; sign in again restores progress
- [ ] Delete my cloud data works

import { SUPPORT_EMAIL } from '../config';

export const PRIVACY_SECTIONS: { title: string; body: string }[] = [
  { title: 'The short version', body: 'FLUX works offline and has no ads and no analytics. Play as a Guest (everything stays on this phone) or sign in with Google so your progress is saved to your account and follows you to other phones.' },
  { title: 'Guest mode', body: 'Nothing leaves your phone. If you uninstall FLUX or change phones, your progress is lost.' },
  { title: 'Google sign-in and cloud save', body: 'If you sign in with Google we receive your account name, email address and account ID. Your progress (levels, stars, badges, streak, stats, settings, name and avatar) is stored in Google Firebase under your account ID so it can be restored on any phone. It is used only for this save feature, never for ads or analytics, and only you can read it. Delete it any time in Settings > Account > Delete my cloud data.' },
  { title: 'What is stored on your phone', body: 'Your player name and avatar colour, your progress (levels, stars, badges, streaks, stats), your settings, and an unfinished puzzle so you can resume it. This data lives only in the app storage of your phone. Uninstalling FLUX deletes it.' },
  { title: 'Notifications', body: 'If you turn on reminders, FLUX asks Android for permission and schedules notifications on your phone (daily puzzle, streak reminder, and a nudge if you have been away). They are created locally, not by a server. You can turn them off in Settings or in your phone settings at any time.' },
  { title: 'Crash information', body: 'If the app hits an error, a short note is kept on your phone. It is only shared if you choose "Share error report".' },
  { title: 'Children', body: 'FLUX collects no personal information and is suitable for all ages. Please do not type a real full name if you are under 13; any nickname works.' },
  { title: 'Deleting your data', body: 'Settings > Reset progress clears your progress (and your cloud save if you are signed in). Settings > Account > Delete my cloud data removes your cloud save. Uninstalling removes everything on the phone.' },
  { title: 'Contact', body: `Questions: ${SUPPORT_EMAIL}` },
];

/** Fill these in before publishing. */
export const SUPPORT_EMAIL = 'support@example.com'; // TODO: your real support email (shown in Privacy and Settings)
export const PRIVACY_URL = ''; // TODO: public URL of docs/PRIVACY.md once hosted (Play Console needs it); empty = in-app screen only
export const APP_NAME = 'FLUX';

/**
 * Google sign-in + cloud save (Firebase). Leave empty and the app still works: the Google button explains
 * that sign-in is not set up yet and Guest mode keeps working. Setup steps: docs/GOOGLE_LOGIN_SETUP.md
 */
export const GOOGLE_WEB_CLIENT_ID = ''; // OAuth "Web client" ID (Firebase console > Authentication > Google)
export const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};
export const cloudConfigured = () => !!GOOGLE_WEB_CLIENT_ID && !!FIREBASE_CONFIG.apiKey && !!FIREBASE_CONFIG.projectId && !!FIREBASE_CONFIG.appId;

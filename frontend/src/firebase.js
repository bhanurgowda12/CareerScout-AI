import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { shouldUseFirebaseEmulators } from './environmentConfig.js';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const configValues = Object.values(firebaseConfig);
export const isFirebaseConfigured = configValues.every(
  (value) => typeof value === 'string'
    && value.trim() !== ''
    && !value.includes('YOUR_FIREBASE_'),
);

export const firebaseApp = isFirebaseConfigured
  ? initializeApp(firebaseConfig)
  : null;

export const useFirebaseEmulators = shouldUseFirebaseEmulators(import.meta.env, {
  isDevelopment: import.meta.env.DEV,
});
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY?.trim();
const appCheckDebugMode = import.meta.env.DEV
  && import.meta.env.VITE_FIREBASE_APP_CHECK_DEBUG === 'true';

if (appCheckDebugMode && typeof self !== 'undefined') {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

export const appCheck = firebaseApp && appCheckSiteKey && !useFirebaseEmulators
  ? initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  })
  : null;

export const auth = firebaseApp
  ? getAuth(firebaseApp)
  : null;

if (useFirebaseEmulators && auth) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}

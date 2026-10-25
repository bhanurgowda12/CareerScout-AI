import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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

const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY?.trim();
const appCheckDebugMode = import.meta.env.DEV
  && import.meta.env.VITE_FIREBASE_APP_CHECK_DEBUG === 'true';

if (appCheckDebugMode && typeof self !== 'undefined') {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

export const appCheck = firebaseApp && appCheckSiteKey
  ? initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  })
  : null;

export const auth = firebaseApp
  ? getAuth(firebaseApp)
  : null;

export const firestore = firebaseApp
  ? getFirestore(firebaseApp)
  : null;

const storageBucket = typeof firebaseConfig.storageBucket === 'string'
  ? firebaseConfig.storageBucket.trim()
  : '';
const storageBucketUrl = storageBucket.startsWith('gs://')
  ? storageBucket
  : `gs://${storageBucket}`;

export const storage = firebaseApp && typeof firebaseConfig.storageBucket === 'string'
  && storageBucket
  ? getStorage(firebaseApp, storageBucketUrl)
  : null;

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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

export const auth = firebaseApp
  ? getAuth(firebaseApp)
  : null;

export const firestore = firebaseApp
  ? getFirestore(firebaseApp)
  : null;

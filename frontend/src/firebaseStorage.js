import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { firebaseApp, useFirebaseEmulators } from './firebase.js';

const storageBucket = typeof import.meta.env.VITE_FIREBASE_STORAGE_BUCKET === 'string'
  ? import.meta.env.VITE_FIREBASE_STORAGE_BUCKET.trim()
  : '';
const storageBucketUrl = storageBucket.startsWith('gs://')
  ? storageBucket
  : `gs://${storageBucket}`;

export const storage = firebaseApp && storageBucket
  ? getStorage(firebaseApp, storageBucketUrl)
  : null;

if (useFirebaseEmulators && storage) {
  connectStorageEmulator(storage, '127.0.0.1', 9199);
}

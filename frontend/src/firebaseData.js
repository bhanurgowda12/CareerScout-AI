import { connectFirestoreEmulator, doc, getDoc, getFirestore } from 'firebase/firestore';
import { firebaseApp, useFirebaseEmulators } from './firebase.js';

export { doc, getDoc };

export const firestore = firebaseApp
  ? getFirestore(firebaseApp)
  : null;

if (useFirebaseEmulators && firestore) {
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
}

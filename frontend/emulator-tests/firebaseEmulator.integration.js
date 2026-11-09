import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import test, { after, before, beforeEach } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import {
  deleteObject,
  getBytes,
  ref,
  uploadBytes,
} from 'firebase/storage';

const projectId = 'demo-careerscout-ai';
const emulatorHosts = {
  auth: process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099',
  firestore: process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080',
  storage: process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199',
};

function assertLoopbackHost(value, name) {
  const host = value.split(':')[0].replace(/^\[|\]$/g, '').toLowerCase();
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error(`${name} must point to a loopback emulator host, received "${host}".`);
  }
}

for (const [name, host] of Object.entries(emulatorHosts)) {
  assertLoopbackHost(host, name);
}

const emulatorHttp = (host) => `http://${host}`;
let testEnvironment;
let owner;
let otherUser;

async function authRequest(path, body) {
  const response = await fetch(
    `${emulatorHttp(emulatorHosts.auth)}/identitytoolkit.googleapis.com/v1/${path}?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Firebase Auth emulator request failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function createAndSignInTestAccount(label) {
  const email = `emulator-${label}-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}-9a`;
  const created = await authRequest('accounts:signUp', {
    email,
    password,
    returnSecureToken: true,
  });
  const signedIn = await authRequest('accounts:signInWithPassword', {
    email,
    password,
    returnSecureToken: true,
  });
  assert.equal(signedIn.localId, created.localId);
  assert.equal(signedIn.email, email);
  assert.ok(signedIn.idToken);
  return { uid: signedIn.localId, email, idToken: signedIn.idToken };
}

function firestoreFor(user, claims = {}) {
  return testEnvironment.authenticatedContext(user.uid, {
    email_verified: true,
    firebase: { sign_in_provider: 'password' },
    ...claims,
  }).firestore();
}

function storageFor(user, claims = {}) {
  return testEnvironment.authenticatedContext(user.uid, {
    email_verified: true,
    firebase: { sign_in_provider: 'password' },
    ...claims,
  }).storage(`gs://${projectId}.appspot.com`);
}

before(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: emulatorHosts.firestore.split(':')[0],
      port: Number(emulatorHosts.firestore.split(':').at(-1)),
      rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8'),
    },
    storage: {
      host: emulatorHosts.storage.split(':')[0],
      port: Number(emulatorHosts.storage.split(':').at(-1)),
      rules: await readFile(new URL('../../storage.rules', import.meta.url), 'utf8'),
    },
  });
  owner = await createAndSignInTestAccount('owner');
  otherUser = await createAndSignInTestAccount('other');
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
  await testEnvironment.clearStorage();
});

after(async () => {
  await testEnvironment?.cleanup();
});

test('Auth emulator creates a dedicated account and signs it in', async () => {
  const account = await createAndSignInTestAccount('auth');
  assert.match(account.email, /^emulator-auth-[0-9a-f-]+@example\.test$/);
  assert.ok(account.uid);
  assert.ok(account.idToken);
});

test('verified owner can persist and reload a profile document', async () => {
  const db = firestoreFor(owner);
  const profile = doc(db, 'users', owner.uid, 'profile', 'profile');
  await assertSucceeds(setDoc(profile, { username: 'emulator_student' }));
  const saved = await assertSucceeds(getDoc(profile));

  assert.equal(saved.data().username, 'emulator_student');
});

test('Firestore data is isolated by user and rejects unauthenticated or unverified access', async () => {
  const ownerProfile = doc(firestoreFor(owner), 'users', owner.uid, 'profile', 'profile');
  await assertSucceeds(setDoc(ownerProfile, { username: 'owner_only' }));

  const otherDb = firestoreFor(otherUser);
  await assertFails(getDoc(doc(otherDb, 'users', owner.uid, 'profile', 'profile')));
  await assertFails(setDoc(doc(otherDb, 'users', owner.uid, 'profile', 'profile'), { username: 'intruder' }));

  const unverified = testEnvironment.authenticatedContext(owner.uid, {
    email_verified: false,
    firebase: { sign_in_provider: 'password' },
  }).firestore();
  await assertFails(getDoc(doc(unverified, 'users', owner.uid, 'profile', 'profile')));
  await assertFails(getDoc(doc(testEnvironment.unauthenticatedContext().firestore(), 'users', owner.uid, 'profile', 'profile')));
});

test('application tracker documents persist while enforcing the existing schema', async () => {
  const db = firestoreFor(owner);
  const application = doc(db, 'users', owner.uid, 'jobApplications', 'synthetic-application');
  const validApplication = {
    companyName: 'Synthetic Careers Ltd',
    jobTitle: 'Test Engineer',
    jobUrl: 'https://example.test/jobs/test-engineer',
    location: 'Remote',
    employmentType: 'Full-time',
    status: 'Saved',
    dateApplied: '',
    followUpDate: '',
    description: 'Synthetic E2E fixture.',
    notes: '',
    dateSaved: Timestamp.now(),
  };
  await assertSucceeds(setDoc(application, validApplication));
  const saved = await assertSucceeds(getDoc(application));
  assert.equal(saved.data().jobTitle, validApplication.jobTitle);
  assert.equal(saved.data().status, 'Saved');

  await assertFails(setDoc(
    doc(db, 'users', owner.uid, 'jobApplications', 'invalid-application'),
    { ...validApplication, unexpected: true },
  ));
});

test('skill progress persists and another user cannot read it', async () => {
  const progress = doc(firestoreFor(owner), 'users', owner.uid, 'skillProgress', 'synthetic-python');
  await assertSucceeds(setDoc(progress, {
    careerPath: 'Synthetic QA Engineer',
    skill: 'Python',
    completed: true,
  }));
  const saved = await assertSucceeds(getDoc(progress));
  assert.equal(saved.data().completed, true);

  const otherProgress = doc(firestoreFor(otherUser), 'users', owner.uid, 'skillProgress', 'synthetic-python');
  await assertFails(getDoc(otherProgress));
});

test('Storage permits owner avatar operations and denies other users and invalid files', async () => {
  const ownerStorage = storageFor(owner);
  const avatar = ref(ownerStorage, `users/${owner.uid}/profile/avatar-emulator-test.jpg`);
  await assertSucceeds(uploadBytes(avatar, new Uint8Array([0xff, 0xd8, 0xff]), {
    contentType: 'image/jpeg',
  }));
  const bytes = await assertSucceeds(getBytes(avatar));
  assert.deepEqual([...new Uint8Array(bytes)], [0xff, 0xd8, 0xff]);
  await assertSucceeds(deleteObject(avatar));

  const otherAvatar = ref(storageFor(otherUser), `users/${owner.uid}/profile/avatar-emulator-test.jpg`);
  await assertFails(uploadBytes(otherAvatar, new Uint8Array([0xff]), { contentType: 'image/jpeg' }));
  await assertFails(getBytes(otherAvatar));

  const invalidType = ref(ownerStorage, `users/${owner.uid}/profile/avatar-invalid.jpg`);
  await assertFails(uploadBytes(invalidType, new Uint8Array([1]), { contentType: 'text/plain' }));
  const invalidName = ref(ownerStorage, `users/${owner.uid}/profile/not-an-avatar.txt`);
  await assertFails(uploadBytes(invalidName, new Uint8Array([1]), { contentType: 'image/jpeg' }));

  const unauthenticatedStorage = testEnvironment.unauthenticatedContext()
    .storage(`gs://${projectId}.appspot.com`);
  await assertFails(getBytes(ref(unauthenticatedStorage, `users/${owner.uid}/profile/avatar-emulator-test.jpg`)));
});

test('application query remains scoped to the signed-in user', async () => {
  const ownCollection = collection(firestoreFor(owner), 'users', owner.uid, 'jobApplications');
  const otherCollection = collection(firestoreFor(otherUser), 'users', owner.uid, 'jobApplications');
  await assertSucceeds(getDocs(ownCollection));
  await assertFails(getDocs(otherCollection));
  await assertSucceeds(deleteDoc(doc(firestoreFor(owner), 'users', owner.uid, 'skillProgress', 'missing')));
});

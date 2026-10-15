import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasPasswordProvider,
  isValidUsername,
  readThemePreference,
  THEME_STORAGE_KEY,
  writeThemePreference,
} from '../src/settingsUtils.js';

test('username validation accepts trimmed letters, numbers, and underscores within limits', () => {
  assert.equal(isValidUsername('  a_b  '), true);
  assert.equal(isValidUsername('a'.repeat(20)), true);
  assert.equal(isValidUsername('ab'), false);
  assert.equal(isValidUsername('a'.repeat(21)), false);
  assert.equal(isValidUsername('has space'), false);
  assert.equal(isValidUsername('name-tag'), false);
});

test('theme preference defaults to light and persists under its dedicated key', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  assert.equal(readThemePreference(storage), 'light');
  assert.equal(writeThemePreference('dark', storage), 'dark');
  assert.equal(values.get(THEME_STORAGE_KEY), 'dark');
  assert.equal(readThemePreference(storage), 'dark');
  assert.equal(writeThemePreference('invalid', storage), 'light');
  assert.equal(values.get(THEME_STORAGE_KEY), 'light');
});

test('theme preference safely falls back when storage is unavailable', () => {
  const storage = {
    getItem() { throw new Error('storage unavailable'); },
    setItem() { throw new Error('storage unavailable'); },
  };

  assert.equal(readThemePreference(storage), 'light');
  assert.equal(writeThemePreference('dark', storage), 'dark');
});

test('password changes are available only when a password provider is linked', () => {
  assert.equal(hasPasswordProvider({ providerData: [{ providerId: 'password' }] }), true);
  assert.equal(hasPasswordProvider({ providerData: [{ providerId: 'google.com' }] }), false);
  assert.equal(hasPasswordProvider({ providerData: [] }), false);
  assert.equal(hasPasswordProvider(null), false);
});
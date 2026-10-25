import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isOwnedAvatarPath,
  MAX_AVATAR_FILE_SIZE,
  mergeProfileUpdates,
  normalizeProfileUrl,
  validateAvatarFile,
  validateProfessionalLinks,
} from './studentProfileUtils.js';

test('accepts secure links for every professional profile service', () => {
  const links = {
    linkedin: 'https://www.linkedin.com/in/student/',
    github: 'https://github.com/student',
    portfolio: 'https://student.dev',
    leetcode: 'https://leetcode.com/u/student/',
    hackerrank: 'https://www.hackerrank.com/student',
  };

  assert.deepEqual(validateProfessionalLinks(links), {});
});

test('trims surrounding whitespace and permits existing HTTP portfolio compatibility', () => {
  assert.equal(normalizeProfileUrl('  https://github.com/student  '), 'https://github.com/student');
  assert.equal(normalizeProfileUrl('http://student.example', true), 'http://student.example/');
  assert.equal(normalizeProfileUrl('http://github.com/student'), '');
});

test('allows empty optional links', () => {
  assert.deepEqual(validateProfessionalLinks({
    linkedin: '',
    github: '  ',
    portfolio: '',
    leetcode: '',
    hackerrank: '',
  }), {});
});

test('rejects malformed URLs and unsafe protocols with field-specific errors', () => {
  const errors = validateProfessionalLinks({
    linkedin: 'linkedin.com/in/student',
    github: 'javascript:alert(1)',
    portfolio: 'data:text/html,unsafe',
    leetcode: 'https://',
    hackerrank: 'ftp://hackerrank.com/student',
  });

  assert.deepEqual(Object.keys(errors), ['linkedin', 'github', 'portfolio', 'leetcode', 'hackerrank']);
});

test('merges profile edits without dropping unrelated saved fields', () => {
  const original = {
    username: 'student',
    selectedCareerPathway: { careerPath: 'Data Analyst' },
    legacyPreference: 'preserve',
  };
  const updated = mergeProfileUpdates(original, { github: 'https://github.com/student' });

  assert.deepEqual(updated, {
    ...original,
    github: 'https://github.com/student',
  });
});

function fakeImageFile(bytes, { type = '', size = bytes.length } = {}) {
  return {
    type,
    size,
    slice: () => ({
      arrayBuffer: async () => Uint8Array.from(bytes).buffer,
    }),
  };
}

test('validates JPEG, PNG, and WebP content signatures', async () => {
  assert.equal((await validateAvatarFile(fakeImageFile([0xff, 0xd8, 0xff], { type: 'image/jpeg' }))).valid, true);
  assert.equal((await validateAvatarFile(fakeImageFile([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], { type: 'image/png' }))).valid, true);
  assert.equal((await validateAvatarFile(fakeImageFile([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], { type: 'image/webp' }))).valid, true);
});

test('rejects an empty selection, oversized images, invalid bytes, and mismatched MIME types', async () => {
  assert.equal((await validateAvatarFile(null)).valid, false);
  const largeFile = await validateAvatarFile(fakeImageFile([0xff, 0xd8, 0xff], { size: MAX_AVATAR_FILE_SIZE + 1 }));
  assert.match(largeFile.error, /5 MB/);
  assert.equal((await validateAvatarFile(fakeImageFile([1, 2, 3], { type: 'image/png' }))).valid, false);
  assert.match((await validateAvatarFile(fakeImageFile([0xff, 0xd8, 0xff], { type: 'image/png' }))).error, /does not match/);
});

test('recognizes only avatar paths belonging to the current user', () => {
  assert.equal(isOwnedAvatarPath('users/user-123/profile/avatar-random-id.jpg', 'user-123'), true);
  assert.equal(isOwnedAvatarPath('users/another-user/profile/avatar-random-id.jpg', 'user-123'), false);
  assert.equal(isOwnedAvatarPath('users/user-123/profile/other.jpg', 'user-123'), false);
  assert.equal(isOwnedAvatarPath('users/user-123/profile/avatar-random/id.jpg', 'user-123'), false);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { createEducationFromProfile, getVisibleEducationEntries } from '../src/resumeEducation.js';

test('existing profile education prefills only an undergraduate entry', () => {
  assert.deepEqual(createEducationFromProfile({
    degree: 'BE',
    branch: 'Computer Science',
    college: 'Example University',
    graduationYear: '2027',
  }), [{
    level: 'Undergraduate degree',
    institution: 'Example University',
    board: '',
    qualification: 'BE',
    specialization: 'Computer Science',
    startYear: '',
    completionYear: '2027',
    grade: '',
  }]);
});

test('missing profile education does not invent school or qualification details', () => {
  assert.deepEqual(createEducationFromProfile({}), []);
});

test('visible education entries sort by completion year with undated entries last', () => {
  const entries = [
    { level: '10th / SSLC', qualification: 'SSLC', completionYear: '2019' },
    { level: 'Undergraduate degree', qualification: 'BE', completionYear: '2027' },
    { level: '12th / PUC', qualification: 'PUC', completionYear: '2021' },
    { level: 'Diploma', qualification: 'Diploma', startYear: '', completionYear: '' },
    { level: '', qualification: '', completionYear: '' },
  ];

  assert.deepEqual(
    getVisibleEducationEntries(entries).map((entry) => entry.level),
    ['Undergraduate degree', '12th / PUC', '10th / SSLC', 'Diploma'],
  );
  assert.equal(entries[0].level, '10th / SSLC');
});

test('entries with a start year sort using it when completion year is absent', () => {
  const entries = [
    { level: 'Diploma', qualification: 'Diploma', startYear: '2022', completionYear: '' },
    { level: 'Undergraduate degree', qualification: 'BE', startYear: '2020', completionYear: '2024' },
  ];

  assert.deepEqual(
    getVisibleEducationEntries(entries).map((entry) => entry.level),
    ['Undergraduate degree', 'Diploma'],
  );
});
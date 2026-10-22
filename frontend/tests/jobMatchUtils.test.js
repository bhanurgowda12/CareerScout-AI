import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compareJobRequirements,
  JobMatchValidationError,
  normalizeJobRequirements,
  normalizeSkillName,
  validateJobMatchResult,
} from '../src/jobMatchUtils.js';

test('normalizes skill names and supported common aliases', () => {
  assert.equal(normalizeSkillName('  jAvAsCrIpT  '), 'JavaScript');
  assert.equal(normalizeSkillName('JS'), 'JavaScript');
  assert.equal(normalizeSkillName('Structured Query Language'), 'SQL');
  assert.equal(normalizeSkillName('Node JS'), 'Node.js');
  assert.equal(normalizeSkillName('Postgres'), 'PostgreSQL');
  assert.equal(normalizeSkillName('React.js'), 'React');
  assert.equal(normalizeSkillName('  cloud   security  '), 'cloud security');
});

test('matches exact skill names without regard to case', () => {
  const result = compareJobRequirements(['Python'], ['Experience building with PYTHON.']);

  assert.deepEqual(result.matchedRequirements, ['Python']);
  assert.deepEqual(result.unverifiedRequirements, []);
  assert.equal(result.score, 100);
});

test('does not match Java against JavaScript', () => {
  const result = compareJobRequirements(['Java'], ['JavaScript development']);

  assert.deepEqual(result.matchedRequirements, []);
  assert.deepEqual(result.unverifiedRequirements, ['Java']);
});

test('does not find SQL inside unrelated words', () => {
  const result = compareJobRequirements(['SQL'], [
    'NoSQL databases',
    'The sequel was released recently.',
  ]);

  assert.deepEqual(result.matchedRequirements, []);
  assert.deepEqual(result.unverifiedRequirements, ['SQL']);
});

test('matches safely supported aliases in either requirements or evidence', () => {
  const result = compareJobRequirements(
    ['JavaScript', 'SQL', 'Node.js'],
    ['Built with JS and Node JS; used structured query language for reports.'],
  );

  assert.deepEqual(result.matchedRequirements, ['JavaScript', 'SQL', 'Node.js']);
  assert.equal(result.score, 100);
});

test('removes duplicate requirements without merging distinct skills', () => {
  const requirements = normalizeJobRequirements([
    'JS',
    'JavaScript',
    'java',
    'Java',
    'SQL',
    'NoSQL',
  ]);

  assert.deepEqual(requirements, ['JavaScript', 'java', 'SQL', 'NoSQL']);
});

test('finds evidence in project and certification descriptions', () => {
  const result = compareJobRequirements(['TypeScript', 'AWS'], {
    projects: [{
      name: 'Dashboard',
      description: 'Built an accessible application using TypeScript.',
      technologies: 'React',
    }],
    certifications: [{
      name: 'Cloud Practitioner',
      issuer: 'AWS',
      description: 'Introduction to AWS cloud services.',
    }],
  });

  assert.deepEqual(result.matchedRequirements, ['TypeScript', 'AWS']);
  assert.equal(result.score, 100);
});

test('reports requirements without evidence as unverified and gives an explanatory note', () => {
  const result = compareJobRequirements(['Go', 'Kubernetes'], ['Python projects']);

  assert.deepEqual(result.unverifiedRequirements, ['Go', 'Kubernetes']);
  assert.deepEqual(result.requirements, [
    { skill: 'Go', status: 'unverified' },
    { skill: 'Kubernetes', status: 'unverified' },
  ]);
  assert.match(result.interpretationNote, /does not mean you lack the skill/i);
  assert.doesNotMatch(result.interpretationNote, /you lack Go|you lack Kubernetes/i);
});

test('calculates the rounded matched-to-recognized requirement score', () => {
  const result = compareJobRequirements(
    ['Python', 'SQL', 'Docker'],
    ['Python is used in projects'],
  );

  assert.equal(result.matchedCount, 1);
  assert.equal(result.totalCount, 3);
  assert.equal(result.score, 33);
});

test('reports all requirements matched with the complete score', () => {
  const result = compareJobRequirements(['React', 'CSS'], ['React and CSS']);

  assert.equal(result.matchedCount, 2);
  assert.equal(result.totalCount, 2);
  assert.equal(result.score, 100);
});

test('rejects empty or blank-only requirements instead of calculating a score', () => {
  for (const requirements of [[], ['  ', '']]) {
    assert.throws(
      () => compareJobRequirements(requirements, []),
      (error) => error instanceof JobMatchValidationError
        && error.code === 'no-recognized-requirements',
    );
  }
});

test('accepts an empty profile evidence object and marks requirements unverified', () => {
  const result = compareJobRequirements(['Python'], {});

  assert.equal(result.matchedCount, 0);
  assert.equal(result.totalCount, 1);
  assert.equal(result.score, 0);
  assert.deepEqual(result.unverifiedRequirements, ['Python']);
});

test('rejects invalid requirements and invalid profile evidence safely', () => {
  assert.throws(
    () => compareJobRequirements('Python', {}),
    (error) => error instanceof JobMatchValidationError && error.code === 'invalid-requirements',
  );
  assert.throws(
    () => compareJobRequirements(['Python', 42], {}),
    (error) => error instanceof JobMatchValidationError && error.code === 'invalid-requirement',
  );
  assert.throws(
    () => compareJobRequirements(['Python'], { skills: 'Python' }),
    (error) => error instanceof JobMatchValidationError && error.code === 'invalid-profile-evidence',
  );
  assert.throws(
    () => compareJobRequirements(['Python'], ['Python', false]),
    (error) => error instanceof JobMatchValidationError && error.code === 'invalid-profile-evidence',
  );
});

test('validates match result counts, partitions, score, and interpretation', () => {
  const result = compareJobRequirements(['Python', 'SQL'], ['Python']);

  assert.equal(validateJobMatchResult(result), result);
  for (const invalidResult of [
    { ...result, score: 100 },
    { ...result, matchedCount: 2 },
    { ...result, matchedRequirements: ['Python', 'SQL'], unverifiedRequirements: ['SQL'] },
    { ...result, interpretationNote: 'You lack SQL.' },
  ]) {
    assert.throws(
      () => validateJobMatchResult(invalidResult),
      (error) => error instanceof JobMatchValidationError && error.code === 'invalid-result',
    );
  }
});

test('rejects missing and malformed match results', () => {
  for (const invalidResult of [null, [], {}, 'result']) {
    assert.throws(
      () => validateJobMatchResult(invalidResult),
      (error) => error instanceof JobMatchValidationError && error.code === 'invalid-result',
    );
  }
});

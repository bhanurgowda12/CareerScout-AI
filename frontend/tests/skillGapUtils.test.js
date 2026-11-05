import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateSkillGaps } from '../src/skillGapUtils.js';
import { getCareerProgressDocumentId } from '../src/careerCatalog.js';

test('identifies skills explicitly listed in the profile', () => {
  const result = calculateSkillGaps(['Python'], { skills: ['Python'] });

  assert.equal(result.demonstratedSkills[0].skill, 'Python');
  assert.equal(result.demonstratedSkills[0].status, 'demonstrated');
  assert.match(result.demonstratedSkills[0].evidence[0].description, /profile skills/i);
  assert.deepEqual(result.unverifiedSkills, []);
});

test('identifies skills demonstrated by projects and certifications with provenance', () => {
  const result = calculateSkillGaps(['SQL', 'AWS'], {
    projects: [{ name: 'Data dashboard', technologies: 'Python, SQL' }],
    certifications: [{ name: 'Cloud Practitioner', issuer: 'AWS Academy' }],
  });

  assert.equal(result.skills[0].status, 'demonstrated');
  assert.match(result.skills[0].evidence[0].description, /project "Data dashboard".*technologies/i);
  assert.equal(result.skills[1].status, 'demonstrated');
  assert.match(result.skills[1].evidence[0].description, /certification "Cloud Practitioner".*issuer/i);
});

test('supports existing string-form project and certification evidence', () => {
  const result = calculateSkillGaps(['Python', 'AWS'], {
    projects: ['A Python reporting tool'],
    certifications: ['AWS Cloud Practitioner'],
  });

  assert.deepEqual(result.demonstratedSkills.map(({ skill }) => skill), ['Python', 'AWS']);
  assert.match(result.demonstratedSkills[0].evidence[0].description, /project evidence/i);
  assert.match(result.demonstratedSkills[1].evidence[0].description, /certification evidence/i);
});

test('marks skills with no profile evidence unverified without asserting lack of proficiency', () => {
  const result = calculateSkillGaps(['Kubernetes'], { skills: ['Python'] });

  assert.equal(result.unverifiedSkills[0].skill, 'Kubernetes');
  assert.equal(result.unverifiedSkills[0].status, 'unverified');
  assert.deepEqual(result.unverifiedSkills[0].evidence, []);
});

test('normalizes duplicate names and known aliases while retaining the first display name', () => {
  const result = calculateSkillGaps(['JS', 'JavaScript', 'Node JS', 'Node.js'], {
    skills: ['javascript', 'Node.js'],
  });

  assert.deepEqual(result.skills.map(({ skill }) => skill), ['JavaScript', 'Node.js']);
  assert(result.skills.every(({ status }) => status === 'demonstrated'));
});

test('handles empty and incomplete profiles and ignores malformed evidence collections', () => {
  const empty = calculateSkillGaps(['Python', 'SQL'], {});
  const incomplete = calculateSkillGaps(['Python', 'SQL'], {
    skills: ['Python'],
    projects: 'not an array',
    certifications: [null, 'invalid'],
  });

  assert.deepEqual(empty.unverifiedSkills.map(({ skill }) => skill), ['Python', 'SQL']);
  assert.deepEqual(incomplete.demonstratedSkills.map(({ skill }) => skill), ['Python']);
  assert.deepEqual(incomplete.unverifiedSkills.map(({ skill }) => skill), ['SQL']);
});

test('recalculates against updated profile evidence without changing the target order', () => {
  const targetSkills = ['SQL', 'Python', 'React'];
  const original = calculateSkillGaps(targetSkills, { skills: ['React'] });
  const updated = calculateSkillGaps(targetSkills, {
    skills: ['React', 'Python'],
    projects: [{ description: 'Used SQL for reporting' }],
  });

  assert.deepEqual(original.skills.map(({ skill }) => skill), targetSkills);
  assert.deepEqual(updated.skills.map(({ skill }) => skill), targetSkills);
  assert.deepEqual(updated.demonstratedSkills.map(({ skill }) => skill), ['SQL', 'Python', 'React']);
  assert.deepEqual(updated.unverifiedSkills, []);
});

test('switching target pathways recalculates gaps independently', () => {
  const profile = { skills: ['Python'] };
  const backend = calculateSkillGaps(['Python', 'FastAPI'], profile);
  const analytics = calculateSkillGaps(['SQL', 'Power BI'], profile);

  assert.deepEqual(backend.demonstratedSkills.map(({ skill }) => skill), ['Python']);
  assert.deepEqual(backend.unverifiedSkills.map(({ skill }) => skill), ['FastAPI']);
  assert.deepEqual(analytics.unverifiedSkills.map(({ skill }) => skill), ['SQL', 'Power BI']);
});

test('preserves target plan metadata and sequence ordering while removing alias duplicates', () => {
  const result = calculateSkillGaps([
    { skill: 'SQL', sequenceOrder: 2, priority: 'Intermediate' },
    { skill: 'JavaScript', sequenceOrder: 1, priority: 'Beginner' },
    { skill: 'JS', sequenceOrder: 3, priority: 'Advanced' },
  ]);

  assert.deepEqual(result.skills.map(({ skill }) => skill), ['SQL', 'JavaScript']);
  assert.deepEqual(result.skills.map(({ sequenceOrder }) => sequenceOrder), [2, 1]);
  assert.deepEqual(result.skills.map(({ priority }) => priority), ['Intermediate', 'Beginner']);
});

test('progress document identity remains scoped to the career and skill', () => {
  const backendProgress = getCareerProgressDocumentId('Backend Developer', 'Python');
  const analyticsProgress = getCareerProgressDocumentId('Data Analyst', 'Python');

  assert.equal(backendProgress, getCareerProgressDocumentId('Backend Developer', 'Python'));
  assert.notEqual(backendProgress, analyticsProgress);
});

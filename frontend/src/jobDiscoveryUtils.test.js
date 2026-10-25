import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createExternalJobSearchLinks,
  createJobPreparationRoadmap,
  createTrackerPrefill,
  compareListingWithProfile,
  deduplicateDiscoveryListings,
  EXPERIENCE_FILTERS,
  extractJobRequirements,
  filterAndSortDiscoveryListings,
  filterDiscoveryListings,
  formatDiscoveryDate,
  getExperienceClassification,
  getLocationMatch,
  getRoleSearchTerms,
  groupListingsByCompany,
  isValidDiscoveryListing,
  JOB_CATEGORIES,
  matchesJobSelections,
  normalizeSearchText,
} from './jobDiscoveryUtils.js';

const listing = {
  id: '123',
  title: 'Software Engineer',
  company: 'Example Co',
  location: 'Worldwide',
  employmentType: 'Full-time',
  description: 'Build reliable software with JavaScript.',
  url: 'https://remotive.com/remote-jobs/software-engineer-123',
  category: 'Software Development',
  isRemote: true,
  source: 'Remotive',
};

test('filters actual listings by all search terms and supported remote status', () => {
  assert.deepEqual(filterDiscoveryListings([listing], { query: 'software javascript', remoteOnly: true }), [listing]);
  assert.deepEqual(filterDiscoveryListings([listing], { query: 'designer', remoteOnly: true }), []);
  assert.deepEqual(filterDiscoveryListings([{ ...listing, isRemote: false }], { remoteOnly: true }), []);
});

test('matches partial search terms across titles and descriptions, not locations', () => {
  const partialMatch = {
    ...listing,
    title: 'Senior Frontend Engineer',
    description: 'Build products for developers.',
  };
  assert.deepEqual(filterDiscoveryListings([partialMatch], { query: 'Frontend Developer' }), [partialMatch]);
  assert.deepEqual(filterDiscoveryListings([
    { ...listing, title: 'Engineer', description: '', location: 'Frontend Developer' },
  ], { query: 'Frontend Developer' }), []);
  assert.deepEqual(filterDiscoveryListings([
    { ...listing, title: 'React Developer', description: '', location: 'Worldwide' },
  ], { query: 'DEVELOPER', remoteOnly: true }), [
    { ...listing, title: 'React Developer', description: '', location: 'Worldwide' },
  ]);
});

test('rejects incomplete listings and non-Remotive links', () => {
  assert.equal(isValidDiscoveryListing({ ...listing, company: '' }), false);
  assert.equal(isValidDiscoveryListing({ ...listing, url: 'https://remotive.com.attacker.example/job' }), false);
  assert.equal(isValidDiscoveryListing({ ...listing, url: 'http://remotive.com/remote-jobs/insecure' }), false);
  assert.deepEqual(filterDiscoveryListings([null, {}, { ...listing, url: 'javascript:alert(1)' }]), []);
});

test('creates encoded external job-board searches with title and location', () => {
  const links = createExternalJobSearchLinks('C++ & React', 'Bengaluru, India');
  const byName = Object.fromEntries(links.map((link) => [link.name, new URL(link.url)]));

  assert.equal(byName['LinkedIn Jobs'].searchParams.get('keywords'), 'C++ & React');
  assert.equal(byName['LinkedIn Jobs'].searchParams.get('location'), 'Bengaluru, India');
  assert.equal(byName.Indeed.searchParams.get('q'), 'C++ & React');
  assert.equal(byName.Indeed.searchParams.get('l'), 'Bengaluru, India');
  assert.equal(byName.Naukri.searchParams.get('k'), 'C++ & React');
  assert.equal(byName['Google Jobs'].searchParams.get('q'), 'C++ & React Bengaluru, India');
  assert.equal(createExternalJobSearchLinks('', '').length, 0);
});

test('prefills exactly the tracker fields without changing the Saved status', () => {
  assert.deepEqual(createTrackerPrefill(listing), {
    companyName: 'Example Co',
    jobTitle: 'Software Engineer',
    jobUrl: listing.url,
    location: 'Worldwide',
    employmentType: 'Full-time',
    status: 'Saved',
    dateApplied: '',
    followUpDate: '',
    description: listing.description,
    notes: '',
  });
  assert.equal(createTrackerPrefill({ ...listing, description: 'd'.repeat(2000) }).description.length, 1500);
  assert.equal(createTrackerPrefill({ ...listing, employmentType: 'Temporary' }).employmentType, '');
  assert.equal(createTrackerPrefill({ ...listing, title: '' }), null);
});

test('formats available publication dates and omits invalid dates', () => {
  assert.equal(formatDiscoveryDate('not-a-date'), '');
  assert.notEqual(formatDiscoveryDate('2026-01-02T00:00:00Z'), '');
});

test('publishes all requested job-role categories instead of discipline-first engineering categories', () => {
  assert.equal(JOB_CATEGORIES.length, 30);
  assert.equal(JOB_CATEGORIES[0].label, 'Software Development');
  assert.equal(JOB_CATEGORIES.at(-1).label, 'Internships & Graduate Opportunities');
  assert.equal(EXPERIENCE_FILTERS[0], 'All opportunities');
  assert.ok(JOB_CATEGORIES.some((category) => category.roles.some((role) => role.title === 'Frontend Developer')));
  assert.ok(JOB_CATEGORIES.some((category) => category.roles.some((role) => role.title === 'Financial Analyst')));
  assert.ok(JOB_CATEGORIES.some((category) => category.roles.some((role) => role.title === 'Graduate Engineer Trainee')));
});

test('normalizes search text and matches multi-category roles and full-stack synonyms', () => {
  assert.equal(normalizeSearchText('  DéVOpS  ENGINEER '), 'devops engineer');
  assert.deepEqual(getRoleSearchTerms('Full Stack Developer'), [
    'Full Stack Developer',
    'Full-Stack Engineer',
    'Full Stack Software Engineer',
    'Frontend and Backend Software Engineer',
  ]);
  assert.equal(matchesJobSelections({
    ...listing,
    title: 'Full-Stack Software Engineer',
  }, { role: 'Full Stack Developer' }), true);
  assert.equal(matchesJobSelections({
    ...listing,
    title: 'Graduate Engineer Trainee',
  }, { categories: ['internships-graduate', 'software-development'] }), true);
  assert.equal(matchesJobSelections(listing, {}), true);
});

test('filters, deduplicates, groups and sorts only returned provider listings', () => {
  const second = {
    ...listing,
    id: '456',
    company: 'Another Co',
    title: 'Python Analyst',
    description: 'Analyze data in Python.',
    publicationDate: '2026-02-02T00:00:00Z',
    url: 'https://remotive.com/remote-jobs/python-analyst-456',
  };
  const duplicate = { ...second, id: 'different-id' };
  const results = filterAndSortDiscoveryListings([listing, second, duplicate], {
    company: 'another',
    sortBy: 'newest',
  });
  assert.deepEqual(results, [second]);
  assert.deepEqual(deduplicateDiscoveryListings([listing, second, duplicate]), [listing, second]);
  assert.deepEqual(deduplicateDiscoveryListings([
    { ...listing, id: 'stable-1', url: 'https://remotive.com/job/one' },
    { ...listing, id: 'stable-1', url: 'https://remotive.com/job/renamed' },
  ]).length, 1);
  assert.deepEqual(Object.keys(groupListingsByCompany([listing, second])), ['Example Co', 'Another Co']);
  assert.deepEqual(filterAndSortDiscoveryListings([], {}), []);
});

test('filters supported employment and experience terms without inventing missing metadata', () => {
  const internship = {
    ...listing,
    title: 'Software Engineering Intern',
    employmentType: 'internship',
  };
  assert.deepEqual(filterAndSortDiscoveryListings([internship], {
    employment: 'Internship',
    experience: 'Internships',
  }), [internship]);
  assert.deepEqual(filterAndSortDiscoveryListings([
    internship,
    { ...listing, id: 'graduate', url: 'https://remotive.com/jobs/graduate', title: 'Graduate Software Engineer' },
    { ...listing, id: 'senior', url: 'https://remotive.com/jobs/senior', title: 'Senior Software Engineer' },
    { ...listing, id: 'unknown', url: 'https://remotive.com/jobs/unknown', title: 'Software Engineer' },
  ], { experience: 'Internships' }).map((job) => job.title), [
    'Software Engineering Intern',
    'Software Engineer',
  ]);
  assert.deepEqual(filterAndSortDiscoveryListings([
    { ...listing, id: 'graduate', url: 'https://remotive.com/jobs/graduate', title: 'Graduate Software Engineer' },
    { ...listing, id: 'senior', url: 'https://remotive.com/jobs/senior', title: 'Senior Software Engineer' },
    { ...listing, id: 'unknown', url: 'https://remotive.com/jobs/unknown', title: 'Software Engineer' },
  ], { experience: 'Freshers & graduates' }).map((job) => job.title), [
    'Graduate Software Engineer',
    'Software Engineer',
  ]);
  assert.equal(getExperienceClassification({ title: 'Software Engineer' }), 'Not stated');
  for (const title of [
    'AI Intern',
    'Data Analyst Intern',
    'Graduate Engineer Trainee',
    'Junior Developer',
    'Associate Software Engineer',
    'Apprentice',
    'Entry-Level Engineer',
  ]) {
    assert.equal(getExperienceClassification({ title }), title.includes('Intern') ? 'Internship' : 'Entry-level');
  }
  assert.deepEqual(filterAndSortDiscoveryListings([listing], {
    location: 'San Francisco',
  }), [listing]);
  assert.deepEqual(filterAndSortDiscoveryListings([listing], {
    workMode: 'On-site',
  }), [listing]);
});

test('filters city matches honestly and keeps global/unspecified remote listings separate', () => {
  const cityListing = { ...listing, location: 'Bengaluru, India', isRemote: false };
  const globalRemote = { ...listing, id: 'global', url: 'https://remotive.com/jobs/global', location: 'Worldwide', isRemote: true };
  const unspecifiedRemote = { ...listing, id: 'remote-unknown', url: 'https://remotive.com/jobs/remote-unknown', location: '', isRemote: true };
  const otherCity = { ...listing, id: 'other', url: 'https://remotive.com/jobs/other', location: 'United States', isRemote: true };
  const unknownLocation = { ...listing, id: 'unknown', url: 'https://remotive.com/jobs/unknown', location: '', isRemote: null };
  assert.equal(getLocationMatch(cityListing, 'Bengaluru'), 'local');
  assert.equal(getLocationMatch(globalRemote, 'Bengaluru'), 'remote-global');
  assert.equal(getLocationMatch(unspecifiedRemote, 'Bengaluru'), 'remote-unspecified');
  assert.equal(getLocationMatch(otherCity, 'Bengaluru'), '');
  assert.equal(getLocationMatch(unknownLocation, 'Bengaluru'), '');
  assert.deepEqual(filterAndSortDiscoveryListings([
    cityListing, globalRemote, unspecifiedRemote, otherCity, unknownLocation,
  ], { location: 'Bengaluru' }).map((job) => job.id), ['123', 'global', 'remote-unknown']);
});

test('normalizes actual provider skill tags and compares profile evidence without claiming absent skills are lacking', () => {
  const job = {
    ...listing,
    skills: ['React', 'Docker'],
    description: 'Experience using JavaScript and React. Familiarity with Python is helpful.',
  };
  assert.deepEqual(extractJobRequirements(job), ['React', 'Docker', 'JavaScript', 'Python']);
  const comparison = compareListingWithProfile(job, {
    skills: ['React'],
    projects: [{ technologies: 'JavaScript' }],
  });
  assert.deepEqual(comparison.matchedSkills, ['React', 'JavaScript']);
  assert.deepEqual(comparison.needsVerification, ['Docker', 'Python']);
  assert.equal(comparison.score, 50);
  assert.equal(compareListingWithProfile({ ...job, skills: [], description: '' }, {}).score, null);
});

test('creates role-specific, time-bounded roadmaps with measurable milestones and completion state', () => {
  const roadmap = createJobPreparationRoadmap({
    ...listing,
    title: 'Unity Game Developer',
    skills: ['Unity', 'C#'],
  }, { skills: ['C#'] }, 8);
  assert.equal(roadmap.weeks, 8);
  assert.equal(roadmap.role, 'Unity Game Developer');
  assert.ok(roadmap.tasks.some((task) => task.skill === 'Unity'));
  assert.ok(roadmap.tasks.every((task) => typeof task.milestone === 'string' && task.milestone.length > 0));
  assert.equal(roadmap.tasks[0].completed, false);
});

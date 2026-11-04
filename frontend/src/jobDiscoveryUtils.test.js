import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  getExperienceClassificationDetails,
  getCategorySearchTerms,
  getExperienceClassification,
  getKnownEmploymentTypes,
  getKnownWorkMode,
  getLocationMatch,
  getRoleSearchTerms,
  groupListingsByCompany,
  isValidDiscoveryListing,
  isUnrestrictedJobRole,
  JOB_CATEGORIES,
  JOB_SKILLS,
  matchesJobSelections,
  normalizeSearchText,
  partitionExperienceClassifications,
  partitionExperienceFilterResults,
  summarizeCompanyListings,
} from './jobDiscoveryUtils.js';

const experienceClassificationCases = JSON.parse(readFileSync(
  new URL('../../shared/experienceClassificationCases.json', import.meta.url),
  'utf8',
));

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

test('treats all-job role labels and empty/default filters as unrestricted', () => {
  for (const role of ['ALL TYPE JOB', 'All Job Types', 'All types of jobs', '']) {
    assert.equal(isUnrestrictedJobRole(role), true);
    assert.deepEqual(getRoleSearchTerms(role), []);
    assert.deepEqual(filterAndSortDiscoveryListings([listing], { role }), [listing]);
  }

  assert.deepEqual(filterAndSortDiscoveryListings([listing], {
    query: '',
    role: 'ALL TYPE JOB',
    categories: ['All Job Types', ''],
    skills: ['', 'Any skill'],
    company: '',
    location: '',
    workMode: '',
    experience: '',
    employment: '',
  }), [listing]);
});

test('matches selected skills against listing evidence and avoids partial technology-name matches', () => {
  const skillListings = [
    { ...listing, id: 'python-title', url: 'https://remotive.com/jobs/python-title', title: 'Python Developer', description: '' },
    { ...listing, id: 'typescript-description', url: 'https://remotive.com/jobs/typescript-description', title: 'Frontend Engineer', description: 'Build with TypeScript.' },
    { ...listing, id: 'data-category', url: 'https://remotive.com/jobs/data-category', title: 'Analyst', category: 'Data Science' },
    { ...listing, id: 'mongo-tag', url: 'https://remotive.com/jobs/mongo-tag', title: 'Backend Engineer', skills: ['MongoDB'] },
    { ...listing, id: 'javascript', url: 'https://remotive.com/jobs/javascript', title: 'JavaScript Developer', description: '', skills: [] },
  ];

  assert.ok(JOB_SKILLS.includes('Python'));
  assert.ok(JOB_SKILLS.includes('Machine Learning'));
  assert.deepEqual(filterAndSortDiscoveryListings(skillListings, { skills: ['Python'] }).map((job) => job.id), ['python-title']);
  assert.deepEqual(filterAndSortDiscoveryListings(skillListings, { skills: ['TypeScript'] }).map((job) => job.id), ['typescript-description']);
  assert.deepEqual(filterAndSortDiscoveryListings(skillListings, { skills: ['Data Science'] }).map((job) => job.id), ['data-category']);
  assert.deepEqual(filterAndSortDiscoveryListings(skillListings, { skills: ['MongoDB'] }).map((job) => job.id), ['mongo-tag']);
  assert.deepEqual(filterAndSortDiscoveryListings(skillListings, { skills: ['Java'] }).map((job) => job.id), []);
  assert.deepEqual(filterAndSortDiscoveryListings(skillListings, { skills: ['Java', 'MongoDB'] }).map((job) => job.id), ['mongo-tag']);
});

test('matches expanded role aliases and sends category terms consistent with frontend taxonomy filters', () => {
  for (const title of [
    'Python Developer',
    'Java Developer',
    'JavaScript Developer',
    'React Developer',
    'Angular Developer',
    'Node.js Developer',
    'Frontend Developer',
    'Backend Developer',
    'Full Stack Developer',
    'Software Engineer',
    'AI Engineer',
    'Machine Learning Engineer',
    'Data Analyst',
    'Data Scientist',
    'Game Developer',
    'DevOps Engineer',
    'Cloud Engineer',
    'Cybersecurity Engineer',
  ]) {
    assert.equal(getRoleSearchTerms(title)[0], title);
  }
  assert.deepEqual(getRoleSearchTerms('Python Developer'), [
    'Python Developer',
    'Python Engineer',
    'Python Programmer',
    'Python Software Developer',
  ]);
  assert.ok(matchesJobSelections({ ...listing, title: 'Python Engineer' }, { role: 'Python Developer' }));
  assert.ok(matchesJobSelections({ ...listing, title: 'Java Software Developer' }, { role: 'Java Developer' }));
  assert.equal(matchesJobSelections({ ...listing, title: 'JavaScript Developer' }, { role: 'Java Developer' }), false);
  assert.ok(matchesJobSelections({ ...listing, description: 'Build internal tools as a React.js Developer.' }, { role: 'React Developer' }));
  assert.ok(getCategorySearchTerms(['software-development']).includes('Python Developer'));
  assert.ok(matchesJobSelections({ ...listing, title: 'Unspecified role', category: 'Software Development' }, {
    categories: ['software-development'],
  }));
  assert.ok(matchesJobSelections({ ...listing, description: 'Develop Python services.' }, { categories: ['software-development'] }));
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
  ]);
  assert.deepEqual(filterAndSortDiscoveryListings([
    { ...listing, id: 'graduate', url: 'https://remotive.com/jobs/graduate', title: 'Graduate Software Engineer' },
    { ...listing, id: 'senior', url: 'https://remotive.com/jobs/senior', title: 'Senior Software Engineer' },
    { ...listing, id: 'unknown', url: 'https://remotive.com/jobs/unknown', title: 'Software Engineer' },
  ], { experience: 'Freshers & graduates' }).map((job) => job.title), [
    'Graduate Software Engineer',
    'Software Engineer',
  ]);
  assert.deepEqual(filterAndSortDiscoveryListings([
    { ...listing, id: 'junior', url: 'https://remotive.com/jobs/junior', title: 'Junior Developer' },
    { ...listing, id: 'graduate', url: 'https://remotive.com/jobs/graduate', title: 'Graduate Software Engineer' },
    { ...listing, id: 'unknown', url: 'https://remotive.com/jobs/unknown', title: 'Software Engineer' },
  ], { experience: 'Entry-level jobs' }).map((job) => job.title), [
    'Junior Developer',
    'Software Engineer',
  ]);
  assert.deepEqual(filterAndSortDiscoveryListings([
    { ...listing, id: 'senior', url: 'https://remotive.com/jobs/senior', title: 'Senior Engineer' },
    { ...listing, id: 'junior', url: 'https://remotive.com/jobs/junior', title: 'Junior Developer' },
    { ...listing, id: 'unknown', url: 'https://remotive.com/jobs/unknown', title: 'Software Engineer' },
  ], { experience: 'Experienced jobs' }).map((job) => job.title), [
    'Senior Engineer',
    'Software Engineer',
  ]);
  assert.equal(getExperienceClassification({ title: 'Software Engineer' }), 'Unknown');
  assert.equal(getExperienceClassification({ title: 'Trainee Developer' }), 'Unknown');
  assert.equal(getExperienceClassification({ title: 'Associate Software Engineer' }), 'Unknown');
  assert.equal(getExperienceClassification({ title: 'Graduate Engineer Trainee' }), 'Fresher/Graduate');
  assert.equal(getExperienceClassification({ title: 'Junior Developer' }), 'Entry-level');
  assert.equal(getExperienceClassification({ title: 'Senior Engineer' }), 'Experienced');
  assert.equal(getExperienceClassification({ employmentType: 'Full-time', title: 'Software Engineer' }), 'Unknown');
  assert.deepEqual(filterAndSortDiscoveryListings([listing], {
    location: 'San Francisco',
  }), [listing]);
  assert.deepEqual(filterAndSortDiscoveryListings([listing], {
    workMode: 'On-site',
  }), []);
});

test('matches the shared backend experience-classification contract', () => {
  for (const item of experienceClassificationCases) {
    const result = getExperienceClassificationDetails(item.listing);
    const classification = ({
      'Fresher/Graduate': 'fresher/graduate',
      'Entry-level': 'entry-level',
    }[result.classification] || result.classification.toLocaleLowerCase());
    assert.equal(classification, item.classification, item.name);
    assert.equal(result.source, item.source, item.name);
    if (item.opportunityType) {
      assert.equal(result.opportunityType.classification, item.opportunityType, item.name);
      assert.equal(result.opportunityType.source, item.opportunityTypeSource, item.name);
      assert.equal(result.seniority.classification, item.seniority, item.name);
      assert.equal(result.seniority.source, item.senioritySource, item.name);
    }
    assert.equal(getExperienceClassification(item.listing), ({
      internship: 'Internship',
      'fresher/graduate': 'Fresher/Graduate',
      'entry-level': 'Entry-level',
      experienced: 'Experienced',
      unknown: 'Unknown',
    }[item.classification]), item.name);
  }
});

test('partitions experience-filter results into source-reported, inferred, and unknown groups', () => {
  const listings = [
    { ...listing, id: 'source', url: 'https://remotive.com/jobs/source', employmentType: '', experienceLevel: 'Internship' },
    { ...listing, id: 'inferred', url: 'https://remotive.com/jobs/inferred', title: 'Junior Developer' },
    { ...listing, id: 'unknown', url: 'https://remotive.com/jobs/unknown', title: 'Associate Developer' },
  ];
  assert.deepEqual(
    Object.fromEntries(Object.entries(partitionExperienceClassifications(listings))
      .map(([group, items]) => [group, items.map((item) => item.id)])),
    {
      providerReported: ['source'],
      titleInferred: ['inferred'],
      descriptionInferred: [],
      unknown: ['unknown'],
    },
  );
  const summary = summarizeCompanyListings(listings);
  assert.equal(summary.providerReportedExperience, 1);
  assert.equal(summary.titleInferredExperience, 1);
  assert.equal(summary.descriptionInferredExperience, 0);
  assert.equal(summary.unknownExperience, 2);
});

test('experience filters prioritize confirmed Full Stack matches and keep unknown listings unconfirmed', () => {
  const listings = [
    { ...listing, id: 'provider-internship', url: 'https://remotive.com/jobs/provider-internship', employmentType: '', experienceLevel: 'Internship', title: 'Full Stack Developer' },
    { ...listing, id: 'title-internship', url: 'https://remotive.com/jobs/title-internship', employmentType: '', title: 'Full Stack Developer Internship' },
    { ...listing, id: 'provider-graduate', url: 'https://remotive.com/jobs/provider-graduate', experienceLevel: 'Graduate', title: 'Full Stack Developer' },
    { ...listing, id: 'title-graduate', url: 'https://remotive.com/jobs/title-graduate', title: 'Graduate Full Stack Developer' },
    { ...listing, id: 'provider-entry', url: 'https://remotive.com/jobs/provider-entry', experienceLevel: 'Entry Level', title: 'Full Stack Developer' },
    { ...listing, id: 'title-entry', url: 'https://remotive.com/jobs/title-entry', title: 'Junior Full Stack Developer' },
    { ...listing, id: 'unknown', url: 'https://remotive.com/jobs/unknown', employmentType: '', title: 'Full Stack Developer' },
  ];
  const cases = [
    ['Internships', ['provider-internship', 'title-internship']],
    ['Freshers & graduates', ['provider-graduate', 'title-graduate']],
    ['Entry-level jobs', ['provider-entry', 'title-entry']],
  ];

  for (const [experience, expectedConfirmed] of cases) {
    const filtered = filterAndSortDiscoveryListings(listings, {
      role: 'Full Stack Developer',
      experience,
    });
    const results = partitionExperienceFilterResults(filtered, experience);
    assert.deepEqual(results.confirmed.map((job) => job.id).sort(), expectedConfirmed.sort(), experience);
    assert.deepEqual(results.unknown.map((job) => job.id), experience === 'Internships'
      ? ['unknown']
      : ['provider-internship', 'title-internship', 'unknown'], experience);
    assert.equal(results.confirmedCount, 2, experience);
    assert.equal(results.unconfirmedCount, experience === 'Internships' ? 1 : 3, experience);
  }
});

test('description-inferred experience remains distinct, confirmed, and filter-specific', () => {
  const listings = [
    {
      ...listing,
      id: 'description-internship',
      url: 'https://remotive.com/jobs/description-internship',
      title: 'Full Stack Developer',
      employmentType: '',
      description: 'This is a paid internship program on our product team.',
    },
    {
      ...listing,
      id: 'description-experienced',
      url: 'https://remotive.com/jobs/description-experienced',
      title: 'Full Stack Developer',
      description: '3+ years of experience as a full-stack or frontend-heavy engineer.',
    },
    {
      ...listing,
      id: 'source-internship-entry',
      url: 'https://remotive.com/jobs/source-internship-entry',
      title: 'Full Stack Developer',
      employmentType: 'Internship',
      experienceLevel: 'Entry-Level, Junior',
    },
    {
      ...listing,
      id: 'unknown',
      url: 'https://remotive.com/jobs/unknown-experience',
      title: 'Full Stack Developer',
      employmentType: '',
      description: 'Students use our Python product.',
    },
  ];

  const internshipResults = partitionExperienceFilterResults(
    filterAndSortDiscoveryListings(listings, { role: 'Full Stack Developer', experience: 'Internships' }),
    'Internships',
  );
  const entryLevelResults = partitionExperienceFilterResults(
    filterAndSortDiscoveryListings(listings, { role: 'Full Stack Developer', experience: 'Entry-level jobs' }),
    'Entry-level jobs',
  );
  const experiencedResults = partitionExperienceFilterResults(
    filterAndSortDiscoveryListings(listings, { role: 'Full Stack Developer', experience: 'Experienced jobs' }),
    'Experienced jobs',
  );

  assert.deepEqual(internshipResults.confirmed.map((job) => job.id).sort(), [
    'description-internship',
    'source-internship-entry',
  ]);
  assert.deepEqual(internshipResults.descriptionInferred.map((job) => job.id), ['description-internship']);
  assert.deepEqual(entryLevelResults.confirmed.map((job) => job.id), ['source-internship-entry']);
  assert.deepEqual(experiencedResults.confirmed.map((job) => job.id), ['description-experienced']);
  for (const [results, expectedUnknown] of [
    [internshipResults, ['unknown']],
    [entryLevelResults, ['description-internship', 'unknown']],
    [experiencedResults, ['description-internship', 'unknown']],
  ]) {
    assert.deepEqual(results.unknown.map((job) => job.id).sort(), expectedUnknown.sort());
    assert.equal(results.confirmedCount, results.providerReported.length
      + results.titleInferred.length + results.descriptionInferred.length);
    assert.equal(results.unconfirmedCount, expectedUnknown.length);
  }
});

test('keeps unknown work-mode and employment metadata visible without treating it as confirmed', () => {
  const unknown = {
    ...listing,
    id: 'unknown',
    url: 'https://remotive.com/jobs/unknown-metadata',
    workMode: '',
    isRemote: null,
    employmentType: '',
  };
  const onsite = {
    ...unknown,
    id: 'onsite',
    url: 'https://remotive.com/jobs/onsite-metadata',
    workMode: 'On-site',
    isRemote: false,
    employmentType: 'Internship',
  };
  const remote = {
    ...unknown,
    id: 'remote',
    url: 'https://remotive.com/jobs/remote-metadata',
    workMode: 'Remote',
    isRemote: true,
    employmentType: 'Full-Time',
  };

  assert.equal(getKnownWorkMode(unknown), '');
  assert.equal(getKnownWorkMode(remote), 'Remote');
  assert.deepEqual(getKnownEmploymentTypes(unknown), []);
  assert.deepEqual(getKnownEmploymentTypes(remote), ['Full-time']);
  assert.deepEqual(filterAndSortDiscoveryListings([unknown, onsite, remote], {
    workMode: 'On-site',
  }).map((job) => job.id), ['unknown', 'onsite']);
  assert.deepEqual(filterAndSortDiscoveryListings([unknown, onsite, remote], {
    employment: 'Internship',
  }).map((job) => job.id), ['unknown', 'onsite']);
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

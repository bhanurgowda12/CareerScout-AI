import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createExternalJobSearchLinks,
  createTrackerPrefill,
  filterDiscoveryListings,
  formatDiscoveryDate,
  isValidDiscoveryListing,
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

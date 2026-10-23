import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterApplications,
  getApplicationSummary,
  getFollowUpState,
  getLocalDateString,
  isValidHttpUrl,
  sortApplications,
  validateApplicationFields,
} from '../src/jobApplicationUtils.js';

const validFields = {
  companyName: 'Acme',
  jobTitle: 'Engineer',
  status: 'Saved',
  jobUrl: '',
  dateApplied: '',
  followUpDate: '',
  description: '',
  notes: '',
};

test('validates required company, title, and application status', () => {
  assert.deepEqual(validateApplicationFields(validFields), {});
  assert.deepEqual(validateApplicationFields({ ...validFields, companyName: ' ', jobTitle: '', status: 'Unknown' }), {
    companyName: 'Enter a company name.',
    jobTitle: 'Enter a job title.',
    status: 'Choose an application status.',
  });
});

test('accepts only valid HTTP and HTTPS job URLs', () => {
  assert.equal(isValidHttpUrl('https://jobs.example.com/role'), true);
  assert.equal(isValidHttpUrl('http://example.com'), true);
  for (const url of ['ftp://example.com/job', 'javascript:alert(1)', 'not a url', 'https://', '']) {
    assert.equal(isValidHttpUrl(url), false);
  }
  assert.equal(validateApplicationFields({ ...validFields, jobUrl: 'ftp://example.com/job' }).jobUrl, 'Enter a valid HTTP or HTTPS URL.');
});

test('validates real dates and optional text length limits', () => {
  assert.deepEqual(validateApplicationFields({
    ...validFields,
    dateApplied: '2026-02-30',
    followUpDate: 'not-a-date',
  }), {
    dateApplied: 'Enter a valid date.',
    followUpDate: 'Enter a valid date.',
  });
  assert.equal(validateApplicationFields({ ...validFields, description: 'x'.repeat(1501) }).description, 'Use 1,500 characters or fewer.');
  assert.equal(validateApplicationFields({ ...validFields, notes: 'x'.repeat(2001) }).notes, 'Use 2,000 characters or fewer.');
});

test('searches company and job title without regard to case and filters by status', () => {
  const applications = [
    { id: '1', companyName: 'Acme Labs', jobTitle: 'Designer', status: 'Saved' },
    { id: '2', companyName: 'Northwind', jobTitle: 'Software Engineer', status: 'Applied' },
    { id: '3', companyName: 'Other', jobTitle: 'Engineer', status: 'Interview' },
  ];
  assert.deepEqual(filterApplications(applications, 'ACME').map(({ id }) => id), ['1']);
  assert.deepEqual(filterApplications(applications, 'software').map(({ id }) => id), ['2']);
  assert.deepEqual(filterApplications(applications, '', 'Interview').map(({ id }) => id), ['3']);
  assert.deepEqual(filterApplications(applications, 'engineer', 'Applied').map(({ id }) => id), ['2']);
  assert.deepEqual(filterApplications(applications, 'missing'), []);
});

test('calculates non-overlapping totals and deduplicates repeated application IDs', () => {
  const applications = [
    { id: 'saved', status: 'Saved' },
    { id: 'applied', status: 'Applied' },
    { id: 'interview', status: 'Interview' },
    { id: 'offer', status: 'Offer' },
    { id: 'rejected', status: 'Rejected' },
    { id: 'withdrawn', status: 'Withdrawn' },
    { id: 'interview', status: 'Interview' },
  ];
  assert.deepEqual(getApplicationSummary(applications), { total: 6, submitted: 5, interviews: 1, offers: 1 });
  assert.deepEqual(getApplicationSummary([]), { total: 0, submitted: 0, interviews: 0, offers: 0 });
});

test('uses local calendar date and identifies upcoming, overdue, missing, and invalid follow-ups', () => {
  const date = new Date(2026, 9, 23, 23, 30);
  assert.equal(getLocalDateString(date), '2026-10-23');
  assert.equal(getFollowUpState('2026-10-23', '2026-10-23'), 'upcoming');
  assert.equal(getFollowUpState('2026-10-24', '2026-10-23'), 'upcoming');
  assert.equal(getFollowUpState('2026-10-22', '2026-10-23'), 'overdue');
  assert.equal(getFollowUpState('', '2026-10-23'), 'none');
  assert.equal(getFollowUpState('2026-02-30', '2026-10-23'), 'none');
  assert.equal(getFollowUpState('2026-10-23', 'invalid'), 'none');
});

test('sorts newest saved first and earliest valid follow-up first with missing dates last', () => {
  const applications = [
    { id: 'old', dateSaved: '2026-01-01T10:00:00Z', followUpDate: '2026-11-01' },
    { id: 'new', dateSaved: '2026-03-01T10:00:00Z', followUpDate: '2026-10-26' },
    { id: 'none', dateSaved: '2026-02-01T10:00:00Z', followUpDate: '' },
  ];
  assert.deepEqual(sortApplications(applications).map(({ id }) => id), ['new', 'none', 'old']);
  assert.deepEqual(sortApplications(applications, 'followUp').map(({ id }) => id), ['new', 'old', 'none']);
});

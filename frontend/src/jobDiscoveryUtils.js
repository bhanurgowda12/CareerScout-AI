import { EMPLOYMENT_TYPES, MAX_DESCRIPTION_LENGTH, isValidHttpUrl } from './jobApplicationUtils.js';

export const MAX_JOB_SEARCH_LENGTH = 100;
export const MAX_JOB_LOCATION_LENGTH = 120;

export function isValidDiscoveryListing(listing) {
  return Boolean(
    listing
    && typeof listing === 'object'
    && typeof listing.title === 'string'
    && listing.title.trim()
    && typeof listing.company === 'string'
    && listing.company.trim()
    && typeof listing.url === 'string'
    && isValidHttpUrl(listing.url)
    && (
      new URL(listing.url).hostname.toLowerCase() === 'remotive.com'
      || new URL(listing.url).hostname.toLowerCase().endsWith('.remotive.com')
    ),
  );
}

export function filterDiscoveryListings(listings, { query = '', remoteOnly = false } = {}) {
  const searchTerms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return listings.filter((listing) => {
    if (!isValidDiscoveryListing(listing)) return false;
    if (remoteOnly && listing.isRemote !== true) return false;
    const searchableText = [
      listing.title,
      listing.description,
    ].filter((value) => typeof value === 'string').join(' ').toLocaleLowerCase();
    return searchTerms.every((term) => searchableText.includes(term));
  });
}

function searchQuery(query, location) {
  return [query.trim(), location.trim()].filter(Boolean).join(' ');
}

export function createExternalJobSearchLinks(query, location) {
  const keywords = searchQuery(query, location);
  if (!keywords) return [];
  const encoded = encodeURIComponent(keywords);
  const params = new URLSearchParams();
  params.set('keywords', query.trim());
  if (location.trim()) params.set('location', location.trim());
  const indeed = new URLSearchParams();
  indeed.set('q', query.trim());
  if (location.trim()) indeed.set('l', location.trim());
  const naukri = new URLSearchParams();
  naukri.set('k', query.trim());
  if (location.trim()) naukri.set('l', location.trim());

  return [
    { name: 'LinkedIn Jobs', url: `https://www.linkedin.com/jobs/search/?${params.toString()}` },
    { name: 'Naukri', url: `https://www.naukri.com/job-search?${naukri.toString()}` },
    { name: 'Indeed', url: `https://www.indeed.com/jobs?${indeed.toString()}` },
    { name: 'Google Jobs', url: `https://www.google.com/search?ibp=htl;jobs&q=${encoded}` },
  ];
}

function trackerEmploymentType(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toLocaleLowerCase();
  return EMPLOYMENT_TYPES.find((type) => type.toLocaleLowerCase() === normalized) || '';
}

export function createTrackerPrefill(listing) {
  if (!isValidDiscoveryListing(listing)) return null;
  return {
    companyName: listing.company.trim().slice(0, 120),
    jobTitle: listing.title.trim().slice(0, 120),
    jobUrl: listing.url.trim().slice(0, 2048),
    location: (typeof listing.location === 'string' ? listing.location : '').trim().slice(0, 120),
    employmentType: trackerEmploymentType(listing.employmentType),
    status: 'Saved',
    dateApplied: '',
    followUpDate: '',
    description: (typeof listing.description === 'string' ? listing.description : '').trim().slice(0, MAX_DESCRIPTION_LENGTH),
    notes: '',
  };
}

export function formatDiscoveryDate(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

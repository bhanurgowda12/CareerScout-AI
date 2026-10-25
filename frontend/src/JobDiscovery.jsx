import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createExternalJobSearchLinks,
  createTrackerPrefill,
  filterDiscoveryListings,
  formatDiscoveryDate,
  isValidDiscoveryListing,
  MAX_JOB_LOCATION_LENGTH,
  MAX_JOB_SEARCH_LENGTH,
} from './jobDiscoveryUtils.js';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

function descriptionPreview(description) {
  if (typeof description !== 'string') return '';
  const normalized = description.replace(/\s+/g, ' ').trim();
  return normalized.length > 420 ? `${normalized.slice(0, 417).trimEnd()}...` : normalized;
}

export function JobDiscovery({ onBack, onAnalyzeJob, onTrackJob }) {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [hasFetched, setHasFetched] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [fetchedAt, setFetchedAt] = useState('');
  const [isCached, setIsCached] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');
  const requestGeneration = useRef(0);
  const activeRequest = useRef(null);

  useEffect(() => () => {
    requestGeneration.current += 1;
    activeRequest.current?.abort();
  }, []);

  const visibleJobs = useMemo(() => filterDiscoveryListings(jobs, { query, remoteOnly }), [jobs, query, remoteOnly]);
  const externalSearchLinks = useMemo(() => createExternalJobSearchLinks(query, location), [query, location]);

  async function searchJobs(event) {
    event.preventDefault();
    if (loading) return;
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setValidationError('Enter a job title or keyword to search.');
      setError('');
      return;
    }
    if (trimmedQuery.length > MAX_JOB_SEARCH_LENGTH || location.trim().length > MAX_JOB_LOCATION_LENGTH) {
      setValidationError('Review the search terms and location length, then try again.');
      setError('');
      return;
    }

    setValidationError('');
    setError('');
    setHasSearched(true);
    const generation = requestGeneration.current + 1;
    requestGeneration.current = generation;
    const controller = new AbortController();
    activeRequest.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 12000);
    setLoading(true);
    try {
      const searchParams = new URLSearchParams({ query: trimmedQuery, limit: '50' });
      const response = await fetch(`${API_BASE_URL}/api/job-discovery?${searchParams}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new Error('The job service returned an invalid response.');
      }
      if (!response.ok) {
        throw new Error(typeof payload?.detail === 'string'
          ? payload.detail
          : 'Remote job listings are temporarily unavailable. Please try again later.');
      }
      if (!Array.isArray(payload?.jobs) || payload?.source !== 'Remotive') {
        throw new Error('The job service returned an invalid response.');
      }
      if (requestGeneration.current !== generation) return;
      setJobs(payload.jobs.filter(isValidDiscoveryListing));
      setFetchedAt(typeof payload.fetchedAt === 'string' ? payload.fetchedAt : '');
      setIsCached(payload.cached === true);
      setHasFetched(true);
    } catch (requestError) {
      if (requestGeneration.current !== generation) return;
      setError(requestError?.name === 'AbortError'
        ? 'Remote job listings took too long to load. Check your connection and try again.'
        : requestError instanceof Error
          ? requestError.message
          : 'Remote job listings are temporarily unavailable. Please try again later.');
    } finally {
      window.clearTimeout(timeoutId);
      if (requestGeneration.current === generation) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }

  function analyzeListing(listing) {
    onAnalyzeJob?.(listing);
  }

  function trackListing(listing) {
    const prefill = createTrackerPrefill(listing);
    if (prefill) onTrackJob?.(prefill);
  }

  return (
    <section className="job-discovery-page" aria-labelledby="job-discovery-title">
      <header className="job-discovery-header">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot" /> Find your next step</p>
          <h1 id="job-discovery-title">Discover Your Next Opportunity</h1>
          <p>Explore job opportunities, check your skills against job requirements, and organize your search.</p>
        </div>
        {onBack && <button className="button button-secondary" type="button" onClick={onBack}>Back to Dashboard</button>}
      </header>

      <form className="job-discovery-search" onSubmit={searchJobs} noValidate>
        <div className="job-discovery-search-fields">
          <label className="form-field" htmlFor="job-discovery-query">
            <span>Job title or keyword</span>
            <input
              id="job-discovery-query"
              type="search"
              value={query}
              maxLength={MAX_JOB_SEARCH_LENGTH}
              onChange={(event) => {
                setQuery(event.target.value);
                setValidationError('');
              }}
              placeholder="e.g. frontend developer"
              aria-invalid={Boolean(validationError)}
              aria-describedby={validationError ? 'job-discovery-validation-error' : undefined}
            />
          </label>
          <label className="form-field" htmlFor="job-discovery-location">
            <span>Location <small>(for external job boards)</small></span>
            <input
              id="job-discovery-location"
              type="search"
              value={location}
              maxLength={MAX_JOB_LOCATION_LENGTH}
              onChange={(event) => {
                setLocation(event.target.value);
                setValidationError('');
              }}
              placeholder="e.g. Bengaluru"
            />
          </label>
          <label className="job-discovery-remote" htmlFor="job-discovery-remote">
            <input
              id="job-discovery-remote"
              type="checkbox"
              checked={remoteOnly}
              onChange={(event) => setRemoteOnly(event.target.checked)}
            />
            <span>Remote roles only</span>
          </label>
          <button className="button button-primary job-discovery-submit" type="submit" disabled={loading} aria-busy={loading}>
            {loading ? 'Searching...' : 'Search jobs'}
          </button>
        </div>
        {validationError && <p className="job-discovery-error" id="job-discovery-validation-error" role="alert">{validationError}</p>}
      </form>

      <aside className="job-discovery-source-note">
        <p><strong>Remote listings:</strong> Results are genuine listings from <a href="https://remotive.com/remote-jobs" target="_blank" rel="noopener noreferrer">Remotive</a>. Provider data is cached to respect its request guidance and listings may be delayed by up to 24 hours. Local role searches are not represented as Remotive results.</p>
      </aside>

      {loading && <div className="job-discovery-state" role="status"><span className="recommendation-spinner" aria-hidden="true" /><p>Loading remote job listings...</p></div>}
      {error && !loading && <div className="job-discovery-state job-discovery-state--error" role="alert"><p>{error}</p><button className="button button-secondary" type="button" onClick={searchJobs}>Try again</button></div>}

      {!loading && !error && !hasSearched && (
        <div className="job-discovery-state"><h2>Start with a role or skill</h2><p>Search cached remote listings, or open a location-specific search on an external job board.</p></div>
      )}

      {!loading && hasSearched && hasFetched && visibleJobs.length === 0 && !error && (
        <div className="job-discovery-state" role="status">
          <h2>No matching Remotive listings</h2>
          <p>Try a broader title or switch off “Remote roles only”. For local opportunities, use the external job-board searches below.</p>
        </div>
      )}

      {!loading && hasSearched && visibleJobs.length > 0 && (
        <section className="job-discovery-results" aria-labelledby="job-discovery-results-title" aria-live="polite">
          <div className="job-discovery-results-heading">
            <div>
              <p className="eyebrow">Remotive remote listings</p>
              <h2 id="job-discovery-results-title">{visibleJobs.length} {visibleJobs.length === 1 ? 'opportunity' : 'opportunities'}</h2>
            </div>
            {fetchedAt && <p className="job-discovery-updated">{isCached ? 'Cached results' : 'Provider data fetched'} · {formatDiscoveryDate(fetchedAt)}</p>}
          </div>
          <ul className="job-discovery-list">
            {visibleJobs.map((job) => {
              const publishedDate = formatDiscoveryDate(job.publicationDate);
              return (
                <li className="job-discovery-card" key={job.id || job.url}>
                  <article>
                    <header>
                      <div className="job-discovery-card-title">
                        <p>{job.company}</p>
                        <h3>{job.title}</h3>
                      </div>
                      <span className="job-discovery-badge">Remotive · Remote</span>
                    </header>
                    <dl>
                      {job.location && <div><dt>Location</dt><dd>{job.location}</dd></div>}
                      {job.employmentType && <div><dt>Employment</dt><dd>{job.employmentType}</dd></div>}
                      {publishedDate && <div><dt>Published</dt><dd><time dateTime={job.publicationDate}>{publishedDate}</time></dd></div>}
                    </dl>
                    {descriptionPreview(job.description) && <p className="job-discovery-description">{descriptionPreview(job.description)}</p>}
                    {job.category && <p className="job-discovery-category">{job.category}</p>}
                    <footer>
                      <a className="small-action" href={job.url} target="_blank" rel="noopener noreferrer">View original posting <span aria-hidden="true">↗</span></a>
                      <button className="small-action" type="button" onClick={() => analyzeListing(job)}>Check job match</button>
                      <button className="small-action" type="button" onClick={() => trackListing(job)}>Prepare tracker entry</button>
                    </footer>
                  </article>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {externalSearchLinks.length > 0 && (
        <section className="job-discovery-external" aria-labelledby="job-discovery-external-title">
          <div>
            <p className="eyebrow">Location-specific options</p>
            <h2 id="job-discovery-external-title">Search external job boards</h2>
            <p>These links open third-party search results for your terms and location. CareerScout AI does not scrape or present their listings.</p>
          </div>
          <ul>
            {externalSearchLinks.map((link) => (
              <li key={link.name}><a href={link.url} target="_blank" rel="noopener noreferrer">{link.name}<span aria-hidden="true">↗</span></a></li>
            ))}
          </ul>
        </section>
      )}

      <p className="job-discovery-attribution">Job listing data provided by <a href="https://remotive.com/remote-jobs" target="_blank" rel="noopener noreferrer">Remotive</a>. Always confirm job details and availability with the original source.</p>
    </section>
  );
}

export default JobDiscovery;

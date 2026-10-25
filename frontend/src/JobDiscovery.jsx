import React, { useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { auth, firestore } from './firebase.js';
import {
  createExternalJobSearchLinks,
  createExternalCompanySearchLink,
  createJobPreparationRoadmap,
  createTrackerPrefill,
  filterAndSortDiscoveryListings,
  formatDiscoveryDate,
  getAllJobRoles,
  getExperienceClassification,
  getLocationMatch,
  getRoleSearchTerms,
  groupListingsByCompany,
  isValidDiscoveryListing,
  JOB_CATEGORIES,
  MAX_JOB_LOCATION_LENGTH,
  MAX_JOB_SEARCH_LENGTH,
  summarizeCompanyListings,
  WORK_MODES,
  EXPERIENCE_FILTERS,
  EMPLOYMENT_FILTERS,
} from './jobDiscoveryUtils.js';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

function descriptionPreview(description) {
  if (typeof description !== 'string') return '';
  const normalized = description.replace(/\s+/g, ' ').trim();
  return normalized.length > 420 ? `${normalized.slice(0, 417).trimEnd()}...` : normalized;
}

function verifiedUser(user) {
  return Boolean(user?.uid && (
    user.emailVerified
    || user.providerData?.some((provider) => provider.providerId === 'google.com')
  ));
}

export function JobDiscovery({
  user,
  onBack,
  onAnalyzeJob,
  onTrackJob,
  onContinueLearning,
}) {
  const [searchMode, setSearchMode] = useState('jobs');
  const [query, setQuery] = useState('');
  const [companyQuery, setCompanyQuery] = useState('');
  const [location, setLocation] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [role, setRole] = useState('');
  const [workMode, setWorkMode] = useState('Any work mode');
  const [experience, setExperience] = useState('All opportunities');
  const [employment, setEmployment] = useState('Any employment');
  const [company, setCompany] = useState('');
  const [sortBy, setSortBy] = useState('relevance');
  const [groupByCompany, setGroupByCompany] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [hasFetched, setHasFetched] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [fetchedAt, setFetchedAt] = useState('');
  const [isCached, setIsCached] = useState(false);
  const [sources, setSources] = useState([]);
  const [providerStatuses, setProviderStatuses] = useState([]);
  const [providerErrors, setProviderErrors] = useState([]);
  const [companyProfile, setCompanyProfile] = useState(null);
  const [companyStatus, setCompanyStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [profile, setProfile] = useState(null);
  const [profileState, setProfileState] = useState('loading');
  const [profileError, setProfileError] = useState('');
  const [comparisonJob, setComparisonJob] = useState('');
  const [roadmapJob, setRoadmapJob] = useState('');
  const [roadmapWeeks, setRoadmapWeeks] = useState(4);
  const [completedTasks, setCompletedTasks] = useState({});
  const requestGeneration = useRef(0);
  const activeRequest = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const uid = user?.uid || '';
    setProfile(null);
    setProfileError('');
    setProfileState('loading');

    if (!firestore || !verifiedUser(user) || !uid || auth?.currentUser?.uid !== uid) {
      setProfileState('unavailable');
      setProfileError('Your saved profile is unavailable for comparison. Sign in with your verified account and try again.');
      return () => { cancelled = true; };
    }

    getDoc(doc(firestore, 'users', uid, 'profile', 'profile'))
      .then((snapshot) => {
        if (cancelled || auth?.currentUser?.uid !== uid) return;
        setProfile(snapshot.exists() ? snapshot.data() : {});
        setProfileState('ready');
      })
      .catch(() => {
        if (!cancelled && auth?.currentUser?.uid === uid) {
          setProfileState('error');
          setProfileError('Your saved profile could not be loaded. Job results are still available, but comparison and personalized roadmaps are disabled.');
        }
      });
    return () => { cancelled = true; };
  }, [user?.uid, user?.emailVerified]);

  useEffect(() => () => {
    requestGeneration.current += 1;
    activeRequest.current?.abort();
  }, []);

  const roleOptions = useMemo(() => {
    const roles = getAllJobRoles();
    return selectedCategories.length
      ? roles.filter((item) => selectedCategories.includes(item.categoryId))
      : roles;
  }, [selectedCategories]);

  const listingQuery = query.trim();
  const visibleJobs = useMemo(() => filterAndSortDiscoveryListings(jobs, {
    query: listingQuery,
    categories: selectedCategories,
    role,
    workMode,
    experience,
    employment,
    company: searchMode === 'company' ? companyQuery : company,
    location,
    sortBy,
  }), [jobs, listingQuery, selectedCategories, role, workMode, experience, employment, company, companyQuery, searchMode, location, sortBy]);

  const selectedCategoryText = selectedCategories
    .map((id) => JOB_CATEGORIES.find((categoryItem) => categoryItem.id === id)?.label)
    .filter(Boolean)
    .join(' ');
  const externalSearchTerm = [role || selectedCategoryText, listingQuery].filter(Boolean).join(' ')
    || (location.trim() ? 'jobs' : '');
  const externalSearchLinks = useMemo(
    () => createExternalJobSearchLinks(externalSearchTerm, location),
    [externalSearchTerm, location],
  );
  const companySummary = useMemo(() => summarizeCompanyListings(visibleJobs), [visibleJobs]);
  const externalCompanySearch = createExternalCompanySearchLink(companyQuery);
  const locationSections = location.trim()
    ? [
      {
        key: 'local',
        title: `Listings with source-confirmed locations matching ${location.trim()}`,
        listings: visibleJobs.filter((job) => getLocationMatch(job, location) === 'local'),
      },
      {
        key: 'remote-global',
        title: 'Remote worldwide listings',
        listings: visibleJobs.filter((job) => getLocationMatch(job, location) === 'remote-global'),
      },
      {
        key: 'remote-unspecified',
        title: 'Remote listings with no location stated',
        listings: visibleJobs.filter((job) => getLocationMatch(job, location) === 'remote-unspecified'),
      },
    ]
    : [{ key: 'all', title: '', listings: visibleJobs }];

  async function searchJobs(event) {
    event.preventDefault();
    if (loading) return;
    const trimmedQuery = query.trim();
    if ((searchMode === 'company' && !companyQuery.trim())
      || trimmedQuery.length > MAX_JOB_SEARCH_LENGTH
      || role.trim().length > MAX_JOB_SEARCH_LENGTH
      || location.trim().length > MAX_JOB_LOCATION_LENGTH
      || companyQuery.trim().length > MAX_JOB_LOCATION_LENGTH) {
      setValidationError(searchMode === 'company' && !companyQuery.trim()
        ? 'Enter a company name to explore its available listings.'
        : 'Review the search terms, company name, and location length, then try again.');
      setError('');
      return;
    }

    setValidationError('');
    setError('');
    setHasSearched(true);
    setHasFetched(false);
    setJobs([]);
    setProviderErrors([]);
    setProviderStatuses([]);
    setCompanyProfile(null);
    const generation = requestGeneration.current + 1;
    requestGeneration.current = generation;
    const controller = new AbortController();
    activeRequest.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 12000);
    setLoading(true);
    try {
      const searchParams = new URLSearchParams({ limit: '500', mode: searchMode });
      if (trimmedQuery) searchParams.set('query', trimmedQuery);
      if (searchMode === 'company') searchParams.set('company', companyQuery.trim());
      if (location.trim()) searchParams.set('location', location.trim());
      if (workMode !== 'Any work mode') searchParams.set('workMode', workMode);
      if (employment !== 'Any employment') searchParams.set('employmentType', employment);
      if (experience !== 'All opportunities') searchParams.set('experience', experience);
      const roleSearchTerms = role ? getRoleSearchTerms(role) : [];
      [...new Set(roleSearchTerms)].forEach((term) => searchParams.append('roleTerms', term));
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
        if (payload?.detail && typeof payload.detail === 'object') {
          setProviderStatuses(Array.isArray(payload.detail.providerStatus) ? payload.detail.providerStatus : []);
          setProviderErrors(Array.isArray(payload.detail.providerErrors) ? payload.detail.providerErrors : []);
          setHasFetched(true);
        }
        throw new Error(typeof payload?.detail === 'string'
          ? payload.detail
          : typeof payload?.detail?.message === 'string'
            ? payload.detail.message
            : 'Remote job listings are temporarily unavailable. Please try again later.');
      }
      if (!Array.isArray(payload?.jobs)
        || (typeof payload?.source !== 'string' && !Array.isArray(payload?.sources))) {
        throw new Error('The job service returned an invalid response.');
      }
      if (requestGeneration.current !== generation) return;
      setJobs(payload.jobs.filter(isValidDiscoveryListing));
      setFetchedAt(typeof payload.fetchedAt === 'string' ? payload.fetchedAt : '');
      setIsCached(payload.cached === true);
      setSources(Array.isArray(payload.sources) ? payload.sources : [payload.source].filter(Boolean));
      setProviderStatuses(Array.isArray(payload.providerStatus) ? payload.providerStatus : []);
      setProviderErrors(Array.isArray(payload.providerErrors)
        ? payload.providerErrors.filter((item) => typeof item === 'string')
        : []);
      setCompanyProfile(payload.company && typeof payload.company === 'object' ? payload.company : null);
      setCompanyStatus(typeof payload.companyStatus === 'string' ? payload.companyStatus : '');
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

  function toggleCategory(categoryId) {
    setSelectedCategories((current) => {
      const next = current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId];
      if (role && next.length
        && !getAllJobRoles().some((item) => item.title === role && next.includes(item.categoryId))) {
        setRole('');
      }
      return next;
    });
  }

  function analyzeListing(listing) {
    onAnalyzeJob?.(listing);
  }

  function trackListing(listing) {
    const prefill = createTrackerPrefill(listing);
    if (prefill) {
      onTrackJob?.(prefill);
    }
  }

  function toggleTask(listing, taskId) {
    const key = `${listing.id || listing.url}:${taskId}`;
    setCompletedTasks((current) => ({ ...current, [key]: !current[key] }));
  }

  function renderListing(job) {
    const publishedDate = formatDiscoveryDate(job.publicationDate);
    const comparison = profileState === 'ready' && comparisonJob === (job.id || job.url)
      ? createJobPreparationRoadmap(job, profile || {}, roadmapWeeks).requirements
      : null;
    const roadmap = profileState === 'ready' && roadmapJob === (job.id || job.url)
      ? createJobPreparationRoadmap(job, profile || {}, roadmapWeeks)
      : null;
    const jobKey = job.id || job.url;
    return (
      <li className="job-discovery-card" key={jobKey}>
        <article>
          <header>
            <div className="job-discovery-card-title">
              <p>{job.company}</p>
              <h3>{job.title}</h3>
            </div>
            <span className="job-discovery-badge">{job.sourceLabel || job.source || 'Provider source'}</span>
          </header>
          <dl>
            <div><dt>Location</dt><dd>{job.location || 'Not provided by source'}</dd></div>
            <div><dt>Work mode</dt><dd>{job.workMode || 'Not provided by source'}</dd></div>
            <div><dt>Experience</dt><dd>{job.experienceLevel || (
              getExperienceClassification(job) === 'Not stated'
                ? 'Not stated by source'
                : `${getExperienceClassification(job)} (inferred from title or type)`
            )}</dd></div>
            <div><dt>Employment</dt><dd>{job.employmentType || 'Not provided by source'}</dd></div>
            <div><dt>Salary</dt><dd>{job.salary || 'Not provided by source'}</dd></div>
            <div><dt>Published</dt><dd>{publishedDate
              ? <time dateTime={job.publicationDate}>{publishedDate}</time>
              : 'Not provided by source'}</dd></div>
          </dl>
          {descriptionPreview(job.description) && <p className="job-discovery-description">{descriptionPreview(job.description)}</p>}
          {Array.isArray(job.skills) && job.skills.length > 0 && (
            <p className="job-discovery-category"><strong>Provider tags:</strong> {job.skills.join(', ')}</p>
          )}
          {job.category && <p className="job-discovery-category">{job.category}</p>}
          <footer>
            <a className="small-action" href={job.url} target="_blank" rel="noopener noreferrer">View original posting <span aria-hidden="true">↗</span></a>
            <button className="small-action" type="button" onClick={() => trackListing(job)}>
              Save job in tracker
            </button>
            <button className="small-action" type="button" onClick={() => analyzeListing(job)}>Open AI job analyzer</button>
            <button className="small-action" type="button" disabled={profileState !== 'ready'} onClick={() => setComparisonJob(comparisonJob === jobKey ? '' : jobKey)}>Compare with profile</button>
            <button className="small-action" type="button" disabled={profileState !== 'ready'} onClick={() => setRoadmapJob(roadmapJob === jobKey ? '' : jobKey)}>Prepare for this job</button>
          </footer>
          {comparison && (
            <section className="job-discovery-compare" aria-label={`Profile comparison for ${job.title}`}>
              <h4>Profile evidence comparison</h4>
              {comparison.score === null
                ? <p>No structured skill requirements were available to calculate a score.</p>
                : <p><strong>{comparison.score}%</strong> {comparison.scoreLabel}. This is not a prediction of hiring success.</p>}
              <div>
                <h5>Matched in your profile</h5>
                {comparison.matchedSkills.length
                  ? <ul>{comparison.matchedSkills.map((skill) => <li key={skill}>{skill}</li>)}</ul>
                  : <p>No matching skills were documented in the saved profile.</p>}
              </div>
              <div>
                <h5>Skills not documented in your profile</h5>
                {comparison.needsVerification.length
                  ? <ul>{comparison.needsVerification.map((skill) => <li key={skill}>{skill}</li>)}</ul>
                  : <p>No identified requirements were missing from the saved profile.</p>}
                <p>These are profile gaps, not confirmed skill gaps.</p>
              </div>
              <div>
                <h5>Needs verification</h5>
                <p>Self-assess the skills not listed above and verify the complete requirements with the original employer posting. Descriptions may mention skills that are not mandatory.</p>
              </div>
            </section>
          )}
          {roadmap && (
            <section className="job-discovery-roadmap" aria-label={`Preparation roadmap for ${job.title}`}>
              <div className="job-discovery-roadmap-heading">
                <h4>{roadmap.weeks}-week preparation roadmap</h4>
                <label>
                  Timeline
                  <select value={roadmapWeeks} onChange={(event) => setRoadmapWeeks(Number(event.target.value))}>
                    {[2, 4, 8, 12].map((weeks) => <option key={weeks} value={weeks}>{weeks} weeks</option>)}
                  </select>
                </label>
              </div>
              <p>Based on information in this posting and your saved profile. Suggested exercises are not guarantees of employment.</p>
              <ol>
                {roadmap.tasks.map((task) => {
                  const taskKey = `${jobKey}:${task.id}`;
                  return (
                    <li key={task.id} className={completedTasks[taskKey] ? 'is-complete' : ''}>
                      <label>
                        <input type="checkbox" checked={Boolean(completedTasks[taskKey])} onChange={() => toggleTask(job, task.id)} />
                        <span><strong>Week {task.week}: {task.title}</strong></span>
                      </label>
                      <p>{task.objective}</p>
                      <p><strong>Exercise:</strong> {task.exercise}</p>
                      <p><strong>Milestone:</strong> {task.milestone}</p>
                      <p><strong>Suggested resources:</strong> {task.resources}</p>
                      {task.skill && onContinueLearning && (
                        <button className="small-action" type="button" onClick={() => onContinueLearning(task.skill)}>
                          Explore {task.skill} learning resources
                        </button>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </article>
      </li>
    );
  }

  return (
    <section className="job-discovery-page" aria-labelledby="job-discovery-title">
      <header className="job-discovery-header">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot" /> Find your next step</p>
          <h1 id="job-discovery-title">Discover Your Next Opportunity</h1>
          <p>Search company roles across technology, business, engineering, and early-career opportunities.</p>
        </div>
        {onBack && <button className="button button-secondary" type="button" onClick={onBack}>Back to Dashboard</button>}
      </header>

      <div className="job-discovery-modes" role="group" aria-label="Job discovery mode">
        <button
          className={`job-discovery-mode${searchMode === 'jobs' ? ' is-active' : ''}`}
          type="button"
          aria-pressed={searchMode === 'jobs'}
          onClick={() => {
            setSearchMode('jobs');
            setValidationError('');
          }}
        >
          Find Jobs
        </button>
        <button
          className={`job-discovery-mode${searchMode === 'company' ? ' is-active' : ''}`}
          type="button"
          aria-pressed={searchMode === 'company'}
          onClick={() => {
            setSearchMode('company');
            setValidationError('');
          }}
        >
          Explore a Company
        </button>
      </div>

      <form className="job-discovery-search" onSubmit={searchJobs} noValidate>
        <div className="job-discovery-search-fields">
          {searchMode === 'company' && (
            <label className="form-field" htmlFor="job-discovery-company-name">
              <span>Company name <small>(custom company names supported)</small></span>
              <input
                id="job-discovery-company-name"
                type="search"
                value={companyQuery}
                maxLength={MAX_JOB_LOCATION_LENGTH}
                onChange={(event) => {
                  setCompanyQuery(event.target.value);
                  setValidationError('');
                }}
                placeholder="e.g. Google, Microsoft, or another company"
                aria-invalid={Boolean(validationError)}
                aria-describedby={validationError ? 'job-discovery-validation-error' : undefined}
              />
            </label>
          )}
          <label className="form-field" htmlFor="job-discovery-role">
            <span>Job role <small>(All Job Types by default)</small></span>
            <input
              id="job-discovery-role"
              type="search"
              list="job-discovery-role-options"
              value={role}
              maxLength={MAX_JOB_SEARCH_LENGTH}
              onChange={(event) => setRole(event.target.value)}
              placeholder="Search roles, e.g. Full Stack Developer"
            />
            <datalist id="job-discovery-role-options">
              {roleOptions.map((item) => <option key={`${item.categoryId}:${item.title}`} value={item.title}>{item.categoryLabel}</option>)}
            </datalist>
          </label>
          <label className="form-field" htmlFor="job-discovery-query">
            <span>Custom title or keyword</span>
            <input
              id="job-discovery-query"
              type="search"
              value={query}
              maxLength={MAX_JOB_SEARCH_LENGTH}
              onChange={(event) => {
                setQuery(event.target.value);
                setValidationError('');
              }}
              placeholder="e.g. Python, graduate trainee, product"
              aria-invalid={Boolean(validationError)}
              aria-describedby={validationError ? 'job-discovery-validation-error' : undefined}
            />
          </label>
          <label className="form-field" htmlFor="job-discovery-location">
            <span>City or location <small>(matches when listing location is provided)</small></span>
            <input
              id="job-discovery-location"
              type="search"
              value={location}
              maxLength={MAX_JOB_LOCATION_LENGTH}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="e.g. Bengaluru"
            />
          </label>
          <div className="form-field job-discovery-category-picker">
            <span id="job-discovery-categories-label">Categories <small>(optional; choose one or more)</small></span>
            <details>
              <summary aria-labelledby="job-discovery-categories-label">
                {selectedCategories.length ? `${selectedCategories.length} categories selected` : 'All Job Types'}
              </summary>
              <div className="job-discovery-category-options">
                {JOB_CATEGORIES.map((item) => (
                  <label key={item.id}>
                    <input type="checkbox" checked={selectedCategories.includes(item.id)} onChange={() => toggleCategory(item.id)} />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </details>
          </div>
          <label className="form-field" htmlFor="job-discovery-work-mode">
            <span>Work mode</span>
            <select id="job-discovery-work-mode" value={workMode} onChange={(event) => setWorkMode(event.target.value)}>
              {WORK_MODES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="form-field" htmlFor="job-discovery-experience">
            <span>Opportunity type</span>
            <select id="job-discovery-experience" value={experience} onChange={(event) => setExperience(event.target.value)}>
              {EXPERIENCE_FILTERS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="form-field" htmlFor="job-discovery-employment">
            <span>Employment type</span>
            <select id="job-discovery-employment" value={employment} onChange={(event) => setEmployment(event.target.value)}>
              {EMPLOYMENT_FILTERS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <button className="button button-primary job-discovery-submit" type="submit" disabled={loading} aria-busy={loading}>
            {loading ? 'Searching...' : 'Discover Jobs'}
          </button>
        </div>
        {validationError && <p className="job-discovery-error" id="job-discovery-validation-error" role="alert">{validationError}</p>}
      </form>

      <aside className="job-discovery-source-note">
        <p><strong>Live listings:</strong> CareerScout queries <a href="https://remotive.com/remote-jobs" target="_blank" rel="noopener noreferrer">Remotive</a> and the public <a href="https://jobicy.com/jobs-rss-feed" target="_blank" rel="noopener noreferrer">Jobicy API</a> (remote-focused aggregators). Jobicy results use cursor pagination within a bounded request limit. Public Greenhouse, Lever, and Ashby company boards are searched only when their company board IDs are configured by the backend operator. Results are not a complete inventory of openings. Listings with unstated experience are kept labeled as uncertain rather than assumed entry-level.</p>
      </aside>
      {providerErrors.length > 0 && hasFetched && (
        <div className="job-discovery-partial-note" role="status">
          <strong>Provider coverage note:</strong> Some results may be limited or a provider may be unavailable. {providerErrors.join(' ')}
        </div>
      )}
      {!loading && hasSearched && hasFetched && (
        <aside className="job-discovery-coverage" aria-label="Job source coverage" aria-live="polite">
          <p><strong>{visibleJobs.length}</strong> matching listings returned from <strong>{companySummary.distinctCompanies}</strong> represented companies.</p>
          <p>
            Classification from available listing evidence: {companySummary.internships} internship
            {companySummary.internships === 1 ? '' : 's'}, {companySummary.entryLevel} fresher/entry-level,
            {' '}{companySummary.experienced} experienced, and {companySummary.unknownExperience} with experience not stated.
          </p>
          {location.trim() && (
            <p>
              Location results: {companySummary.localMatches} source-confirmed local,
              {' '}{companySummary.remoteGlobal} remote worldwide,
              {' '}{companySummary.remoteUnspecified} remote with location not stated.
              {' '}A remote-global result is not presented as located in {location.trim()}.
            </p>
          )}
          <ul>
            {providerStatuses.map((provider, index) => (
              <li key={`${provider.name}:${index}`}>
                {provider.name}: {provider.status === 'error' ? 'unavailable' : provider.status === 'empty' ? 'available; no listings returned' : provider.status === 'partial' ? 'partially available' : 'available'}
                {Number.isFinite(provider.listingCount) ? ` · ${provider.listingCount} listings retrieved` : ''}
                    {Number.isFinite(provider.matchedCount) ? ` · ${visibleJobs.filter((job) => job.source === provider.name).length} matching listings shown` : ''}
              </li>
            ))}
          </ul>
          <p>Counts describe provider responses and current filters, not the employers’ complete vacancy inventory.</p>
        </aside>
      )}
      {searchMode === 'company' && companyProfile && hasFetched && (
        <section className="job-discovery-company-profile" aria-labelledby="job-discovery-company-profile-title">
          <div className="job-discovery-results-heading">
            <div>
              <p className="eyebrow">{companyStatus === 'configured' ? 'Configured company profile' : companyStatus === 'careers_link_available' ? 'Verified official careers link' : 'Company search'}</p>
              <h2 id="job-discovery-company-profile-title">{companyProfile.officialName || companyProfile.name}</h2>
            </div>
            {companyProfile.careersUrl && (
              <a className="button button-secondary" href={companyProfile.careersUrl} target="_blank" rel="noopener noreferrer">
                Official careers page <span aria-hidden="true">↗</span>
              </a>
            )}
          </div>
          {companyStatus === 'not_configured' && (
            <p className="job-discovery-company-note">
              No official company profile or company-board integration is configured for this name. Aggregator matches may still appear; CareerScout AI cannot verify the company website or careers page. Use the external careers search below.
            </p>
          )}
          {companyStatus === 'profile_configured' && (
            <p className="job-discovery-company-note">
              Company details are configured by the CareerScout operator, but no Greenhouse, Lever, or Ashby board is connected. Listings may still be returned by aggregators.
            </p>
          )}
          {companyStatus === 'careers_link_available' && (
            <p className="job-discovery-company-note">
              This verified official careers link is available, but no company-board feed is configured. Aggregator matches may appear; this search does not represent the company’s complete vacancy inventory.
            </p>
          )}
          <dl className="job-discovery-company-details">
            {[
              ['Website', companyProfile.website],
              ['Description', companyProfile.description],
              ['Industry', companyProfile.industry],
              ['Headquarters', companyProfile.headquarters],
              ['Office locations', companyProfile.officeLocations?.join(', ')],
              ['Company details source', companyProfile.detailsSource],
              ['Last verified', companyProfile.verifiedAt],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  {label === 'Website' && value
                    ? <a href={value} target="_blank" rel="noopener noreferrer">{value}</a>
                    : value || 'Not available'}
                </dd>
              </div>
            ))}
          </dl>
          {externalCompanySearch && (
            <p className="job-discovery-company-note">
              <a href={externalCompanySearch.url} target="_blank" rel="noopener noreferrer">
                Search {companyQuery.trim()} careers externally (not verified by CareerScout AI) <span aria-hidden="true">↗</span>
              </a>
            </p>
          )}
        </section>
      )}
      {profileError && <p className="job-discovery-profile-note" role="status">{profileError}</p>}
      {profileState === 'loading' && <p className="job-discovery-profile-note" role="status">Loading your saved profile for comparison and personalized roadmaps...</p>}
      {loading && <div className="job-discovery-state" role="status"><span className="recommendation-spinner" aria-hidden="true" /><p>Loading remote job listings...</p></div>}
      {error && !loading && <div className="job-discovery-state job-discovery-state--error" role="alert"><p>{error}</p><button className="button button-secondary" type="button" onClick={searchJobs}>Try again</button></div>}

      {!loading && !error && !hasSearched && (
        <div className="job-discovery-state"><h2>{searchMode === 'company' ? 'Explore company opportunities' : 'Start with any job type'}</h2><p>{searchMode === 'company' ? 'Enter a company name to search configured public company boards and aggregator listings, when available.' : 'Choose a category or role, or browse listings from configured providers. No exact job title is required.'}</p></div>
      )}

      {!loading && hasSearched && hasFetched && visibleJobs.length === 0 && !error && (
        <div className="job-discovery-state" role="status">
          {searchMode === 'company' && companyStatus === 'not_configured'
            ? <>
              <h2>No company-board integration is configured</h2>
              <p>No matching listing was returned by configured aggregators. This does not mean the company has no openings. A company-specific Greenhouse, Lever, or Ashby board must be configured before CareerScout can query those official postings.</p>
            </>
            : <>
              <h2>No matching listings returned by the configured sources</h2>
              <p>Try broader filters or use external searches. CareerScout only shows listings returned by configured providers; this is not evidence that no openings exist.</p>
            </>}
        </div>
      )}

      {!loading && hasSearched && visibleJobs.length > 0 && (
        <section className="job-discovery-results" aria-labelledby="job-discovery-results-title" aria-live="polite">
          <div className="job-discovery-results-heading">
            <div>
              <p className="eyebrow">Listings returned by {sources.join(', ') || 'configured sources'}</p>
              <h2 id="job-discovery-results-title">
                {searchMode === 'company'
                  ? `${visibleJobs.length} listings returned for ${companyProfile?.officialName || companyQuery.trim()}`
                  : `${visibleJobs.length} ${visibleJobs.length === 1 ? 'listing' : 'listings'} returned`}
              </h2>
            </div>
            {fetchedAt && <p className="job-discovery-updated">{isCached ? 'Cached results' : 'Provider data fetched'} · {formatDiscoveryDate(fetchedAt)}</p>}
          </div>
          <p className="job-discovery-results-note">
            Counts describe listings retrieved from the listed sources, not all current openings.
              {companySummary.unknownExperience > 0
                ? ` Experience level was not supplied for ${companySummary.unknownExperience} returned ${companySummary.unknownExperience === 1 ? 'listing' : 'listings'}; these remain labeled as not stated.`
              : ''}
          </p>
          <div className="job-discovery-result-tools">
            {searchMode === 'jobs' && (
              <label className="form-field" htmlFor="job-discovery-company">
                <span>Filter by company</span>
                <input id="job-discovery-company" type="search" value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Company name" />
              </label>
            )}
            <label className="form-field" htmlFor="job-discovery-sort">
              <span>Sort by</span>
              <select id="job-discovery-sort" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="relevance">Provider order</option>
                <option value="newest">Newest</option>
                <option value="company">Company</option>
                <option value="title">Job title</option>
              </select>
            </label>
            <label className="job-discovery-group-toggle">
              <input type="checkbox" checked={groupByCompany} onChange={(event) => setGroupByCompany(event.target.checked)} />
              <span>Group by company</span>
            </label>
          </div>
          {locationSections.map((locationSection) => {
            const groups = groupByCompany
              ? Object.entries(groupListingsByCompany(locationSection.listings))
              : [['', locationSection.listings]];
            return locationSection.listings.length > 0 && (
              <section className="job-discovery-location-group" key={locationSection.key}>
                {locationSection.title && <h3>{locationSection.title} <span>({locationSection.listings.length})</span></h3>}
                {groups.map(([companyName, listings]) => (
                  <section className="job-discovery-company-group" key={`${locationSection.key}:${companyName || 'all-listings'}`}>
                    {companyName && <h4>{companyName} <span>({listings.length})</span></h4>}
                    <ul className="job-discovery-list">{listings.map(renderListing)}</ul>
                  </section>
                ))}
              </section>
            );
          })}
        </section>
      )}

      {externalSearchLinks.length > 0 && (
        <section className="job-discovery-external" aria-labelledby="job-discovery-external-title">
          <div>
            <p className="eyebrow">Location-specific options</p>
            <h2 id="job-discovery-external-title">Search external job boards</h2>
            <p>These open third-party search results for your selected role or terms and location. CareerScout AI does not scrape or present their listings.</p>
          </div>
          <ul>
            {externalSearchLinks.map((link) => (
              <li key={link.name}><a href={link.url} target="_blank" rel="noopener noreferrer">{link.name}<span aria-hidden="true">↗</span></a></li>
            ))}
          </ul>
        </section>
      )}

      <p className="job-discovery-attribution">Listing data is attributed to its provider. {sources.includes('Remotive') && <><a href="https://remotive.com/remote-jobs" target="_blank" rel="noopener noreferrer">Remotive</a>{sources.includes('Jobicy') ? ' and ' : '. '}</>}{sources.includes('Jobicy') && <a href="https://jobicy.com/jobs-rss-feed" target="_blank" rel="noopener noreferrer">Jobicy</a>}. Always confirm details and availability with the original listing.</p>
    </section>
  );
}

export default JobDiscovery;

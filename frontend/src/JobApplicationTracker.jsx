import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, firestore } from './firebase.js';
import {
  APPLICATION_STATUSES,
  EMPLOYMENT_TYPES,
  MAX_DESCRIPTION_LENGTH,
  MAX_NOTES_LENGTH,
  filterApplications,
  getApplicationSummary,
  getFollowUpState,
  isValidHttpUrl,
  sortApplications,
  validateApplicationFields,
} from './jobApplicationUtils.js';

const emptyForm = {
  companyName: '',
  jobTitle: '',
  jobUrl: '',
  location: '',
  employmentType: '',
  status: 'Saved',
  dateApplied: '',
  followUpDate: '',
  description: '',
  notes: '',
};

function canUseTracker(user) {
  return Boolean(user?.uid && (
    user.emailVerified
    || user.providerData?.some((provider) => provider.providerId === 'google.com')
  ));
}

function getStorageError(error, action = 'load') {
  if (error?.code === 'permission-denied') {
    return 'Firestore denied access to job applications. The deployed security rules must allow verified users to access only their own users/{uid}/jobApplications records.';
  }
  if (error?.code === 'unauthenticated') return 'Your sign-in expired. Sign in again, then retry.';
  if (['unavailable', 'network-request-failed', 'deadline-exceeded'].includes(error?.code)) {
    return 'Firestore is unavailable right now. Check your connection and try again.';
  }
  return action === 'load'
    ? 'Your job applications could not be loaded. Check your connection and try again.'
    : 'Your change could not be saved. Check your connection and try again.';
}

function formatDate(value) {
  let date;
  if (value && typeof value.toDate === 'function') date = value.toDate();
  else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    date = new Date(year, month - 1, day);
  } else date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function formFromApplication(application) {
  return Object.fromEntries(Object.keys(emptyForm).map((key) => [key, application[key] || '']));
}

export function JobApplicationTracker({ user, onBack }) {
  const [applications, setApplications] = useState([]);
  const [requestUid, setRequestUid] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [actionError, setActionError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const submitPending = useRef(null);
  const currentUid = user?.uid || '';
  const currentUidRef = useRef(currentUid);
  currentUidRef.current = currentUid;
  const verifiedUser = canUseTracker(user);

  function isCurrentOwner(uid) {
    return Boolean(uid && currentUidRef.current === uid && auth?.currentUser?.uid === uid);
  }

  useEffect(() => {
    let cancelled = false;
    const uid = currentUid;
    setRequestUid(uid);
    setApplications([]);
    setLoadError('');
    setLoading(true);
    setFormOpen(false);
    setEditingId('');
    setForm(emptyForm);
    setActionError('');
    setFieldErrors({});
    setFormError('');
    setSearchText('');
    setStatusFilter('All');
    setSortBy('newest');
    submitPending.current = null;
    setSaving(false);
    setDeletingId('');

    if (!firestore) {
      setLoadError('Firebase is not configured, so job applications cannot be loaded.');
      setLoading(false);
      return () => { cancelled = true; };
    }
    if (!verifiedUser || !uid || auth?.currentUser?.uid !== uid) {
      setLoadError('Sign in with a verified account to access your job applications.');
      setLoading(false);
      return () => { cancelled = true; };
    }

    getDocs(collection(firestore, 'users', uid, 'jobApplications'))
      .then((snapshot) => {
        if (cancelled || !isCurrentOwner(uid)) return;
        setApplications(snapshot.docs.map((application) => {
          const data = application.data();
          return {
            id: application.id,
            ...data,
            companyName: typeof data.companyName === 'string' ? data.companyName : '',
            jobTitle: typeof data.jobTitle === 'string' ? data.jobTitle : '',
            jobUrl: typeof data.jobUrl === 'string' ? data.jobUrl : '',
            location: typeof data.location === 'string' ? data.location : '',
            employmentType: typeof data.employmentType === 'string' ? data.employmentType : '',
            status: APPLICATION_STATUSES.includes(data.status) ? data.status : '',
            dateApplied: typeof data.dateApplied === 'string' ? data.dateApplied : '',
            followUpDate: typeof data.followUpDate === 'string' ? data.followUpDate : '',
            description: typeof data.description === 'string' ? data.description : '',
            notes: typeof data.notes === 'string' ? data.notes : '',
          };
        }));
      })
      .catch((error) => {
        if (!cancelled && isCurrentOwner(uid)) setLoadError(getStorageError(error));
      })
      .finally(() => {
        if (!cancelled && isCurrentOwner(uid)) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [currentUid, verifiedUser, loadAttempt]);

  const summary = useMemo(() => getApplicationSummary(applications), [applications]);
  const visibleApplications = useMemo(() => sortApplications(
    filterApplications(applications, searchText, statusFilter),
    sortBy,
  ), [applications, searchText, statusFilter, sortBy]);

  function openNewForm() {
    setForm(emptyForm);
    setEditingId('');
    setFieldErrors({});
    setFormError('');
    setActionError('');
    setFormOpen(true);
  }

  function cancelForm() {
    setFormOpen(false);
    setEditingId('');
    setForm(emptyForm);
    setFieldErrors({});
    setFormError('');
  }

  function editApplication(application) {
    setForm(formFromApplication(application));
    setEditingId(application.id);
    setFieldErrors({});
    setFormError('');
    setActionError('');
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
    setFormError('');
  }

  async function saveApplication(event) {
    event.preventDefault();
    if (submitPending.current) return;
    const errors = validateApplicationFields(form);
    setFieldErrors(errors);
    setFormError('');
    setActionError('');
    if (Object.keys(errors).length) {
      setFormError('Review the highlighted fields and try again.');
      return;
    }

    const uid = currentUid;
    if (!firestore || !verifiedUser || !isCurrentOwner(uid)) {
      setFormError('Your verified sign-in could not be confirmed. Sign in again, then retry.');
      return;
    }

    const submissionToken = {};
    submitPending.current = submissionToken;
    setSaving(true);
    const values = {
      ...form,
      companyName: form.companyName.trim(),
      jobTitle: form.jobTitle.trim(),
      jobUrl: form.jobUrl.trim(),
      location: form.location.trim(),
      description: form.description.trim(),
      notes: form.notes.trim(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(firestore, 'users', uid, 'jobApplications', editingId), values);
        if (isCurrentOwner(uid)) {
          setApplications((current) => current.map((application) => (
            application.id === editingId ? { ...application, ...values } : application
          )));
          cancelForm();
        }
      } else {
        const saved = await addDoc(collection(firestore, 'users', uid, 'jobApplications'), {
          ...values,
          dateSaved: Timestamp.now(),
        });
        if (isCurrentOwner(uid)) {
          setApplications((current) => [...current, { id: saved.id, ...values, dateSaved: Timestamp.now() }]);
          cancelForm();
        }
      }
    } catch (error) {
      if (isCurrentOwner(uid)) setFormError(getStorageError(error, 'save'));
    } finally {
      if (submitPending.current === submissionToken) {
        submitPending.current = null;
        if (isCurrentOwner(uid)) setSaving(false);
      }
    }
  }

  async function deleteApplication(application) {
    if (!window.confirm(`Delete ${application.jobTitle} at ${application.companyName}? This cannot be undone.`)) return;
    const uid = currentUid;
    if (!firestore || !verifiedUser || !isCurrentOwner(uid)) {
      setActionError('Your verified sign-in could not be confirmed. Sign in again, then retry.');
      return;
    }

    setDeletingId(application.id);
    setActionError('');
    try {
      await deleteDoc(doc(firestore, 'users', uid, 'jobApplications', application.id));
      if (isCurrentOwner(uid)) {
        setApplications((current) => current.filter((entry) => entry.id !== application.id));
        if (editingId === application.id) cancelForm();
      }
    } catch (error) {
      if (isCurrentOwner(uid)) setActionError(getStorageError(error, 'save'));
    } finally {
      if (isCurrentOwner(uid)) setDeletingId('');
    }
  }

  if (loading || requestUid !== currentUid) {
    return <section className="job-tracker-page job-tracker-state" role="status"><span className="recommendation-spinner" aria-hidden="true" /><p>Loading your job applications...</p></section>;
  }

  if (loadError) {
    return (
      <section className="job-tracker-page job-tracker-state" role="alert">
        <h1>Job Application Tracker</h1>
        <p>{loadError}</p>
        {verifiedUser && firestore && <button className="button button-secondary" type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</button>}
        {onBack && <button className="button button-secondary" type="button" onClick={onBack}>Back to Student Dashboard</button>}
      </section>
    );
  }

  return (
    <section className="job-tracker-page" aria-labelledby="job-tracker-title">
      <header className="job-tracker-header">
        <div className="job-tracker-intro">
          <p className="eyebrow"><span className="eyebrow-dot" /> Your next opportunity</p>
          <h1 id="job-tracker-title">Job Application Tracker</h1>
          <p>Keep your job search organized, track application progress, and stay on top of follow-ups.</p>
        </div>
        <div className="job-tracker-header-actions">
          {onBack && <button className="button button-secondary" type="button" onClick={onBack}>Back to Student Dashboard</button>}
          {!formOpen && <button className="button button-primary" type="button" onClick={openNewForm}>Add application <span aria-hidden="true">+</span></button>}
        </div>
      </header>

      <section className="job-tracker-summary" aria-label="Application summary">
        <article><span>Total tracked jobs</span><strong>{summary.total}</strong></article>
        <article><span>Applications submitted</span><strong>{summary.submitted}</strong><small>Applied or later status</small></article>
        <article><span>Interviews in progress</span><strong>{summary.interviews}</strong></article>
        <article><span>Offers received</span><strong>{summary.offers}</strong></article>
      </section>

      {formOpen && (
        <form className="job-tracker-form" onSubmit={saveApplication} noValidate aria-labelledby="job-tracker-form-title">
          <div className="job-tracker-section-heading">
            <div><p className="eyebrow">{editingId ? 'Update your records' : 'A new opportunity'}</p><h2 id="job-tracker-form-title">{editingId ? 'Edit application' : 'Add an application'}</h2></div>
            <p>Fields marked required must be completed.</p>
          </div>
          <div className="form-grid form-grid-two">
            <div className={`form-field${fieldErrors.companyName ? ' form-field--error' : ''}`}>
              <label htmlFor="job-tracker-company">Company name <span aria-hidden="true">*</span></label>
              <input id="job-tracker-company" name="companyName" value={form.companyName} onChange={updateField} maxLength={120} required aria-invalid={Boolean(fieldErrors.companyName)} aria-describedby={fieldErrors.companyName ? 'job-tracker-company-error' : undefined} />
              {fieldErrors.companyName && <span className="field-error" id="job-tracker-company-error">{fieldErrors.companyName}</span>}
            </div>
            <div className={`form-field${fieldErrors.jobTitle ? ' form-field--error' : ''}`}>
              <label htmlFor="job-tracker-title-input">Job title <span aria-hidden="true">*</span></label>
              <input id="job-tracker-title-input" name="jobTitle" value={form.jobTitle} onChange={updateField} maxLength={120} required aria-invalid={Boolean(fieldErrors.jobTitle)} aria-describedby={fieldErrors.jobTitle ? 'job-tracker-title-error' : undefined} />
              {fieldErrors.jobTitle && <span className="field-error" id="job-tracker-title-error">{fieldErrors.jobTitle}</span>}
            </div>
            <div className={`form-field${fieldErrors.jobUrl ? ' form-field--error' : ''}`}>
              <label htmlFor="job-tracker-url">Job posting URL <span>(optional)</span></label>
              <input id="job-tracker-url" name="jobUrl" type="url" inputMode="url" value={form.jobUrl} onChange={updateField} maxLength={2048} placeholder="https://example.com/jobs/..." aria-invalid={Boolean(fieldErrors.jobUrl)} aria-describedby={fieldErrors.jobUrl ? 'job-tracker-url-error' : undefined} />
              {fieldErrors.jobUrl && <span className="field-error" id="job-tracker-url-error">{fieldErrors.jobUrl}</span>}
            </div>
            <div className="form-field">
              <label htmlFor="job-tracker-location">Job location <span>(optional)</span></label>
              <input id="job-tracker-location" name="location" value={form.location} onChange={updateField} maxLength={120} placeholder="City, region, or remote" />
            </div>
            <div className={`form-field${fieldErrors.employmentType ? ' form-field--error' : ''}`}>
              <label htmlFor="job-tracker-employment">Employment type <span>(optional)</span></label>
              <select id="job-tracker-employment" name="employmentType" value={form.employmentType} onChange={updateField} aria-invalid={Boolean(fieldErrors.employmentType)} aria-describedby={fieldErrors.employmentType ? 'job-tracker-employment-error' : undefined}>
                <option value="">Select employment type</option>
                {EMPLOYMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              {fieldErrors.employmentType && <span className="field-error" id="job-tracker-employment-error">{fieldErrors.employmentType}</span>}
            </div>
            <div className={`form-field${fieldErrors.status ? ' form-field--error' : ''}`}>
              <label htmlFor="job-tracker-status">Application status <span aria-hidden="true">*</span></label>
              <select id="job-tracker-status" name="status" value={form.status} onChange={updateField} required aria-invalid={Boolean(fieldErrors.status)} aria-describedby={fieldErrors.status ? 'job-tracker-status-error' : undefined}>
                {APPLICATION_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              {fieldErrors.status && <span className="field-error" id="job-tracker-status-error">{fieldErrors.status}</span>}
            </div>
            <div className={`form-field${fieldErrors.dateApplied ? ' form-field--error' : ''}`}>
              <label htmlFor="job-tracker-applied">Date applied <span>(optional)</span></label>
              <input id="job-tracker-applied" type="date" name="dateApplied" value={form.dateApplied} onChange={updateField} aria-invalid={Boolean(fieldErrors.dateApplied)} aria-describedby={fieldErrors.dateApplied ? 'job-tracker-applied-error' : undefined} />
              {fieldErrors.dateApplied && <span className="field-error" id="job-tracker-applied-error">{fieldErrors.dateApplied}</span>}
            </div>
            <div className={`form-field${fieldErrors.followUpDate ? ' form-field--error' : ''}`}>
              <label htmlFor="job-tracker-follow-up">Follow-up date <span>(optional)</span></label>
              <input id="job-tracker-follow-up" type="date" name="followUpDate" value={form.followUpDate} onChange={updateField} aria-invalid={Boolean(fieldErrors.followUpDate)} aria-describedby={fieldErrors.followUpDate ? 'job-tracker-follow-up-error' : undefined} />
              {fieldErrors.followUpDate && <span className="field-error" id="job-tracker-follow-up-error">{fieldErrors.followUpDate}</span>}
            </div>
            <div className={`form-field form-field-wide${fieldErrors.description ? ' form-field--error' : ''}`}>
              <label htmlFor="job-tracker-description">Job description or summary <span>(optional)</span></label>
              <textarea id="job-tracker-description" name="description" value={form.description} onChange={updateField} maxLength={MAX_DESCRIPTION_LENGTH} rows="3" aria-describedby="job-tracker-description-meta" aria-invalid={Boolean(fieldErrors.description)} />
              <div className="job-tracker-field-meta" id="job-tracker-description-meta"><span>{fieldErrors.description || 'A short summary to help you remember the role.'}</span><span>{form.description.length}/{MAX_DESCRIPTION_LENGTH}</span></div>
            </div>
            <div className={`form-field form-field-wide${fieldErrors.notes ? ' form-field--error' : ''}`}>
              <label htmlFor="job-tracker-notes">Personal notes <span>(optional)</span></label>
              <textarea id="job-tracker-notes" name="notes" value={form.notes} onChange={updateField} maxLength={MAX_NOTES_LENGTH} rows="3" aria-describedby="job-tracker-notes-meta" aria-invalid={Boolean(fieldErrors.notes)} />
              <div className="job-tracker-field-meta" id="job-tracker-notes-meta"><span>{fieldErrors.notes || 'Keep your own reminders and application details.'}</span><span>{form.notes.length}/{MAX_NOTES_LENGTH}</span></div>
            </div>
          </div>
          {formError && <p className="job-tracker-error" role="alert">{formError}</p>}
          <div className="job-tracker-form-actions">
            <button className="button button-primary" type="submit" disabled={saving} aria-busy={saving}>{saving ? 'Saving...' : editingId ? 'Save changes' : 'Add application'}</button>
            <button className="button button-secondary" type="button" onClick={cancelForm} disabled={saving}>Cancel</button>
          </div>
        </form>
      )}

      <section className="job-tracker-list-section" aria-labelledby="job-tracker-list-title">
        <div className="job-tracker-section-heading">
          <div><p className="eyebrow">Your opportunities</p><h2 id="job-tracker-list-title">Tracked applications</h2></div>
          <span className="job-tracker-result-count" aria-live="polite">{visibleApplications.length} {visibleApplications.length === 1 ? 'application' : 'applications'}</span>
        </div>
        <div className="job-tracker-controls">
          <label className="form-field" htmlFor="job-tracker-search"><span>Search company or job title</span><input id="job-tracker-search" type="search" value={searchText} onChange={(event) => setSearchText(event.target.value)} /></label>
          <label className="form-field" htmlFor="job-tracker-filter"><span>Filter by status</span><select id="job-tracker-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All</option>{APPLICATION_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label className="form-field" htmlFor="job-tracker-sort"><span>Sort applications</span><select id="job-tracker-sort" value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="newest">Newest saved</option><option value="followUp">Earliest follow-up</option></select></label>
        </div>

        {actionError && <p className="job-tracker-error" role="alert">{actionError}</p>}
        {applications.length === 0 ? (
          <div className="job-tracker-empty"><span aria-hidden="true">↗</span><h3>No applications yet</h3><p>Add your first opportunity to start tracking its progress and follow-up dates.</p><button className="button button-primary" type="button" onClick={openNewForm}>Add your first application</button></div>
        ) : visibleApplications.length === 0 ? (
          <p className="job-tracker-empty job-tracker-no-results" role="status">No applications match your search or status filter. Try changing your filters.</p>
        ) : (
          <ul className="job-tracker-list">
            {visibleApplications.map((application) => {
              const followUpState = getFollowUpState(application.followUpDate);
              const statusLabel = APPLICATION_STATUSES.includes(application.status) ? application.status : 'Status unavailable';
              const statusClass = APPLICATION_STATUSES.includes(application.status) ? application.status.toLocaleLowerCase() : 'unknown';
              return (
                <li className={`job-tracker-card${followUpState === 'overdue' ? ' job-tracker-card--overdue' : followUpState === 'upcoming' ? ' job-tracker-card--upcoming' : ''}`} key={application.id}>
                  <article>
                    <header className="job-tracker-card-header">
                      <div className="job-tracker-card-title"><p>{application.companyName || 'Company unavailable'}</p><h3>{application.jobTitle || 'Job title unavailable'}</h3>{application.location && <span>{application.location}</span>}</div>
                      <span className={`job-tracker-status job-tracker-status--${statusClass}`}>{statusLabel}</span>
                    </header>
                    <dl className="job-tracker-dates">
                      <div><dt>Date saved</dt><dd>{formatDate(application.dateSaved)}</dd></div>
                      {application.dateApplied && <div><dt>Date applied</dt><dd>{formatDate(application.dateApplied)}</dd></div>}
                      {application.employmentType && <div><dt>Employment</dt><dd>{application.employmentType}</dd></div>}
                      {application.followUpDate && <div><dt>Follow-up</dt><dd><time dateTime={application.followUpDate}>{formatDate(application.followUpDate)}</time></dd></div>}
                    </dl>
                    {followUpState !== 'none' && <p className={`job-tracker-follow-up job-tracker-follow-up--${followUpState}`} role="status">{followUpState === 'overdue' ? 'Follow-up overdue' : 'Upcoming follow-up'} — {formatDate(application.followUpDate)}. This is a reminder only; it does not indicate application outcome.</p>}
                    {application.description && <p className="job-tracker-description">{application.description}</p>}
                    {application.notes && <p className="job-tracker-notes"><strong>Your notes</strong>{application.notes}</p>}
                    <footer className="job-tracker-card-actions">
                      {isValidHttpUrl(application.jobUrl) && <a className="small-action" href={application.jobUrl} target="_blank" rel="noopener noreferrer">View job posting <span aria-hidden="true">↗</span></a>}
                      <button className="small-action" type="button" onClick={() => editApplication(application)}>Edit</button>
                      <button className="small-action job-tracker-delete" type="button" onClick={() => deleteApplication(application)} disabled={deletingId === application.id}>{deletingId === application.id ? 'Deleting...' : 'Delete'}</button>
                    </footer>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}

export default JobApplicationTracker;

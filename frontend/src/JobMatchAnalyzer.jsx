import React, { useEffect, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { auth, firestore } from './firebase.js';
import {
  createJobMatchRequestGate,
  extractJobRequirements,
  MAX_JOB_DESCRIPTION_LENGTH,
} from './jobMatchAi.js';
import { compareJobRequirements, validateJobMatchResult } from './jobMatchUtils.js';

const MAX_RESUME_TEXT_LENGTH = 12000;

function canUseProfile(user) {
  return Boolean(user?.uid && (
    user.emailVerified
    || user.providerData?.some((provider) => provider.providerId === 'google.com')
  ));
}

function text(value) {
  return typeof value === 'string' ? value : '';
}

function profileEvidence(profile, resumeText) {
  const source = profile && typeof profile === 'object' ? profile : {};
  const skills = Array.isArray(source.skills)
    ? source.skills.filter((skill) => typeof skill === 'string')
    : [];
  const projects = Array.isArray(source.projects)
    ? source.projects.filter((project) => project && typeof project === 'object' && !Array.isArray(project)).map((project) => ({
      name: text(project.name),
      description: text(project.description),
      technologies: text(project.technologies),
    }))
    : [];
  const certifications = Array.isArray(source.certifications)
    ? source.certifications.filter((certification) => certification && typeof certification === 'object' && !Array.isArray(certification)).map((certification) => ({
      name: text(certification.name),
      issuer: text(certification.issuer),
      description: text(certification.description),
    }))
    : [];

  if (resumeText.trim()) skills.push(resumeText);
  return { skills, projects, certifications };
}

function getProfileLoadError(error) {
  if (error?.code === 'permission-denied') {
    return 'Firestore denied access to your saved profile. Check your account access and try again.';
  }
  if (error?.code === 'unauthenticated') {
    return 'Your sign-in expired. Sign in again, then retry.';
  }
  if (error?.code === 'unavailable' || error?.code === 'network-request-failed') {
    return 'Your saved profile could not be loaded because Firestore is unavailable. Check your connection and retry.';
  }
  return 'Your saved profile could not be loaded. Check your connection and try again.';
}

export function JobMatchAnalyzer({ user, onBack, onContinueLearning, initialJobDescription = '' }) {
  const [profile, setProfile] = useState(null);
  const [profileUid, setProfileUid] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileMissing, setProfileMissing] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileLoadAttempt, setProfileLoadAttempt] = useState(0);
  const [jobDescription, setJobDescription] = useState(() => (
    typeof initialJobDescription === 'string' ? initialJobDescription : ''
  ));
  const [resumeText, setResumeText] = useState('');
  const [formError, setFormError] = useState('');
  const [analysisError, setAnalysisError] = useState('');
  const [analysisProgress, setAnalysisProgress] = useState('');
  const [result, setResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const requestGate = useRef(null);
  if (!requestGate.current) requestGate.current = createJobMatchRequestGate();
  const currentUid = user?.uid || '';
  const previousUid = useRef(currentUid);
  const verifiedUser = canUseProfile(user);
  const profileReady = Boolean(
    currentUid && profileUid === currentUid && profile !== null && !profileLoading && !profileError,
  );

  useEffect(() => {
    let cancelled = false;
    const uid = user?.uid || '';
    requestGate.current.invalidate();
    setAnalyzing(false);
    if (previousUid.current !== uid) {
      setJobDescription('');
      setResumeText('');
      previousUid.current = uid;
    }
    setProfile(null);
    setProfileUid(uid);
    setProfileMissing(false);
    setProfileError('');
    setProfileLoading(true);
    setResult(null);
    setAnalysisError('');
    setAnalysisProgress('');
    setFormError('');

    if (!firestore) {
      setProfileLoading(false);
      setProfileError('Firebase is not configured, so your saved profile cannot be loaded.');
      return () => { cancelled = true; };
    }
    if (!verifiedUser || !uid || auth?.currentUser?.uid !== uid) {
      setProfileLoading(false);
      setProfileError('Sign in with a verified account to use your saved profile for analysis.');
      return () => { cancelled = true; };
    }

    getDoc(doc(firestore, 'users', uid, 'profile', 'profile'))
      .then((snapshot) => {
        if (cancelled || auth?.currentUser?.uid !== uid) return;
        setProfile(snapshot.exists() ? snapshot.data() : {});
        setProfileMissing(!snapshot.exists());
        setProfileUid(uid);
      })
      .catch((error) => {
        if (!cancelled && auth?.currentUser?.uid === uid) setProfileError(getProfileLoadError(error));
      })
      .finally(() => {
        if (!cancelled && auth?.currentUser?.uid === uid) setProfileLoading(false);
      });

    return () => {
      cancelled = true;
      requestGate.current.invalidate();
    };
  }, [user?.uid, verifiedUser, profileLoadAttempt]);

  function clearAnalysisMessages() {
    setResult(null);
    setFormError('');
    setAnalysisError('');
    setAnalysisProgress('');
  }

  async function analyzeJobMatch(event) {
    event.preventDefault();
    if (requestGate.current.isBusy()) return;

    setResult(null);
    setFormError('');
    setAnalysisError('');
    if (!jobDescription.trim()) {
      setFormError('Enter a job description before analyzing.');
      return;
    }
    if (jobDescription.length > MAX_JOB_DESCRIPTION_LENGTH) {
      setFormError(`Job descriptions must be ${MAX_JOB_DESCRIPTION_LENGTH.toLocaleString()} characters or fewer.`);
      return;
    }
    if (resumeText.length > MAX_RESUME_TEXT_LENGTH) {
      setFormError(`Pasted resume text must be ${MAX_RESUME_TEXT_LENGTH.toLocaleString()} characters or fewer.`);
      return;
    }
    if (!profileReady || !verifiedUser || auth?.currentUser?.uid !== currentUid) {
      setAnalysisError(profileError || 'Your saved profile is not ready. Retry loading it before analyzing.');
      return;
    }

    const generation = requestGate.current.begin();
    if (generation === null) return;
    setAnalyzing(true);
    const uid = currentUid;
    let timedOutRequestSettled = false;
    let timeoutReported = false;
    setAnalysisProgress('Extracting job requirements...');
    try {
      const requirements = await extractJobRequirements(jobDescription, {
        onStatus: (status) => {
          if (!requestGate.current.isCurrent(generation) || auth?.currentUser?.uid !== uid) return;
          setAnalysisProgress(status === 'retrying'
            ? 'A temporary AI-service issue occurred. Retrying the extraction...'
            : 'The first model is unavailable. Trying the fallback model...');
        },
        onWorkflowSettled: () => {
          timedOutRequestSettled = true;
          if (!requestGate.current.isCurrent(generation)) return;
          requestGate.current.release(generation);
          if (auth?.currentUser?.uid === uid) {
            setAnalyzing(false);
            setAnalysisProgress('');
          }
        },
      });
      if (!requestGate.current.isCurrent(generation) || auth?.currentUser?.uid !== uid) return;
      const analysis = validateJobMatchResult(
        compareJobRequirements(requirements, profileEvidence(profile, resumeText)),
      );
      if (requestGate.current.isCurrent(generation) && auth?.currentUser?.uid === uid) {
        setResult(analysis);
        setAnalysisProgress('');
      }
    } catch (error) {
      if (!requestGate.current.isCurrent(generation) || auth?.currentUser?.uid !== uid) return;
      timeoutReported = error?.code === 'analysis-timeout' && error?.pendingRequest === true;
      setAnalysisError(error instanceof Error
        ? error.message
        : 'Job requirements could not be extracted. Please try the analysis again.');
      setAnalysisProgress(timeoutReported && !timedOutRequestSettled
        ? 'The timed-out Firebase request is still completing. Another analysis will be available when it finishes.'
        : '');
    } finally {
      if (
        requestGate.current.isCurrent(generation)
        && !(timeoutReported && !timedOutRequestSettled)
      ) {
        requestGate.current.release(generation);
        setAnalyzing(false);
        if (!timeoutReported || timedOutRequestSettled) setAnalysisProgress('');
      }
    }
  }

  function retryProfileLoad() {
    setProfileLoadAttempt((attempt) => attempt + 1);
  }

  const pageIsCurrent = Boolean(currentUid && profileUid === currentUid);

  return (
    <section className="job-match-page recommendations-page" aria-labelledby="job-match-title">
      <header className="job-match-header">
        <div className="job-match-intro">
          <p className="eyebrow"><span className="eyebrow-dot" /> Compare role requirements with your evidence</p>
          <h1 id="job-match-title">AI Job Match <span>Analyzer.</span></h1>
          <p>Review skills named in a job description against your saved profile and any resume text you choose to paste.</p>
        </div>
        {onBack && <button className="button button-secondary job-match-back" type="button" onClick={onBack}>Back to Dashboard</button>}
      </header>

      {!currentUid ? (
        <div className="job-match-state job-match-state--error" role="alert">
          <p>Sign in with a verified account to use the Job Match Analyzer.</p>
        </div>
      ) : !pageIsCurrent || profileLoading ? (
        <div className="job-match-state" role="status">
          <span className="recommendation-spinner" aria-hidden="true" />
          <p>Loading your saved profile...</p>
        </div>
      ) : profileError ? (
        <div className="job-match-state job-match-state--error" role="alert">
          <p>{profileError}</p>
          <button className="button button-secondary" type="button" onClick={retryProfileLoad}>Retry loading profile</button>
        </div>
      ) : (
        <>
          {profileMissing && (
            <p className="job-match-notice" role="status">
              No saved profile was found. You can still analyze evidence from resume text you paste below; nothing you enter here will be saved.
            </p>
          )}
          <form className="job-match-form" onSubmit={analyzeJobMatch} noValidate>
            <div className={`form-field job-match-field${formError ? ' form-field--error' : ''}`}>
              <label htmlFor="job-match-description">Job description</label>
              <textarea
                id="job-match-description"
                rows="9"
                maxLength={MAX_JOB_DESCRIPTION_LENGTH}
                value={jobDescription}
                disabled={analyzing}
                aria-describedby="job-match-description-help job-match-description-count job-match-form-error"
                aria-invalid={Boolean(formError)}
                onChange={(event) => {
                  setJobDescription(event.target.value);
                  clearAnalysisMessages();
                }}
              />
              <div className="job-match-field-meta">
                <span id="job-match-description-help">Paste the role description. Only this text is sent to Firebase AI for requirement extraction.</span>
                <span id="job-match-description-count" aria-live="off">
                  {jobDescription.length.toLocaleString()} / {MAX_JOB_DESCRIPTION_LENGTH.toLocaleString()}
                </span>
              </div>
            </div>

            <div className={`form-field job-match-field${formError && resumeText.length > MAX_RESUME_TEXT_LENGTH ? ' form-field--error' : ''}`}>
              <label htmlFor="job-match-resume">Resume text <span>(optional)</span></label>
              <textarea
                id="job-match-resume"
                rows="7"
                maxLength={MAX_RESUME_TEXT_LENGTH}
                value={resumeText}
                disabled={analyzing}
                aria-describedby="job-match-resume-help job-match-resume-count"
                onChange={(event) => {
                  setResumeText(event.target.value);
                  clearAnalysisMessages();
                }}
              />
              <div className="job-match-field-meta">
                <span id="job-match-resume-help">Paste text only. It is compared locally in this browser for this session and is not saved or sent to AI.</span>
                <span id="job-match-resume-count" aria-live="off">
                  {resumeText.length.toLocaleString()} / {MAX_RESUME_TEXT_LENGTH.toLocaleString()}
                </span>
              </div>
            </div>

            {formError && <p className="job-match-error" id="job-match-form-error" role="alert">{formError}</p>}
            {!profileReady && <p className="job-match-inline-note" role="status">Waiting for your saved profile to finish loading.</p>}
            <div className="job-match-actions">
              <button
                className="button button-primary"
                type="submit"
                disabled={analyzing || !profileReady || !verifiedUser}
                aria-busy={analyzing}
              >
                {analyzing ? 'Analyzing...' : 'Analyze Job Match'}
              </button>
              {analyzing && <span className="job-match-progress" role="status"><span className="recommendation-spinner" aria-hidden="true" /> {analysisProgress || 'Extracting job requirements...'}</span>}
            </div>
          </form>

          {analysisError && <p className="job-match-error job-match-error--request" role="alert">{analysisError}</p>}

          {result && (
            <section className="job-match-results" aria-labelledby="job-match-results-title" aria-live="polite">
              <div className="job-match-results-header">
                <div>
                  <p className="eyebrow">Your analysis</p>
                  <h2 id="job-match-results-title">Skill coverage</h2>
                </div>
                <div className="job-match-score" aria-label={`Skill coverage score ${result.score} percent`}>
                  <strong>{result.score}%</strong>
                  <span>coverage</span>
                </div>
              </div>
              <div className="job-match-metrics">
                <div><strong>{result.totalCount}</strong><span>Recognized requirements</span></div>
                <div><strong>{result.matchedCount}</strong><span>Matching requirements</span></div>
              </div>
              <p className="job-match-explanation">
                Score = matching requirements ÷ recognized requirements × 100, rounded to the nearest whole percent. This is a keyword-evidence estimate, not a measure of proficiency, competence, or hiring likelihood.
              </p>
              <div className="job-match-skill-groups">
                <section aria-labelledby="job-match-matched-title">
                  <h3 id="job-match-matched-title">Matching skills</h3>
                  {result.matchedRequirements.length ? (
                    <ul className="job-match-skill-list">
                      {result.matchedRequirements.map((skill) => (
                        <li key={skill}>
                          <span>{skill}</span>
                          {onContinueLearning && (
                            <button className="small-action job-match-learn" type="button" onClick={() => onContinueLearning(skill)}>
                              Explore learning resources
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="job-match-muted">No matching evidence was found in the information provided.</p>}
                </section>
                <section aria-labelledby="job-match-unverified-title">
                  <h3 id="job-match-unverified-title">Unverified</h3>
                  {result.unverifiedRequirements.length ? (
                    <>
                      <p className="job-match-muted">Not found in the information provided. This does not mean you lack these skills.</p>
                      <ul className="job-match-skill-list job-match-skill-list--unverified">
                        {result.unverifiedRequirements.map((skill) => (
                          <li key={skill}>
                            <span>{skill}</span>
                            {onContinueLearning && (
                              <button className="small-action job-match-learn" type="button" onClick={() => onContinueLearning(skill)}>
                                Find learning resources
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : <p className="job-match-muted">All recognized requirements had matching evidence in the information provided.</p>}
                </section>
              </div>
              <p className="job-match-limitations">{result.interpretationNote}</p>
            </section>
          )}
        </>
      )}
    </section>
  );
}

export default JobMatchAnalyzer;

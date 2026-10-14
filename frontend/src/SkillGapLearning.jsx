import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, firestore } from './firebase.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
const LEARNING_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'kn', label: 'Kannada (ಕನ್ನಡ)' },
  { code: 'hi', label: 'Hindi (हिन्दी)' },
  { code: 'te', label: 'Telugu (తెలుగు)' },
  { code: 'ta', label: 'Tamil (தமிழ்)' },
  { code: 'ml', label: 'Malayalam (മലയാളം)' },
  { code: 'mr', label: 'Marathi (मराठी)' },
  { code: 'bn', label: 'Bengali (বাংলা)' },
];

async function requestLearningResources(skill, language, idToken, pageToken) {
  const parameters = new URLSearchParams({ skill, language });
  if (pageToken) parameters.set('pageToken', pageToken);
  const response = await fetch(
    `${API_BASE_URL}/api/learning-resources?${parameters.toString()}`,
    { headers: { Authorization: `Bearer ${idToken}` } },
  );
  const result = await response.json().catch(() => ({}));
  return { response, result };
}

function getSkillsToLearn(career) {
  const skillPlan = Array.isArray(career?.skillLearningPlan)
    ? [...career.skillLearningPlan].sort((first, second) => first.sequenceOrder - second.sequenceOrder)
    : [];
  return skillPlan.length
    ? skillPlan
    : (career?.missingSkills || []).map((skill, index) => ({ skill, sequenceOrder: index + 1 }));
}

function canUseProfile(user) {
  return Boolean(user?.uid && (
    user.emailVerified
    || user.providerData?.some((provider) => provider.providerId === 'google.com')
  ));
}

function formatSavedDate(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== 'function') return 'Saved date unavailable';
  return timestamp.toDate().toLocaleString();
}

function getProgressDocumentId(careerPath, skill) {
  return encodeURIComponent(`${careerPath}::${skill}`);
}

function reportRecommendationReadFailure(user, error) {
  if (!import.meta.env.DEV) return;
  console.error('[CareerScout Firestore] Saved career recommendations could not be loaded', {
    operation: 'read',
    errorCode: error?.code || 'unknown',
    firebaseConfigured: Boolean(firestore),
    authenticatedUserExists: Boolean(auth?.currentUser),
    userMatchesComponent: Boolean(auth?.currentUser?.uid && auth.currentUser.uid === user?.uid),
    accountVerifiedOrGoogle: Boolean(user?.emailVerified || user?.providerData?.some((provider) => provider.providerId === 'google.com')),
    collectionPath: 'users/{authenticatedUid}/careerRecommendations',
  });
}

function getRecommendationReadErrorMessage(error) {
  if (error?.code === 'permission-denied') {
    return 'Firestore denied access to saved recommendations. Deploy the current firestore.rules and confirm this app is connected to the same Firebase project where they were deployed.';
  }
  if (error?.code === 'unauthenticated') {
    return 'Your sign-in expired. Sign in again, then retry.';
  }
  if (error?.code === 'unavailable' || error?.code === 'network-request-failed') {
    return 'Firestore is unavailable. Check your connection and retry.';
  }
  return 'Saved career recommendations could not be loaded. Check your connection and Firestore configuration.';
}

function SkillGapLearning({ user, onRequestSignIn }) {
  const [savedRecommendations, setSavedRecommendations] = useState([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [recommendationsError, setRecommendationsError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [selectedCareerPath, setSelectedCareerPath] = useState('');
  const [completedSkills, setCompletedSkills] = useState(new Set());
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState('');
  const [savingSkill, setSavingSkill] = useState('');
  const [resourcesBySkill, setResourcesBySkill] = useState({});
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [submittedLanguages, setSubmittedLanguages] = useState(null);
  const [languageError, setLanguageError] = useState('');
  const searchGeneration = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function loadSavedRecommendations() {
      setSavedRecommendations([]);
      setSelectedId('');
      setRecommendationsError('');
      if (!canUseProfile(user) || auth?.currentUser?.uid !== user.uid || !firestore) {
        setRecommendationsLoading(false);
        setRecommendationsError('Sign in with a verified account to load your saved career recommendations.');
        return;
      }

      setRecommendationsLoading(true);
      try {
        const snapshot = await getDocs(query(
          collection(firestore, 'users', user.uid, 'careerRecommendations'),
          orderBy('generatedAt', 'desc'),
          limit(20),
        ));
        if (cancelled || auth.currentUser?.uid !== user.uid) return;
        const records = snapshot.docs.map((saved) => ({ id: saved.id, ...saved.data() }));
        setSavedRecommendations(records);
        setSelectedId(records[0]?.id || '');
        setSelectedCareerPath(records[0]?.careerRecommendations?.[0]?.careerPath || '');
      } catch (error) {
        reportRecommendationReadFailure(user, error);
        if (!cancelled) {
          setRecommendationsError(getRecommendationReadErrorMessage(error));
        }
      } finally {
        if (!cancelled) setRecommendationsLoading(false);
      }
    }

    loadSavedRecommendations();
    return () => { cancelled = true; };
  }, [user?.uid]);

  const selectedRecord = useMemo(
    () => savedRecommendations.find((record) => record.id === selectedId) || null,
    [savedRecommendations, selectedId],
  );
  const careers = selectedRecord?.careerRecommendations || [];
  const selectedCareer = careers.find((career) => career.careerPath === selectedCareerPath) || careers[0] || null;

  useEffect(() => {
    let cancelled = false;

    async function loadProgress() {
      setCompletedSkills(new Set());
      setProgressError('');
      if (!selectedRecord || !selectedCareerPath || !canUseProfile(user) || auth?.currentUser?.uid !== user.uid || !firestore) return;

      setProgressLoading(true);
      try {
        const snapshot = await getDocs(query(
          collection(firestore, 'users', user.uid, 'skillProgress'),
          where('careerPath', '==', selectedCareerPath),
        ));
        if (cancelled || auth.currentUser?.uid !== user.uid) return;
        setCompletedSkills(new Set(
          snapshot.docs.filter((progress) => progress.data().completed).map((progress) => progress.data().skill),
        ));
      } catch {
        if (!cancelled) setProgressError('Completion progress could not be loaded.');
      } finally {
        if (!cancelled) setProgressLoading(false);
      }
    }

    loadProgress();
    return () => { cancelled = true; };
  }, [selectedRecord?.id, selectedCareerPath, user?.uid]);

  function updateResource(skill, language, update) {
    setResourcesBySkill((current) => {
      const currentSkillResources = current[skill] || {};
      const previous = currentSkillResources[language];
      return {
        ...current,
        [skill]: {
          ...currentSkillResources,
          [language]: typeof update === 'function' ? update(previous) : update,
        },
      };
    });
  }

  function getResourceErrorMessage(response, result) {
    const detailCode = typeof result.detail === 'object' ? result.detail?.code : undefined;
    const detailMessage = typeof result.detail === 'string' ? result.detail : result.detail?.message;
    if (response.status === 401) {
      if (detailCode === 'firebase-sign-in-required') return 'Sign in to load learning resources.';
      if (detailCode === 'firebase-token-expired') return 'Your Firebase sign-in has expired. Sign in again, then retry.';
      if (detailCode === 'firebase-token-revoked') return 'This Firebase sign-in is no longer valid. Sign in again, then retry.';
      if (detailCode === 'firebase-token-project-mismatch') return 'The sign-in token belongs to a different Firebase project. Confirm the frontend and backend use the same Firebase project.';
      if (detailCode === 'firebase-token-issuer-mismatch') return 'The sign-in token issuer does not match the backend Firebase project. Check the Firebase project configuration.';
      if (detailCode === 'firebase-token-signature-invalid') return 'Firebase could not validate this token signature. Check the Firebase project and token configuration.';
      return 'Firebase could not verify this token. Check that the frontend and backend use the same Firebase project; your session has not been assumed to be expired.';
    }
    if (response.status === 503 && detailCode?.startsWith('firebase-')) {
      return detailMessage || 'Firebase token verification is unavailable. Please retry shortly.';
    }
    if (response.status === 503 && detailMessage?.includes('not configured')) {
      return 'YouTube learning resources are not configured. Set YOUTUBE_API_KEY for the backend and restart it.';
    }
    if (response.status === 422) return 'This learning language is not supported by the video search service.';
    return detailMessage || 'YouTube learning resources could not be loaded. Please retry.';
  }

  async function loadResources(skill, language, pageToken = null, generation = searchGeneration.current, force = false) {
    const existing = resourcesBySkill[skill]?.[language];
    if (!pageToken && !force && ['loading', 'loaded'].includes(existing?.status)) return;
    if (pageToken && existing?.loadingMore) return;
    if (pageToken) {
      updateResource(skill, language, (previous) => ({ ...previous, loadingMore: true, moreError: '' }));
    } else {
      updateResource(skill, language, { status: 'loading', videos: [] });
    }

    try {
      const currentUser = auth?.currentUser;
      if (!currentUser) throw new Error('Sign in again to load learning resources.');
      if (currentUser.uid !== user?.uid) throw new Error('Your sign-in changed. Reload the page and try again.');

      let idToken;
      try {
        idToken = await currentUser.getIdToken(true);
      } catch {
        throw new Error('Your sign-in could not be verified. Sign in again, then retry.');
      }
      if (generation !== searchGeneration.current) return;
      if (auth?.currentUser?.uid !== currentUser.uid) throw new Error('Your sign-in changed. Reload the page and try again.');

      let { response, result } = await requestLearningResources(skill, language, idToken, pageToken);
      if (response.status === 401 && result.detail?.code === 'firebase-token-expired') {
        if (auth?.currentUser?.uid !== currentUser.uid) throw new Error('Your sign-in changed. Reload the page and try again.');
        try {
          idToken = await currentUser.getIdToken(true);
        } catch {
          throw new Error('Your sign-in could not be refreshed. Sign in again, then retry.');
        }
        if (generation !== searchGeneration.current) return;
        if (auth?.currentUser?.uid !== currentUser.uid) throw new Error('Your sign-in changed. Reload the page and try again.');
        ({ response, result } = await requestLearningResources(skill, language, idToken, pageToken));
      }
      if (!response.ok) throw new Error(getResourceErrorMessage(response, result));
      if (generation !== searchGeneration.current) return;

      updateResource(skill, language, (previous) => {
        const incomingVideos = Array.isArray(result.videos) ? result.videos : [];
        const combinedVideos = pageToken ? [...(previous?.videos || []), ...incomingVideos] : incomingVideos;
        const seenVideoIds = new Set();
        const videos = combinedVideos.filter((video) => {
          if (!video?.videoId || seenVideoIds.has(video.videoId)) return false;
          seenVideoIds.add(video.videoId);
          return true;
        });
        return {
          status: 'loaded',
          videos,
          nextPageToken: typeof result.nextPageToken === 'string' ? result.nextPageToken : null,
          loadingMore: false,
          moreError: '',
        };
      });
    } catch (error) {
      if (generation !== searchGeneration.current) return;
      const message = error instanceof Error
        ? error.message
        : 'The learning resources service is unavailable. Check the backend and retry.';
      updateResource(skill, language, (previous) => pageToken
        ? { ...previous, loadingMore: false, moreError: message }
        : { status: 'error', message, videos: [] });
    }
  }

  function submitLanguageSelection() {
    if (!selectedLanguages.length) {
      setLanguageError('Choose at least one language before searching.');
      return;
    }
    searchGeneration.current += 1;
    setResourcesBySkill({});
    setLanguageError('');
    setSubmittedLanguages([...selectedLanguages]);
  }

  function changeLanguages() {
    searchGeneration.current += 1;
    setResourcesBySkill({});
    setSubmittedLanguages(null);
    setLanguageError('');
  }

  useEffect(() => {
    if (!submittedLanguages?.length || !selectedRecord || !selectedCareer) return undefined;
    const generation = searchGeneration.current;
    setResourcesBySkill({});
    getSkillsToLearn(selectedCareer).forEach(({ skill }) => {
      submittedLanguages.forEach((language) => {
        void loadResources(skill, language, null, generation, true);
      });
    });
    return () => { searchGeneration.current += 1; };
  }, [submittedLanguages, selectedRecord?.id, selectedCareerPath, user?.uid]);

  async function toggleCompleted(skill) {
    if (!selectedRecord || !firestore || auth?.currentUser?.uid !== user?.uid) return;
    setSavingSkill(skill);
    setProgressError('');
    const careerPath = selectedCareer?.careerPath;
    if (!careerPath || !selectedCareer.missingSkills?.includes(skill)) {
      setSavingSkill('');
      setProgressError('This skill is not part of the selected saved career. Select the recommendation again.');
      return;
    }

    const progressRef = doc(
      firestore,
      'users',
      user.uid,
      'skillProgress',
      getProgressDocumentId(careerPath, skill),
    );
    try {
      if (completedSkills.has(skill)) {
        await deleteDoc(progressRef);
        setCompletedSkills((current) => new Set([...current].filter((item) => item !== skill)));
      } else {
        await setDoc(progressRef, {
          careerPath,
          skill,
          completed: true,
          completedAt: serverTimestamp(),
        });
        setCompletedSkills((current) => new Set([...current, skill]));
      }
    } catch {
      setProgressError('Progress could not be saved. Check your connection and Firestore rules, then retry.');
    } finally {
      setSavingSkill('');
    }
  }

  return (
    <section className="skill-gap-page" aria-labelledby="skill-gap-title">
      <header className="skill-gap-intro">
        <p className="eyebrow"><span className="eyebrow-dot" /> Build toward your next role</p>
        <h1 id="skill-gap-title">Skill gap <span>& learning resources.</span></h1>
        <p>Choose a saved career path to see its skill sequence, track your progress, and find real YouTube lessons.</p>
      </header>

      {!canUseProfile(user) ? (
        <div className="skill-gap-state" role="alert">
          <p>Sign in with a verified account to access your saved recommendations and learning progress.</p>
          <button className="button button-primary" type="button" onClick={onRequestSignIn}>Sign in</button>
        </div>
      ) : !firestore ? (
        <div className="skill-gap-state" role="alert"><p>Firebase is not configured, so saved recommendations and progress are unavailable.</p></div>
      ) : recommendationsLoading ? (
        <div className="skill-gap-state" role="status"><span className="recommendation-spinner" aria-hidden="true" /><p>Loading your saved career recommendations...</p></div>
      ) : recommendationsError ? (
        <div className="skill-gap-state" role="alert"><p>{recommendationsError}</p></div>
      ) : savedRecommendations.length === 0 ? (
        <div className="skill-gap-state skill-gap-state--empty">
          <h2>No saved career paths yet.</h2>
          <p>Generate Career Recommendations first. New recommendation results are saved here automatically for your account.</p>
        </div>
      ) : submittedLanguages === null ? (
        <section className="learning-language-step" aria-labelledby="learning-language-title">
          <h2 id="learning-language-title">Which language would you like to learn in?</h2>
          <p>Choose one or more languages to find learning videos you understand.</p>
          <p className="learning-language-note">YouTube language relevance is approximate; check each video for its spoken language.</p>
          <fieldset className="learning-language-options">
            <legend className="visually-hidden">Preferred learning languages</legend>
            {LEARNING_LANGUAGES.map((language) => (
              <label
                className={`learning-language-option${selectedLanguages.includes(language.code) ? ' learning-language-option--selected' : ''}`}
                key={language.code}
              >
                <input
                  type="checkbox"
                  checked={selectedLanguages.includes(language.code)}
                  onChange={() => {
                    setSelectedLanguages((current) => current.includes(language.code)
                      ? current.filter((code) => code !== language.code)
                      : [...current, language.code]);
                    setLanguageError('');
                  }}
                />
                <span>{language.label}</span>
              </label>
            ))}
          </fieldset>
          {languageError && <p className="skill-gap-error" role="alert">{languageError}</p>}
          <button className="button button-primary" type="button" onClick={submitLanguageSelection}>
            Search Learning Videos
          </button>
        </section>
      ) : (
        <>
          <div className="learning-language-toolbar">
            <p>Searching in {submittedLanguages.map((code) => LEARNING_LANGUAGES.find((language) => language.code === code)?.label).join(', ')}</p>
            <button className="button button-secondary" type="button" onClick={changeLanguages}>Change Languages</button>
          </div>
          <div className="skill-gap-selector">
            <label htmlFor="saved-career-select">Saved recommendation</label>
            <select id="saved-career-select" value={selectedId} onChange={(event) => {
              const record = savedRecommendations.find((item) => item.id === event.target.value);
              setSelectedId(event.target.value);
              setSelectedCareerPath(record?.careerRecommendations?.[0]?.careerPath || '');
            }}>
              {savedRecommendations.map((record) => {
                const title = record.careerRecommendations?.[0]?.careerPath || 'Career paths';
                const total = record.careerRecommendations?.length || 0;
                return <option key={record.id} value={record.id}>{title} + {Math.max(0, total - 1)} more · {formatSavedDate(record.generatedAt)}</option>;
              })}
            </select>
          </div>

          {selectedRecord && (
            <div className="skill-gap-career-select">
              <label htmlFor="career-path-select">Career path</label>
              <select id="career-path-select" value={selectedCareerPath} onChange={(event) => setSelectedCareerPath(event.target.value)}>
                {careers.map((career) => <option key={career.careerPath} value={career.careerPath}>{career.careerPath}</option>)}
              </select>
            </div>
          )}

          {selectedRecord?.generationMethod === 'rule-based' && (
            <aside className="recommendation-source-notice">
              <strong>Rule-based suggestions</strong>
              <p>Match scores are estimates based on the saved profile, not AI assessments or hiring probabilities.</p>
            </aside>
          )}

          {selectedRecord && (() => {
            const career = careers.find((item) => item.careerPath === selectedCareerPath) || careers[0];
            const skillPlan = Array.isArray(career?.skillLearningPlan)
              ? [...career.skillLearningPlan].sort((first, second) => first.sequenceOrder - second.sequenceOrder)
              : [];
            const skillsToLearn = getSkillsToLearn(career);

            return (
              <>
                <section className="skill-gap-career" aria-labelledby="selected-career-title">
                  <div className="skill-gap-career-heading">
                    <div><p className="eyebrow">{formatSavedDate(selectedRecord.generatedAt)}</p><h2 id="selected-career-title">{career?.careerPath || 'Career path'}</h2></div>
                    <span className="skill-gap-fit">{career?.compatibilityScore ?? '—'} <small>profile fit</small></span>
                  </div>
                  <p className="skill-gap-reason">{career?.whyItSuits}</p>

                  <div className="skill-gap-columns">
                    <section className="skill-gap-existing">
                      <h3>Skills you already have</h3>
                      {career?.relevantSkills?.length ? (
                        <ul className="recommendation-tags">{career.relevantSkills.map((skill) => <li key={skill}>{skill}</li>)}</ul>
                      ) : <p className="skill-gap-muted">No direct matching skills were listed for this path.</p>}
                    </section>
                    <section className="skill-gap-sequence">
                      <h3>Recommended learning sequence</h3>
                      {!skillPlan.length ? (
                        <p className="skill-gap-muted">This saved result has no per-skill sequence. Generate a fresh recommendation to create a detailed plan.</p>
                      ) : (
                        <ol>
                          {skillPlan.map((item) => (
                            <li key={item.skill}>
                              <span className="skill-sequence-number">{item.sequenceOrder}</span>
                              <span>{item.skill}</span>
                              <span className={`skill-priority skill-priority--${item.priority.toLowerCase()}`}>{item.priority}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </section>
                  </div>

                  <section className="skill-gap-resources">
                    <div className="skill-gap-section-heading"><div><p className="eyebrow">Practice and track</p><h3>Skills to learn</h3></div>{progressLoading && <span className="skill-gap-muted" role="status">Loading progress...</span>}</div>
                    {progressError && <p className="skill-gap-error" role="alert">{progressError}</p>}
                    {!career?.missingSkills?.length ? (
                      <p className="skill-gap-muted">No missing skills were identified for this career path.</p>
                    ) : (
                      <div className="skill-resource-list">
                        {skillsToLearn.map((plan) => {
                          const skill = plan.skill;
                          const completed = completedSkills.has(skill);
                          return (
                            <article className={`skill-resource${completed ? ' skill-resource--completed' : ''}`} key={skill}>
                              <header className="skill-resource-heading">
                                <div><span className="skill-sequence-number">{plan.sequenceOrder}</span><div className="skill-resource-labels"><div className="skill-resource-title-line"><h4>{skill}</h4><span className={`skill-completion-status${completed ? ' skill-completion-status--done' : ''}`}>{completed ? 'Completed' : 'In progress'}</span></div>{plan.priority ? <span className={`skill-priority skill-priority--${plan.priority.toLowerCase()}`}>{plan.priority} priority</span> : <span className="skill-gap-muted">Priority unavailable in this saved result</span>}</div></div>
                                <button className={`button ${completed ? 'button-secondary' : 'button-primary'}`} type="button" onClick={() => toggleCompleted(skill)} disabled={savingSkill === skill || progressLoading}>
                                  {savingSkill === skill ? 'Saving...' : completed ? 'Completed' : 'Mark as completed'}
                                </button>
                              </header>
                              <div className="skill-language-results">
                                {submittedLanguages.map((languageCode) => {
                                  const language = LEARNING_LANGUAGES.find((item) => item.code === languageCode);
                                  const resourceState = resourcesBySkill[skill]?.[languageCode];
                                  return (
                                    <section className="skill-language-result" key={languageCode}>
                                      <div className="skill-video-heading">
                                        <h5>{language?.label} learning videos</h5>
                                        <span className="learning-language-badge">{languageCode.toUpperCase()}</span>
                                      </div>
                                      {resourceState?.status === 'loading' && (
                                        <div className="learning-video-loading" role="status">
                                          <p className="skill-gap-muted">Searching YouTube...</p>
                                          <div className="learning-video-skeleton-grid" aria-hidden="true">
                                            {[0, 1, 2].map((skeleton) => (
                                              <div className="learning-video-skeleton" key={skeleton}>
                                                <span className="learning-video-skeleton-thumbnail" />
                                                <span className="learning-video-skeleton-line" />
                                                <span className="learning-video-skeleton-line learning-video-skeleton-line--short" />
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {resourceState?.status === 'error' && (
                                        <div className="learning-resource-error">
                                          <p className="skill-gap-error" role="alert">{resourceState.message}</p>
                                          <button className="small-action" type="button" onClick={() => loadResources(skill, languageCode)}>Retry</button>
                                        </div>
                                      )}
                                      {resourceState?.status === 'loaded' && (
                                        <>
                                          {resourceState.videos.length ? (
                                            <ul className="youtube-resource-grid">
                                              {resourceState.videos.map((video) => (
                                                <li className="youtube-video-card" key={video.videoId}>
                                                  <a className="youtube-video-link" href={video.videoUrl} target="_blank" rel="noreferrer" aria-label={`Watch ${video.title} on YouTube`}>
                                                    <span className="youtube-video-thumbnail">
                                                      {video.thumbnailUrl
                                                        ? <img src={video.thumbnailUrl} alt="" loading="lazy" />
                                                        : <span className="youtube-thumbnail-fallback">Video preview</span>}
                                                      <span className="youtube-play-mark" aria-hidden="true">▶</span>
                                                    </span>
                                                    <span className="youtube-video-copy">
                                                      <strong>{video.title}</strong>
                                                      <small>{video.channelName}</small>
                                                      <span className="youtube-watch-action">Watch Video <span aria-hidden="true">↗</span></span>
                                                    </span>
                                                  </a>
                                                </li>
                                              ))}
                                            </ul>
                                          ) : <p className="skill-gap-muted">YouTube returned no videos for this skill and language.</p>}
                                          {resourceState.moreError && (
                                            <div className="learning-resource-error">
                                              <p className="skill-gap-error" role="alert">{resourceState.moreError}</p>
                                              <button className="small-action" type="button" onClick={() => loadResources(skill, languageCode, resourceState.nextPageToken)}>Retry</button>
                                            </div>
                                          )}
                                          <button
                                            className="small-action learning-load-more"
                                            type="button"
                                            disabled={!resourceState.nextPageToken || resourceState.loadingMore}
                                            onClick={() => loadResources(skill, languageCode, resourceState.nextPageToken)}
                                          >
                                            {resourceState.loadingMore ? 'Loading videos...' : resourceState.nextPageToken ? 'Load More Videos' : 'No more videos'}
                                          </button>
                                        </>
                                      )}
                                    </section>
                                  );
                                })}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </section>
              </>
            );
          })()}
        </>
      )}
    </section>
  );
}

export default SkillGapLearning;
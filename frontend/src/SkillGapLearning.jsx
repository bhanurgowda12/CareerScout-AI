import React, { useEffect, useMemo, useState } from 'react';
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

  async function loadResources(skill) {
    if (resourcesBySkill[skill]?.status || !user || auth?.currentUser?.uid !== user.uid) return;
    setResourcesBySkill((current) => ({ ...current, [skill]: { status: 'loading', videos: [] } }));

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(
        `${API_BASE_URL}/api/learning-resources?skill=${encodeURIComponent(skill)}`,
        { headers: { Authorization: `Bearer ${idToken}` } },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = response.status === 503 && result.detail?.includes('not configured')
          ? 'YouTube learning resources are not configured. Set YOUTUBE_API_KEY for the backend and restart it.'
          : response.status === 401
            ? 'Your sign-in expired. Sign in again and retry.'
            : result.detail || 'YouTube learning resources could not be loaded. Please retry.';
        setResourcesBySkill((current) => ({ ...current, [skill]: { status: 'error', message, videos: [] } }));
        return;
      }
      setResourcesBySkill((current) => ({
        ...current,
        [skill]: { status: 'loaded', videos: Array.isArray(result.videos) ? result.videos : [] },
      }));
    } catch {
      setResourcesBySkill((current) => ({
        ...current,
        [skill]: { status: 'error', message: 'The learning resources service is unavailable. Check the backend and retry.', videos: [] },
      }));
    }
  }

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
      ) : (
        <>
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

          {selectedRecord && (() => {
            const career = careers.find((item) => item.careerPath === selectedCareerPath) || careers[0];
            const skillPlan = Array.isArray(career?.skillLearningPlan) ? [...career.skillLearningPlan].sort((a, b) => a.sequenceOrder - b.sequenceOrder) : [];
            const skillsToLearn = skillPlan.length
              ? skillPlan
              : (career?.missingSkills || []).map((skill, index) => ({ skill, sequenceOrder: index + 1 }));

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
                          const resourceState = resourcesBySkill[skill];
                          const completed = completedSkills.has(skill);
                          return (
                            <article className={`skill-resource${completed ? ' skill-resource--completed' : ''}`} key={skill}>
                              <header className="skill-resource-heading">
                                <div><span className="skill-sequence-number">{plan.sequenceOrder}</span><div><h4>{skill}</h4>{plan.priority ? <span className={`skill-priority skill-priority--${plan.priority.toLowerCase()}`}>{plan.priority} priority</span> : <span className="skill-gap-muted">Priority unavailable in this saved result</span>}</div></div>
                                <button className={`button ${completed ? 'button-secondary' : 'button-primary'}`} type="button" onClick={() => toggleCompleted(skill)} disabled={savingSkill === skill || progressLoading}>
                                  {savingSkill === skill ? 'Saving...' : completed ? 'Completed' : 'Mark as completed'}
                                </button>
                              </header>
                              <div className="skill-video-heading">
                                <h5>YouTube lessons</h5>
                                {!resourceState?.status && <button className="small-action" type="button" onClick={() => loadResources(skill)}>Find videos</button>}
                                {resourceState?.status === 'error' && <button className="small-action" type="button" onClick={() => {
                                  setResourcesBySkill((current) => ({ ...current, [skill]: undefined }));
                                  loadResources(skill);
                                }}>Retry</button>}
                              </div>
                              {resourceState?.status === 'loading' && <p className="skill-gap-muted" role="status">Searching YouTube...</p>}
                              {resourceState?.status === 'error' && <p className="skill-gap-error" role="alert">{resourceState.message}</p>}
                              {resourceState?.status === 'loaded' && (resourceState.videos.length ? (
                                <ul className="youtube-resource-list">
                                  {resourceState.videos.map((video) => (
                                    <li key={video.videoId}>
                                      <a href={video.videoUrl} target="_blank" rel="noreferrer">
                                        {video.thumbnailUrl && <img src={video.thumbnailUrl} alt="" loading="lazy" />}
                                        <span><strong>{video.title}</strong><small>{video.channelName}</small></span>
                                        <span className="youtube-open" aria-hidden="true">↗</span>
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              ) : <p className="skill-gap-muted">YouTube returned no videos for this skill.</p>)}
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
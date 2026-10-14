import React, { useEffect, useState } from 'react';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useCareerRecommendations } from './ai.js';
import CareerExplorer from './CareerExplorer.jsx';
import { getCareerRole } from './careerCatalog.js';
import { auth, firestore } from './firebase.js';

function canUseProfile(user) {
  return Boolean(user?.uid && (
    user.emailVerified
    || user.providerData?.some((provider) => provider.providerId === 'google.com')
  ));
}

function hasCareerProfileData(profile) {
  return Boolean(
    profile?.degree
    || profile?.branch
    || profile?.experienceLevel
    || profile?.skills?.length
    || profile?.interests?.length
    || profile?.preferredWorkAreas?.length
    || profile?.preferredIndustries?.length
    || profile?.careerInterests?.length
    || profile?.projects?.some((project) => project?.name || project?.description || project?.technologies)
    || profile?.certifications?.some((certification) => certification?.name || certification?.issuer),
  );
}

function reportRecommendationFirestoreFailure(operation, user, error) {
  if (!import.meta.env.DEV) return;
  console.error('[CareerScout Firestore] Career recommendations request failed', {
    operation,
    errorCode: error?.code || 'unknown',
    firebaseConfigured: Boolean(firestore),
    authenticatedUserExists: Boolean(auth?.currentUser),
    userMatchesComponent: Boolean(auth?.currentUser?.uid && auth.currentUser.uid === user?.uid),
    accountVerifiedOrGoogle: Boolean(user?.emailVerified || user?.providerData?.some((provider) => provider.providerId === 'google.com')),
    collectionPath: 'users/{authenticatedUid}/careerRecommendations',
  });
}

function getRecommendationFirestoreMessage(error, operation) {
  if (error?.code === 'permission-denied') {
    return `Firestore denied the ${operation}. Deploy the current firestore.rules and confirm you are signed in to the same Firebase project.`;
  }
  if (error?.code === 'unauthenticated') {
    return 'Your sign-in expired. Sign in again, then retry.';
  }
  if (error?.code === 'unavailable' || error?.code === 'network-request-failed') {
    return 'Firestore is unavailable. Check your connection and retry.';
  }
  return `Saved recommendations could not be ${operation === 'save' ? 'saved' : 'loaded'}. Check your connection and Firestore configuration.`;
}

function CareerRecommendations({ user, onOpenProfile, onRequestSignIn }) {
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [profileLoadAttempt, setProfileLoadAttempt] = useState(0);
  const [recommendationSaveError, setRecommendationSaveError] = useState('');
  const [exploreRoleId, setExploreRoleId] = useState('');
  const { recommendations, loading, error, requestRecommendations } = useCareerRecommendations();

  useEffect(() => {
    let cancelled = false;

    async function loadSavedProfile() {
      setProfile(null);
      setProfileError('');
      if (!canUseProfile(user) || auth?.currentUser?.uid !== user.uid || !firestore) {
        setProfileLoading(false);
        setProfileError('Sign in with a verified account to load your saved profile.');
        return;
      }

      setProfileLoading(true);
      try {
        const snapshot = await getDoc(doc(firestore, 'users', user.uid, 'profile', 'profile'));
        if (cancelled || auth.currentUser?.uid !== user.uid) return;
        setProfile(snapshot.exists() ? snapshot.data() : null);
      } catch {
        if (!cancelled) {
          setProfileError('Your saved profile could not be loaded. Check your connection and try again.');
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    }

    loadSavedProfile();
    return () => { cancelled = true; };
  }, [user?.uid, profileLoadAttempt]);

  async function generateRecommendations() {
    if (!profile || loading || auth?.currentUser?.uid !== user?.uid) return;
    setRecommendationSaveError('');
    const generated = await requestRecommendations(profile);
    if (!generated || auth?.currentUser?.uid !== user?.uid) return;

    try {
      await addDoc(collection(firestore, 'users', user.uid, 'careerRecommendations'), {
        careerRecommendations: generated.careerRecommendations,
        generationMethod: generated.generationMethod || 'gemini',
        generatedAt: serverTimestamp(),
      });
    } catch (error) {
      reportRecommendationFirestoreFailure('save', user, error);
      setRecommendationSaveError(`Recommendations were generated, but could not be saved. ${getRecommendationFirestoreMessage(error, 'save')}`);
    }
  }

  return (
    <section className="recommendations-page" aria-labelledby="recommendations-title">
      <div className="recommendations-intro">
        <p className="eyebrow"><span className="eyebrow-dot" /> Your next direction</p>
        <h1 id="recommendations-title">Career paths, <span>shaped around you.</span></h1>
        <p>Explore practical directions based on the education, skills, interests, and work you have saved in your Student Profile.</p>
      </div>

      {!canUseProfile(user) ? (
        <div className="recommendation-state" role="alert">
          <p>Sign in with a verified account to get recommendations from your saved profile.</p>
          <button className="button button-primary" type="button" onClick={onRequestSignIn}>Sign in</button>
        </div>
      ) : !firestore ? (
        <div className="recommendation-state" role="alert">
          <p>Firebase is not configured, so your saved profile cannot be loaded.</p>
        </div>
      ) : profileLoading ? (
        <div className="recommendation-state" role="status">
          <span className="recommendation-spinner" aria-hidden="true" />
          <p>Loading your saved profile...</p>
        </div>
      ) : profileError ? (
        <div className="recommendation-state" role="alert">
          <p>{profileError}</p>
          <button className="button button-secondary" type="button" onClick={() => setProfileLoadAttempt((attempt) => attempt + 1)}>
            Reload profile
          </button>
        </div>
      ) : !profile || !hasCareerProfileData(profile) ? (
        <div className="recommendation-state recommendation-state--empty">
          <span className="recommendation-state-mark" aria-hidden="true">↗</span>
          <h2>Your profile is ready to guide the search.</h2>
          <p>Save your degree, interests, or skills in Student Profile first. CareerScout will use that saved information, so there is nothing to enter again here.</p>
          <button className="button button-primary" type="button" onClick={onOpenProfile}>Open Student Profile <span aria-hidden="true">↗</span></button>
        </div>
      ) : (
        <>
          <div className="recommendation-controls">
            <div>
              <strong>Using your saved Student Profile</strong>
              <p>Your profile stays in your account; only career-relevant details are sent to Firebase AI Logic.</p>
            </div>
            <button className="button button-primary" type="button" onClick={generateRecommendations} disabled={loading}>
              {loading ? <><span className="recommendation-spinner" aria-hidden="true" /> Building recommendations...</> : recommendations ? 'Generate again' : 'Generate recommendations'}
            </button>
          </div>

          {loading && (
            <div className="recommendation-loading" role="status" aria-live="polite">
              <span className="recommendation-spinner" aria-hidden="true" />
              <p>Comparing your profile with practical early-career paths...</p>
            </div>
          )}

          {error && (
            <div className="recommendation-error" role="alert">
              <div><strong>Recommendations could not be generated.</strong><p>{error}</p></div>
              <button className="button button-secondary" type="button" onClick={generateRecommendations} disabled={loading}>Retry</button>
            </div>
          )}

          {recommendationSaveError && <p className="recommendation-save-error" role="alert">{recommendationSaveError}</p>}

          {recommendations && !loading && recommendations.careerRecommendations.length === 0 && (
            <div className="recommendation-state recommendation-state--empty">
              <h2>Add a little more career context</h2>
              <p>Your saved profile did not match a role strongly enough yet. Add skills, project details, interests, or preferred work areas, or browse the catalogue below.</p>
              <button className="button button-secondary" type="button" onClick={onOpenProfile}>Update Student Profile <span aria-hidden="true">↗</span></button>
            </div>
          )}

          {recommendations && !loading && recommendations.careerRecommendations.length > 0 && (
            <>
              {recommendations.generationMethod === 'rule-based' && (
                <aside className="recommendation-source-notice">
                  <strong>Rule-based suggestions</strong>
                  <p>Match scores are estimates based on your saved skills and interests, not AI assessments or hiring probabilities.</p>
                </aside>
              )}
              <div className="recommendation-results-heading">
                <div>
                  <p className="eyebrow">A starting point, not a guarantee</p>
                  <h2>{recommendations.careerRecommendations.length} paths to explore</h2>
                </div>
                <p>{recommendations.generationMethod === 'rule-based'
                  ? 'Match scores are estimates based on your saved profile.'
                  : 'Fit scores are directional AI estimates, not predictions of hiring outcomes.'}</p>
              </div>
              <div className="career-recommendation-list">
                {recommendations.careerRecommendations.map((career, index) => (
                  <article className="career-recommendation" key={`${career.careerPath}-${index}`}>
                    <header className="career-card-heading">
                      <div>
                        <span className="career-card-number">0{index + 1}</span>
                        <h3>{career.careerPath}</h3>
                        {career.careerDomain && <p className="career-card-domain">{career.careerDomain}</p>}
                      </div>
                      <span className="career-fit" aria-label={`Directional profile fit ${career.compatibilityScore} out of 100`}>
                        <strong>{career.compatibilityScore}</strong><span>profile fit</span>
                      </span>
                    </header>

                    <p className="career-reasoning">{career.whyItSuits}</p>

                    <button
                      className="button button-secondary career-explore-action"
                      type="button"
                      onClick={() => setExploreRoleId(career.careerId || getCareerRole(career.careerPath)?.id || '')}
                    >Explore This Career <span aria-hidden="true">↗</span></button>

                    <div className="career-skill-grid">
                      <section>
                        <h4>Skills you can build on</h4>
                        {career.relevantSkills.length ? (
                          <ul className="recommendation-tags">{career.relevantSkills.map((skill) => <li key={skill}>{skill}</li>)}</ul>
                        ) : <p className="recommendation-muted">Your profile does not list direct matches yet.</p>}
                      </section>
                      <section>
                        <h4>Transferable skills</h4>
                        {career.transferableSkills?.length ? (
                          <ul className="recommendation-tags">{career.transferableSkills.map((skill) => <li key={skill}>{skill}</li>)}</ul>
                        ) : <p className="recommendation-muted">Add project or work-area details to identify more transferable skills.</p>}
                      </section>
                      <section>
                        <h4>Skills to develop</h4>
                        <ul className="recommendation-tags recommendation-tags--gap">{career.missingSkills.map((skill) => <li key={skill}>{skill}</li>)}</ul>
                      </section>
                    </div>

                    {career.prerequisites?.length > 0 && (
                      <section className="career-recommendation-prerequisites">
                        <h4>Prerequisites to consider</h4>
                        <ul>{career.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul>
                      </section>
                    )}

                    <details className="career-detail-disclosure">
                      <summary>Learning roadmap, portfolio idea, and next steps</summary>
                      <div className="career-detail-grid">
                      <section className="career-roadmap">
                        <h4>Learning roadmap</h4>
                        <ol>
                          {career.learningRoadmap.map((phase, phaseIndex) => (
                            <li key={`${phase.phase}-${phaseIndex}`}>
                              <div className="roadmap-phase-heading"><strong>{phase.phase}</strong><span>{phase.timeframe}</span></div>
                              <ul>{phase.actions.map((action, actionIndex) => <li key={`${action}-${actionIndex}`}>{action}</li>)}</ul>
                            </li>
                          ))}
                        </ol>
                      </section>
                      <section className="career-next-steps">
                        <div>
                          <h4>Portfolio project</h4>
                          <p>{career.suggestedPortfolioProject}</p>
                        </div>
                        <div>
                          <h4>Suggested next steps</h4>
                          <ol>{career.nextSteps.map((step, stepIndex) => <li key={`${step}-${stepIndex}`}>{step}</li>)}</ol>
                        </div>
                      </section>
                      </div>
                    </details>
                  </article>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {!profileLoading && !profileError && firestore && (
        <CareerExplorer
          user={user}
          profile={profile || {}}
          requestedRoleId={exploreRoleId}
          onContinueLearning={(career) => {
            const firstSkill = career.skillLearningPlan?.[0]?.skill || '';
            onContinueLearning?.(firstSkill, career.careerPath);
          }}
        />
      )}
    </section>
  );
}

export default CareerRecommendations;
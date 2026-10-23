import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
} from 'firebase/firestore';
import { auth, firestore } from './firebase.js';

function canUseProfile(user) {
  return Boolean(user?.uid && (
    user.emailVerified
    || user.providerData?.some((provider) => provider.providerId === 'google.com')
  ));
}

function getRoadmapSkills(career) {
  const plan = Array.isArray(career?.skillLearningPlan) && career.skillLearningPlan.length
    ? [...career.skillLearningPlan].sort((first, second) => first.sequenceOrder - second.sequenceOrder)
    : (Array.isArray(career?.missingSkills) ? career.missingSkills : []).map((skill, index) => ({ skill, sequenceOrder: index + 1 }));
  const seen = new Set();
  return plan.filter((item) => {
    if (typeof item?.skill !== 'string' || !item.skill.trim()) return false;
    const key = item.skill.trim().toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toDate(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== 'function') return null;
  const date = timestamp.toDate();
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function StudentDashboard({ user, username, onOpenProfile, onOpenResume, onOpenSettings, onOpenRecommendations, onOpenJobTracker, onContinueLearning }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const uid = user?.uid;

    async function loadDashboard() {
      setDashboardData(null);
      setError('');
      if (!canUseProfile(user) || auth?.currentUser?.uid !== uid || !firestore) {
        setLoading(false);
        setError('Sign in with a verified account to load your dashboard.');
        return;
      }

      setLoading(true);
      try {
        const [profileSnapshot, recommendationsSnapshot, progressSnapshot, historySnapshot] = await Promise.all([
          getDoc(doc(firestore, 'users', uid, 'profile', 'profile')),
          getDocs(query(
            collection(firestore, 'users', uid, 'careerRecommendations'),
            orderBy('generatedAt', 'desc'),
          )),
          getDocs(collection(firestore, 'users', uid, 'skillProgress')),
          getDocs(query(
            collection(firestore, 'users', uid, 'profileHistory'),
            orderBy('savedAt', 'desc'),
            limit(5),
          )),
        ]);
        if (cancelled || auth?.currentUser?.uid !== uid) return;

        const profile = profileSnapshot.exists() ? profileSnapshot.data() : null;
        const recommendations = recommendationsSnapshot.docs.flatMap((snapshot) => {
          const saved = snapshot.data();
          return (Array.isArray(saved.careerRecommendations) ? saved.careerRecommendations : [])
            .map((career) => ({ career, generatedAt: saved.generatedAt }));
        });
        const seenCareerPaths = new Set();
        const uniqueRecommendations = recommendations.filter(({ career }) => {
          if (typeof career?.careerPath !== 'string' || !career.careerPath.trim()) return false;
          const key = career.careerPath.trim().toLocaleLowerCase();
          if (seenCareerPaths.has(key)) return false;
          seenCareerPaths.add(key);
          return true;
        });
        const latestSavedCareers = Array.isArray(recommendationsSnapshot.docs[0]?.data()?.careerRecommendations)
          ? recommendationsSnapshot.docs[0].data().careerRecommendations.filter((career) => career?.careerPath)
          : [];
        const selection = profile?.selectedCareerPathway;
        const selectedRecord = selection?.recommendationId
          ? recommendationsSnapshot.docs.find((snapshot) => snapshot.id === selection.recommendationId)?.data()
          : null;
        const selectedCareer = selectedRecord?.careerRecommendations?.find((career) => (
          career.careerPath === selection?.careerPath && career.pathwayId === selection?.pathwayId
        )) || (selection?.careerPath ? selection : null);
        const primaryCareer = selectedCareer || null;
        const roadmapSkills = getRoadmapSkills(primaryCareer);
        const progress = progressSnapshot.docs
          .map((snapshot) => snapshot.data())
          .filter((entry) => entry.completed === true);
        const completedSkillKeys = new Set(progress
          .filter((entry) => entry.careerPath === primaryCareer?.careerPath && typeof entry.skill === 'string')
          .map((entry) => entry.skill.trim().toLocaleLowerCase()));
        const completedSkills = roadmapSkills.filter((item) => completedSkillKeys.has(item.skill.trim().toLocaleLowerCase()));
        const profileHistory = historySnapshot.docs
          .map((snapshot) => ({ date: toDate(snapshot.data().savedAt), kind: 'profile' }))
          .filter((activity) => activity.date);
        const skillHistory = progress
          .filter((entry) => typeof entry.skill === 'string' && entry.careerPath)
          .map((entry) => ({
            date: toDate(entry.completedAt),
            kind: 'skill',
            skill: entry.skill,
            careerPath: entry.careerPath,
          }))
          .filter((activity) => activity.date);

        setDashboardData({
          profile,
          recommendations: uniqueRecommendations,
          latestSavedCareers,
          primaryCareer,
          roadmapSkills,
          completedSkills,
          activities: [...profileHistory, ...skillHistory]
            .sort((first, second) => second.date - first.date)
            .slice(0, 5),
        });
      } catch {
        if (!cancelled) setError('Your dashboard data could not be loaded. Check your connection and try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();
    return () => { cancelled = true; };
  }, [user?.uid, loadAttempt]);

  const completionPercent = useMemo(() => {
    if (!dashboardData?.roadmapSkills.length) return 0;
    return Math.round((dashboardData.completedSkills.length / dashboardData.roadmapSkills.length) * 100);
  }, [dashboardData]);

  if (loading) {
    return <section className="dashboard-page dashboard-state" role="status"><span className="recommendation-spinner" aria-hidden="true" /><p>Loading your dashboard...</p></section>;
  }

  if (error || !dashboardData) {
    return (
      <section className="dashboard-page dashboard-state" role="alert">
        <p>{error || 'Your dashboard is not available right now.'}</p>
        {canUseProfile(user) && firestore && <button className="button button-secondary" type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</button>}
      </section>
    );
  }

  const { profile, recommendations, latestSavedCareers, primaryCareer, roadmapSkills, completedSkills, activities } = dashboardData;
  const studentName = typeof username === 'string' ? username.trim() : '';
  const profileEssentials = [
    typeof profile?.fullName === 'string' && Boolean(profile.fullName.trim()),
    typeof profile?.email === 'string' && Boolean(profile.email.trim()),
    typeof profile?.degree === 'string' && Boolean(profile.degree.trim()),
    typeof profile?.branch === 'string' && Boolean(profile.branch.trim()),
    typeof profile?.college === 'string' && Boolean(profile.college.trim()),
    typeof profile?.graduationYear === 'string' && Boolean(profile.graduationYear.trim()),
    Array.isArray(profile?.interests) && profile.interests.length > 0,
    Boolean(profile?.experienceLevel),
  ];
  const profilePercent = Math.round((profileEssentials.filter(Boolean).length / profileEssentials.length) * 100);
  const completedKeys = new Set(completedSkills.map((item) => item.skill.trim().toLocaleLowerCase()));
  const nextSkills = roadmapSkills.filter((item) => !completedKeys.has(item.skill.trim().toLocaleLowerCase())).slice(0, 3);

  return (
    <section className="dashboard-page" aria-labelledby="dashboard-title">
      <header className="dashboard-welcome">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot" /> Your progress, in one place</p>
          <h1 id="dashboard-title">{studentName ? `Welcome back, ${studentName}.` : 'Welcome to your dashboard.'}</h1>
          <p>See what you have built so far and choose a useful next step.</p>
        </div>
        <div className="dashboard-welcome-actions">
          <button className="button button-secondary" type="button" onClick={onOpenProfile}>Open Student Profile <span aria-hidden="true">↗</span></button>
          <button className="button button-secondary" type="button" onClick={onOpenJobTracker}>Job Application Tracker <span aria-hidden="true">↗</span></button>
          <button className="button button-primary" type="button" onClick={onOpenResume}>Resume Builder <span aria-hidden="true">↗</span></button>
          <button className="button button-secondary" type="button" onClick={onOpenSettings}>Settings <span aria-hidden="true">↗</span></button>
        </div>
      </header>

      {primaryCareer ? (
        <aside className="dashboard-current-pathway">
          <div><span>Current pathway</span><strong>{primaryCareer.careerPath}{primaryCareer.pathwayName ? ` — ${primaryCareer.pathwayName}` : ''}</strong><small>{primaryCareer.careerDomain || 'Saved career plan'}</small></div>
          <button className="button button-secondary" type="button" onClick={() => onContinueLearning(nextSkills[0]?.skill || '', primaryCareer.careerPath)}>Open saved roadmap <span aria-hidden="true">↗</span></button>
        </aside>
      ) : (
        <aside className="dashboard-current-pathway dashboard-current-pathway--empty">
          <div><span>No current pathway</span><strong>Explore careers that connect to your profile.</strong><small>Your saved recommendations and learning roadmap will appear here.</small></div>
          <button className="button button-primary" type="button" onClick={onOpenRecommendations}>Explore careers <span aria-hidden="true">↗</span></button>
        </aside>
      )}

      <div className="dashboard-summary" aria-label="Career and learning summary">
        <article className="dashboard-metric">
          <span>Profile completion</span>
          <strong>{profilePercent}%</strong>
          <progress value={profilePercent} max="100" aria-label={`Profile ${profilePercent}% complete`} />
        </article>
        <article className="dashboard-metric"><span>Career paths</span><strong>{recommendations.length}</strong><small>Saved distinct paths</small></article>
        <article className="dashboard-metric"><span>Skills completed</span><strong>{completedSkills.length}<small> / {roadmapSkills.length}</small></strong><small>{primaryCareer?.pathwayName || primaryCareer?.careerPath || 'Saved learning roadmap'}</small></article>
        <article className="dashboard-metric"><span>Learning progress</span><strong>{completionPercent}%</strong><progress value={completionPercent} max="100" aria-label={`Learning ${completionPercent}% complete`} /></article>
      </div>

      <div className="dashboard-columns">
        <section className="dashboard-section dashboard-learning" aria-labelledby="dashboard-learning-title">
          <div className="dashboard-section-heading"><div><p className="eyebrow">Keep your momentum</p><h2 id="dashboard-learning-title">Continue learning</h2></div>{primaryCareer && <button className="text-action" type="button" onClick={() => onContinueLearning('', primaryCareer.careerPath)}>View roadmap <span aria-hidden="true">↗</span></button>}</div>
          {!primaryCareer ? (
            <p className="dashboard-empty">Choose a career pathway from Explore Careers to build your learning roadmap.</p>
          ) : !roadmapSkills.length ? (
            <p className="dashboard-empty">Your saved roadmap has no skills to learn yet.</p>
          ) : nextSkills.length ? (
            <ol className="dashboard-skill-list">
              {nextSkills.map((item) => (
                <li key={item.skill}>
                  <div><strong>{item.skill}</strong><span>{item.priority ? `${item.priority} priority` : 'Priority unavailable'}</span></div>
                  <button className="button button-primary" type="button" onClick={() => onContinueLearning(item.skill, primaryCareer.careerPath)}>Continue Learning <span aria-hidden="true">↗</span></button>
                </li>
              ))}
            </ol>
          ) : <p className="dashboard-empty">You have completed every unique skill in this roadmap.</p>}
        </section>

        <section className="dashboard-section dashboard-recommendations" aria-labelledby="dashboard-recommendations-title">
          <div className="dashboard-section-heading"><div><p className="eyebrow">Saved for you</p><h2 id="dashboard-recommendations-title">Career recommendations</h2></div><button className="text-action" type="button" onClick={onOpenRecommendations}>View all <span aria-hidden="true">↗</span></button></div>
          {latestSavedCareers.length ? (
            <>
              {latestSavedCareers.slice(0, 3).map((career) => (
                <article className="dashboard-career" key={career.careerPath}>
                  <div className="dashboard-career-heading"><h3>{career.careerPath}</h3><span>{Number.isInteger(career.compatibilityScore) ? `${career.compatibilityScore}% fit` : 'Fit unavailable'}</span></div>
                  {career.whyItSuits && <p>{career.whyItSuits}</p>}
                  {Array.isArray(career.relevantSkills) && career.relevantSkills.length > 0 && <ul className="recommendation-tags">{career.relevantSkills.slice(0, 4).map((skill) => <li key={skill}>{skill}</li>)}</ul>}
                </article>
              ))}
              <p className="dashboard-disclaimer">Fit scores are estimates based on your saved profile, not predictions of hiring outcomes or hiring probabilities.</p>
            </>
          ) : <p className="dashboard-empty">Your saved career paths will appear here after you generate recommendations.</p>}
        </section>
      </div>

      <section className="dashboard-section dashboard-activity" aria-labelledby="dashboard-activity-title">
        <div className="dashboard-section-heading"><div><p className="eyebrow">A record of real progress</p><h2 id="dashboard-activity-title">Recent activity</h2></div></div>
        {activities.length ? (
          <ol className="dashboard-activity-list">
            {activities.map((activity, index) => (
              <li key={`${activity.kind}-${activity.date.toISOString()}-${index}`}>
                <span className="dashboard-activity-mark" aria-hidden="true">{activity.kind === 'skill' ? '✓' : '↻'}</span>
                <div><strong>{activity.kind === 'skill' ? `Completed ${activity.skill}` : 'Profile updated'}</strong>{activity.kind === 'skill' && <span>{activity.careerPath}</span>}</div>
                <time dateTime={activity.date.toISOString()}>{formatDate(activity.date)}</time>
              </li>
            ))}
          </ol>
        ) : <p className="dashboard-empty">No profile updates or skill completions have been saved yet.</p>}
      </section>
    </section>
  );
}

export default StudentDashboard;
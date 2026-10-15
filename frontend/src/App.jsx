import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import AuthPanel from './AuthPanel.jsx';
import { auth, firestore } from './firebase.js';
import StudentProfile from './StudentProfile.jsx';
import CareerRecommendations from './CareerRecommendations.jsx';
import SkillGapLearning from './SkillGapLearning.jsx';
import StudentDashboard from './StudentDashboard.jsx';
import ResumeBuilder from './ResumeBuilder.jsx';
import UsernameSetup, { isValidUsername } from './UsernameSetup.jsx';

const highlights = [
  {
    number: '01',
    title: 'Career discovery',
    description: 'Explore practical paths connected to your interests and strengths.',
  },
  {
    number: '02',
    title: 'Skill gap analysis',
    description: 'See what you already bring and what to learn next.',
  },
  {
    number: '03',
    title: 'Personalized learning',
    description: 'Find video lessons for the skills in your chosen career path.',
  },
  {
    number: '04',
    title: 'Progress tracking',
    description: 'Mark skills complete and keep your learning momentum visible.',
  },
];

const workflowSteps = [
  'Build your profile',
  'Explore careers',
  'Learn skills',
  'Track progress',
];

const pageHashes = {
  home: '',
  dashboard: '#student-dashboard',
  profile: '#student-profile',
  recommendations: '#career-recommendations',
  learning: '#skill-gap-learning',
  resume: '#resume-builder',
  login: '#sign-in',
  register: '#get-started',
  username: '#choose-username',
};

const protectedPages = new Set(['dashboard', 'profile', 'recommendations', 'learning', 'resume', 'username']);

function getPageFromHash(hash) {
  if (hash === '#top') return 'home';
  return Object.entries(pageHashes).find(([, routeHash]) => routeHash && routeHash === hash)?.[0] || 'home';
}

function hasVerifiedAccess(user) {
  return Boolean(user && (
    user.emailVerified
    || user.providerData?.some((provider) => provider.providerId === 'google.com')
  ));
}

function App() {
  const [apiStatus, setApiStatus] = useState('checking');
  const [currentPage, setCurrentPage] = useState(() => getPageFromHash(window.location.hash));
  const [authUser, setAuthUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [studentUsername, setStudentUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState('checking');
  const [usernameLoadAttempt, setUsernameLoadAttempt] = useState(0);
  const [logoutPending, setLogoutPending] = useState(false);
  const [authNotice, setAuthNotice] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [learningFocus, setLearningFocus] = useState({ skill: '', careerPath: '' });
  const [pendingDestination, setPendingDestination] = useState('');

  function navigate(page, { replace = false } = {}) {
    const routeHash = pageHashes[page] ?? '';
    const currentHash = window.location.hash;
    setCurrentPage(page);
    setMobileNavOpen(false);
    if (currentHash !== routeHash) {
      const nextUrl = `${window.location.pathname}${window.location.search}${routeHash}`;
      window.history[replace ? 'replaceState' : 'pushState'](null, '', nextUrl);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  useEffect(() => {
    if (!auth) {
      setAuthReady(true);
      return undefined;
    }

    return onAuthStateChanged(
      auth,
      (user) => {
        setAuthUser(user);
        setStudentUsername('');
        setUsernameStatus('checking');
        setAuthReady(true);
      },
      () => {
        setAuthUser(null);
        setStudentUsername('');
        setUsernameStatus('missing');
        setAuthReady(true);
        setAuthNotice('Your sign-in state could not be restored. Please try signing in again.');
      },
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    const uid = authUser?.uid;
    if (!authReady || !hasVerifiedAccess(authUser)) {
      setStudentUsername('');
      setUsernameStatus('missing');
      return undefined;
    }

    setUsernameStatus('checking');
    if (!firestore || auth?.currentUser?.uid !== uid) {
      setUsernameStatus('error');
      return undefined;
    }

    getDoc(doc(firestore, 'users', uid, 'profile', 'profile'))
      .then((snapshot) => {
        if (cancelled || auth?.currentUser?.uid !== uid) return;
        const savedUsername = snapshot.exists() ? snapshot.data().username : '';
        if (isValidUsername(savedUsername)) {
          setStudentUsername(savedUsername.trim());
          setUsernameStatus('ready');
        } else {
          setStudentUsername('');
          setUsernameStatus('missing');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStudentUsername('');
          setUsernameStatus('error');
        }
      });

    return () => { cancelled = true; };
  }, [authReady, authUser?.uid, hasVerifiedAccess(authUser), usernameLoadAttempt]);

  useEffect(() => {
    function syncPageFromLocation() {
      setCurrentPage(getPageFromHash(window.location.hash));
      setMobileNavOpen(false);
    }

    window.addEventListener('hashchange', syncPageFromLocation);
    window.addEventListener('popstate', syncPageFromLocation);
    return () => {
      window.removeEventListener('hashchange', syncPageFromLocation);
      window.removeEventListener('popstate', syncPageFromLocation);
    };
  }, []);

  useEffect(() => {
    if (!authReady || logoutPending) return;

    if (protectedPages.has(currentPage) && !hasVerifiedAccess(authUser)) {
      setPendingDestination(currentPage === 'username' ? 'dashboard' : currentPage);
      setAuthNotice(authUser
        ? 'Verify your email before opening this student page.'
        : 'Sign in and verify your email to open this student page.');
      navigate('login', { replace: true });
      return;
    }

    if (!hasVerifiedAccess(authUser)) return;

    if (usernameStatus === 'checking') return;

    if (usernameStatus === 'error') {
      if (currentPage !== 'home' && currentPage !== 'username') {
        setPendingDestination((destination) => destination || (protectedPages.has(currentPage) ? currentPage : 'dashboard'));
        navigate('username', { replace: true });
      }
      return;
    }

    if (usernameStatus === 'missing') {
      if (currentPage !== 'home' && currentPage !== 'username') {
        setPendingDestination((destination) => destination || (protectedPages.has(currentPage) ? currentPage : 'dashboard'));
        navigate('username', { replace: true });
      }
      return;
    }

    if (usernameStatus === 'ready' && (currentPage === 'login' || currentPage === 'register' || currentPage === 'username')) {
      const destination = pendingDestination || 'dashboard';
      setPendingDestination('');
      setAuthNotice('');
      navigate(destination, { replace: true });
    }
  }, [authReady, authUser, currentPage, logoutPending, pendingDestination, usernameStatus]);

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    const controller = new AbortController();

    async function checkBackend() {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/health', {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Health check failed with status ${response.status}`);
        }

        const health = await response.json();
        setApiStatus(health.status === 'ok' ? 'connected' : 'disconnected');
      } catch {
        if (!controller.signal.aborted) {
          setApiStatus('disconnected');
        }
      }
    }

    checkBackend();
    return () => controller.abort();
  }, []);

  const apiStatusLabel = {
    checking: 'Checking backend...',
    connected: 'Backend Connected',
    disconnected: 'Backend Disconnected',
  }[apiStatus];

  function handleAuthenticated(user) {
    setAuthUser(user);
    setAuthReady(true);
    if (!hasVerifiedAccess(user)) {
      setAuthNotice('Verify your email before opening your student dashboard.');
      return;
    }
    setUsernameStatus('checking');
    setUsernameLoadAttempt((attempt) => attempt + 1);
    setPendingDestination((destination) => destination || 'dashboard');
    setAuthNotice('');
    navigate('username', { replace: true });
  }

  async function handleLogout() {
    if (!auth) return;

    setLogoutPending(true);
    setAuthNotice('');
    try {
      await signOut(auth);
      setAuthUser(null);
      setStudentUsername('');
      setUsernameStatus('missing');
      setPendingDestination('');
      navigate('home', { replace: true });
    } catch {
      setAuthNotice('You could not be signed out. Please try again.');
    } finally {
      setLogoutPending(false);
    }
  }

  function openProtectedPage(page, label) {
    if (hasVerifiedAccess(authUser)) {
      setAuthNotice('');
      navigate(page);
    } else {
      setPendingDestination(page);
      navigate('login');
      setAuthNotice(authUser
        ? `Verify your email before opening ${label}.`
        : `Sign in and verify your email to open ${label}.`);
    }
  }

  function openAuthPage(page) {
    if (hasVerifiedAccess(authUser)) {
      navigate('dashboard');
      return;
    }
    setAuthNotice('');
    navigate(page);
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="CareerScout AI home" aria-current={currentPage === 'home' ? 'page' : undefined} onClick={(event) => { event.preventDefault(); navigate('home'); }}>
          <span className="brand-mark" aria-hidden="true">C</span>
          <span>CareerScout<span className="brand-ai"> AI</span></span>
        </a>
        <nav id="primary-navigation" className={`site-nav${mobileNavOpen ? ' site-nav--open' : ''}`} aria-label="Main navigation">
          {currentPage === 'home' ? (
            <>
              <a href="#top" aria-current="page" onClick={(event) => { event.preventDefault(); navigate('home'); }}>Home</a>
              <a href="#explore" onClick={() => setMobileNavOpen(false)}>Features</a>
              <a href="#how-it-works" onClick={() => setMobileNavOpen(false)}>About</a>
            </>
          ) : (
            <a href="#top" onClick={(event) => { event.preventDefault(); navigate('home'); }}>Home</a>
          )}
          {authReady && hasVerifiedAccess(authUser) && usernameStatus === 'ready' && (
            <>
              <a href={pageHashes.dashboard} aria-current={currentPage === 'dashboard' ? 'page' : undefined} onClick={(event) => { event.preventDefault(); openProtectedPage('dashboard', 'your Student Dashboard'); }}>Dashboard</a>
              <a href={pageHashes.profile} aria-current={currentPage === 'profile' ? 'page' : undefined} onClick={(event) => { event.preventDefault(); openProtectedPage('profile', 'your Student Profile'); }}>Student Profile</a>
              <a href={pageHashes.recommendations} aria-current={currentPage === 'recommendations' ? 'page' : undefined} onClick={(event) => { event.preventDefault(); openProtectedPage('recommendations', 'Career Recommendations'); }}>Career Recommendations</a>
              <a href={pageHashes.learning} aria-current={currentPage === 'learning' ? 'page' : undefined} onClick={(event) => { event.preventDefault(); setLearningFocus({ skill: '', careerPath: '' }); openProtectedPage('learning', 'Skill Gap & Learning Resources'); }}>Skill Gap & Learning Resources</a>
            </>
          )}
        </nav>
        <button
          className="mobile-menu-toggle"
          type="button"
          aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileNavOpen}
          aria-controls="primary-navigation"
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
        <div className="account-controls">
          {!authReady ? (
            <span className="account-status" role="status">Checking sign-in...</span>
          ) : hasVerifiedAccess(authUser) ? (
            <>
              {usernameStatus === 'ready'
                ? <span className="account-username" title={studentUsername}>{studentUsername}</span>
                : <span className="account-status" role="status">{usernameStatus === 'checking' ? 'Loading account...' : usernameStatus === 'error' ? 'Username unavailable' : 'Username required'}</span>}
              <button className="account-action" type="button" onClick={handleLogout} disabled={logoutPending}>
                {logoutPending ? 'Signing out...' : 'Sign Out'}
              </button>
            </>
          ) : authUser ? (
            <>
              <button className="account-action" type="button" onClick={() => openAuthPage('login')}>Verify email</button>
              <button className="account-action" type="button" onClick={handleLogout} disabled={logoutPending}>{logoutPending ? 'Signing out...' : 'Sign Out'}</button>
            </>
          ) : (
            <button className="auth-nav-link" type="button" onClick={() => openAuthPage('login')}>Sign In</button>
          )}
        </div>
        {!(hasVerifiedAccess(authUser) && currentPage === 'dashboard') && <a
          className="nav-cta"
          href={!authReady ? '#top' : hasVerifiedAccess(authUser) ? usernameStatus === 'ready' ? pageHashes.dashboard : pageHashes.username : authUser ? pageHashes.login : pageHashes.register}
          aria-disabled={!authReady || usernameStatus === 'checking'}
          onClick={(event) => {
            event.preventDefault();
            if (!authReady || usernameStatus === 'checking') return;
            if (hasVerifiedAccess(authUser) && usernameStatus === 'ready') navigate('dashboard');
            else if (hasVerifiedAccess(authUser)) navigate('username');
            else openAuthPage(authUser ? 'login' : 'register');
          }}
        >
          {!authReady ? 'Checking sign-in...' : hasVerifiedAccess(authUser) ? usernameStatus === 'ready' ? 'Go to Dashboard' : usernameStatus === 'checking' ? 'Loading account...' : usernameStatus === 'error' ? 'Retry username setup' : 'Choose Username' : authUser ? 'Verify Email' : 'Get Started'} {!authReady || usernameStatus === 'checking' ? null : <span aria-hidden="true">↗</span>}
        </a>}
      </header>

      {authNotice && <p className="auth-global-notice" role="alert">{authNotice}</p>}

      {!authReady && currentPage !== 'home' ? (
        <div className="recommendation-state dashboard-state" role="status"><span className="recommendation-spinner" aria-hidden="true" /><p>Checking your sign-in...</p></div>
      ) : protectedPages.has(currentPage) && !hasVerifiedAccess(authUser) ? (
        <div className="recommendation-state dashboard-state" role="status"><span className="recommendation-spinner" aria-hidden="true" /><p>Opening sign in...</p></div>
      ) : hasVerifiedAccess(authUser) && usernameStatus === 'checking' && currentPage !== 'home' ? (
        <div className="recommendation-state dashboard-state" role="status"><span className="recommendation-spinner" aria-hidden="true" /><p>Loading your student account...</p></div>
      ) : hasVerifiedAccess(authUser) && usernameStatus !== 'ready' && currentPage !== 'home' && currentPage !== 'username' ? (
        <div className="recommendation-state dashboard-state" role="status"><span className="recommendation-spinner" aria-hidden="true" /><p>Preparing your student account...</p></div>
      ) : hasVerifiedAccess(authUser) && usernameStatus === 'error' && currentPage === 'username' ? (
        <div className="recommendation-state dashboard-state" role="alert">
          <p>Your username could not be checked. Check your connection, then retry.</p>
          <button className="button button-secondary" type="button" onClick={() => setUsernameLoadAttempt((attempt) => attempt + 1)}>Retry</button>
        </div>
      ) : currentPage === 'username' && hasVerifiedAccess(authUser) && usernameStatus === 'missing' ? (
        <UsernameSetup
          user={authUser}
          onSaved={(username) => {
            setStudentUsername(username);
            setUsernameStatus('ready');
          }}
        />
      ) : currentPage === 'dashboard' && hasVerifiedAccess(authUser) ? (
        <StudentDashboard
          user={authUser}
          username={studentUsername}
          onOpenProfile={() => navigate('profile')}
          onOpenResume={() => navigate('resume')}
          onOpenRecommendations={() => navigate('recommendations')}
          onContinueLearning={(skill, careerPath) => {
            setLearningFocus({ skill, careerPath });
            navigate('learning');
          }}
        />
      ) : currentPage === 'profile' && hasVerifiedAccess(authUser) ? (
        <StudentProfile user={authUser} onRequestSignIn={() => openAuthPage('login')} />
      ) : currentPage === 'resume' && hasVerifiedAccess(authUser) ? (
        <ResumeBuilder user={authUser} onBack={() => navigate('dashboard')} />
      ) : currentPage === 'recommendations' && hasVerifiedAccess(authUser) ? (
        <CareerRecommendations
          user={authUser}
          onOpenProfile={() => navigate('profile')}
          onRequestSignIn={() => openAuthPage('login')}
          onContinueLearning={(skill, careerPath) => {
            setLearningFocus({ skill, careerPath });
            navigate('learning');
          }}
        />
      ) : currentPage === 'learning' && hasVerifiedAccess(authUser) ? (
        <SkillGapLearning user={authUser} onRequestSignIn={() => openAuthPage('login')} focusSkill={learningFocus.skill} focusCareerPath={learningFocus.careerPath} />
      ) : currentPage === 'login' || currentPage === 'register' ? (
        <AuthPanel
          user={authUser}
          initialMode={currentPage === 'register' ? 'register' : 'login'}
          onModeChange={(mode) => navigate(mode === 'register' ? 'register' : 'login')}
          onAuthenticated={handleAuthenticated}
        />
      ) : <>
      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> A clearer path starts here</p>
          {import.meta.env.DEV && (
            <div className={`api-status api-status--${apiStatus}`} role="status" aria-live="polite">
              <span className="api-status-indicator" aria-hidden="true" />
              {apiStatusLabel}
            </div>
          )}
          <h1>Your future is<br />yours to <span>explore.</span></h1>
          <p className="hero-description">
            Career ideas, practical skills, and real opportunities, brought together to help you figure out what comes next.
          </p>
          <div className="hero-actions">
            <button className="button button-primary" type="button" disabled={!authReady} onClick={() => {
              if (!authReady) return;
              if (hasVerifiedAccess(authUser)) navigate('dashboard');
              else openAuthPage(authUser ? 'login' : 'register');
            }}>{!authReady ? 'Checking sign-in...' : hasVerifiedAccess(authUser) ? 'Go to Dashboard' : authUser ? 'Verify Email' : 'Get Started'} {authReady && <span aria-hidden="true">↗</span>}</button>
            <a className="button button-secondary" href="#explore">Explore Careers <span aria-hidden="true">↓</span></a>
          </div>
          <div className="hero-note">
            <span className="note-mark" aria-hidden="true">✳</span>
            <p>Made for the questions you have<br />before your first big career move.</p>
          </div>
        </div>

        <div className="hero-visual" aria-label="Students collaborating on their future careers">
          <img
            className="hero-photo"
            src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=85"
            alt="Students sharing ideas around a table"
          />
          <div className="visual-label"><span className="label-star" aria-hidden="true">✳</span> A future in progress</div>
          <div className="path-card">
            <div className="path-card-top">
              <span className="path-icon" aria-hidden="true">↗</span>
              <span className="path-kicker">A path to explore</span>
            </div>
            <strong>Product designer</strong>
            <p>Creative thinking meets useful technology.</p>
            <div className="skill-row"><span>UX research</span><span>Prototyping</span><span>+2</span></div>
          </div>
          <span className="visual-index">01 / 03</span>
        </div>
      </section>

      <section className="explore-section" id="explore">
        <div className="section-heading">
          <p className="eyebrow">Start with what matters to you</p>
          <h2>Curiosity, meet direction.</h2>
        </div>
        <div className="highlight-grid">
          {highlights.map((item) => (
            <article className="highlight" key={item.number}>
              <span className="highlight-number">{item.number}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <span className="highlight-arrow" aria-hidden="true">↗</span>
            </article>
          ))}
        </div>
      </section>

      <section className="workflow-section" id="how-it-works" aria-labelledby="workflow-title">
        <div className="workflow-heading">
          <p className="eyebrow">A simple next-step loop</p>
          <h2 id="workflow-title">From where you are to where you want to go.</h2>
        </div>
        <ol className="workflow-steps">
          {workflowSteps.map((step, index) => (
            <li key={step}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{step}</strong>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-cta" aria-labelledby="home-cta-title">
        <div>
          <p className="eyebrow">Your next step starts with you</p>
          <h2 id="home-cta-title">Make your interests a place to begin.</h2>
        </div>
        <button className="button button-primary" type="button" disabled={!authReady} onClick={() => {
          if (!authReady) return;
          if (hasVerifiedAccess(authUser)) navigate('profile');
          else openAuthPage(authUser ? 'login' : 'register');
        }}>
          {!authReady ? 'Checking sign-in...' : hasVerifiedAccess(authUser) ? 'Build your profile' : authUser ? 'Verify your email' : 'Get Started'} {authReady && <span aria-hidden="true">↗</span>}
        </button>
      </section>
      </>}

      <footer className="site-footer">
        <a className="brand footer-brand" href="#top" onClick={(event) => { event.preventDefault(); navigate('home'); }}>
          <span className="brand-mark" aria-hidden="true">C</span>
          <span>CareerScout<span className="brand-ai"> AI</span></span>
        </a>
        <p>A little more clarity for whatever comes next.</p>
        <span className="footer-credit">Built for students, with possibility in mind.</span>
      </footer>
    </main>
  );
}

export default App;

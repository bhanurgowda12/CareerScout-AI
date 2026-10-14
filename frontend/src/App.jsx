import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import AuthPanel from './AuthPanel.jsx';
import { auth } from './firebase.js';
import StudentProfile from './StudentProfile.jsx';
import CareerRecommendations from './CareerRecommendations.jsx';
import SkillGapLearning from './SkillGapLearning.jsx';

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

function hasVerifiedAccess(user) {
  return Boolean(user && (
    user.emailVerified
    || user.providerData?.some((provider) => provider.providerId === 'google.com')
  ));
}

function App() {
  const [apiStatus, setApiStatus] = useState('checking');
  const [currentPage, setCurrentPage] = useState('home');
  const [authUser, setAuthUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [authNotice, setAuthNotice] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!auth) {
      setAuthReady(true);
      return undefined;
    }

    return onAuthStateChanged(
      auth,
      (user) => {
        setAuthUser(user);
        setAuthReady(true);
      },
      () => {
        setAuthUser(null);
        setAuthReady(true);
        setAuthNotice('Your sign-in state could not be restored. Please try signing in again.');
      },
    );
  }, []);

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
    setAuthNotice('');
    setCurrentPage(hasVerifiedAccess(user) ? 'home' : 'auth');
  }

  async function handleLogout() {
    if (!auth) return;

    setLogoutPending(true);
    setAuthNotice('');
    try {
      await signOut(auth);
      setCurrentPage('home');
    } catch {
      setAuthNotice('You could not be signed out. Please try again.');
    } finally {
      setLogoutPending(false);
    }
  }

  function openProtectedPage(page, label) {
    if (hasVerifiedAccess(authUser)) {
      setAuthNotice('');
      setCurrentPage(page);
    } else {
      setCurrentPage('auth');
      setAuthNotice(authUser
        ? `Verify your email before opening ${label}.`
        : `Sign in and verify your email to open ${label}.`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="CareerScout AI home" aria-current={currentPage === 'home' ? 'page' : undefined} onClick={() => { setCurrentPage('home'); setMobileNavOpen(false); }}>
          <span className="brand-mark" aria-hidden="true">C</span>
          <span>CareerScout<span className="brand-ai"> AI</span></span>
        </a>
        <nav id="primary-navigation" className={`site-nav${mobileNavOpen ? ' site-nav--open' : ''}`} aria-label="Main navigation">
          {currentPage === 'home' ? (
            <>
              <a href="#how-it-works" onClick={() => setMobileNavOpen(false)}>How it works</a>
              <a href="#explore" onClick={() => setMobileNavOpen(false)}>Explore</a>
            </>
          ) : (
            <a href="#top" onClick={() => { setCurrentPage('home'); setMobileNavOpen(false); }}>Home</a>
          )}
          <a
            href="#student-profile"
            aria-current={currentPage === 'profile' ? 'page' : undefined}
            onClick={(event) => { event.preventDefault(); setMobileNavOpen(false); openProtectedPage('profile', 'your Student Profile'); }}
          >Student Profile</a>
          <a
            href="#career-recommendations"
            aria-current={currentPage === 'recommendations' ? 'page' : undefined}
            onClick={(event) => { event.preventDefault(); setMobileNavOpen(false); openProtectedPage('recommendations', 'Career Recommendations'); }}
          >Career Recommendations</a>
          <a
            href="#skill-gap-learning"
            aria-current={currentPage === 'learning' ? 'page' : undefined}
            onClick={(event) => { event.preventDefault(); setMobileNavOpen(false); openProtectedPage('learning', 'Skill Gap & Learning Resources'); }}
          >Skill Gap & Learning Resources</a>
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
          ) : authUser ? (
            <>
              <span className="account-email" title={authUser.email || 'Signed in'}>
                {authUser.email || 'Signed in'}
              </span>
              {!hasVerifiedAccess(authUser) && (
                <button className="account-action" type="button" onClick={() => { setCurrentPage('auth'); setMobileNavOpen(false); }}>
                  Verify email
                </button>
              )}
              <button className="account-action" type="button" onClick={handleLogout} disabled={logoutPending}>
                {logoutPending ? 'Signing out...' : 'Log out'}
              </button>
            </>
          ) : (
            <button className="account-action" type="button" onClick={() => { setCurrentPage('auth'); setMobileNavOpen(false); }}>
              Sign in
            </button>
          )}
        </div>
        <a
          className="nav-cta"
          href={currentPage === 'home' ? '#explore' : '#top'}
          onClick={currentPage !== 'home' ? () => { setCurrentPage('home'); setMobileNavOpen(false); } : undefined}
        >
          {currentPage === 'home' ? 'Find your direction' : 'Back to CareerScout'} <span aria-hidden="true">↗</span>
        </a>
      </header>

      {authNotice && <p className="auth-global-notice" role="alert">{authNotice}</p>}

      {currentPage === 'profile' && hasVerifiedAccess(authUser) ? (
        <StudentProfile user={authUser} onRequestSignIn={() => setCurrentPage('auth')} />
      ) : currentPage === 'recommendations' && hasVerifiedAccess(authUser) ? (
        <CareerRecommendations
          user={authUser}
          onOpenProfile={() => setCurrentPage('profile')}
          onRequestSignIn={() => setCurrentPage('auth')}
        />
      ) : currentPage === 'learning' && hasVerifiedAccess(authUser) ? (
        <SkillGapLearning user={authUser} onRequestSignIn={() => setCurrentPage('auth')} />
      ) : currentPage === 'auth' || currentPage === 'profile' ? (
        <AuthPanel user={authUser} onAuthenticated={handleAuthenticated} />
      ) : currentPage === 'recommendations' ? (
        <AuthPanel user={authUser} onAuthenticated={handleAuthenticated} />
      ) : currentPage === 'learning' ? (
        <AuthPanel user={authUser} onAuthenticated={handleAuthenticated} />
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
            <a className="button button-primary" href="#explore">Get Started <span aria-hidden="true">↗</span></a>
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
        <button className="button button-primary" type="button" onClick={() => openProtectedPage('profile', 'your Student Profile')}>
          Build your profile <span aria-hidden="true">↗</span>
        </button>
      </section>
      </>}

      <footer className="site-footer">
        <a className="brand footer-brand" href="#top" onClick={() => setCurrentPage('home')}>
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

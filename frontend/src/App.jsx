import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import AuthPanel from './AuthPanel.jsx';
import { auth } from './firebase.js';
import StudentProfile from './StudentProfile.jsx';

const highlights = [
  {
    number: '01',
    title: 'Explore career paths',
    description: 'See where your interests and strengths could take you.',
  },
  {
    number: '02',
    title: 'Spot skill gaps',
    description: 'Understand what to learn next for the roles you want.',
  },
  {
    number: '03',
    title: 'Find your next step',
    description: 'Discover learning resources and early-career opportunities.',
  },
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

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="CareerScout AI home" onClick={() => setCurrentPage('home')}>
          <span className="brand-mark" aria-hidden="true">C</span>
          <span>CareerScout<span className="brand-ai"> AI</span></span>
        </a>
        <nav className="site-nav" aria-label="Main navigation">
          {currentPage === 'home' ? (
            <>
              <a href="#how-it-works">How it works</a>
              <a href="#explore">Explore</a>
            </>
          ) : (
            <a href="#top" onClick={() => setCurrentPage('home')}>Home</a>
          )}
          <a
            href="#student-profile"
            aria-current={currentPage === 'profile' ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault();
              if (hasVerifiedAccess(authUser)) {
                setAuthNotice('');
                setCurrentPage('profile');
              } else {
                setCurrentPage('auth');
                setAuthNotice(authUser
                  ? 'Verify your email before opening your Student Profile.'
                  : 'Sign in or create an account, then verify your email to open your Student Profile.');
              }
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            Student Profile
          </a>
        </nav>
        <div className="account-controls">
          {!authReady ? (
            <span className="account-status" role="status">Checking sign-in...</span>
          ) : authUser ? (
            <>
              <span className="account-email" title={authUser.email || 'Signed in'}>
                {authUser.email || 'Signed in'}
              </span>
              {!hasVerifiedAccess(authUser) && (
                <button className="account-action" type="button" onClick={() => setCurrentPage('auth')}>
                  Verify email
                </button>
              )}
              <button className="account-action" type="button" onClick={handleLogout} disabled={logoutPending}>
                {logoutPending ? 'Signing out...' : 'Log out'}
              </button>
            </>
          ) : (
            <button className="account-action" type="button" onClick={() => setCurrentPage('auth')}>
              Sign in
            </button>
          )}
        </div>
        <a
          className="nav-cta"
          href={currentPage === 'home' ? '#explore' : '#top'}
          onClick={currentPage === 'profile' ? () => setCurrentPage('home') : undefined}
        >
          {currentPage === 'home' ? 'Find your direction' : 'Back to CareerScout'} <span aria-hidden="true">↗</span>
        </a>
      </header>

      {authNotice && <p className="auth-global-notice" role="alert">{authNotice}</p>}

      {currentPage === 'profile' && hasVerifiedAccess(authUser) ? (
        <StudentProfile user={authUser} onRequestSignIn={() => setCurrentPage('auth')} />
      ) : currentPage === 'auth' || currentPage === 'profile' ? (
        <AuthPanel user={authUser} onAuthenticated={handleAuthenticated} />
      ) : <>
      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> A clearer path starts here</p>
          <div className={`api-status api-status--${apiStatus}`} role="status" aria-live="polite">
            <span className="api-status-indicator" aria-hidden="true" />
            {apiStatusLabel}
          </div>
          <h1>Your future is<br />yours to <span>explore.</span></h1>
          <p className="hero-description">
            Career ideas, practical skills, and real opportunities, brought together to help you figure out what comes next.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#explore">Get Started <span aria-hidden="true">↗</span></a>
            <a className="button button-secondary" href="#how-it-works">Explore Careers <span aria-hidden="true">↓</span></a>
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
        <div className="section-heading" id="how-it-works">
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

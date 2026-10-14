import React, { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from './firebase.js';

function isEmailPasswordUser(user) {
  return user?.providerData?.some((provider) => provider.providerId === 'password') ?? false;
}

function getAuthErrorMessage(error) {
  switch (error?.code) {
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/email-already-in-use':
      return 'An account already exists for this email. Sign in instead.';
    case 'auth/weak-password':
      return 'Choose a password with at least 8 characters.';
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'The email or password is incorrect.';
    case 'auth/user-disabled':
      return 'This account is disabled. Contact the project administrator.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled for the Firebase project.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was canceled. You can try again when ready.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Allow popups and try again.';
    case 'auth/unauthorized-domain':
      return 'This website is not authorized for Firebase sign-in. Add its hostname in Firebase Authentication settings.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email. Sign in using its original method.';
    case 'auth/network-request-failed':
      return 'A network error interrupted sign-in. Check your connection and try again.';
    case 'auth/too-many-requests':
      return 'Too many attempts were made. Wait a little while and try again.';
    default:
      return 'Sign-in could not be completed. Please try again.';
  }
}

function AuthPanel({ user, onAuthenticated, initialMode = 'login', onModeChange }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pendingAction, setPendingAction] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [verificationUser, setVerificationUser] = useState(() => (
    auth?.currentUser && isEmailPasswordUser(auth.currentUser) && !auth.currentUser.emailVerified
      ? auth.currentUser
      : null
  ));
  const [verificationMessage, setVerificationMessage] = useState('');

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (isEmailPasswordUser(user) && !user.emailVerified) {
      setVerificationUser(user);
    } else if (user?.emailVerified) {
      setVerificationUser(null);
    }
  }, [user]);

  function validateCredentials() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMessage('Enter a valid email address.');
      return false;
    }
    if (mode === 'register' && password.length < 8) {
      setErrorMessage('Choose a password with at least 8 characters.');
      return false;
    }
    return true;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');
    setVerificationMessage('');

    if (!validateCredentials()) return;

    if (!auth) {
      setErrorMessage('Firebase is not configured. Add your Firebase web app settings and restart the frontend.');
      return;
    }

    setPendingAction(mode);
    try {
      if (mode === 'register') {
        const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
        setVerificationUser(result.user);
        onAuthenticated(result.user);
        try {
          await sendEmailVerification(result.user);
          setVerificationMessage(`A verification link was sent to ${result.user.email}. Check your inbox and spam folder. Verify your email before choosing your username and entering CareerScout.`);
        } catch {
          setVerificationMessage('Your account was created, but the verification email could not be sent. Use the resend button below to try again.');
        }
      } else {
        const result = await signInWithEmailAndPassword(auth, email.trim(), password);
        if (!result.user.emailVerified) {
          setVerificationUser(result.user);
          setVerificationMessage(`Please verify ${result.user.email} before choosing your username and entering CareerScout. You can resend the verification email below.`);
          onAuthenticated(result.user);
          return;
        }
        setVerificationUser(null);
        onAuthenticated(result.user);
      }
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setPendingAction('');
    }
  }

  async function handleResendVerification() {
    if (!verificationUser) return;

    setErrorMessage('');
    setPendingAction('resend');
    try {
      await sendEmailVerification(verificationUser);
      setVerificationMessage(`A new verification link was sent to ${verificationUser.email}. Check your inbox and spam folder.`);
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setPendingAction('');
    }
  }

  async function handleCheckVerification() {
    if (!verificationUser) return;

    setErrorMessage('');
    setPendingAction('check');
    try {
      await reload(verificationUser);
      if (verificationUser.emailVerified) {
        await verificationUser.getIdToken(true);
        setVerificationUser(null);
        setVerificationMessage('Email verified. Choose your username to continue.');
        onAuthenticated(verificationUser);
      } else {
        setVerificationMessage('Your email is not verified yet. Open the link in the email, then check again.');
      }
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setPendingAction('');
    }
  }

  async function handleGoogleSignIn() {
    setErrorMessage('');
    if (!auth) {
      setErrorMessage('Firebase is not configured. Add your Firebase web app settings and restart the frontend.');
      return;
    }

    setPendingAction('google');
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      onAuthenticated(result.user);
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setPendingAction('');
    }
  }

  const isPending = pendingAction !== '';
  const visibleVerificationMessage = verificationMessage || (
    verificationUser && !verificationUser.emailVerified
      ? `Verify ${verificationUser.email} before choosing your username and entering CareerScout. You can resend the verification email below.`
      : ''
  );

  return (
    <section className="auth-page" aria-labelledby="auth-title">
      <div className="auth-panel">
        <div className="auth-heading">
          <p className="eyebrow"><span className="eyebrow-dot" /> Your CareerScout account</p>
          <h1 id="auth-title">{mode === 'register' ? 'Create your account.' : 'Welcome back.'}</h1>
          <p>{mode === 'register' ? 'Start building a clearer picture of your next step.' : 'Sign in to continue to CareerScout.'}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Email address</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="form-field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              value={password}
              minLength={mode === 'register' ? 8 : undefined}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {visibleVerificationMessage && <p className="auth-success" role="status">{visibleVerificationMessage}</p>}
          {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}

          {verificationUser && !verificationUser.emailVerified && (
            <div className="verification-actions">
              <button className="button button-secondary" type="button" onClick={handleResendVerification} disabled={isPending}>
                {pendingAction === 'resend' ? 'Sending...' : 'Resend verification email'}
              </button>
              <button className="verification-check" type="button" onClick={handleCheckVerification} disabled={isPending}>
                {pendingAction === 'check' ? 'Checking...' : "I've verified my email"}
              </button>
            </div>
          )}

          <button className="button button-primary auth-submit" type="submit" disabled={isPending}>
            {pendingAction === 'register'
              ? 'Creating account...'
              : pendingAction === 'login'
                ? 'Signing in...'
                : mode === 'register' ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="auth-divider"><span>or</span></div>
        <button className="google-signin" type="button" onClick={handleGoogleSignIn} disabled={isPending}>
          <span className="google-mark" aria-hidden="true">G</span>
          {pendingAction === 'google' ? 'Connecting to Google...' : 'Continue with Google'}
        </button>

        <p className="auth-switch">
          {mode === 'register' ? 'Already have an account?' : 'New to CareerScout?'}{' '}
          <button
            type="button"
            onClick={() => {
              const nextMode = mode === 'register' ? 'login' : 'register';
              setMode(nextMode);
              onModeChange?.(nextMode);
              setErrorMessage('');
            }}
            disabled={isPending}
          >
            {mode === 'register' ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      </div>
    </section>
  );
}

export default AuthPanel;
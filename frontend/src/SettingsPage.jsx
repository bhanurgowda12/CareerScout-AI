import React, { useEffect, useState } from 'react';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, firestore } from './firebase.js';
import { hasPasswordProvider, isValidUsername } from './settingsUtils.js';

function getProviderName(user) {
  const providers = new Set(user?.providerData?.map((provider) => provider.providerId) || []);
  const names = [];
  if (providers.has('password')) names.push('Email and password');
  if (providers.has('google.com')) names.push('Google');
  return names.join(', ') || 'Unavailable';
}

function getPasswordError(error) {
  switch (error?.code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'The current password is incorrect.';
    case 'auth/requires-recent-login':
      return 'For your security, sign out and sign in again before changing your password.';
    case 'auth/weak-password':
      return 'Choose a stronger password with at least 8 characters.';
    case 'auth/too-many-requests':
      return 'There have been too many attempts. Wait a while and try again.';
    case 'auth/network-request-failed':
      return 'A network error interrupted the password change. Check your connection and try again.';
    case 'auth/user-mismatch':
      return 'The signed-in account changed. Sign in again and retry.';
    default:
      return 'Your password could not be changed. Please try again.';
  }
}

function SettingsPage({ user, username, onUsernameChanged, theme, onThemeChange, onLogout, logoutPending }) {
  const [usernameDraft, setUsernameDraft] = useState(username || '');
  const [usernamePending, setUsernamePending] = useState(false);
  const [usernameFeedback, setUsernameFeedback] = useState({ type: '', message: '' });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordPending, setPasswordPending] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState({ type: '', message: '' });

  useEffect(() => {
    setUsernameDraft(username || '');
    setUsernameFeedback({ type: '', message: '' });
  }, [user?.uid, username]);

  async function saveUsername(event) {
    event.preventDefault();
    const normalizedUsername = usernameDraft.trim();
    setUsernameFeedback({ type: '', message: '' });
    if (!isValidUsername(normalizedUsername)) {
      setUsernameFeedback({ type: 'error', message: 'Use 3 to 20 characters: letters, numbers, and underscores only.' });
      return;
    }

    const currentUser = auth?.currentUser;
    if (!firestore || !currentUser || currentUser.uid !== user?.uid) {
      setUsernameFeedback({ type: 'error', message: 'Your signed-in account could not be verified. Sign in again, then retry.' });
      return;
    }
    if (!currentUser.emailVerified && !currentUser.providerData?.some((provider) => provider.providerId === 'google.com')) {
      setUsernameFeedback({ type: 'error', message: 'Verify your email before changing your username.' });
      return;
    }

    setUsernamePending(true);
    let firestoreUpdated = false;
    try {
      await setDoc(
        doc(firestore, 'users', currentUser.uid, 'profile', 'profile'),
        { username: normalizedUsername },
        { merge: true },
      );
      firestoreUpdated = true;
      onUsernameChanged(normalizedUsername);

      try {
        await updateProfile(currentUser, { displayName: normalizedUsername });
        setUsernameFeedback({ type: 'success', message: 'Your username was updated.' });
      } catch {
        setUsernameFeedback({
          type: 'error',
          message: 'Your CareerScout username was saved, but Firebase Authentication could not sync the display name. Save again to retry the sync.',
        });
      }
    } catch (error) {
      setUsernameFeedback({
        type: 'error',
        message: firestoreUpdated
          ? 'Your Firestore username was saved, but the remaining account update failed. Save again to retry.'
          : error?.code === 'permission-denied'
            ? 'Firestore denied this profile update. Check your sign-in status and try again.'
            : 'Your username could not be saved. Check your connection and try again.',
      });
    } finally {
      setUsernamePending(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setPasswordFeedback({ type: '', message: '' });
    if (!currentPassword) {
      setPasswordFeedback({ type: 'error', message: 'Enter your current password.' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordFeedback({ type: 'error', message: 'Choose a new password with at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'error', message: 'The new password and confirmation do not match.' });
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordFeedback({ type: 'error', message: 'Choose a new password that differs from your current password.' });
      return;
    }

    const currentUser = auth?.currentUser;
    if (!currentUser || currentUser.uid !== user?.uid || !currentUser.email || !hasPasswordProvider(currentUser)) {
      setPasswordFeedback({ type: 'error', message: 'Your password provider could not be verified. Sign in again and retry.' });
      return;
    }

    setPasswordPending(true);
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordFeedback({ type: 'success', message: 'Your password was changed.' });
    } catch (error) {
      setPasswordFeedback({ type: 'error', message: getPasswordError(error) });
    } finally {
      setPasswordPending(false);
    }
  }

  const passwordProviderAvailable = hasPasswordProvider(user);

  return (
    <section className="settings-page" aria-labelledby="settings-title">
      <header className="settings-header">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot" /> Your account</p>
          <h1 id="settings-title">Settings</h1>
          <p>Manage your account details and appearance.</p>
        </div>
        <button className="button button-secondary settings-logout" type="button" onClick={onLogout} disabled={logoutPending}>
          {logoutPending ? 'Signing out...' : 'Sign Out'}
        </button>
      </header>

      <section className="settings-section" aria-labelledby="settings-account-title">
        <div className="settings-section-heading">
          <h2 id="settings-account-title">Account information</h2>
          <p>Details from your signed-in Firebase account.</p>
        </div>
        <dl className="settings-account-details">
          <div><dt>Account email</dt><dd>{user?.email || 'Unavailable'}</dd></div>
          <div><dt>Sign-in provider</dt><dd>{getProviderName(user)}</dd></div>
          <div><dt>Email verification</dt><dd>{user?.emailVerified ? 'Verified' : 'Not verified'}</dd></div>
        </dl>
      </section>

      <section className="settings-section" aria-labelledby="settings-username-title">
        <div className="settings-section-heading">
          <h2 id="settings-username-title">Username</h2>
          <p>Shown in your CareerScout account.</p>
        </div>
        <form className="settings-form" onSubmit={saveUsername} noValidate>
          <label className="form-field" htmlFor="settings-username">
            <span>Username</span>
            <input
              id="settings-username"
              name="username"
              autoComplete="nickname"
              value={usernameDraft}
              maxLength={20}
              aria-describedby="settings-username-help"
              onChange={(event) => {
                setUsernameDraft(event.target.value);
                setUsernameFeedback({ type: '', message: '' });
              }}
            />
          </label>
          <p className="form-hint" id="settings-username-help">3 to 20 characters. Letters, numbers, and underscores only.</p>
          {usernameFeedback.message && <p className={`settings-feedback settings-feedback--${usernameFeedback.type}`} role={usernameFeedback.type === 'error' ? 'alert' : 'status'}>{usernameFeedback.message}</p>}
          <button className="button button-primary" type="submit" disabled={usernamePending}>
            {usernamePending ? 'Saving username...' : 'Save username'}
          </button>
        </form>
      </section>

      <section className="settings-section" aria-labelledby="settings-password-title">
        <div className="settings-section-heading">
          <h2 id="settings-password-title">Password</h2>
          <p>Change the password linked to your sign-in method.</p>
        </div>
        {passwordProviderAvailable ? (
          <form className="settings-form" onSubmit={changePassword} noValidate>
            <label className="form-field" htmlFor="current-password">
              <span>Current password</span>
              <input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            </label>
            <label className="form-field" htmlFor="new-password">
              <span>New password</span>
              <input id="new-password" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            </label>
            <label className="form-field" htmlFor="confirm-password">
              <span>Confirm new password</span>
              <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            </label>
            {passwordFeedback.message && <p className={`settings-feedback settings-feedback--${passwordFeedback.type}`} role={passwordFeedback.type === 'error' ? 'alert' : 'status'}>{passwordFeedback.message}</p>}
            <button className="button button-primary" type="submit" disabled={passwordPending}>
              {passwordPending ? 'Changing password...' : 'Change password'}
            </button>
          </form>
        ) : (
          <p className="settings-provider-note">This account uses Google sign-in and has no linked password to change here.</p>
        )}
      </section>

      <section className="settings-section" aria-labelledby="settings-theme-title">
        <div className="settings-section-heading">
          <h2 id="settings-theme-title">Appearance</h2>
          <p>Choose a theme for CareerScout on this device.</p>
        </div>
        <div className="settings-theme-options" aria-label="Color theme">
          {['light', 'dark'].map((option) => (
            <button
              className={`settings-theme-option${theme === option ? ' settings-theme-option--selected' : ''}`}
              key={option}
              type="button"
              aria-pressed={theme === option}
              onClick={() => onThemeChange(option)}
            >
              <span className={`settings-theme-swatch settings-theme-swatch--${option}`} aria-hidden="true" />
              {option === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}

export default SettingsPage;
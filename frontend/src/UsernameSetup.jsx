import React, { useState } from 'react';
import { updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, firestore } from './firebase.js';
import { isValidUsername } from './settingsUtils.js';

export { isValidUsername } from './settingsUtils.js';

function UsernameSetup({ user, onSaved }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function saveUsername(event) {
    event.preventDefault();
    const normalizedUsername = username.trim();
    if (!isValidUsername(normalizedUsername)) {
      setError('Use 3 to 20 characters: letters, numbers, and underscores only.');
      return;
    }
    if (!firestore || !auth?.currentUser || auth.currentUser.uid !== user?.uid) {
      setError('Your signed-in account could not be verified. Sign in again, then retry.');
      return;
    }
    if (!user.emailVerified && !user.providerData?.some((provider) => provider.providerId === 'google.com')) {
      setError('Verify your email before saving a username.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await updateProfile(auth.currentUser, { displayName: normalizedUsername });
      await setDoc(
        doc(firestore, 'users', auth.currentUser.uid, 'profile', 'profile'),
        { username: normalizedUsername },
        { merge: true },
      );
      onSaved(normalizedUsername);
    } catch (saveError) {
      setError(saveError?.code === 'permission-denied'
        ? 'Firestore denied the profile update. Confirm the current rules are deployed, then retry.'
        : 'Your username could not be saved. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="auth-page" aria-labelledby="username-title">
      <div className="auth-panel">
        <div className="auth-heading">
          <p className="eyebrow"><span className="eyebrow-dot" /> Your CareerScout account</p>
          <h1 id="username-title">Choose your username</h1>
          <p>Your username will be displayed in CareerScout AI.</p>
        </div>
        <form className="auth-form" onSubmit={saveUsername} noValidate>
          <label className="form-field" htmlFor="student-username">
            <span>Username</span>
            <input
              id="student-username"
              name="username"
              autoComplete="nickname"
              value={username}
              maxLength={20}
              onChange={(event) => {
                setUsername(event.target.value);
                if (error) setError('');
              }}
              aria-describedby={error ? 'username-error' : 'username-help'}
            />
          </label>
          <p className="form-hint" id="username-help">3 to 20 characters. Letters, numbers, and underscores only.</p>
          {error && <p className="auth-error" id="username-error" role="alert">{error}</p>}
          <button className="button button-primary auth-submit" type="submit" disabled={saving}>
            {saving ? 'Saving username...' : 'Save and Continue'}
          </button>
        </form>
      </div>
    </section>
  );
}

export default UsernameSetup;
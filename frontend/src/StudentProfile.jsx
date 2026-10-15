import React, { useEffect, useRef, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, firestore } from './firebase.js';
import { careerDomains } from './careerCatalog.js';

const PROFILE_STORAGE_KEY = 'careerscout-student-profile';
const legacyCareerOptions = [
  'AI/Machine Learning',
  'Web Development',
  'Data Science',
  'Cybersecurity',
  'Cloud Computing',
  'Mobile App Development',
];
const careerOptions = [...new Set([...legacyCareerOptions, ...careerDomains.map((domain) => domain.label)])];
const experienceOptions = ['Beginner', 'Intermediate', 'Advanced'];

function createEmptyProfile() {
  return {
    username: '',
    preferredWorkAreas: [],
    preferredIndustries: [],
    careerInterests: [],
    selectedCareerPathway: null,
    fullName: '',
    email: '',
    degree: '',
    branch: '',
    college: '',
    graduationYear: '',
    skills: [],
    interests: [],
    projects: [],
    certifications: [],
    experienceLevel: '',
  };
}

function normalizeProfile(value) {
  const source = value && typeof value === 'object' ? value : {};
  try {
    return {
      username: typeof source.username === 'string' ? source.username : '',
      preferredWorkAreas: Array.isArray(source.preferredWorkAreas) ? source.preferredWorkAreas.filter((item) => typeof item === 'string') : [],
      preferredIndustries: Array.isArray(source.preferredIndustries) ? source.preferredIndustries.filter((item) => typeof item === 'string') : [],
      careerInterests: Array.isArray(source.careerInterests) ? source.careerInterests.filter((item) => typeof item === 'string') : [],
      selectedCareerPathway: source.selectedCareerPathway && typeof source.selectedCareerPathway === 'object'
        ? { ...source.selectedCareerPathway }
        : null,
      fullName: typeof source.fullName === 'string' ? source.fullName : '',
      email: typeof source.email === 'string' ? source.email : '',
      degree: typeof source.degree === 'string' ? source.degree : '',
      branch: typeof source.branch === 'string' ? source.branch : '',
      college: typeof source.college === 'string' ? source.college : '',
      graduationYear: typeof source.graduationYear === 'string' ? source.graduationYear : '',
      skills: Array.isArray(source.skills) ? source.skills.filter((item) => typeof item === 'string') : [],
      interests: Array.isArray(source.interests) ? source.interests.filter((item) => typeof item === 'string') : [],
      projects: Array.isArray(source.projects) ? source.projects.map((project) => ({
        name: typeof project?.name === 'string' ? project.name : '',
        description: typeof project?.description === 'string' ? project.description : '',
        technologies: typeof project?.technologies === 'string' ? project.technologies : '',
      })) : [],
      certifications: Array.isArray(source.certifications) ? source.certifications.map((certification) => ({
        name: typeof certification?.name === 'string' ? certification.name : '',
        issuer: typeof certification?.issuer === 'string' ? certification.issuer : '',
      })) : [],
      experienceLevel: typeof source.experienceLevel === 'string' ? source.experienceLevel : '',
    };
  } catch {
    return createEmptyProfile();
  }
}

function readLocalProfile() {
  try {
    const savedProfile = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!savedProfile) return null;
    const parsedProfile = JSON.parse(savedProfile);
    return parsedProfile && typeof parsedProfile === 'object' && !Array.isArray(parsedProfile)
      ? normalizeProfile(parsedProfile)
      : null;
  } catch {
    return null;
  }
}

function canUseProfile(user) {
  return Boolean(user?.uid && (
    user.emailVerified
    || user.providerData?.some((provider) => provider.providerId === 'google.com')
  ));
}

function getUserProfileRef(uid) {
  return doc(firestore, 'users', uid, 'profile', 'profile');
}

function getProfileHistoryCollectionRef(uid) {
  return collection(firestore, 'users', uid, 'profileHistory');
}

function reportFirestoreFailure(operation, sdkOperation, user, error, documentPath) {
  if (!import.meta.env.DEV) return;

  const currentUser = auth?.currentUser;
  const uid = user?.uid;
  const providers = currentUser?.providerData || [];
  const hasPasswordProvider = providers.some((provider) => provider.providerId === 'password');
  const hasGoogleProvider = providers.some((provider) => provider.providerId === 'google.com');
  const diagnostics = [
    '[CareerScout Firestore]',
    `operation: ${operation}`,
    `sdkOperation: ${sdkOperation}`,
    `errorCode: ${error?.code || 'unknown'}`,
    `errorMessage: ${error?.message || 'No error message provided'}`,
    `firebaseUserExists: ${Boolean(currentUser)}`,
    `userMatchesProfile: ${Boolean(currentUser && uid && currentUser.uid === uid)}`,
    `emailVerificationRequired: ${currentUser ? hasPasswordProvider && !hasGoogleProvider : 'unknown (no user)'}`,
    `emailVerified: ${currentUser ? currentUser.emailVerified === true : 'unknown (no user)'}`,
    `googleProvider: ${hasGoogleProvider}`,
    `documentPath: ${documentPath || (uid ? `users/${uid}/profile/profile` : '(no authenticated user)')}`,
  ].join('\n');

  console.error(diagnostics);
}

function getProfileErrorMessage(error, operation) {
  if (error?.code === 'permission-denied') {
    return `Firestore denied the profile ${operation} operation (permission-denied). Confirm the rules match users/{userId}/profile/{profileId} and restrict access to the authenticated owner.`;
  }
  if (error?.code === 'unauthenticated') {
    return 'Your sign-in expired. Sign in again to access your profile.';
  }
  if (error?.code === 'unavailable' || error?.code === 'network-request-failed') {
    return `Your profile ${operation} failed because Firestore is unavailable. Check your connection and try again.`;
  }
  return `Your profile ${operation} failed. Please try again.`;
}

function formatHistoryDate(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== 'function') return 'Save time unavailable';
  return timestamp.toDate().toLocaleString();
}

function ProfileSection({ number, title, description, className = '', children }) {
  return (
    <section className={`profile-section${className ? ` ${className}` : ''}`}>
      <div className="profile-section-heading">
        <span className="profile-section-number">{number}</span>
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function FormField({ id, label, error, children }) {
  return (
    <div className={`form-field${error ? ' form-field--error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

function StudentProfile({ user, onRequestSignIn }) {
  const [profile, setProfile] = useState(createEmptyProfile);
  const [errors, setErrors] = useState({});
  const [skillInput, setSkillInput] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [profileLoadError, setProfileLoadError] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [cloudProfileExists, setCloudProfileExists] = useState(false);
  const [profileHistory, setProfileHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [restoringVersionId, setRestoringVersionId] = useState('');
  const [localProfile, setLocalProfile] = useState(null);
  const [loadedUid, setLoadedUid] = useState(null);
  const [loadVersion, setLoadVersion] = useState(0);
  const activeUid = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const uid = user?.uid;
    activeUid.current = uid || null;
    setProfile(createEmptyProfile());
    setErrors({});
    setSkillInput('');
    setFeedback({ type: '', message: '' });
    setProfileLoadError('');
    setCloudProfileExists(false);
    setProfileHistory([]);
    setHistoryLoading(true);
    setHistoryError('');
    setSelectedHistory(null);
    setLocalProfile(null);
    setLoadedUid(null);
    setSaving(false);
    setDeleting(false);
    setImporting(false);

    if (!canUseProfile(user) || !firestore || auth?.currentUser?.uid !== uid) {
      setProfileLoading(false);
      setHistoryLoading(false);
      setFeedback({ type: 'error', message: 'Sign in with a verified account to load your Student Profile.' });
      return () => {
        cancelled = true;
      };
    }

    setProfileLoading(true);
    const profileRef = getUserProfileRef(uid);
    const historyRef = getProfileHistoryCollectionRef(uid);

    getDoc(profileRef)
      .then((snapshot) => {
        if (cancelled || activeUid.current !== uid || auth.currentUser?.uid !== uid) return;

        if (snapshot.exists()) {
          setProfile(normalizeProfile(snapshot.data()));
          setCloudProfileExists(true);
        } else {
          setProfile(createEmptyProfile());
          setCloudProfileExists(false);
          setLocalProfile(readLocalProfile());
        }
        setLoadedUid(uid);
      })
      .catch((error) => {
          reportFirestoreFailure('read', 'getDoc profile', user, error);
        if (!cancelled && activeUid.current === uid) {
          setProfileLoadError(getProfileErrorMessage(error, 'load'));
        }
      })
      .finally(() => {
        if (!cancelled && activeUid.current === uid) setProfileLoading(false);
      });

    getDocs(query(historyRef, orderBy('savedAt', 'desc')))
      .then((snapshot) => {
        if (cancelled || activeUid.current !== uid || auth.currentUser?.uid !== uid) return;
        setProfileHistory(snapshot.docs.map((version) => ({
          ...version.data(),
          versionId: version.id,
        })));
      })
      .catch((error) => {
        reportFirestoreFailure(
          'read',
          'getDocs profile history',
          user,
          error,
          `users/${uid}/profileHistory`,
        );
        if (!cancelled && activeUid.current === uid) {
          setHistoryError(getProfileErrorMessage(error, 'load history'));
        }
      })
      .finally(() => {
        if (!cancelled && activeUid.current === uid) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.uid, loadVersion]);

  function isCurrentUser() {
    return Boolean(
      canUseProfile(user)
      && auth?.currentUser?.uid === user.uid
      && activeUid.current === user.uid,
    );
  }

  async function refreshProfileHistory() {
    if (!isCurrentUser()) return;

    try {
      const snapshot = await getDocs(query(
        getProfileHistoryCollectionRef(user.uid),
        orderBy('savedAt', 'desc'),
      ));
      if (!isCurrentUser()) return;
      setProfileHistory(snapshot.docs.map((version) => ({
        ...version.data(),
        versionId: version.id,
      })));
      setHistoryError('');
    } catch (error) {
      reportFirestoreFailure(
        'read',
        'getDocs profile history',
        user,
        error,
        `users/${user.uid}/profileHistory`,
      );
      if (isCurrentUser()) setHistoryError(getProfileErrorMessage(error, 'load history'));
    }
  }

  async function retryProfileHistoryLoad() {
    setHistoryLoading(true);
    setHistoryError('');
    await refreshProfileHistory();
    if (isCurrentUser()) setHistoryLoading(false);
  }

  function updateField(field, value) {
    setProfile((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
    setFeedback({ type: '', message: '' });
  }

  function updateEntry(collection, index, field, value) {
    setProfile((current) => ({
      ...current,
      [collection]: current[collection].map((entry, entryIndex) => (
        entryIndex === index ? { ...entry, [field]: value } : entry
      )),
    }));
    setFeedback({ type: '', message: '' });
  }

  function addSkill(event) {
    event.preventDefault();
    const skill = skillInput.trim();
    if (!skill || profile.skills.some((existing) => existing.toLowerCase() === skill.toLowerCase())) {
      return;
    }
    updateField('skills', [...profile.skills, skill]);
    setSkillInput('');
  }

  function toggleInterest(interest) {
    const interests = profile.interests.includes(interest)
      ? profile.interests.filter((item) => item !== interest)
      : [...profile.interests, interest];
    updateField('interests', interests);
  }

  function validateProfile() {
    const nextErrors = {};
    const requiredFields = [
      ['fullName', 'Enter your full name.'],
      ['email', 'Enter your email address.'],
      ['degree', 'Enter your degree.'],
      ['branch', 'Enter your branch or specialization.'],
      ['college', 'Enter your college name.'],
      ['graduationYear', 'Enter your graduation year.'],
      ['experienceLevel', 'Select your experience level.'],
    ];

    requiredFields.forEach(([field, message]) => {
      if (!String(profile[field]).trim()) nextErrors[field] = message;
    });

    if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (profile.graduationYear && !/^\d{4}$/.test(profile.graduationYear)) {
      nextErrors.graduationYear = 'Enter a four-digit graduation year.';
    }
    if (profile.interests.length === 0) {
      nextErrors.interests = 'Select at least one career interest.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function saveProfile(event) {
    event.preventDefault();
    setFeedback({ type: '', message: '' });
    if (!validateProfile()) {
      setFeedback({ type: 'error', message: 'Please review the highlighted fields.' });
      return;
    }

    if (!firestore || !isCurrentUser() || loadedUid !== user.uid) {
      setFeedback({ type: 'error', message: 'Sign in with a verified account and reload your profile before saving.' });
      return;
    }

    setSaving(true);
    try {
      const profileRef = getUserProfileRef(user.uid);
      const historyRef = doc(getProfileHistoryCollectionRef(user.uid));
      const nextProfile = normalizeProfile(profile);
      await runTransaction(firestore, async (transaction) => {
        const currentSnapshot = await transaction.get(profileRef);
        if (currentSnapshot.exists()) {
          transaction.set(historyRef, {
            ...normalizeProfile(currentSnapshot.data()),
            savedAt: serverTimestamp(),
            versionId: historyRef.id,
            changeType: 'before_update',
          });
        }
        transaction.set(profileRef, nextProfile);
      });
      if (isCurrentUser()) {
        setCloudProfileExists(true);
        setLocalProfile(null);
        setFeedback({ type: 'success', message: 'Your profile has been saved to your account.' });
        await refreshProfileHistory();
      }
    } catch (error) {
      reportFirestoreFailure('write', 'runTransaction update profile', user, error);
      if (isCurrentUser()) {
        setFeedback({ type: 'error', message: getProfileErrorMessage(error, 'save') });
      }
    } finally {
      if (isCurrentUser()) setSaving(false);
    }
  }

  async function resetProfile() {
    if (!isCurrentUser() || loadedUid !== user.uid) {
      setFeedback({ type: 'error', message: 'Sign in with a verified account before changing your profile.' });
      return;
    }

    if (cloudProfileExists) {
      const confirmed = window.confirm('Delete your saved cloud Student Profile? This permanently deletes only the profile in your account. Any old profile stored on this device will not be deleted.');
      if (!confirmed) return;

      setDeleting(true);
      try {
        await deleteDoc(getUserProfileRef(user.uid));
        if (isCurrentUser()) {
          setProfile(createEmptyProfile());
          setCloudProfileExists(false);
          setLocalProfile(readLocalProfile());
          setErrors({});
          setSkillInput('');
          setFeedback({ type: 'success', message: 'Your saved cloud profile was deleted.' });
        }
      } catch (error) {
        reportFirestoreFailure('write', 'deleteDoc profile', user, error);
        if (isCurrentUser()) {
          setFeedback({ type: 'error', message: getProfileErrorMessage(error, 'delete') });
        }
      } finally {
        if (isCurrentUser()) setDeleting(false);
      }
      return;
    }

    const confirmed = window.confirm('Clear the fields currently shown in the form? This will not delete or upload the older profile saved on this device.');
    if (!confirmed) return;

    setProfile(createEmptyProfile());
    setErrors({});
    setSkillInput('');
    setFeedback({ type: 'success', message: 'The form was cleared. No saved profile was deleted.' });
  }

  async function importLocalProfile() {
    if (!localProfile || cloudProfileExists || !isCurrentUser() || loadedUid !== user.uid) {
      setFeedback({ type: 'error', message: 'This profile cannot be imported right now. Reload your cloud profile and try again.' });
      return;
    }

    const confirmed = window.confirm('Import the profile saved on this device into your signed-in account? This uploads its name, editable email, education, skills, interests, projects, certifications, and experience level. The editable email is profile data only, not your account identity. The import will not overwrite a cloud profile if one already exists.');
    if (!confirmed) return;

    setImporting(true);
    setFeedback({ type: '', message: '' });
    let failedOperation = { operation: 'write', sdkOperation: 'runTransaction profile import' };
    try {
      const profileRef = getUserProfileRef(user.uid);
      const imported = await runTransaction(firestore, async (transaction) => {
        const snapshot = await transaction.get(profileRef);
        if (snapshot.exists()) return false;
        transaction.set(profileRef, normalizeProfile(localProfile));
        return true;
      });

      if (!isCurrentUser()) return;
      if (!imported) {
        failedOperation = { operation: 'read', sdkOperation: 'getDoc existing profile after import conflict' };
        const snapshot = await getDoc(profileRef);
        if (!isCurrentUser()) return;
        if (snapshot.exists()) {
          setProfile(normalizeProfile(snapshot.data()));
          setCloudProfileExists(true);
          setLocalProfile(null);
          setFeedback({ type: 'error', message: 'A cloud profile already exists, so the local profile was not imported or used to overwrite it.' });
        }
        return;
      }

      setProfile(normalizeProfile(localProfile));
      setCloudProfileExists(true);
      setLocalProfile(null);
      setFeedback({ type: 'success', message: 'The profile saved on this device was imported into your account. The original local copy was kept.' });
    } catch (error) {
      reportFirestoreFailure(failedOperation.operation, failedOperation.sdkOperation, user, error);
      if (isCurrentUser()) {
        setFeedback({ type: 'error', message: getProfileErrorMessage(error, 'import') });
      }
    } finally {
      if (isCurrentUser()) setImporting(false);
    }
  }

  async function restoreHistoryVersion(version) {
    if (!isCurrentUser() || loadedUid !== user.uid || !version?.versionId) {
      setFeedback({ type: 'error', message: 'Sign in with a verified account before restoring a profile version.' });
      return;
    }

    const confirmed = window.confirm('Restore this profile version? Your current profile will first be saved as a new history version, and the selected history entry will remain unchanged.');
    if (!confirmed) return;

    setRestoringVersionId(version.versionId);
    setFeedback({ type: '', message: '' });
    try {
      const profileRef = getUserProfileRef(user.uid);
      const historyCollectionRef = getProfileHistoryCollectionRef(user.uid);
      const sourceVersionRef = doc(historyCollectionRef, version.versionId);
      const backupVersionRef = doc(historyCollectionRef);
      const restoredProfile = await runTransaction(firestore, async (transaction) => {
        const [currentSnapshot, versionSnapshot] = await Promise.all([
          transaction.get(profileRef),
          transaction.get(sourceVersionRef),
        ]);

        if (!versionSnapshot.exists()) {
          throw new Error('The selected profile history version no longer exists. Refresh history and try again.');
        }

        if (currentSnapshot.exists()) {
          transaction.set(backupVersionRef, {
            ...normalizeProfile(currentSnapshot.data()),
            savedAt: serverTimestamp(),
            versionId: backupVersionRef.id,
            changeType: 'before_restore',
          });
        }

        const restored = normalizeProfile(versionSnapshot.data());
        if (!restored.username && currentSnapshot.exists()) {
          const currentUsername = currentSnapshot.data().username;
          restored.username = typeof currentUsername === 'string' ? currentUsername : '';
        }
        if (!restored.selectedCareerPathway && currentSnapshot.exists()) {
          const currentSelection = currentSnapshot.data().selectedCareerPathway;
          restored.selectedCareerPathway = currentSelection && typeof currentSelection === 'object'
            ? { ...currentSelection }
            : null;
        }
        transaction.set(profileRef, restored);
        return restored;
      });

      if (!isCurrentUser()) return;
      setProfile(restoredProfile);
      setCloudProfileExists(true);
      setSelectedHistory(null);
      setFeedback({ type: 'success', message: 'The selected version was restored. Your previous current profile was added to history.' });
      await refreshProfileHistory();
    } catch (error) {
      reportFirestoreFailure(
        'write',
        'runTransaction restore profile version',
        user,
        error,
        `users/${user.uid}/profile/profile and users/${user.uid}/profileHistory`,
      );
      if (isCurrentUser()) {
        setFeedback({ type: 'error', message: error?.code === 'permission-denied'
          ? getProfileErrorMessage(error, 'restore')
          : error?.message || getProfileErrorMessage(error, 'restore') });
      }
    } finally {
      if (isCurrentUser()) setRestoringVersionId('');
    }
  }

  function retryProfileLoad() {
    setLoadVersion((version) => version + 1);
  }

  const isAuthorized = canUseProfile(user) && auth?.currentUser?.uid === user.uid;
  const isLoaded = loadedUid === user?.uid;
  const isBusy = saving || deleting || importing || Boolean(restoringVersionId);
  const profileEssentials = [
    Boolean(profile.fullName.trim()),
    Boolean(profile.email.trim()),
    Boolean(profile.degree.trim()),
    Boolean(profile.branch.trim()),
    Boolean(profile.college.trim()),
    Boolean(profile.graduationYear.trim()),
    profile.interests.length > 0,
    Boolean(profile.experienceLevel),
  ];
  const completedEssentials = profileEssentials.filter(Boolean).length;

  function addProject() {
    setProfile((current) => ({
      ...current,
      projects: [...current.projects, { name: '', description: '', technologies: '' }],
    }));
    setFeedback({ type: '', message: '' });
  }

  function addCertification() {
    setProfile((current) => ({
      ...current,
      certifications: [...current.certifications, { name: '', issuer: '' }],
    }));
    setFeedback({ type: '', message: '' });
  }

  function removeEntry(collection, index) {
    setProfile((current) => ({
      ...current,
      [collection]: current[collection].filter((_, entryIndex) => entryIndex !== index),
    }));
    setFeedback({ type: '', message: '' });
  }

  return (
    <section className="profile-page">
      <div className="profile-intro">
        <p className="eyebrow"><span className="eyebrow-dot" /> Your starting point</p>
        <h1>Build your <span>student profile.</span></h1>
        <p>Share a little about your journey so your next steps can feel more like yours.</p>
      </div>

      {!isAuthorized ? (
        <div className="profile-load-state" role="alert">
          <p>Sign in with a verified account to view or save your Student Profile.</p>
          <button className="button button-primary" type="button" onClick={onRequestSignIn}>Sign in</button>
        </div>
      ) : !firestore ? (
        <div className="profile-load-state" role="alert">
          <p>Firebase is not configured, so your cloud profile cannot be loaded.</p>
        </div>
      ) : profileLoading || !isLoaded ? (
        <div className="profile-load-state" role="status">
          <p>{profileLoadError || 'Loading your saved profile...'}</p>
          {profileLoadError && <button className="button button-secondary" type="button" onClick={retryProfileLoad}>Try again</button>}
        </div>
      ) : (
        <>
          {localProfile && !cloudProfileExists && (
            <aside className="profile-migration" aria-labelledby="profile-migration-title">
              <h2 id="profile-migration-title">A profile is saved on this device</h2>
              <p>
                Nothing has been uploaded. You can explicitly import its name, editable email, education,
                skills, interests, projects, certifications, and experience level into this signed-in account.
                The editable email is profile data, not account identity. An existing cloud profile will never be overwritten.
              </p>
              <button className="button button-secondary" type="button" onClick={importLocalProfile} disabled={isBusy}>
                {importing ? 'Importing profile...' : 'Import this device profile'}
              </button>
            </aside>
          )}

          <section className="profile-completion" aria-labelledby="profile-completion-title">
            <div className="profile-completion-heading">
              <div>
                <p className="eyebrow">A useful starting point</p>
                <h2 id="profile-completion-title">Profile essentials</h2>
              </div>
              <strong>{completedEssentials} of {profileEssentials.length} complete</strong>
            </div>
            <progress value={completedEssentials} max={profileEssentials.length} aria-label={`${completedEssentials} of ${profileEssentials.length} profile essentials complete`} />
            <p>{completedEssentials === profileEssentials.length
              ? 'Your core profile is ready to inform career recommendations.'
              : 'Complete the required details below to give your recommendations a stronger starting point.'}</p>
          </section>

          <form className="profile-form" onSubmit={saveProfile} noValidate>
        <ProfileSection number="01" title="Personal information" description="How should we identify you?">
          <div className="form-grid form-grid-two">
            <FormField id="fullName" label="Full name" error={errors.fullName}>
              <input id="fullName" autoComplete="name" value={profile.fullName} onChange={(event) => updateField('fullName', event.target.value)} />
            </FormField>
            <FormField id="email" label="Email address" error={errors.email}>
              <input id="email" type="email" autoComplete="email" value={profile.email} onChange={(event) => updateField('email', event.target.value)} />
            </FormField>
          </div>
        </ProfileSection>

        <ProfileSection number="02" title="Education" description="Tell us what you are studying." className="profile-education-section">
          <div className="form-grid form-grid-two">
            <FormField id="degree" label="Degree" error={errors.degree}>
              <input id="degree" placeholder="e.g. B.Tech" value={profile.degree} onChange={(event) => updateField('degree', event.target.value)} />
            </FormField>
            <FormField id="branch" label="Branch or specialization" error={errors.branch}>
              <input id="branch" placeholder="e.g. Computer Science" value={profile.branch} onChange={(event) => updateField('branch', event.target.value)} />
            </FormField>
            <FormField id="college" label="College name" error={errors.college}>
              <input id="college" value={profile.college} onChange={(event) => updateField('college', event.target.value)} />
            </FormField>
            <FormField id="graduationYear" label="Graduation year" error={errors.graduationYear}>
              <input id="graduationYear" type="number" inputMode="numeric" min="1950" max="2100" placeholder="e.g. 2027" value={profile.graduationYear} onChange={(event) => updateField('graduationYear', event.target.value)} />
            </FormField>
          </div>
        </ProfileSection>

        <ProfileSection number="03" title="Technical skills" description="Add skills you have practiced or are learning.">
          <div className="skill-entry">
            <input
              aria-label="Add a technical skill"
              placeholder="e.g. Python, Figma, SQL"
              value={skillInput}
              onChange={(event) => setSkillInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addSkill(event);
              }}
            />
            <button className="small-action" type="button" onClick={addSkill}>Add skill</button>
          </div>
          {profile.skills.length > 0 ? (
            <ul className="skill-list" aria-label="Technical skills">
              {profile.skills.map((skill, index) => (
                <li key={`${skill}-${index}`}>
                  <span>{skill}</span>
                  <button type="button" aria-label={`Remove ${skill}`} onClick={() => updateField('skills', profile.skills.filter((_, skillIndex) => skillIndex !== index))}>×</button>
                </li>
              ))}
            </ul>
          ) : <p className="form-hint">No skills added yet.</p>}
        </ProfileSection>

        <ProfileSection number="04" title="Career interests" description="Choose every area you would like to explore." className="profile-interests-section">
          <div className="choice-grid">
            {careerOptions.map((interest) => (
              <label className={`choice-option${profile.interests.includes(interest) ? ' choice-option--selected' : ''}`} key={interest}>
                <input type="checkbox" checked={profile.interests.includes(interest)} onChange={() => toggleInterest(interest)} />
                <span className="choice-check" aria-hidden="true">✓</span>
                {interest}
              </label>
            ))}
          </div>
          {errors.interests && <span className="field-error">{errors.interests}</span>}
        </ProfileSection>

        <ProfileSection number="05" title="Projects" description="Add projects that show what you can do.">
          {profile.projects.length === 0 && (
            <div className="profile-empty-entry">
              <strong>No projects added yet</strong>
              <p>A class assignment, personal build, or team project can help show how you apply your skills.</p>
            </div>
          )}
          <div className="repeatable-list">
            {profile.projects.map((project, index) => (
              <div className="repeatable-item" key={index}>
                <div className="repeatable-item-heading">
                  <span>Project {index + 1}</span>
                  <button className="remove-action" type="button" onClick={() => removeEntry('projects', index)}>Remove</button>
                </div>
                <div className="form-grid form-grid-two">
                  <FormField id={`project-name-${index}`} label="Project name">
                    <input id={`project-name-${index}`} value={project.name} onChange={(event) => updateEntry('projects', index, 'name', event.target.value)} />
                  </FormField>
                  <FormField id={`project-tech-${index}`} label="Technologies used">
                    <input id={`project-tech-${index}`} placeholder="e.g. React, Python" value={project.technologies} onChange={(event) => updateEntry('projects', index, 'technologies', event.target.value)} />
                  </FormField>
                  <div className="form-field form-field-wide">
                    <label htmlFor={`project-description-${index}`}>Project description</label>
                    <textarea id={`project-description-${index}`} rows="3" value={project.description} onChange={(event) => updateEntry('projects', index, 'description', event.target.value)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="add-action" type="button" onClick={addProject}><span aria-hidden="true">+</span> Add project</button>
        </ProfileSection>

        <ProfileSection number="06" title="Certifications" description="Include courses or certifications you have completed.">
          {profile.certifications.length === 0 && (
            <div className="profile-empty-entry">
              <strong>No certifications added yet</strong>
              <p>Add a completed course or credential whenever you have one. This section is optional.</p>
            </div>
          )}
          <div className="repeatable-list">
            {profile.certifications.map((certification, index) => (
              <div className="repeatable-item" key={index}>
                <div className="repeatable-item-heading">
                  <span>Certification {index + 1}</span>
                  <button className="remove-action" type="button" onClick={() => removeEntry('certifications', index)}>Remove</button>
                </div>
                <div className="form-grid form-grid-two">
                  <FormField id={`certification-name-${index}`} label="Certification name">
                    <input id={`certification-name-${index}`} value={certification.name} onChange={(event) => updateEntry('certifications', index, 'name', event.target.value)} />
                  </FormField>
                  <FormField id={`certification-issuer-${index}`} label="Issuing organization">
                    <input id={`certification-issuer-${index}`} value={certification.issuer} onChange={(event) => updateEntry('certifications', index, 'issuer', event.target.value)} />
                  </FormField>
                </div>
              </div>
            ))}
          </div>
          <button className="add-action" type="button" onClick={addCertification}><span aria-hidden="true">+</span> Add certification</button>
        </ProfileSection>

        <ProfileSection number="07" title="Experience level" description="Choose the option that best describes your current experience.">
          <FormField id="experienceLevel" label="Current level" error={errors.experienceLevel}>
            <select id="experienceLevel" value={profile.experienceLevel} onChange={(event) => updateField('experienceLevel', event.target.value)}>
              <option value="">Select your experience level</option>
              {experienceOptions.map((level) => <option key={level} value={level}>{level}</option>)}
            </select>
          </FormField>
        </ProfileSection>

        <div className="profile-actions">
          <div className="profile-feedback" role="status" aria-live="polite">
            {feedback.message && <span className={`feedback-message feedback-message--${feedback.type}`}>{feedback.message}</span>}
          </div>
          <div className="profile-action-buttons">
            <button className="button button-secondary" type="button" onClick={resetProfile} disabled={isBusy}>
              {deleting ? 'Deleting profile...' : cloudProfileExists ? 'Delete Saved Profile' : 'Reset Form'}
            </button>
            <button className="button button-primary" type="submit" disabled={isBusy || profileLoading}>
              {saving ? 'Saving...' : 'Save Profile'} <span aria-hidden="true">↗</span>
            </button>
          </div>
        </div>
          </form>

          <section className="profile-history" aria-labelledby="profile-history-title">
            <div className="profile-history-heading">
              <div>
                <p className="eyebrow">Saved snapshots</p>
                <h2 id="profile-history-title">Profile history</h2>
              </div>
              {historyError && <button className="small-action" type="button" onClick={retryProfileHistoryLoad}>Retry history</button>}
            </div>

            {historyLoading ? (
              <p className="history-status" role="status">Loading previous versions...</p>
            ) : historyError ? (
              <p className="history-status feedback-message--error" role="alert">{historyError}</p>
            ) : profileHistory.length === 0 ? (
              <p className="history-status">Previous versions will appear here after you update this profile.</p>
            ) : (
              <ul className="profile-history-list">
                {profileHistory.map((version) => (
                  <li className="profile-history-item" key={version.versionId}>
                    <div className="profile-history-summary">
                      <strong>{formatHistoryDate(version.savedAt)}</strong>
                      <span>{version.changeType === 'before_restore' ? 'Before restore' : 'Before update'}</span>
                    </div>
                    <button
                      className="small-action"
                      type="button"
                      onClick={() => setSelectedHistory(version)}
                      disabled={isBusy}
                    >
                      View version
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {selectedHistory && (
              <div className="history-preview" aria-labelledby="history-preview-title">
                <div className="history-preview-heading">
                  <div>
                    <h3 id="history-preview-title">Previous profile</h3>
                    <p>{formatHistoryDate(selectedHistory.savedAt)} · {selectedHistory.changeType === 'before_restore' ? 'Before restore' : 'Before update'}</p>
                  </div>
                  <button className="remove-action" type="button" onClick={() => setSelectedHistory(null)}>Close</button>
                </div>
                <dl className="history-details">
                  <div><dt>Name</dt><dd>{selectedHistory.fullName || '—'}</dd></div>
                  <div><dt>Profile email</dt><dd>{selectedHistory.email || '—'}</dd></div>
                  <div><dt>Education</dt><dd>{[selectedHistory.degree, selectedHistory.branch].filter(Boolean).join(' · ') || '—'}</dd></div>
                  <div><dt>College</dt><dd>{selectedHistory.college || '—'}</dd></div>
                  <div><dt>Graduation year</dt><dd>{selectedHistory.graduationYear || '—'}</dd></div>
                  <div><dt>Experience</dt><dd>{selectedHistory.experienceLevel || '—'}</dd></div>
                  <div><dt>Skills</dt><dd>{selectedHistory.skills?.join(', ') || '—'}</dd></div>
                  <div><dt>Interests</dt><dd>{selectedHistory.interests?.join(', ') || '—'}</dd></div>
                  <div>
                    <dt>Projects</dt>
                    <dd>
                      {selectedHistory.projects?.length ? (
                        <ul>
                          {selectedHistory.projects.map((project, index) => (
                            <li key={`${project.name}-${index}`}>
                              <strong>{project.name || 'Untitled project'}</strong>
                              {project.technologies && <span> · {project.technologies}</span>}
                              {project.description && <p>{project.description}</p>}
                            </li>
                          ))}
                        </ul>
                      ) : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Certifications</dt>
                    <dd>
                      {selectedHistory.certifications?.length ? (
                        <ul>
                          {selectedHistory.certifications.map((certification, index) => (
                            <li key={`${certification.name}-${index}`}>
                              {certification.name || 'Untitled certification'}
                              {certification.issuer && <span> · {certification.issuer}</span>}
                            </li>
                          ))}
                        </ul>
                      ) : '—'}
                    </dd>
                  </div>
                </dl>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => restoreHistoryVersion(selectedHistory)}
                  disabled={isBusy}
                >
                  {restoringVersionId === selectedHistory.versionId ? 'Restoring version...' : 'Restore this version'}
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}

export default StudentProfile;

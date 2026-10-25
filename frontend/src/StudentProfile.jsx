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
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytesResumable,
} from 'firebase/storage';
import { auth, firestore, storage } from './firebase.js';
import { careerDomains } from './careerCatalog.js';
import {
  isOwnedAvatarPath,
  MAX_AVATAR_FILE_SIZE,
  mergeProfileUpdates,
  normalizeProfileUrl,
  processAvatarImage,
  professionalLinkFields,
  validateAvatarFile,
  validateProfessionalLinks,
} from './studentProfileUtils.js';

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
    summary: '',
    profilePhotoPath: '',
    linkedin: '',
    github: '',
    portfolio: '',
    leetcode: '',
    hackerrank: '',
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
      summary: typeof source.summary === 'string' ? source.summary : '',
      profilePhotoPath: typeof source.profilePhotoPath === 'string' ? source.profilePhotoPath : '',
      linkedin: typeof source.linkedin === 'string' ? source.linkedin : '',
      github: typeof source.github === 'string' ? source.github : '',
      portfolio: typeof source.portfolio === 'string' ? source.portfolio : '',
      leetcode: typeof source.leetcode === 'string' ? source.leetcode : '',
      hackerrank: typeof source.hackerrank === 'string' ? source.hackerrank : '',
      degree: typeof source.degree === 'string' ? source.degree : '',
      branch: typeof source.branch === 'string' ? source.branch : '',
      college: typeof source.college === 'string' ? source.college : '',
      graduationYear: typeof source.graduationYear === 'string' ? source.graduationYear : '',
      skills: Array.isArray(source.skills) ? source.skills.filter((item) => typeof item === 'string') : [],
      interests: Array.isArray(source.interests) ? source.interests.filter((item) => typeof item === 'string') : [],
      projects: Array.isArray(source.projects) ? source.projects.map((project) => ({
        ...(project && typeof project === 'object' ? project : {}),
        name: typeof project?.name === 'string' ? project.name : '',
        description: typeof project?.description === 'string' ? project.description : '',
        technologies: typeof project?.technologies === 'string' ? project.technologies : '',
        githubUrl: typeof project?.githubUrl === 'string' ? project.githubUrl : '',
        liveDemoUrl: typeof project?.liveDemoUrl === 'string' ? project.liveDemoUrl : '',
      })) : [],
      certifications: Array.isArray(source.certifications) ? source.certifications.map((certification) => ({
        ...(certification && typeof certification === 'object' ? certification : {}),
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

function getAvatarErrorMessage(error, action = 'upload') {
  if (error?.code === 'storage/unauthorized' || error?.code === 'storage/unauthenticated') {
    return 'Firebase Storage denied this photo operation. Confirm the owner-only Storage rules are deployed and that your account is verified.';
  }
  if (error?.code === 'storage/no-default-bucket' || error?.code === 'storage/bucket-not-found') {
    return 'The Firebase Storage bucket could not be found. Enable Storage for this project and confirm VITE_FIREBASE_STORAGE_BUCKET is correct.';
  }
  if (error?.code === 'storage/canceled') return 'The photo upload was canceled. Your saved profile photo was not changed.';
  if (error?.code === 'storage/retry-limit-exceeded' || error?.code === 'storage/unknown') {
    return `The photo ${action === 'load' ? 'could not be loaded' : action === 'delete' ? 'could not be deleted' : 'upload failed'} because of a Storage or network issue. Check your connection and try again.`;
  }
  if (action === 'load') return 'The saved profile photo could not be loaded.';
  if (action === 'delete') return 'The profile photo could not be deleted from Storage.';
  return 'The profile photo could not be uploaded. Please try again.';
}

function makeAvatarFilename() {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `avatar-${id}.jpg`;
}

function formatHistoryDate(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== 'function') return 'Save time unavailable';
  return timestamp.toDate().toLocaleString();
}

function getProjectLinks(project) {
  const candidates = [
    { label: 'GitHub', value: project?.githubUrl || project?.github },
    { label: 'Live demo', value: project?.liveDemoUrl || project?.liveDemo || project?.demoUrl },
  ];
  return candidates
    .map((link) => ({ ...link, url: normalizeProfileUrl(link.value) }))
    .filter((link) => link.url);
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
  const control = React.isValidElement(children)
    ? React.cloneElement(children, {
      'aria-invalid': error ? 'true' : undefined,
      'aria-describedby': error ? `${id}-error` : children.props['aria-describedby'],
    })
    : children;
  return (
    <div className={`form-field${error ? ' form-field--error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {control}
      {error && <span className="field-error" id={`${id}-error`}>{error}</span>}
    </div>
  );
}

function StudentProfile({ user, onRequestSignIn }) {
  const [profile, setProfile] = useState(createEmptyProfile);
  const [savedProfile, setSavedProfile] = useState(createEmptyProfile);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
  const [avatarChange, setAvatarChange] = useState('unchanged');
  const [pendingAvatar, setPendingAvatar] = useState(null);
  const [avatarError, setAvatarError] = useState('');
  const [avatarLoadError, setAvatarLoadError] = useState('');
  const [avatarProgress, setAvatarProgress] = useState(null);
  const [avatarImageFailed, setAvatarImageFailed] = useState(false);
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
  const avatarInput = useRef(null);
  const avatarUploadTask = useRef(null);

  useEffect(() => () => avatarUploadTask.current?.cancel(), [user?.uid]);

  useEffect(() => {
    if (!avatarPreviewUrl) return undefined;
    return () => URL.revokeObjectURL(avatarPreviewUrl);
  }, [avatarPreviewUrl]);

  useEffect(() => {
    let cancelled = false;
    const uid = user?.uid;
    const path = savedProfile.profilePhotoPath;
    setAvatarUrl('');
    setAvatarLoadError('');
    if (!path) return undefined;
    if (!storage || !isOwnedAvatarPath(path, uid)) {
      setAvatarLoadError(storage
        ? 'The saved profile photo reference is invalid.'
        : 'Firebase Storage is not configured for profile photos.');
      return undefined;
    }

    getDownloadURL(storageRef(storage, path))
      .then((url) => {
        if (!cancelled && auth?.currentUser?.uid === uid && activeUid.current === uid) setAvatarUrl(url);
      })
      .catch((error) => {
        if (!cancelled && auth?.currentUser?.uid === uid && activeUid.current === uid) {
          setAvatarLoadError(getAvatarErrorMessage(error, 'load'));
        }
      });

    return () => { cancelled = true; };
  }, [savedProfile.profilePhotoPath, user?.uid]);

  useEffect(() => {
    let cancelled = false;
    const uid = user?.uid;
    activeUid.current = uid || null;
    setProfile(createEmptyProfile());
    setSavedProfile(createEmptyProfile());
    setAvatarUrl('');
    setAvatarChange('unchanged');
    setPendingAvatar(null);
    setAvatarError('');
    setAvatarProgress(null);
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
          const loadedProfile = normalizeProfile(snapshot.data());
          setProfile(loadedProfile);
          setSavedProfile(loadedProfile);
          setCloudProfileExists(true);
        } else {
          const emptyProfile = createEmptyProfile();
          setProfile(emptyProfile);
          setSavedProfile(emptyProfile);
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

  async function handleAvatarSelection(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setAvatarError('');
    setFeedback({ type: '', message: '' });
    if (!storage || !isCurrentUser()) {
      setAvatarError('Firebase Storage is not configured or your signed-in account could not be verified.');
      return;
    }

    try {
      const validation = await validateAvatarFile(file);
      if (!validation.valid) {
        setAvatarError(validation.error);
        return;
      }
      const processedImage = await processAvatarImage(file);
      if (!isCurrentUser()) return;
      if (processedImage.size > 2 * 1024 * 1024) {
        setAvatarError('The processed photo is still too large to upload. Choose a smaller image.');
        return;
      }
      const preview = URL.createObjectURL(processedImage);
      setAvatarPreviewUrl(preview);
      setPendingAvatar(processedImage);
      setAvatarChange('upload');
      setAvatarError('');
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'The selected image could not be prepared.');
    }
  }

  function cancelAvatarChange() {
    setPendingAvatar(null);
    setAvatarChange('unchanged');
    setAvatarPreviewUrl('');
    setAvatarError('');
    setAvatarProgress(null);
  }

  function removeAvatar() {
    setPendingAvatar(null);
    setAvatarChange('remove');
    setAvatarPreviewUrl('');
    setAvatarError('');
    setAvatarProgress(null);
    setFeedback({ type: '', message: '' });
  }

  function uploadAvatar(uid, imageBlob) {
    const path = `users/${uid}/profile/${makeAvatarFilename()}`;
    setAvatarProgress(0);
    return new Promise((resolve, reject) => {
      const task = uploadBytesResumable(storageRef(storage, path), imageBlob, {
        contentType: 'image/jpeg',
        cacheControl: 'private, max-age=3600',
      });
      avatarUploadTask.current = task;
      task.on('state_changed', (snapshot) => {
        if (isCurrentUser()) {
          setAvatarProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        }
      }, reject, () => resolve(path));
    });
  }

  function updateEntry(collection, index, field, value) {
    setProfile((current) => ({
      ...current,
      [collection]: current[collection].map((entry, entryIndex) => (
        entryIndex === index ? { ...entry, [field]: value } : entry
      )),
    }));
    setErrors((current) => ({ ...current, [`${collection}-${field}-${index}`]: '' }));
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
    const nextErrors = validateProfessionalLinks(profile);
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
    profile.projects.forEach((project, index) => {
      ['githubUrl', 'liveDemoUrl'].forEach((field) => {
        if (project[field]?.trim() && !normalizeProfileUrl(project[field])) {
          nextErrors[`projects-${field}-${index}`] = 'Enter a valid URL beginning with https://.';
        }
      });
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (saving) return;
    setFeedback({ type: '', message: '' });
    if (!validateProfile()) {
      setFeedback({ type: 'error', message: 'Please review the highlighted fields.' });
      return;
    }

    if (!firestore || !isCurrentUser() || loadedUid !== user.uid) {
      setFeedback({ type: 'error', message: 'Sign in with a verified account and reload your profile before saving.' });
      return;
    }
    if (avatarChange !== 'unchanged' && !storage) {
      setAvatarError('Firebase Storage is not configured. Add a Storage bucket and deploy the owner-only Storage rules before changing your profile photo.');
      setFeedback({ type: 'error', message: 'Your profile photo was not changed. Profile text has not been saved.' });
      return;
    }
    if (avatarChange === 'upload' && !pendingAvatar) {
      setAvatarError('Choose a valid profile photo before saving.');
      return;
    }

    setSaving(true);
    let uploadedAvatarPath = '';
    try {
      const profileRef = getUserProfileRef(user.uid);
      const historyRef = doc(getProfileHistoryCollectionRef(user.uid));
      const previousAvatarPath = savedProfile.profilePhotoPath;
      if (avatarChange === 'upload') {
        uploadedAvatarPath = await uploadAvatar(user.uid, pendingAvatar);
        if (!isCurrentUser()) throw new Error('Your signed-in account changed during photo upload. Sign in again and retry.');
      }
      const normalizedLinks = professionalLinkFields.reduce((links, field) => ({
        ...links,
        [field.key]: normalizeProfileUrl(profile[field.key], field.allowHttp),
      }), {});
      const nextProfile = normalizeProfile({
        ...profile,
        ...normalizedLinks,
        profilePhotoPath: avatarChange === 'upload'
          ? uploadedAvatarPath
          : avatarChange === 'remove'
            ? ''
            : savedProfile.profilePhotoPath,
      });
      await runTransaction(firestore, async (transaction) => {
        const currentSnapshot = await transaction.get(profileRef);
        if (currentSnapshot.exists()) {
          transaction.set(historyRef, {
            ...currentSnapshot.data(),
            ...(avatarChange !== 'unchanged' ? { profilePhotoPath: '' } : {}),
            savedAt: serverTimestamp(),
            versionId: historyRef.id,
            changeType: 'before_update',
          });
        }
        transaction.set(profileRef, mergeProfileUpdates(
          currentSnapshot.exists() ? currentSnapshot.data() : {},
          nextProfile,
        ));
      });
      if (isCurrentUser()) {
        setProfile(nextProfile);
        setSavedProfile(nextProfile);
        setCloudProfileExists(true);
        setLocalProfile(null);
        setAvatarChange('unchanged');
        setPendingAvatar(null);
        setAvatarPreviewUrl('');
        setAvatarProgress(null);
        let cleanupWarning = '';
        if (
          (avatarChange === 'upload' || avatarChange === 'remove')
          && previousAvatarPath
          && previousAvatarPath !== nextProfile.profilePhotoPath
          && isOwnedAvatarPath(previousAvatarPath, user.uid)
          && !historyLoading
          && !historyError
          && !profileHistory.some((version) => version.profilePhotoPath === previousAvatarPath)
        ) {
          try {
            await deleteObject(storageRef(storage, previousAvatarPath));
          } catch (error) {
            if (error?.code !== 'storage/object-not-found') {
              cleanupWarning = ' The profile was saved, but the previous photo could not be removed from Storage.';
            }
          }
        }
        setAvatarError(cleanupWarning.trim());
        setFeedback({
          type: 'success',
          message: `${avatarChange === 'remove' ? 'Your profile photo was removed and your profile was saved.' : avatarChange === 'upload' ? 'Your profile photo and profile changes were saved.' : 'Your profile has been saved to your account.'}${cleanupWarning}`,
        });
        await refreshProfileHistory();
      }
    } catch (error) {
      let cleanupWarning = '';
      if (uploadedAvatarPath && storage && isOwnedAvatarPath(uploadedAvatarPath, user.uid)) {
        try {
          await deleteObject(storageRef(storage, uploadedAvatarPath));
        } catch (cleanupError) {
          if (cleanupError?.code !== 'storage/object-not-found') {
            cleanupWarning = ' The uploaded replacement could not be cleaned up; your previous profile photo remains active.';
          }
        }
      }
      if (error?.code?.startsWith('storage/')) {
        setAvatarError(getAvatarErrorMessage(error));
      } else {
        reportFirestoreFailure('write', 'runTransaction update profile', user, error);
      }
      if (isCurrentUser()) {
        setFeedback({
          type: 'error',
          message: `${error?.code?.startsWith('storage/')
            ? getAvatarErrorMessage(error)
            : getProfileErrorMessage(error, 'save')}${cleanupWarning}`,
        });
      }
    } finally {
      avatarUploadTask.current = null;
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
          const emptyProfile = createEmptyProfile();
          let cleanupWarning = '';
          const avatarReferencedByHistory = profileHistory.some(
            (version) => version.profilePhotoPath === savedProfile.profilePhotoPath,
          );
          if (
            savedProfile.profilePhotoPath
            && storage
            && isOwnedAvatarPath(savedProfile.profilePhotoPath, user.uid)
            && !avatarReferencedByHistory
            && !historyLoading
            && !historyError
          ) {
            try {
              await deleteObject(storageRef(storage, savedProfile.profilePhotoPath));
            } catch (error) {
              if (error?.code !== 'storage/object-not-found') {
                cleanupWarning = ' The profile was deleted, but its photo could not be removed from Storage.';
              }
            }
          } else if (avatarReferencedByHistory) {
            cleanupWarning = ' The photo was retained because a profile-history version still references it.';
          }
            setProfile(emptyProfile);
            setSavedProfile(emptyProfile);
          setCloudProfileExists(false);
          setLocalProfile(readLocalProfile());
          setErrors({});
          setSkillInput('');
            setAvatarChange('unchanged');
            setPendingAvatar(null);
            setAvatarPreviewUrl('');
            setAvatarProgress(null);
            setAvatarUrl('');
          setAvatarError(cleanupWarning);
          setFeedback({ type: 'success', message: `Your saved cloud profile was deleted.${cleanupWarning}` });
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

    const emptyProfile = createEmptyProfile();
    setProfile(emptyProfile);
    setSavedProfile(emptyProfile);
    setAvatarChange('unchanged');
    setPendingAvatar(null);
    setAvatarPreviewUrl('');
    setAvatarProgress(null);
    setErrors({});
    setSkillInput('');
    setFeedback({ type: 'success', message: 'The form was cleared. No saved profile was deleted.' });
  }

  async function importLocalProfile() {
    if (!localProfile || cloudProfileExists || !isCurrentUser() || loadedUid !== user.uid) {
      setFeedback({ type: 'error', message: 'This profile cannot be imported right now. Reload your cloud profile and try again.' });
      return;
    }

    const confirmed = window.confirm('Import the profile saved on this device into your signed-in account? This uploads its name, editable email, professional summary and links, education, skills, interests, projects, certifications, and experience level. The editable email is profile data only, not your account identity. The import will not overwrite a cloud profile if one already exists.');
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
          const existingProfile = normalizeProfile(snapshot.data());
          setProfile(existingProfile);
          setSavedProfile(existingProfile);
          setCloudProfileExists(true);
          setLocalProfile(null);
          setFeedback({ type: 'error', message: 'A cloud profile already exists, so the local profile was not imported or used to overwrite it.' });
        }
        return;
      }

      const importedProfile = normalizeProfile(localProfile);
      setProfile(importedProfile);
      setSavedProfile(importedProfile);
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
      setSavedProfile(restoredProfile);
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

  function discardChanges() {
    setProfile(savedProfile);
    setErrors({});
    setFeedback({ type: '', message: '' });
    setSkillInput('');
    setAvatarChange('unchanged');
    setPendingAvatar(null);
    setAvatarError('');
    setAvatarProgress(null);
    setAvatarPreviewUrl('');
  }

  const isAuthorized = canUseProfile(user) && auth?.currentUser?.uid === user.uid;
  const isLoaded = loadedUid === user?.uid;
  const isBusy = saving || deleting || importing || Boolean(restoringVersionId);
  const hasUnsavedChanges = JSON.stringify(profile) !== JSON.stringify(savedProfile) || avatarChange !== 'unchanged';
  const displayName = savedProfile.fullName.trim() || savedProfile.username.trim();
  const displayEducation = [
    savedProfile.degree,
    savedProfile.branch,
    savedProfile.college,
    savedProfile.graduationYear,
  ].filter((value) => value?.trim());
  const displayInterests = savedProfile.interests.length
    ? savedProfile.interests
    : savedProfile.careerInterests;
  const savedLinks = professionalLinkFields
    .map((field) => ({
      ...field,
      url: normalizeProfileUrl(savedProfile[field.key], field.allowHttp),
    }))
    .filter((field) => field.url);
  const shownAvatarUrl = avatarChange === 'upload'
    ? avatarPreviewUrl
    : avatarChange === 'remove'
      ? ''
      : avatarUrl;
  useEffect(() => {
    setAvatarImageFailed(false);
  }, [shownAvatarUrl]);
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
        <p className="eyebrow"><span className="eyebrow-dot" /> Your professional profile</p>
        <h1>{displayName || 'Build your'}{displayName ? '' : <> <span>student profile.</span></>}</h1>
        <p>Showcase your education, skills, projects, and professional links.</p>
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
          <section className="profile-showcase" aria-label="Profile overview">
            <div className="profile-showcase-header">
              <div className="profile-avatar-shell">
                {shownAvatarUrl && !avatarImageFailed ? (
                  <img
                    className="profile-avatar"
                    src={shownAvatarUrl}
                    alt={`${displayName || 'Student'} profile`}
                    onError={() => {
                      setAvatarImageFailed(true);
                    }}
                  />
                ) : (
                  <span className="profile-avatar" aria-hidden="true">{displayName ? displayName.charAt(0).toUpperCase() : 'S'}</span>
                )}
                <div className="profile-photo-controls">
                  <input
                    ref={avatarInput}
                    className="profile-photo-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="Choose a profile photo"
                    aria-invalid={avatarError ? 'true' : undefined}
                    aria-describedby={avatarError ? 'profile-photo-error' : 'profile-photo-help'}
                    onChange={handleAvatarSelection}
                  />
                  <button className="small-action" type="button" onClick={() => avatarInput.current?.click()} disabled={isBusy}>
                    {savedProfile.profilePhotoPath ? 'Replace photo' : 'Add photo'}
                  </button>
                  {avatarChange !== 'unchanged' ? (
                    <button className="remove-action" type="button" onClick={cancelAvatarChange} disabled={isBusy}>
                      {avatarChange === 'remove' ? 'Undo removal' : 'Cancel change'}
                    </button>
                  ) : savedProfile.profilePhotoPath ? (
                    <button className="remove-action" type="button" onClick={removeAvatar} disabled={isBusy}>
                      Remove photo
                    </button>
                  ) : null}
                </div>
                {avatarChange === 'upload' && <p className="profile-photo-pending">Preview only · save profile to apply</p>}
                <p className="profile-photo-help" id="profile-photo-help">JPEG, PNG, or WebP · up to {MAX_AVATAR_FILE_SIZE / (1024 * 1024)} MB</p>
                {avatarProgress !== null && (
                  <div className="profile-photo-progress" role="progressbar" aria-label="Profile photo upload progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={avatarProgress}>
                    <span style={{ width: `${avatarProgress}%` }} />
                    <small>{avatarProgress}%</small>
                  </div>
                )}
                {avatarError && <p className="profile-photo-error" id="profile-photo-error" role="alert">{avatarError}</p>}
                {avatarLoadError && !avatarError && <p className="profile-photo-error" role="status">{avatarLoadError}</p>}
              </div>
              <div className="profile-showcase-identity">
                <h2>{displayName || 'Add your name to get started'}</h2>
                {displayEducation.length > 0
                  ? <p>{displayEducation.join(' · ')}</p>
                  : <p>Education details will appear here when you add them.</p>}
                <button
                  className="button button-secondary profile-edit-action"
                  type="button"
                  onClick={() => document.getElementById('profile-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                >
                  Edit profile
                </button>
              </div>
            </div>
            {savedProfile.summary.trim() && <p className="profile-showcase-summary">{savedProfile.summary}</p>}
            {displayInterests.length > 0 && (
              <ul className="profile-showcase-tags" aria-label="Career interests">
                {displayInterests.map((interest, index) => <li key={`${interest}-${index}`}>{interest}</li>)}
              </ul>
            )}
            {savedProfile.skills.length > 0 && (
              <div className="profile-showcase-skills">
                <h3>Skills</h3>
                <ul className="profile-showcase-tags" aria-label="Saved skills">
                  {savedProfile.skills.map((skill, index) => <li key={`${skill}-${index}`}>{skill}</li>)}
                </ul>
              </div>
            )}
            <section className="profile-showcase-links" aria-labelledby="profile-links-title">
              <div className="profile-showcase-section-heading">
                <div>
                  <p className="eyebrow">Connect</p>
                  <h3 id="profile-links-title">Professional Links</h3>
                </div>
              </div>
              {savedLinks.length > 0 ? (
                <ul>
                  {savedLinks.map((link) => (
                    <li key={link.key}>
                      <a href={link.url} target="_blank" rel="noopener noreferrer">
                        <span>{link.label}</span>
                        <span aria-hidden="true">↗</span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : <p className="profile-showcase-empty">Add a link below to make your professional work easier to discover.</p>}
            </section>
          </section>

          <div className="profile-showcase-details">
            <section className="profile-showcase-panel" aria-labelledby="profile-projects-title">
              <h3 id="profile-projects-title">Projects</h3>
              {savedProfile.projects.some((project) => project.name.trim() || project.description.trim() || project.technologies.trim()) ? (
                <div className="profile-project-cards">
                  {savedProfile.projects.filter((project) => project.name.trim() || project.description.trim() || project.technologies.trim()).map((project, index) => (
                    <article key={`${project.name}-${index}`}>
                      <h4>{project.name || 'Untitled project'}</h4>
                      {project.description && <p>{project.description}</p>}
                      {project.technologies && <span className="profile-project-tech">{project.technologies}</span>}
                      {getProjectLinks(project).length > 0 && (
                        <div className="profile-project-links">
                          {getProjectLinks(project).map((link) => (
                            <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer">
                              {link.label} <span aria-hidden="true">↗</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              ) : <p className="profile-showcase-empty">No projects added yet.</p>}
            </section>
            <section className="profile-showcase-panel" aria-labelledby="profile-credentials-title">
              <h3 id="profile-credentials-title">Education &amp; Certifications</h3>
              {displayEducation.length > 0 && (
                <div className="profile-credential-item">
                  <strong>{[savedProfile.degree, savedProfile.branch].filter(Boolean).join(' · ') || 'Education'}</strong>
                  <span>{[savedProfile.college, savedProfile.graduationYear].filter(Boolean).join(' · ')}</span>
                </div>
              )}
              {savedProfile.certifications.filter((certification) => certification.name.trim() || certification.issuer.trim()).map((certification, index) => (
                <div className="profile-credential-item" key={`${certification.name}-${index}`}>
                  <strong>{certification.name || 'Certification'}</strong>
                  {certification.issuer && <span>{certification.issuer}</span>}
                </div>
              ))}
              {!displayEducation.length && !savedProfile.certifications.some((certification) => certification.name.trim() || certification.issuer.trim()) && (
                <p className="profile-showcase-empty">Education and certifications will appear here when added.</p>
              )}
            </section>
          </div>

          {localProfile && !cloudProfileExists && (
            <aside className="profile-migration" aria-labelledby="profile-migration-title">
              <h2 id="profile-migration-title">A profile is saved on this device</h2>
              <p>
                Nothing has been uploaded. You can explicitly import its name, editable email, education,
                professional summary and links, skills, interests, projects, certifications, and experience level into this signed-in account.
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

          <form id="profile-editor" className="profile-form" onSubmit={saveProfile} noValidate>
        <ProfileSection number="01" title="Personal information" description="How should we identify you?">
          <div className="form-grid form-grid-two">
            <FormField id="fullName" label="Full name" error={errors.fullName}>
              <input id="fullName" autoComplete="name" value={profile.fullName} onChange={(event) => updateField('fullName', event.target.value)} />
            </FormField>
            <FormField id="email" label="Email address" error={errors.email}>
              <input id="email" type="email" autoComplete="email" value={profile.email} onChange={(event) => updateField('email', event.target.value)} />
            </FormField>
            <div className="form-field form-field-wide">
              <label htmlFor="profile-summary">Professional summary <span>(optional)</span></label>
              <textarea
                id="profile-summary"
                rows="3"
                maxLength="1200"
                value={profile.summary}
                onChange={(event) => updateField('summary', event.target.value)}
                placeholder="Summarize your interests, strengths, or the work you hope to do."
              />
            </div>
          </div>
        </ProfileSection>

        <ProfileSection number="02" title="Professional Links" description="Add optional links to your professional profiles. Use HTTPS for service profiles." className="profile-links-section">
          <div className="profile-link-grid">
            {professionalLinkFields.map((field) => (
              <FormField key={field.key} id={`profile-link-${field.key}`} label={field.label} error={errors[field.key]}>
                <input
                  id={`profile-link-${field.key}`}
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  maxLength={2048}
                  placeholder={field.key === 'portfolio' ? 'https://yourname.dev' : `https://${field.key === 'linkedin' ? 'www.linkedin.com/in/yourname' : field.key === 'github' ? 'github.com/yourname' : `${field.key}.com/yourname`}`}
                  value={profile[field.key]}
                  onChange={(event) => updateField(field.key, event.target.value)}
                />
              </FormField>
            ))}
          </div>
          <p className="form-hint">Portfolio links may use HTTP to retain compatibility with existing personal sites. Other profile links must use HTTPS.</p>
        </ProfileSection>

        <ProfileSection number="03" title="Education" description="Tell us what you are studying." className="profile-education-section">
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

        <ProfileSection number="04" title="Technical skills" description="Add skills you have practiced or are learning.">
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

        <ProfileSection number="05" title="Career interests" description="Choose every area you would like to explore." className="profile-interests-section">
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

        <ProfileSection number="06" title="Projects" description="Add projects that show what you can do.">
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
                  <FormField id={`project-github-${index}`} label="GitHub repository URL" error={errors[`projects-githubUrl-${index}`]}>
                    <input
                      id={`project-github-${index}`}
                      type="url"
                      inputMode="url"
                      maxLength={2048}
                      value={project.githubUrl || ''}
                      onChange={(event) => updateEntry('projects', index, 'githubUrl', event.target.value)}
                    />
                  </FormField>
                  <FormField id={`project-demo-${index}`} label="Live demo URL" error={errors[`projects-liveDemoUrl-${index}`]}>
                    <input
                      id={`project-demo-${index}`}
                      type="url"
                      inputMode="url"
                      maxLength={2048}
                      value={project.liveDemoUrl || ''}
                      onChange={(event) => updateEntry('projects', index, 'liveDemoUrl', event.target.value)}
                    />
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

        <ProfileSection number="07" title="Certifications" description="Include courses or certifications you have completed.">
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

        <ProfileSection number="08" title="Experience level" description="Choose the option that best describes your current experience.">
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
            {hasUnsavedChanges && (
              <button className="button button-secondary" type="button" onClick={discardChanges} disabled={isBusy}>
                Discard changes
              </button>
            )}
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

import React, { useState } from 'react';

const PROFILE_STORAGE_KEY = 'careerscout-student-profile';
const careerOptions = [
  'AI/Machine Learning',
  'Web Development',
  'Data Science',
  'Cybersecurity',
  'Cloud Computing',
  'Mobile App Development',
];
const experienceOptions = ['Beginner', 'Intermediate', 'Advanced'];

function createEmptyProfile() {
  return {
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

function loadProfile() {
  try {
    const savedProfile = localStorage.getItem(PROFILE_STORAGE_KEY);
    return savedProfile
      ? { ...createEmptyProfile(), ...JSON.parse(savedProfile) }
      : createEmptyProfile();
  } catch {
    return createEmptyProfile();
  }
}

function ProfileSection({ number, title, description, children }) {
  return (
    <section className="profile-section">
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

function StudentProfile() {
  const [profile, setProfile] = useState(loadProfile);
  const [errors, setErrors] = useState({});
  const [skillInput, setSkillInput] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });

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

  function saveProfile(event) {
    event.preventDefault();
    setFeedback({ type: '', message: '' });
    if (!validateProfile()) {
      setFeedback({ type: 'error', message: 'Please review the highlighted fields.' });
      return;
    }

    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
      setFeedback({ type: 'success', message: 'Your profile has been saved on this device.' });
    } catch {
      setFeedback({ type: 'error', message: 'Your profile could not be saved. Check your browser storage settings and try again.' });
    }
  }

  function resetProfile() {
    setProfile(createEmptyProfile());
    setErrors({});
    setSkillInput('');
    try {
      localStorage.removeItem(PROFILE_STORAGE_KEY);
      setFeedback({ type: 'success', message: 'The profile form and saved profile have been reset.' });
    } catch {
      setFeedback({ type: 'error', message: 'The form was reset, but saved browser data could not be cleared.' });
    }
  }

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

        <ProfileSection number="02" title="Education" description="Tell us what you are studying.">
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

        <ProfileSection number="04" title="Career interests" description="Choose every area you would like to explore.">
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
            <button className="button button-secondary" type="button" onClick={resetProfile}>Reset</button>
            <button className="button button-primary" type="submit">Save Profile <span aria-hidden="true">↗</span></button>
          </div>
        </div>
      </form>
    </section>
  );
}

export default StudentProfile;

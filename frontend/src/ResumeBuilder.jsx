import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { auth, firestore } from './firebase.js';
import { createEducationFromProfile, getVisibleEducationEntries } from './resumeEducation.js';

const emptyDraft = {
  fullName: '',
  email: '',
  phone: '',
  location: '',
  linkedin: '',
  github: '',
  portfolio: '',
  summary: '',
  education: [],
  skills: [],
  projects: [],
  certifications: [],
  experience: [],
};

const webLinkFields = ['linkedin', 'github', 'portfolio'];

function text(value) {
  return typeof value === 'string' ? value : '';
}

function createDraft(profile) {
  const source = profile && typeof profile === 'object' ? profile : {};
  return {
    ...emptyDraft,
    fullName: text(source.fullName),
    email: text(source.email),
    education: createEducationFromProfile(source),
    skills: Array.isArray(source.skills) ? source.skills.filter((item) => typeof item === 'string') : [],
    projects: Array.isArray(source.projects) ? source.projects.map((project) => ({
      name: text(project?.name),
      description: text(project?.description),
      technologies: text(project?.technologies),
    })) : [],
    certifications: Array.isArray(source.certifications) ? source.certifications.map((certification) => ({
      name: text(certification?.name),
      issuer: text(certification?.issuer),
    })) : [],
  };
}

function isVerifiedUser(user) {
  return Boolean(user?.uid && (
    user.emailVerified
    || user.providerData?.some((provider) => provider.providerId === 'google.com')
  ));
}

function safeWebUrl(value) {
  if (!value.trim()) return '';
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function displayMonth(value) {
  if (!/^\d{4}-\d{2}$/.test(value)) return value;
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' })
    .format(new Date(year, month - 1, 1, 12));
}

function ResumeField({ id, label, error, children }) {
  return (
    <div className={`form-field${error ? ' form-field--error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error && <span className="field-error" id={`${id}-error`}>{error}</span>}
    </div>
  );
}

function ResumeSection({ title, children }) {
  return (
    <section className="resume-document-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function ResumeBuilder({ user, onBack }) {
  const [draft, setDraft] = useState(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [profileMissing, setProfileMissing] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let cancelled = false;
    const uid = user?.uid;
    setDraft(emptyDraft);
    setErrors({});
    setProfileMissing(false);
    setLoadError('');

    if (!isVerifiedUser(user) || !firestore || auth?.currentUser?.uid !== uid) {
      setLoading(false);
      setLoadError(firestore
        ? 'Sign in with a verified account to open the Resume Builder.'
        : 'Firebase is not configured, so your profile cannot be loaded.');
      return () => { cancelled = true; };
    }

    setLoading(true);
    getDoc(doc(firestore, 'users', uid, 'profile', 'profile'))
      .then((snapshot) => {
        if (cancelled || auth?.currentUser?.uid !== uid) return;
        setDraft(createDraft(snapshot.exists() ? snapshot.data() : {}));
        setProfileMissing(!snapshot.exists());
      })
      .catch(() => {
        if (!cancelled) setLoadError('Your saved profile could not be loaded. Check your connection and try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [user]);

  function updateField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  }

  function updateEntry(collection, index, field, value) {
    setDraft((current) => ({
      ...current,
      [collection]: current[collection].map((entry, entryIndex) => (
        entryIndex === index ? { ...entry, [field]: value } : entry
      )),
    }));
    setErrors((current) => ({ ...current, [`${collection}-${field}-${index}`]: '' }));
  }

  function addEntry(collection, entry) {
    setDraft((current) => ({ ...current, [collection]: [...current[collection], entry] }));
  }

  function removeEntry(collection, index) {
    setDraft((current) => ({
      ...current,
      [collection]: current[collection].filter((_, entryIndex) => entryIndex !== index),
    }));
  }

  function validateDraft() {
    const nextErrors = {};
    if (!draft.fullName.trim()) nextErrors.fullName = 'Enter your name.';
    if (!draft.email.trim()) nextErrors.email = 'Enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }
    webLinkFields.forEach((field) => {
      if (draft[field].trim() && !safeWebUrl(draft[field])) {
        nextErrors[field] = 'Enter a valid web address beginning with http:// or https://.';
      }
    });
    draft.experience.forEach((experience, index) => {
      const hasContent = experience.role.trim()
        || experience.organization.trim()
        || experience.type
        || experience.startDate
        || experience.endDate
        || experience.responsibilities.trim();
      if (!hasContent) return;
      if (!experience.role.trim()) nextErrors[`experience-role-${index}`] = 'Enter a role.';
      if (!experience.organization.trim()) nextErrors[`experience-organization-${index}`] = 'Enter an organization.';
      if (!experience.type) nextErrors[`experience-type-${index}`] = 'Choose work experience or internship.';
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      document.getElementById(Object.keys(nextErrors)[0])?.focus();
      return false;
    }
    return true;
  }

  function printResume() {
    if (loading || loadError || !validateDraft()) return;
    window.print();
  }

  if (loading) {
    return <section className="resume-builder-page resume-builder-state" role="status"><span className="recommendation-spinner" aria-hidden="true" /><p>Loading your saved profile...</p></section>;
  }

  if (loadError) {
    return (
      <section className="resume-builder-page resume-builder-state" role="alert">
        <p>{loadError}</p>
        <button className="button button-secondary" type="button" onClick={onBack}>Back to Dashboard</button>
      </section>
    );
  }

  const projects = draft.projects.filter((project) => project.name.trim() || project.description.trim() || project.technologies.trim());
  const certifications = draft.certifications.filter((certification) => certification.name.trim() || certification.issuer.trim());
  const educationEntries = getVisibleEducationEntries(draft.education);
  const experiences = draft.experience.filter((experience) => (
    experience.role.trim()
    || experience.organization.trim()
    || experience.startDate
    || experience.endDate
    || experience.responsibilities.trim()
  ));
  const contactLinks = webLinkFields
    .filter((field) => draft[field].trim())
    .map((field) => ({ field, url: safeWebUrl(draft[field]) }));
  const hasContactDetails = Boolean(
    draft.fullName.trim()
    || draft.email.trim()
    || draft.phone.trim()
    || draft.location.trim()
    || contactLinks.length,
  );

  return (
    <section className="resume-builder-page" aria-labelledby="resume-builder-title">
      <header className="resume-builder-header">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot" /> Your next step</p>
          <h1 id="resume-builder-title">Resume Builder</h1>
          <p>Edit this resume draft without changing your saved Student Profile.</p>
        </div>
        <div className="resume-builder-actions">
          <button className="button button-secondary" type="button" onClick={onBack}>Back to Dashboard</button>
          <button className="button button-primary" type="button" onClick={printResume}>Print / Save as PDF</button>
        </div>
      </header>

      {profileMissing && <p className="resume-profile-notice" role="status">No saved profile was found. You can enter resume details here; this draft will not be saved.</p>}

      <div className="resume-builder-layout">
        <div className="resume-editor" aria-label="Resume editor">
          <section className="resume-editor-section" aria-labelledby="resume-contact-title">
            <h2 id="resume-contact-title">Contact and summary</h2>
            <div className="resume-form-grid">
              <ResumeField id="fullName" label="Full name" error={errors.fullName}>
                <input id="fullName" autoComplete="name" required value={draft.fullName} aria-invalid={Boolean(errors.fullName)} aria-describedby={errors.fullName ? 'fullName-error' : undefined} onChange={(event) => updateField('fullName', event.target.value)} />
              </ResumeField>
              <ResumeField id="email" label="Email address" error={errors.email}>
                <input id="email" type="email" autoComplete="email" required value={draft.email} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} onChange={(event) => updateField('email', event.target.value)} />
              </ResumeField>
              <ResumeField id="phone" label="Phone (optional)">
                <input id="phone" type="tel" autoComplete="tel" value={draft.phone} onChange={(event) => updateField('phone', event.target.value)} />
              </ResumeField>
              <ResumeField id="location" label="Location (optional)">
                <input id="location" autoComplete="address-level2" value={draft.location} onChange={(event) => updateField('location', event.target.value)} />
              </ResumeField>
              <ResumeField id="linkedin" label="LinkedIn URL (optional)" error={errors.linkedin}>
                <input id="linkedin" type="url" inputMode="url" value={draft.linkedin} aria-invalid={Boolean(errors.linkedin)} aria-describedby={errors.linkedin ? 'linkedin-error' : undefined} onChange={(event) => updateField('linkedin', event.target.value)} />
              </ResumeField>
              <ResumeField id="github" label="GitHub URL (optional)" error={errors.github}>
                <input id="github" type="url" inputMode="url" value={draft.github} aria-invalid={Boolean(errors.github)} aria-describedby={errors.github ? 'github-error' : undefined} onChange={(event) => updateField('github', event.target.value)} />
              </ResumeField>
              <ResumeField id="portfolio" label="Portfolio URL (optional)" error={errors.portfolio}>
                <input id="portfolio" type="url" inputMode="url" value={draft.portfolio} aria-invalid={Boolean(errors.portfolio)} aria-describedby={errors.portfolio ? 'portfolio-error' : undefined} onChange={(event) => updateField('portfolio', event.target.value)} />
              </ResumeField>
              <ResumeField id="summary" label="Summary (optional)">
                <textarea id="summary" rows="4" value={draft.summary} onChange={(event) => updateField('summary', event.target.value)} />
              </ResumeField>
            </div>
          </section>

          <section className="resume-editor-section" aria-labelledby="resume-education-title">
            <div className="resume-editor-heading">
              <h2 id="resume-education-title">Education</h2>
              <button className="add-action" type="button" onClick={() => addEntry('education', {
                level: '',
                institution: '',
                board: '',
                qualification: '',
                specialization: '',
                startYear: '',
                completionYear: '',
                grade: '',
              })}><span aria-hidden="true">+</span> Add Education</button>
            </div>
            <div className="resume-entry-list">
              {draft.education.map((entry, index) => (
                <div className="resume-entry" key={`education-${index}`}>
                  <div className="resume-entry-heading"><strong>Education {index + 1}</strong><button className="remove-action" type="button" onClick={() => removeEntry('education', index)}>Remove</button></div>
                  <div className="resume-form-grid">
                    <ResumeField id={`education-level-${index}`} label="Education level">
                      <select id={`education-level-${index}`} value={entry.level} onChange={(event) => updateEntry('education', index, 'level', event.target.value)}>
                        <option value="">Select education level</option>
                        <option value="10th / SSLC">10th / SSLC</option>
                        <option value="12th / PUC">12th / PUC</option>
                        <option value="Diploma">Diploma</option>
                        <option value="Undergraduate degree">Undergraduate degree</option>
                        <option value="Postgraduate degree">Postgraduate degree</option>
                        <option value="Other education">Other education</option>
                      </select>
                    </ResumeField>
                    <ResumeField id={`education-institution-${index}`} label="School or college">
                      <input id={`education-institution-${index}`} value={entry.institution} onChange={(event) => updateEntry('education', index, 'institution', event.target.value)} />
                    </ResumeField>
                    <ResumeField id={`education-board-${index}`} label="Board or university">
                      <input id={`education-board-${index}`} value={entry.board} onChange={(event) => updateEntry('education', index, 'board', event.target.value)} />
                    </ResumeField>
                    <ResumeField id={`education-qualification-${index}`} label="Qualification or course">
                      <input id={`education-qualification-${index}`} value={entry.qualification} onChange={(event) => updateEntry('education', index, 'qualification', event.target.value)} />
                    </ResumeField>
                    <ResumeField id={`education-specialization-${index}`} label="Stream or specialization">
                      <input id={`education-specialization-${index}`} value={entry.specialization} onChange={(event) => updateEntry('education', index, 'specialization', event.target.value)} />
                    </ResumeField>
                    <ResumeField id={`education-start-year-${index}`} label="Start year (optional)">
                      <input id={`education-start-year-${index}`} type="number" min="1900" max="2100" inputMode="numeric" value={entry.startYear} onChange={(event) => updateEntry('education', index, 'startYear', event.target.value)} />
                    </ResumeField>
                    <ResumeField id={`education-completion-year-${index}`} label="Completion or expected year">
                      <input id={`education-completion-year-${index}`} type="number" min="1900" max="2100" inputMode="numeric" value={entry.completionYear} onChange={(event) => updateEntry('education', index, 'completionYear', event.target.value)} />
                    </ResumeField>
                    <ResumeField id={`education-grade-${index}`} label="Percentage or CGPA (optional)">
                      <input id={`education-grade-${index}`} value={entry.grade} onChange={(event) => updateEntry('education', index, 'grade', event.target.value)} />
                    </ResumeField>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="resume-editor-section" aria-labelledby="resume-skills-title">
            <h2 id="resume-skills-title">Skills</h2>
            <ResumeField id="skills" label="Skills (separate with commas)">
              <textarea id="skills" rows="3" value={draft.skills.join(', ')} onChange={(event) => updateField('skills', event.target.value.split(',').map((skill) => skill.trim()).filter(Boolean))} />
            </ResumeField>
          </section>

          <section className="resume-editor-section" aria-labelledby="resume-experience-title">
            <div className="resume-editor-heading">
              <h2 id="resume-experience-title">Experience</h2>
              <button className="add-action" type="button" onClick={() => addEntry('experience', { type: '', role: '', organization: '', startDate: '', endDate: '', responsibilities: '' })}><span aria-hidden="true">+</span> Add experience</button>
            </div>
            <div className="resume-entry-list">
              {draft.experience.map((experience, index) => (
                <div className="resume-entry" key={`experience-${index}`}>
                  <div className="resume-entry-heading"><strong>Experience {index + 1}</strong><button className="remove-action" type="button" onClick={() => removeEntry('experience', index)}>Remove</button></div>
                  <div className="resume-form-grid">
                    <ResumeField id={`experience-type-${index}`} label="Entry type" error={errors[`experience-type-${index}`]}>
                      <select id={`experience-type-${index}`} value={experience.type} aria-invalid={Boolean(errors[`experience-type-${index}`])} aria-describedby={errors[`experience-type-${index}`] ? `experience-type-${index}-error` : undefined} onChange={(event) => updateEntry('experience', index, 'type', event.target.value)}>
                        <option value="">Select entry type</option>
                        <option value="Work experience">Work experience</option>
                        <option value="Internship">Internship</option>
                      </select>
                    </ResumeField>
                    <ResumeField id={`experience-role-${index}`} label="Role">
                      <input id={`experience-role-${index}`} value={experience.role} aria-invalid={Boolean(errors[`experience-role-${index}`])} aria-describedby={errors[`experience-role-${index}`] ? `experience-role-${index}-error` : undefined} onChange={(event) => updateEntry('experience', index, 'role', event.target.value)} />
                    </ResumeField>
                    <ResumeField id={`experience-organization-${index}`} label="Organization">
                      <input id={`experience-organization-${index}`} value={experience.organization} aria-invalid={Boolean(errors[`experience-organization-${index}`])} aria-describedby={errors[`experience-organization-${index}`] ? `experience-organization-${index}-error` : undefined} onChange={(event) => updateEntry('experience', index, 'organization', event.target.value)} />
                    </ResumeField>
                    <ResumeField id={`experience-start-${index}`} label="Start date">
                      <input id={`experience-start-${index}`} type="month" value={experience.startDate} onChange={(event) => updateEntry('experience', index, 'startDate', event.target.value)} />
                    </ResumeField>
                    <ResumeField id={`experience-end-${index}`} label="End date">
                      <input id={`experience-end-${index}`} type="month" value={experience.endDate} onChange={(event) => updateEntry('experience', index, 'endDate', event.target.value)} />
                    </ResumeField>
                    <div className="form-field resume-form-wide">
                      <label htmlFor={`experience-responsibilities-${index}`}>Responsibilities (one per line)</label>
                      <textarea id={`experience-responsibilities-${index}`} rows="4" value={experience.responsibilities} onChange={(event) => updateEntry('experience', index, 'responsibilities', event.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="resume-editor-section" aria-labelledby="resume-projects-title">
            <div className="resume-editor-heading">
              <h2 id="resume-projects-title">Projects</h2>
              <button className="add-action" type="button" onClick={() => addEntry('projects', { name: '', description: '', technologies: '' })}><span aria-hidden="true">+</span> Add project</button>
            </div>
            <div className="resume-entry-list">
              {draft.projects.map((project, index) => (
                <div className="resume-entry" key={`project-${index}`}>
                  <div className="resume-entry-heading"><strong>Project {index + 1}</strong><button className="remove-action" type="button" onClick={() => removeEntry('projects', index)}>Remove</button></div>
                  <div className="resume-form-grid">
                    <ResumeField id={`project-name-${index}`} label="Project name">
                      <input id={`project-name-${index}`} value={project.name} onChange={(event) => updateEntry('projects', index, 'name', event.target.value)} />
                    </ResumeField>
                    <ResumeField id={`project-technologies-${index}`} label="Technologies">
                      <input id={`project-technologies-${index}`} value={project.technologies} onChange={(event) => updateEntry('projects', index, 'technologies', event.target.value)} />
                    </ResumeField>
                    <div className="form-field resume-form-wide">
                      <label htmlFor={`project-description-${index}`}>Description</label>
                      <textarea id={`project-description-${index}`} rows="3" value={project.description} onChange={(event) => updateEntry('projects', index, 'description', event.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="resume-editor-section" aria-labelledby="resume-certifications-title">
            <div className="resume-editor-heading">
              <h2 id="resume-certifications-title">Certifications</h2>
              <button className="add-action" type="button" onClick={() => addEntry('certifications', { name: '', issuer: '' })}><span aria-hidden="true">+</span> Add certification</button>
            </div>
            <div className="resume-entry-list">
              {draft.certifications.map((certification, index) => (
                <div className="resume-entry" key={`certification-${index}`}>
                  <div className="resume-entry-heading"><strong>Certification {index + 1}</strong><button className="remove-action" type="button" onClick={() => removeEntry('certifications', index)}>Remove</button></div>
                  <div className="resume-form-grid">
                    <ResumeField id={`certification-name-${index}`} label="Certification name">
                      <input id={`certification-name-${index}`} value={certification.name} onChange={(event) => updateEntry('certifications', index, 'name', event.target.value)} />
                    </ResumeField>
                    <ResumeField id={`certification-issuer-${index}`} label="Issuer">
                      <input id={`certification-issuer-${index}`} value={certification.issuer} onChange={(event) => updateEntry('certifications', index, 'issuer', event.target.value)} />
                    </ResumeField>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="resume-preview" aria-label="Live resume preview">
          <div className="resume-preview-heading"><h2>Live preview</h2><span>Updates as you edit</span></div>
          <article className="resume-print-document" aria-label="Resume document">
            {(draft.fullName.trim() || draft.email.trim() || draft.phone.trim() || draft.location.trim() || contactLinks.length > 0) && (
              <header className="resume-document-header">
                {draft.fullName.trim() && <h1>{draft.fullName.trim()}</h1>}
                {[draft.email.trim(), draft.phone.trim(), draft.location.trim()].filter(Boolean).length > 0 && (
                  <p>{[draft.email.trim(), draft.phone.trim(), draft.location.trim()].filter(Boolean).map((value, index) => (
                    <React.Fragment key={`${value}-${index}`}>{index > 0 && <span className="resume-contact-separator"> | </span>}{value}</React.Fragment>
                  ))}</p>
                )}
                {contactLinks.length > 0 && (
                  <p className="resume-document-links">
                    {contactLinks.map(({ field, url }, index) => (
                      <React.Fragment key={field}>
                        {index > 0 && <span className="resume-contact-separator"> | </span>}
                        {url ? <a href={url}>{draft[field].trim()}</a> : <span>{draft[field].trim()}</span>}
                      </React.Fragment>
                    ))}
                  </p>
                )}
              </header>
            )}

            {draft.summary.trim() && <ResumeSection title="SUMMARY"><p>{draft.summary.trim()}</p></ResumeSection>}
            {educationEntries.length > 0 && (
              <ResumeSection title="EDUCATION">
                {educationEntries.map((entry, index) => {
                  const qualification = [entry.qualification, entry.specialization]
                    .filter((value) => value.trim())
                    .join(' - ');
                  const years = [entry.startYear, entry.completionYear].filter((value) => value.trim()).join(' - ');
                  return (
                    <div className="resume-document-entry" key={`preview-education-${index}`}>
                      {qualification && <p><strong>{qualification}</strong></p>}
                      {entry.institution.trim() && <p>{entry.institution.trim()}</p>}
                      {entry.board.trim() && <p>{entry.board.trim()}</p>}
                      {years && <p>{years}</p>}
                      {entry.grade.trim() && <p>{entry.grade.trim()}</p>}
                    </div>
                  );
                })}
              </ResumeSection>
            )}
            {draft.skills.some((skill) => skill.trim()) && (
              <ResumeSection title="SKILLS">
                <ul>{draft.skills.filter((skill) => skill.trim()).map((skill, index) => <li key={`${skill}-${index}`}>{skill.trim()}</li>)}</ul>
              </ResumeSection>
            )}
            {experiences.length > 0 && (
              <ResumeSection title="EXPERIENCE">
                {experiences.map((experience, index) => {
                  const responsibilities = experience.responsibilities.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
                  const dates = [experience.startDate, experience.endDate].filter(Boolean).map(displayMonth);
                  return (
                    <div className="resume-document-entry" key={`preview-experience-${index}`}>
                      {(experience.role.trim() || experience.organization.trim() || experience.type) && <p><strong>{[experience.role.trim(), experience.type, experience.organization.trim()].filter(Boolean).join(' | ')}</strong></p>}
                      {dates.length > 0 && <p>{dates.join(' - ')}</p>}
                      {responsibilities.length > 0 && <ul>{responsibilities.map((line, lineIndex) => <li key={`${line}-${lineIndex}`}>{line}</li>)}</ul>}
                    </div>
                  );
                })}
              </ResumeSection>
            )}
            {projects.length > 0 && (
              <ResumeSection title="PROJECTS">
                {projects.map((project, index) => (
                  <div className="resume-document-entry" key={`preview-project-${index}`}>
                    {project.name.trim() && <p><strong>{project.name.trim()}</strong></p>}
                    {project.technologies.trim() && <p>{project.technologies.trim()}</p>}
                    {project.description.trim() && <p>{project.description.trim()}</p>}
                  </div>
                ))}
              </ResumeSection>
            )}
            {certifications.length > 0 && (
              <ResumeSection title="CERTIFICATIONS">
                <ul>{certifications.map((certification, index) => (
                  <li key={`preview-certification-${index}`}>
                    {certification.name.trim() && <strong>{certification.name.trim()}</strong>}
                    {certification.name.trim() && certification.issuer.trim() && ' - '}
                    {certification.issuer.trim()}
                  </li>
                ))}</ul>
              </ResumeSection>
            )}
            {!hasContactDetails && !draft.summary.trim() && educationEntries.length === 0 && !draft.skills.some((skill) => skill.trim()) && experiences.length === 0 && projects.length === 0 && certifications.length === 0 && (
              <p className="resume-preview-empty">Your resume preview will appear here.</p>
            )}
          </article>
        </aside>
      </div>
    </section>
  );
}

export default ResumeBuilder;
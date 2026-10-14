import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, firestore } from './firebase.js';
import {
  buildCareerLearningPlan,
  careerDomains,
  careerRoles,
  getCareerDomain,
  getCareerPathways,
  matchProfileToCareers,
} from './careerCatalog.js';
import { getResourceById, getResourcesForCareer } from './resourceCatalog.js';

function CareerExplorer({ user, profile, requestedRoleId, onContinueLearning }) {
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedPathwayId, setSelectedPathwayId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const detailRef = useRef(null);

  useEffect(() => {
    if (!requestedRoleId) return;
    setSelectedRoleId(requestedRoleId);
    setSelectedPathwayId('');
    setError('');
    setNotice('');
  }, [requestedRoleId]);

  useEffect(() => {
    if (!requestedRoleId || selectedRoleId !== requestedRoleId || !detailRef.current) return;
    detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    detailRef.current.focus({ preventScroll: true });
  }, [requestedRoleId, selectedRoleId]);

  const filteredRoles = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return careerRoles.filter((role) => (
      (domainFilter === 'all' || role.domainId === domainFilter)
      && (!needle || `${role.title} ${role.domainLabel}`.toLocaleLowerCase().includes(needle))
    )).slice(0, 18);
  }, [search, domainFilter]);

  const selectedRole = careerRoles.find((role) => role.id === selectedRoleId) || null;
  const domain = selectedRole ? getCareerDomain(selectedRole.id) : null;
  const pathways = selectedRole ? getCareerPathways(selectedRole.id) : [];
  const pathway = pathways.find((item) => item.id === selectedPathwayId) || pathways[0] || null;
  const learningPlan = selectedRole && pathway
    ? buildCareerLearningPlan(selectedRole.id, pathway.id, profile)
    : null;
  const matches = useMemo(() => matchProfileToCareers(profile, careerRoles.length), [profile]);
  const profileMatch = matches.find((item) => item.id === selectedRoleId) || null;
  const profileSkills = Array.isArray(profile?.skills) ? profile.skills : [];
  const knownSkills = learningPlan
    ? profileSkills.filter((skill) => domain.matchSkills.some((term) => (
      String(skill).toLocaleLowerCase().includes(term.toLocaleLowerCase())
      || term.toLocaleLowerCase().includes(String(skill).toLocaleLowerCase())
    ))).slice(0, 8)
    : [];
  const nextSteps = learningPlan?.steps.filter((step) => step.newSkills.length) || [];
  const resources = learningPlan
    ? getResourcesForCareer({
      domainId: selectedRole.domainId,
      roleTitle: selectedRole.title,
      topics: learningPlan.steps.map((step) => step.skill),
      limit: 10,
    })
    : [];

  async function savePathway() {
    if (!selectedRole || !pathway || !learningPlan || !firestore || !auth?.currentUser || auth.currentUser.uid !== user?.uid) {
      setError('Your signed-in profile could not be verified. Sign in again and retry.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    const plannedSteps = learningPlan.steps.filter((step) => step.newSkills.length).map((step) => {
      const stepResources = getResourcesForCareer({
        domainId: selectedRole.domainId,
        roleTitle: selectedRole.title,
        topics: [step.skill],
        limit: 3,
      });
      return { ...step, resourceIds: stepResources.map((resource) => resource.id) };
    });
    const selectedCareer = {
      careerId: selectedRole.id,
      careerDomain: domain.label,
      careerPath: selectedRole.title,
      pathwayId: pathway.id,
      pathwayName: pathway.label,
      pathwayFocus: pathway.focus,
      compatibilityScore: profileMatch?.score ?? null,
      whyItSuits: profileMatch
        ? `Your saved profile connects through ${[...profileMatch.skillMatches, ...profileMatch.interestMatches, ...profileMatch.workAreaMatches].slice(0, 5).join(', ')}. This is a learning-fit estimate, not a hiring prediction.`
        : `You selected this path to explore. Your profile does not yet show a direct match; use the plan to assess your interest.`,
      relevantSkills: knownSkills,
      transferableSkills: [...new Set([...knownSkills, ...(profileMatch?.skillMatches || [])])].slice(0, 8),
      prerequisites: [...learningPlan.prerequisites],
      toolsAndTechnologies: [...learningPlan.toolsAndTechnologies],
      responsibilities: [...domain.responsibilities],
      workStyle: domain.workStyle,
      specializations: pathways.map((item) => item.label),
      missingSkills: plannedSteps.map((step) => step.skill),
      skillLearningPlan: plannedSteps.map((step) => ({ ...step })),
      learningRoadmap: plannedSteps.map((step) => ({
        phase: `${step.sequenceOrder}. ${step.skill}`,
        timeframe: step.priority,
        actions: [step.whyItMatters, step.exercise, step.projectMilestone],
        stepDetails: { ...step },
      })),
      suggestedPortfolioProject: learningPlan.projectMilestone,
      projectIdeas: [...learningPlan.projectIdeas],
      nextSteps: plannedSteps.length
        ? [`Start with ${plannedSteps[0].skill}.`, `Use the ${pathway.label} project milestone to build a portfolio artifact.`]
        : ['Your profile already covers the listed pathway skills; choose a project milestone to deepen your experience.'],
      resourceIds: [...new Set(plannedSteps.flatMap((step) => step.resourceIds))],
      resources: [...new Set(plannedSteps.flatMap((step) => step.resourceIds))]
        .map(getResourceById)
        .filter(Boolean),
      generationMethod: 'career-catalog',
    };
    const uid = auth.currentUser.uid;
    const profileRef = doc(firestore, 'users', uid, 'profile', 'profile');
    const historyRef = doc(collection(firestore, 'users', uid, 'profileHistory'));
    const recommendationRef = doc(collection(firestore, 'users', uid, 'careerRecommendations'));

    try {
      await runTransaction(firestore, async (transaction) => {
        if (auth?.currentUser?.uid !== uid || uid !== user.uid) throw new Error('auth-changed');
        const currentProfile = await transaction.get(profileRef);
        if (currentProfile.exists()) {
          transaction.set(historyRef, {
            ...currentProfile.data(),
            savedAt: serverTimestamp(),
            versionId: historyRef.id,
            changeType: 'before_pathway_update',
          });
        }
        transaction.set(profileRef, {
          selectedCareerPathway: {
            recommendationId: recommendationRef.id,
            careerId: selectedCareer.careerId,
            careerPath: selectedCareer.careerPath,
            careerDomain: selectedCareer.careerDomain,
            pathwayId: selectedCareer.pathwayId,
            pathwayName: selectedCareer.pathwayName,
            skillLearningPlan: selectedCareer.skillLearningPlan,
            learningRoadmap: selectedCareer.learningRoadmap,
            resourceIds: selectedCareer.resourceIds,
            selectedAt: serverTimestamp(),
          },
        }, { merge: true });
        transaction.set(recommendationRef, {
          careerRecommendations: [selectedCareer],
          generationMethod: 'career-catalog',
          selectedPathwayId: pathway.id,
          generatedAt: serverTimestamp(),
        });
      });
      setNotice(`${selectedRole.title} — ${pathway.label} saved to your profile.`);
      onContinueLearning?.(selectedCareer);
    } catch (saveError) {
      setError(saveError?.code === 'permission-denied'
        ? 'Firestore denied saving this pathway. Your existing rules were not changed; check the deployed owner-only rules and retry.'
        : 'This pathway could not be saved. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="career-explorer" aria-labelledby="career-explorer-title">
      <div className="career-explorer-heading">
        <div>
          <p className="eyebrow">Browse beyond your first ideas</p>
          <h2 id="career-explorer-title">Explore careers and pathways</h2>
          <p>Compare roles across domains, choose a learning route, and save it to your profile.</p>
        </div>
      </div>

      <div className="career-explorer-browser">
        <div className="career-explorer-filters">
          <label className="form-field" htmlFor="career-search">
            <span>Search careers</span>
            <input id="career-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="e.g. data analyst, UX designer" />
          </label>
          <label className="form-field" htmlFor="career-domain-filter">
            <span>Career domain</span>
            <select id="career-domain-filter" value={domainFilter} onChange={(event) => setDomainFilter(event.target.value)}>
              <option value="all">All career domains</option>
              {careerDomains.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
        </div>
        <div className="career-explorer-role-list" aria-label="Career roles">
          {filteredRoles.length ? filteredRoles.map((role) => (
            <button
              className={`career-explorer-role${selectedRoleId === role.id ? ' career-explorer-role--selected' : ''}`}
              type="button"
              key={role.id}
              onClick={() => { setSelectedRoleId(role.id); setSelectedPathwayId(''); setError(''); setNotice(''); }}
            >
              <span>{role.title}</span><small>{role.domainLabel}</small>
            </button>
          )) : <p className="career-explorer-empty">No roles match this search. Try a broader title or another domain.</p>}
        </div>
      </div>

      {selectedRole && domain && learningPlan && pathway && (
        <article className="career-explorer-detail" aria-labelledby="career-detail-title" ref={detailRef} tabIndex={-1}>
          <header className="career-explorer-detail-heading">
            <div><p className="eyebrow">{domain.label}</p><h3 id="career-detail-title">{selectedRole.title}</h3></div>
            {profileMatch && <span className="career-explorer-fit">{profileMatch.score}% profile overlap estimate</span>}
          </header>

          <div className="career-explorer-detail-copy">
            <section><h4>What the work involves</h4><p>{domain.responsibilities[0]}</p><p>{domain.workStyle}</p></section>
            <section><h4>Typical responsibilities</h4><ul>{domain.responsibilities.map((item) => <li key={item}>{item}</li>)}</ul></section>
          </div>

          <div className="career-pathway-choice">
            <label className="form-field" htmlFor="career-pathway-select">
              <span>Choose a pathway</span>
              <select id="career-pathway-select" value={pathway.id} onChange={(event) => { setSelectedPathwayId(event.target.value); setError(''); setNotice(''); }}>
                {pathways.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <p>{pathway.focus} {pathway.whyChoose ? `Choose this route if ${pathway.whyChoose}` : ''}</p>
          </div>

          <div className="career-explorer-columns">
            <section><h4>Important skills</h4><ul className="recommendation-tags">{pathway.skills.map((skill) => <li key={skill}>{skill}</li>)}</ul></section>
            <section><h4>Prerequisites</h4><ul>{pathway.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul></section>
            <section><h4>Tools and technologies</h4><ul>{pathway.tools.map((item) => <li key={item}>{item}</li>)}</ul></section>
            <section><h4>What you already know</h4>{knownSkills.length ? <ul className="recommendation-tags">{knownSkills.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Your saved profile does not list direct pathway skills yet.</p>}</section>
            <section><h4>Transferable skills</h4>{profileMatch?.skillMatches?.length ? <ul className="recommendation-tags">{profileMatch.skillMatches.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Add skills, project details, or preferred work areas to identify profile connections.</p>}</section>
            <section><h4>Skills to learn next</h4>{nextSteps.length ? <ul className="recommendation-tags recommendation-tags--gap">{nextSteps.map((step) => <li key={step.skill}>{step.skill}</li>)}</ul> : <p>Your saved skills already cover this pathway sequence.</p>}</section>
          </div>

          <section className="career-explorer-roadmap" aria-labelledby="career-pathway-roadmap-title">
            <div className="career-explorer-roadmap-heading"><div><p className="eyebrow">Career-specific sequence</p><h4 id="career-pathway-roadmap-title">Learning plan</h4></div><span>{pathway.label}</span></div>
            {nextSteps.length ? (
              <ol>
                {nextSteps.map((step) => {
                  const stepResources = getResourcesForCareer({ domainId: selectedRole.domainId, roleTitle: selectedRole.title, topics: [step.skill], limit: 3 });
                  return (
                    <li key={step.skill}>
                      <div><strong>{step.sequenceOrder}. {step.skill}</strong><span>{step.whyItMatters}</span></div>
                      <p>Reuse: {step.reusedSkills.length ? step.reusedSkills.join(', ') : 'No direct match listed yet'}</p>
                      <p>Prerequisite: {step.prerequisites.join(', ')}</p>
                      <p>Exercise: {step.exercise}</p>
                      <p>Project milestone: {step.projectMilestone}</p>
                      {stepResources.length > 0 && <ul className="career-resource-links">{stepResources.map((resource) => <li key={resource.id}><a href={resource.url} target="_blank" rel="noreferrer">{resource.title} <span>· {resource.provider} · {resource.costStatus === 'unknown' ? 'price unknown' : resource.costStatus}</span></a></li>)}</ul>}
                    </li>
                  );
                })}
              </ol>
            ) : <p>Your profile matches the listed pathway skills. Use the project milestone to extend your experience.</p>}
            <div className="career-project-milestone"><strong>Portfolio project</strong><p>{learningPlan.projectMilestone}</p></div>
            {resources.length > 0 && <p className="career-resource-note">Resources are provider links; check each course page for current availability, pricing, prerequisites, and instructional language.</p>}
          </section>

          {notice && <p className="auth-success" role="status">{notice}</p>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <div className="career-explorer-actions">
            <button className="button button-primary" type="button" onClick={savePathway} disabled={saving}>
              {saving ? 'Saving pathway...' : 'Save Pathway and Continue Learning'} <span aria-hidden="true">↗</span>
            </button>
          </div>
        </article>
      )}
    </section>
  );
}

export default CareerExplorer;
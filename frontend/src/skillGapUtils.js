import { compareJobRequirements, normalizeJobRequirements } from './jobMatchUtils.js';

function skillKey(skill) {
  return normalizeJobRequirements([skill])[0].toLocaleLowerCase('en-US');
}

function matchingProfileSkills(skill, values) {
  return values.filter((value) => compareJobRequirements([skill], [value]).matchedCount === 1);
}

function getEvidenceFields(skill, entry, fields) {
  return fields.filter((field) => (
    typeof entry[field] === 'string'
    && entry[field].trim()
    && compareJobRequirements([skill], [entry[field]]).matchedCount === 1
  ));
}

function profileEvidence(profile, skill) {
  const evidence = [];
  const skills = Array.isArray(profile?.skills)
    ? profile.skills.filter((value) => typeof value === 'string' && value.trim())
    : [];
  matchingProfileSkills(skill, skills).forEach((value) => {
    evidence.push({
      source: 'profile-skill',
      description: `Listed in profile skills as "${value}".`,
    });
  });

  const projects = Array.isArray(profile?.projects) ? profile.projects : [];
  projects.forEach((project) => {
    if (typeof project === 'string') {
      if (project.trim() && compareJobRequirements([skill], [project]).matchedCount === 1) {
        evidence.push({
          source: 'project',
          description: `Demonstrated in project evidence ("${project.trim()}").`,
        });
      }
      return;
    }
    if (!project || typeof project !== 'object' || Array.isArray(project)) return;
    const fields = getEvidenceFields(skill, project, ['name', 'description', 'technologies']);
    if (!fields.length) return;
    const name = typeof project.name === 'string' && project.name.trim()
      ? project.name.trim()
      : 'Untitled project';
    const fieldLabels = fields.map((field) => ({
      name: 'name',
      description: 'description',
      technologies: 'technologies',
    })[field]);
    evidence.push({
      source: 'project',
      description: `Demonstrated in project "${name}" (${fieldLabels.join(', ')}).`,
    });
  });

  const certifications = Array.isArray(profile?.certifications) ? profile.certifications : [];
  certifications.forEach((certification) => {
    if (typeof certification === 'string') {
      if (certification.trim() && compareJobRequirements([skill], [certification]).matchedCount === 1) {
        evidence.push({
          source: 'certification',
          description: `Demonstrated in certification evidence ("${certification.trim()}").`,
        });
      }
      return;
    }
    if (!certification || typeof certification !== 'object' || Array.isArray(certification)) return;
    const fields = getEvidenceFields(skill, certification, ['name', 'issuer', 'description']);
    if (!fields.length) return;
    const name = typeof certification.name === 'string' && certification.name.trim()
      ? certification.name.trim()
      : 'Unnamed certification';
    const fieldLabels = fields.map((field) => ({
      name: 'name',
      issuer: 'issuer',
      description: 'description',
    })[field]);
    evidence.push({
      source: 'certification',
      description: `Demonstrated in certification "${name}" (${fieldLabels.join(', ')}).`,
    });
  });

  return evidence;
}

export function calculateSkillGaps(targetSkills, profile = {}) {
  const targets = Array.isArray(targetSkills) ? targetSkills : [];
  const normalizedTargets = [];
  const seen = new Set();

  targets.forEach((target) => {
    const rawSkill = typeof target === 'string' ? target : target?.skill;
    if (typeof rawSkill !== 'string' || !rawSkill.trim()) return;

    const skill = normalizeJobRequirements([rawSkill])[0];
    const key = skillKey(skill);
    if (seen.has(key)) return;
    seen.add(key);

    const evidence = profileEvidence(profile, skill);
    normalizedTargets.push({
      ...(target && typeof target === 'object' && !Array.isArray(target) ? target : {}),
      skill,
      status: evidence.length ? 'demonstrated' : 'unverified',
      evidence,
    });
  });

  return {
    skills: normalizedTargets,
    demonstratedSkills: normalizedTargets.filter((item) => item.status === 'demonstrated'),
    unverifiedSkills: normalizedTargets.filter((item) => item.status === 'unverified'),
  };
}

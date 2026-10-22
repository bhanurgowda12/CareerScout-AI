const SKILL_ALIASES = new Map([
  ['c plus plus', 'c++'],
  ['c sharp', 'c#'],
  ['css 3', 'css3'],
  ['html 5', 'html5'],
  ['java script', 'javascript'],
  ['js', 'javascript'],
  ['javascript', 'javascript'],
  ['node js', 'node.js'],
  ['nodejs', 'node.js'],
  ['node.js', 'node.js'],
  ['postgres', 'postgresql'],
  ['postgresql', 'postgresql'],
  ['react js', 'react'],
  ['reactjs', 'react'],
  ['react.js', 'react'],
  ['structured query language', 'sql'],
]);

const DISPLAY_NAMES = new Map([
  ['c#', 'C#'],
  ['c++', 'C++'],
  ['css3', 'CSS3'],
  ['html5', 'HTML5'],
  ['javascript', 'JavaScript'],
  ['node.js', 'Node.js'],
  ['postgresql', 'PostgreSQL'],
  ['react', 'React'],
  ['sql', 'SQL'],
]);

const ALIAS_PATTERN = /\b(?:c\s+plus\s+plus|c\s+sharp|css\s+3|html\s+5|java\s+script|js|javascript|node\s+js|nodejs|node\.js|postgres|postgresql|react\s+js|reactjs|react\.js|structured\s+query\s+language)\b/gi;

export class JobMatchValidationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'JobMatchValidationError';
    this.code = code;
  }
}

function cleanSkillName(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ');
}

function aliasKey(value) {
  const key = cleanSkillName(value).toLocaleLowerCase('en-US');
  return SKILL_ALIASES.get(key) || key;
}

export function normalizeSkillName(value) {
  const cleaned = cleanSkillName(value);
  if (!cleaned) return '';
  const key = aliasKey(cleaned);
  return DISPLAY_NAMES.get(key) || cleaned;
}

function normalizeForMatching(value) {
  const cleaned = cleanSkillName(value).toLocaleLowerCase('en-US');
  const canonical = cleaned.replace(ALIAS_PATTERN, (alias) => (
    SKILL_ALIASES.get(alias.replace(/\s+/g, ' ').toLocaleLowerCase('en-US')) || alias
  ));
  return canonical.match(/[a-z0-9]+(?:[.+#][a-z0-9]+|[+#])*/g) || [];
}

function containsSkill(evidence, requirement) {
  const evidenceTokens = normalizeForMatching(evidence);
  const requirementTokens = normalizeForMatching(requirement);
  if (!requirementTokens.length || requirementTokens.length > evidenceTokens.length) return false;

  for (let start = 0; start <= evidenceTokens.length - requirementTokens.length; start += 1) {
    if (requirementTokens.every((token, offset) => token === evidenceTokens[start + offset])) return true;
  }
  return false;
}

function validateRequirements(requirements) {
  if (!Array.isArray(requirements)) {
    throw new JobMatchValidationError(
      'Job requirements must be provided as an array of skill names.',
      'invalid-requirements',
    );
  }
  if (!requirements.every((requirement) => typeof requirement === 'string')) {
    throw new JobMatchValidationError(
      'Each job requirement must be a skill name string.',
      'invalid-requirement',
    );
  }

  const normalized = [];
  const seen = new Set();
  requirements.forEach((requirement) => {
    const name = normalizeSkillName(requirement);
    if (!name) return;
    const key = aliasKey(name);
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push(name);
  });

  if (!normalized.length) {
    throw new JobMatchValidationError(
      'No recognized job requirements were provided.',
      'no-recognized-requirements',
    );
  }
  return normalized;
}

function collectProfileEvidence(profileEvidence) {
  if (profileEvidence === undefined || profileEvidence === null) return [];
  if (typeof profileEvidence === 'string') return [profileEvidence];
  if (Array.isArray(profileEvidence)) {
    if (!profileEvidence.every((item) => typeof item === 'string')) {
      throw new JobMatchValidationError(
        'Profile evidence arrays may contain only strings.',
        'invalid-profile-evidence',
      );
    }
    return profileEvidence;
  }
  if (typeof profileEvidence !== 'object') {
    throw new JobMatchValidationError(
      'Profile evidence must be text, an array of text, or a profile object.',
      'invalid-profile-evidence',
    );
  }

  const evidence = [];
  const addText = (value) => {
    if (value === undefined || value === null || value === '') return;
    if (typeof value !== 'string') {
      throw new JobMatchValidationError(
        'Profile evidence fields must contain text.',
        'invalid-profile-evidence',
      );
    }
    evidence.push(value);
  };
  const addEntries = (entries, fields) => {
    if (entries === undefined || entries === null) return;
    if (!Array.isArray(entries)) {
      throw new JobMatchValidationError(
        'Profile skills, projects, and certifications must be arrays.',
        'invalid-profile-evidence',
      );
    }
    entries.forEach((entry) => {
      if (typeof entry === 'string') {
        addText(entry);
        return;
      }
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new JobMatchValidationError(
          'Profile evidence entries must be text or objects.',
          'invalid-profile-evidence',
        );
      }
      fields.forEach((field) => addText(entry[field]));
    });
  };

  if (profileEvidence.skills !== undefined && profileEvidence.skills !== null) {
    if (!Array.isArray(profileEvidence.skills)) {
      throw new JobMatchValidationError(
        'Profile skills, projects, and certifications must be arrays.',
        'invalid-profile-evidence',
      );
    }
    profileEvidence.skills.forEach((skill) => {
      if (typeof skill !== 'string') {
        throw new JobMatchValidationError(
          'Profile skills must contain only strings.',
          'invalid-profile-evidence',
        );
      }
      addText(skill);
    });
  }
  addEntries(profileEvidence.projects, ['name', 'description', 'technologies']);
  addEntries(profileEvidence.certifications, ['name', 'issuer', 'description']);
  return evidence;
}

export function normalizeJobRequirements(requirements) {
  return validateRequirements(requirements);
}

export function compareJobRequirements(requirements, profileEvidence = {}) {
  const recognizedRequirements = validateRequirements(requirements);
  const evidence = collectProfileEvidence(profileEvidence);
  const matchedRequirements = [];
  const unverifiedRequirements = [];

  recognizedRequirements.forEach((requirement) => {
    const matched = evidence.some((item) => containsSkill(item, requirement));
    (matched ? matchedRequirements : unverifiedRequirements).push(requirement);
  });

  const matchedCount = matchedRequirements.length;
  const totalCount = recognizedRequirements.length;
  return {
    recognizedRequirements,
    matchedRequirements,
    unverifiedRequirements,
    requirements: recognizedRequirements.map((skill) => ({
      skill,
      status: matchedRequirements.includes(skill) ? 'matched' : 'unverified',
    })),
    matchedCount,
    totalCount,
    score: Math.round((matchedCount / totalCount) * 100),
    interpretationNote: 'Unverified means no matching evidence was found in the information provided; it does not mean you lack the skill. Keyword matching does not assess proficiency or competence.',
  };
}

export function validateJobMatchResult(result) {
  const invalidResult = () => {
    throw new JobMatchValidationError(
      'The match results were invalid. Please run the analysis again.',
      'invalid-result',
    );
  };
  if (!result || typeof result !== 'object' || Array.isArray(result)) invalidResult();

  const {
    recognizedRequirements,
    matchedRequirements,
    unverifiedRequirements,
    requirements,
    matchedCount,
    totalCount,
    score,
    interpretationNote,
  } = result;
  const isStringList = (value) => Array.isArray(value)
    && value.every((item) => typeof item === 'string' && item.trim());
  if (
    !isStringList(recognizedRequirements)
    || !recognizedRequirements.length
    || new Set(recognizedRequirements).size !== recognizedRequirements.length
    || !isStringList(matchedRequirements)
    || !isStringList(unverifiedRequirements)
    || matchedCount !== matchedRequirements.length
    || totalCount !== recognizedRequirements.length
    || matchedCount + unverifiedRequirements.length !== totalCount
    || !Number.isInteger(score)
    || score !== Math.round((matchedCount / totalCount) * 100)
    || typeof interpretationNote !== 'string'
    || !/does not mean you lack the skill/i.test(interpretationNote)
    || !Array.isArray(requirements)
    || requirements.length !== totalCount
  ) invalidResult();

  const matchedSet = new Set(matchedRequirements);
  const unverifiedSet = new Set(unverifiedRequirements);
  if (
    matchedSet.size !== matchedRequirements.length
    || unverifiedSet.size !== unverifiedRequirements.length
    || matchedRequirements.some((skill) => !recognizedRequirements.includes(skill) || unverifiedSet.has(skill))
    || unverifiedRequirements.some((skill) => !recognizedRequirements.includes(skill))
    || requirements.some((entry, index) => (
      !entry
      || typeof entry !== 'object'
      || entry.skill !== recognizedRequirements[index]
      || entry.status !== (matchedSet.has(entry.skill) ? 'matched' : 'unverified')
    ))
  ) invalidResult();

  return result;
}

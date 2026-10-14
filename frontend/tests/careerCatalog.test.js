import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCareerLearningPlan,
  careerDomains,
  careerRoles,
  buildCareerRecommendation,
  createRuleBasedRecommendations,
  getCareerProgressDocumentId,
  getCareerPathways,
  matchProfileToCareers,
} from '../src/careerCatalog.js';
import {
  getResourcesForCareer,
  resourceCatalogue,
  resourceTypes,
  validateResourceCatalogue,
} from '../src/resourceCatalog.js';

test('career catalogue contains the requested diverse domains and roles', () => {
  const roleTitles = new Set(careerRoles.map((role) => role.title));
  for (const title of [
    'Software Engineer', 'Data Analyst', 'AI Engineer', 'SOC Analyst',
    'Cloud Engineer', 'QA Engineer', 'UX Designer', 'Business Analyst',
    'Financial Analyst', 'Digital Marketing Specialist', 'Technical Trainer',
    'Manufacturing Engineer', 'Healthcare Data Analyst', 'Environmental Scientist',
    'Supply Chain Analyst', 'Tourism Coordinator', 'Policy Research Assistant',
  ]) assert(roleTitles.has(title), title);
  assert(careerDomains.length >= 15);
});

test('profile matches include several relevant technical domains without restricting to web development', () => {
  const suggestions = matchProfileToCareers({
    skills: ['Python', 'JavaScript', 'Java'],
    interests: ['data science', 'cybersecurity', 'cloud computing'],
  });
  const domainIds = new Set(suggestions.map((career) => career.domainId));
  for (const id of ['software-development', 'data-analytics', 'artificial-intelligence', 'cybersecurity', 'cloud-infrastructure', 'software-quality']) {
    assert(domainIds.has(id), id);
  }
  assert(suggestions.every((career) => career.score > 0));
});

test('profile matches stay grounded in interests and saved evidence', () => {
  const finance = matchProfileToCareers({
    skills: ['Excel', 'financial reporting'],
    interests: ['accounting', 'audit'],
  });
  assert(finance.some((career) => career.title === 'Accountant'));
  assert(finance.some((career) => career.domainId === 'finance-accounting'));
  assert(!matchProfileToCareers({}).length);
  assert(matchProfileToCareers({ interests: ['Software and application development'] })
    .some((career) => career.domainId === 'software-development'));
});

test('education, preferred work areas, and experience are used as profile context', () => {
  const educationMatches = matchProfileToCareers({ branch: 'Accounting and Finance' });
  assert(educationMatches.some((career) => career.domainId === 'finance-accounting'));

  const profile = {
    preferredWorkAreas: ['finance'],
    experienceLevel: 'Intermediate',
    skills: ['Excel'],
  };
  const financeMatch = matchProfileToCareers(profile, careerRoles.length).find((career) => career.domainId === 'finance-accounting');
  assert(financeMatch);
  const recommendation = buildCareerRecommendation(financeMatch);
  assert.match(recommendation.whyItSuits, /experience level is Intermediate/);
});

test('career pathways stay domain-relevant', () => {
  const backendLabels = getCareerPathways('Backend Developer').map((pathway) => pathway.label);
  assert(backendLabels.includes('Python + FastAPI'));
  assert(backendLabels.includes('Java + Spring Boot'));
  const analystLabels = getCareerPathways('Data Analyst').map((pathway) => pathway.label);
  assert(analystLabels.includes('Python + Pandas + SQL'));
  assert(analystLabels.includes('SQL + Power BI'));
  assert(analystLabels.includes('Excel + Power BI'));
  assert(!getCareerPathways('Digital Marketing Specialist').some((pathway) => pathway.label.includes('Python')));
  assert(getCareerPathways('SOC Analyst').some((pathway) => pathway.id === 'soc-defensive'));
});

test('career learning plans adapt to selected role and pathway', () => {
  const cybersecurity = buildCareerLearningPlan('SOC Analyst', 'soc-defensive', {
    skills: ['Linux', 'Networking'],
    interests: ['defensive security'],
  });
  assert.equal(cybersecurity.careerDomain, 'Cybersecurity');
  assert(cybersecurity.steps.some((step) => step.skill === 'Logs'));
  assert.match(cybersecurity.steps[0].exercise, /training environment/i);

  const design = buildCareerLearningPlan('UX Designer', 'ux-research', { skills: ['Figma'] });
  assert.equal(design.careerDomain, 'UI/UX and product design');
  assert(design.steps.some((step) => step.skill === 'Interviewing'));
  assert.notDeepEqual(cybersecurity.steps.map((step) => step.skill), design.steps.map((step) => step.skill));
});

test('rule-based fallback is transparent and produces profile-grounded recommendations', () => {
  const result = createRuleBasedRecommendations({
    skills: ['SQL', 'Excel'],
    interests: ['business intelligence', 'reporting'],
  });
  assert.equal(result.generationMethod, 'rule-based');
  assert(result.careerRecommendations.some((career) => career.careerDomain === 'Data and analytics'));
  assert(result.careerRecommendations.every((career) => /not a hiring prediction/i.test(career.whyItSuits)));
});

test('resource catalogue validates required metadata and HTTPS destinations', () => {
  assert.equal(validateResourceCatalogue(), true);
  assert(resourceCatalogue.length >= 20);
  assert(resourceCatalogue.every((resource) => resourceTypes.includes(resource.resourceType)));
  assert.throws(() => validateResourceCatalogue([{ ...resourceCatalogue[0], url: 'http://example.com' }]), /HTTPS/);
  assert.throws(() => validateResourceCatalogue([{ ...resourceCatalogue[0], costStatus: 'free-ish' }]), /cost status/);
  assert.throws(() => validateResourceCatalogue([{ ...resourceCatalogue[0], careerDomains: ['unknown-domain'] }]), /domain is unknown/);
});

test('resources are discoverable by career role, domain, and topic', () => {
  const cyberResources = getResourcesForCareer({ domainId: 'cybersecurity', roleTitle: 'SOC Analyst', topics: ['SIEM'] });
  assert(cyberResources.some((resource) => resource.id === 'tryhackme-soc-level-1'));
  const designResources = getResourcesForCareer({ domainId: 'design-product', roleTitle: 'UX Designer', topics: ['user research'] });
  assert(designResources.some((resource) => resource.id === 'google-certificate-ux-design'));
  assert(!designResources.some((resource) => resource.id === 'kaggle-python'));
  const grcResources = getResourcesForCareer({
    domainId: 'cybersecurity',
    roleTitle: 'Governance, Risk and Compliance Analyst',
    topics: ['access reviews'],
  });
  assert(!grcResources.some((resource) => resource.id === 'tryhackme-soc-level-1'));
});

test('changing a pathway keeps existing role-and-skill progress keys intact', () => {
  const previousProgress = new Set([
    getCareerProgressDocumentId('Backend Developer', 'Python'),
    getCareerProgressDocumentId('Backend Developer', 'SQL'),
  ]);
  const sameRoleOtherPathwayKeys = [
    getCareerProgressDocumentId('Backend Developer', 'Python'),
    getCareerProgressDocumentId('Backend Developer', 'SQL'),
  ];
  assert(sameRoleOtherPathwayKeys.every((key) => previousProgress.has(key)));
  assert(previousProgress.has(getCareerProgressDocumentId('Backend Developer', 'Python')));
  assert.notEqual(
    getCareerProgressDocumentId('Backend Developer', 'Python'),
    getCareerProgressDocumentId('Data Analyst', 'Python'),
  );
});

test('project and certification evidence prevents already-demonstrated skills from becoming gaps', () => {
  const matches = matchProfileToCareers({
    projects: [{ name: 'Data dashboard', description: 'Cleaned records with Pandas and SQL', technologies: 'Python, Pandas, SQL' }],
    certifications: [{ name: 'Power BI data analysis', issuer: 'Training provider' }],
    interests: ['data analytics'],
  }, careerRoles.length);
  const analyst = matches.find((career) => career.title === 'Data Analyst');
  const recommendation = buildCareerRecommendation(analyst);
  assert(analyst.projectMatches.length > 0);
  assert(analyst.certificationMatches.length > 0);
  assert(!recommendation.missingSkills.some((skill) => ['pandas', 'sql', 'power bi'].includes(skill.toLocaleLowerCase())));
});
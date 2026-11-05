import { EMPLOYMENT_TYPES, MAX_DESCRIPTION_LENGTH, isValidHttpUrl } from './jobApplicationUtils.js';
import { compareJobRequirements, normalizeJobRequirements } from './jobMatchUtils.js';

export const MAX_JOB_SEARCH_LENGTH = 100;
export const MAX_JOB_LOCATION_LENGTH = 120;
export const JOB_SKILLS = [
  'Python',
  'Java',
  'JavaScript',
  'TypeScript',
  'React',
  'Angular',
  'Node.js',
  'HTML',
  'CSS',
  'SQL',
  'MongoDB',
  'Firebase',
  'AWS',
  'Docker',
  'Kubernetes',
  'Git',
  'Machine Learning',
  'Data Science',
];

export const JOB_CATEGORIES = [
  { id: 'software-development', label: 'Software Development', roles: [
    { title: 'Python Developer', synonyms: ['Python Engineer', 'Python Programmer', 'Python Software Developer'] },
    { title: 'Java Developer', synonyms: ['Java Engineer', 'Java Programmer', 'Java Software Developer'] },
    { title: 'JavaScript Developer', synonyms: ['JavaScript Engineer', 'JavaScript Programmer', 'JS Developer'] },
    { title: 'React Developer', synonyms: ['React Engineer', 'React.js Developer', 'React Frontend Developer'] },
    { title: 'Angular Developer', synonyms: ['Angular Engineer', 'Angular.js Developer'] },
    { title: 'Node.js Developer', synonyms: ['Node.js Engineer', 'Node Developer', 'Node.js Backend Developer'] },
    { title: 'Frontend Developer', synonyms: ['Frontend Engineer', 'Front-End Developer', 'UI Developer'] },
    { title: 'Backend Developer', synonyms: ['Backend Engineer', 'Back-End Developer', 'API Developer'] },
    { title: 'Full Stack Developer', synonyms: ['Full-Stack Engineer', 'Full Stack Software Engineer', 'Frontend and Backend Software Engineer'] },
    { title: 'Software Engineer', synonyms: ['Software Developer', 'Application Developer'] },
    { title: 'Web Developer', synonyms: ['Web Application Developer'] },
  ] },
  { id: 'ai-machine-learning', label: 'AI & Machine Learning', roles: [
    { title: 'AI Engineer', synonyms: ['Artificial Intelligence Engineer', 'AI Developer'] },
    { title: 'Machine Learning Engineer', synonyms: ['ML Engineer', 'Machine Learning Developer'] },
    { title: 'Generative AI Engineer', synonyms: ['GenAI Engineer', 'LLM Engineer'] },
    { title: 'Computer Vision Engineer', synonyms: ['Vision Engineer'] },
    { title: 'NLP Engineer', synonyms: ['Natural Language Processing Engineer'] },
  ] },
  { id: 'data-analytics', label: 'Data & Analytics', roles: [
    { title: 'Data Engineer', synonyms: ['Big Data Engineer', 'Analytics Engineer'] },
    { title: 'Data Analyst', synonyms: ['Business Data Analyst', 'Reporting Analyst'] },
    { title: 'Data Scientist', synonyms: ['Applied Data Scientist'] },
    { title: 'Business Intelligence Analyst', synonyms: ['BI Analyst'] },
    { title: 'Database Administrator', synonyms: ['Database Engineer', 'DBA'] },
  ] },
  { id: 'mobile-app-development', label: 'Mobile App Development', roles: [
    { title: 'Android Developer', synonyms: ['Android Engineer'] },
    { title: 'iOS Developer', synonyms: ['iOS Engineer', 'Swift Developer'] },
    { title: 'Flutter Developer', synonyms: ['Flutter Engineer', 'Cross-platform Mobile Developer'] },
    { title: 'React Native Developer', synonyms: ['Mobile Application Developer'] },
  ] },
  { id: 'game-development', label: 'Game Development', roles: [
    { title: 'Game Developer', synonyms: ['Gameplay Programmer', 'Game Programmer'] },
    { title: 'Unity Developer', synonyms: ['Unity Game Developer'] },
    { title: 'Unreal Engine Developer', synonyms: ['Unreal Developer'] },
    { title: 'Game Designer', synonyms: ['Level Designer'] },
  ] },
  { id: 'cloud-devops', label: 'Cloud & DevOps', roles: [
    { title: 'Cloud Engineer', synonyms: ['Cloud Infrastructure Engineer'] },
    { title: 'DevOps Engineer', synonyms: ['DevOps Specialist'] },
    { title: 'Site Reliability Engineer', synonyms: ['SRE'] },
    { title: 'Platform Engineer', synonyms: ['Cloud Platform Engineer'] },
    { title: 'Cloud Architect', synonyms: ['Solutions Architect'] },
  ] },
  { id: 'cybersecurity', label: 'Cybersecurity', roles: [
    { title: 'Cybersecurity Engineer', synonyms: ['Information Security Engineer', 'Security Engineer'] },
    { title: 'Security Analyst', synonyms: ['SOC Analyst', 'Information Security Analyst'] },
    { title: 'Penetration Tester', synonyms: ['Ethical Hacker', 'Security Tester'] },
    { title: 'Cloud Security Engineer', synonyms: ['Application Security Engineer'] },
  ] },
  { id: 'software-testing-qa', label: 'Software Testing & QA', roles: [
    { title: 'QA Engineer', synonyms: ['Quality Assurance Engineer', 'Quality Engineer'] },
    { title: 'Automation Test Engineer', synonyms: ['Test Automation Engineer', 'SDET'] },
    { title: 'Manual Tester', synonyms: ['Software Tester', 'QA Tester'] },
    { title: 'Performance Test Engineer', synonyms: ['Performance QA Engineer'] },
  ] },
  { id: 'ui-ux-product-design', label: 'UI/UX & Product Design', roles: [
    { title: 'UI/UX Designer', synonyms: ['UX/UI Designer', 'Product Designer'] },
    { title: 'UX Researcher', synonyms: ['User Researcher'] },
    { title: 'Visual Designer', synonyms: ['UI Designer'] },
    { title: 'Interaction Designer', synonyms: ['UX Designer'] },
  ] },
  { id: 'embedded-iot', label: 'Embedded Systems & IoT', roles: [
    { title: 'Embedded Systems Engineer', synonyms: ['Embedded Software Engineer', 'Firmware Engineer'] },
    { title: 'IoT Engineer', synonyms: ['Internet of Things Engineer'] },
    { title: 'Firmware Developer', synonyms: ['Embedded Developer'] },
  ] },
  { id: 'electronics-hardware', label: 'Electronics & Hardware', roles: [
    { title: 'Hardware Engineer', synonyms: ['Computer Hardware Engineer'] },
    { title: 'Electronics Engineer', synonyms: ['Electronics Design Engineer'] },
    { title: 'VLSI Engineer', synonyms: ['ASIC Design Engineer', 'Chip Design Engineer'] },
    { title: 'PCB Design Engineer', synonyms: ['Hardware Design Engineer'] },
  ] },
  { id: 'robotics-automation', label: 'Robotics & Automation', roles: [
    { title: 'Robotics Engineer', synonyms: ['Robotics Software Engineer'] },
    { title: 'Automation Engineer', synonyms: ['Industrial Automation Engineer'] },
    { title: 'Control Systems Engineer', synonyms: ['Controls Engineer'] },
    { title: 'PLC Engineer', synonyms: ['PLC Automation Engineer'] },
  ] },
  { id: 'blockchain-web3', label: 'Blockchain & Web3', roles: [
    { title: 'Blockchain Developer', synonyms: ['Blockchain Engineer'] },
    { title: 'Smart Contract Developer', synonyms: ['Solidity Developer'] },
    { title: 'Web3 Engineer', synonyms: ['Decentralized Application Developer', 'dApp Developer'] },
  ] },
  { id: 'it-support', label: 'IT & Technical Support', roles: [
    { title: 'Technical Support Engineer', synonyms: ['Technical Support Specialist'] },
    { title: 'IT Support Engineer', synonyms: ['IT Help Desk Technician', 'Helpdesk Analyst'] },
    { title: 'Systems Administrator', synonyms: ['System Administrator'] },
    { title: 'Network Engineer', synonyms: ['Network Administrator'] },
  ] },
  { id: 'architecture-leadership', label: 'Software Architecture & Technical Leadership', roles: [
    { title: 'Software Architect', synonyms: ['Application Architect', 'Solution Architect'] },
    { title: 'Technical Lead', synonyms: ['Tech Lead', 'Lead Software Engineer'] },
    { title: 'Engineering Manager', synonyms: ['Software Engineering Manager'] },
    { title: 'Principal Engineer', synonyms: ['Staff Engineer'] },
  ] },
  { id: 'product-project-management', label: 'Product & Project Management', roles: [
    { title: 'Product Manager', synonyms: ['Technical Product Manager'] },
    { title: 'Project Manager', synonyms: ['Technical Project Manager'] },
    { title: 'Program Manager', synonyms: ['Technical Program Manager'] },
    { title: 'Scrum Master', synonyms: ['Agile Delivery Manager'] },
  ] },
  { id: 'business-operations', label: 'Business Analysis & Operations', roles: [
    { title: 'Business Analyst', synonyms: ['IT Business Analyst'] },
    { title: 'Operations Analyst', synonyms: ['Business Operations Analyst'] },
    { title: 'Process Analyst', synonyms: ['Process Improvement Analyst'] },
    { title: 'Management Consultant', synonyms: ['Business Consultant'] },
  ] },
  { id: 'sales-business-development', label: 'Sales & Business Development', roles: [
    { title: 'Business Development Representative', synonyms: ['BDR', 'Business Development Executive'] },
    { title: 'Sales Development Representative', synonyms: ['SDR'] },
    { title: 'Account Executive', synonyms: ['Sales Executive'] },
    { title: 'Pre-Sales Engineer', synonyms: ['Sales Engineer', 'Solutions Consultant'] },
  ] },
  { id: 'marketing-growth', label: 'Marketing & Growth', roles: [
    { title: 'Digital Marketing Executive', synonyms: ['Digital Marketing Specialist'] },
    { title: 'Growth Marketing Manager', synonyms: ['Growth Marketer'] },
    { title: 'SEO Specialist', synonyms: ['Search Engine Optimization Specialist'] },
    { title: 'Content Marketing Specialist', synonyms: ['Marketing Content Writer'] },
    { title: 'Social Media Manager', synonyms: ['Social Media Specialist'] },
  ] },
  { id: 'human-resources', label: 'Human Resources & Recruitment', roles: [
    { title: 'Technical Recruiter', synonyms: ['Technology Recruiter', 'IT Recruiter'] },
    { title: 'Talent Acquisition Specialist', synonyms: ['Recruitment Specialist'] },
    { title: 'HR Generalist', synonyms: ['Human Resources Specialist'] },
  ] },
  { id: 'finance-accounting', label: 'Finance & Accounting', roles: [
    { title: 'Financial Analyst', synonyms: ['Corporate Financial Analyst'] },
    { title: 'Accountant', synonyms: ['Staff Accountant'] },
    { title: 'Accounts Payable Specialist', synonyms: ['Accounts Receivable Specialist'] },
    { title: 'Finance Associate', synonyms: ['Finance Executive'] },
  ] },
  { id: 'customer-success-support', label: 'Customer Success & Customer Support', roles: [
    { title: 'Customer Success Manager', synonyms: ['Customer Success Associate'] },
    { title: 'Customer Support Representative', synonyms: ['Customer Service Representative'] },
    { title: 'Technical Customer Support', synonyms: ['Product Support Specialist'] },
  ] },
  { id: 'content-media', label: 'Content & Media', roles: [
    { title: 'Technical Writer', synonyms: ['Documentation Specialist'] },
    { title: 'Content Writer', synonyms: ['Copywriter'] },
    { title: 'Video Editor', synonyms: ['Video Producer'] },
    { title: 'Graphic Designer', synonyms: ['Multimedia Designer'] },
  ] },
  { id: 'research-innovation', label: 'Research & Innovation', roles: [
    { title: 'Research Engineer', synonyms: ['Applied Research Engineer'] },
    { title: 'Research Scientist', synonyms: ['Applied Scientist'] },
    { title: 'Innovation Analyst', synonyms: ['R&D Analyst'] },
  ] },
  { id: 'mechanical-manufacturing', label: 'Mechanical & Manufacturing', roles: [
    { title: 'Mechanical Design Engineer', synonyms: ['Mechanical Engineer', 'CAD Design Engineer'] },
    { title: 'Manufacturing Engineer', synonyms: ['Production Engineer'] },
    { title: 'Quality Engineer - Manufacturing', synonyms: ['Manufacturing Quality Engineer'] },
  ] },
  { id: 'civil-construction', label: 'Civil & Construction', roles: [
    { title: 'Civil Engineer', synonyms: ['Structural Engineer'] },
    { title: 'Construction Project Engineer', synonyms: ['Site Engineer'] },
    { title: 'Quantity Surveyor', synonyms: ['Construction Cost Engineer'] },
  ] },
  { id: 'electrical-energy', label: 'Electrical & Energy', roles: [
    { title: 'Electrical Engineer', synonyms: ['Power Systems Engineer'] },
    { title: 'Renewable Energy Engineer', synonyms: ['Solar Engineer'] },
    { title: 'Energy Analyst', synonyms: ['Energy Systems Engineer'] },
  ] },
  { id: 'chemical-process', label: 'Chemical & Process Engineering', roles: [
    { title: 'Chemical Engineer', synonyms: ['Process Engineer'] },
    { title: 'Process Safety Engineer', synonyms: ['Chemical Process Engineer'] },
    { title: 'Production Chemist', synonyms: ['Process Development Engineer'] },
  ] },
  { id: 'supply-chain-logistics', label: 'Supply Chain & Logistics', roles: [
    { title: 'Supply Chain Analyst', synonyms: ['Supply Chain Specialist'] },
    { title: 'Logistics Coordinator', synonyms: ['Logistics Analyst'] },
    { title: 'Procurement Specialist', synonyms: ['Purchasing Specialist'] },
    { title: 'Demand Planner', synonyms: ['Inventory Planner'] },
  ] },
  { id: 'internships-graduate', label: 'Internships & Graduate Opportunities', roles: [
    { title: 'Software Engineering Intern', synonyms: ['Software Developer Intern'] },
    { title: 'Data Analyst Intern', synonyms: ['Data Science Intern'] },
    { title: 'Graduate Engineer Trainee', synonyms: ['Graduate Trainee', 'Graduate Engineer'] },
    { title: 'Engineering Intern', synonyms: ['Engineering Internship'] },
    { title: 'Business Intern', synonyms: ['Marketing Intern', 'Finance Intern'] },
    { title: 'Internship', synonyms: ['Intern', 'Trainee', 'Entry Level Graduate'] },
  ] },
];

export const WORK_MODES = ['Any work mode', 'Remote', 'Hybrid', 'On-site'];
export const EXPERIENCE_FILTERS = [
  'All opportunities',
  'Internships',
  'Freshers & graduates',
  'Entry-level jobs',
  'Experienced jobs',
];
export const EMPLOYMENT_FILTERS = ['Any employment', 'Full-time', 'Part-time', 'Internship', 'Contract'];
export const JOB_SORT_OPTIONS = ['relevance', 'newest', 'company', 'title'];

export function normalizeSearchText(value) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}+#.]+/gu, ' ')
    .trim()
    .replace(/\bfront end\b/g, 'frontend')
    .replace(/\bback end\b/g, 'backend')
    .replace(/\bfull stack\b/g, 'fullstack');
}

export function getAllJobRoles() {
  return JOB_CATEGORIES.flatMap((category) => category.roles.map((role) => ({
    ...role,
    categoryId: category.id,
    categoryLabel: category.label,
  })));
}

const UNRESTRICTED_ROLE_VALUES = new Set([
  'all type job',
  'all types job',
  'all type jobs',
  'all types jobs',
  'all job type',
  'all job types',
  'all types of job',
  'all types of jobs',
  'all jobs',
  'all roles',
  'any job',
  'any role',
]);

export function isUnrestrictedJobRole(roleTitle) {
  return !normalizeSearchText(roleTitle)
    || UNRESTRICTED_ROLE_VALUES.has(normalizeSearchText(roleTitle));
}

function isUnrestrictedSkill(skill) {
  return ['any skill', 'any skills', 'all skills'].includes(normalizeSearchText(skill));
}

export function getRoleSearchTerms(roleTitle) {
  if (isUnrestrictedJobRole(roleTitle)) return [];
  const normalizedTitle = normalizeSearchText(roleTitle);
  const role = getAllJobRoles().find((item) => normalizeSearchText(item.title) === normalizedTitle);
  return role ? [role.title, ...role.synonyms] : (roleTitle ? [roleTitle] : []);
}

export function getCategorySearchTerms(categoryIds = []) {
  const terms = new Map();
  for (const categoryId of categoryIds) {
    const category = JOB_CATEGORIES.find((item) => item.id === categoryId);
    if (category?.label) terms.set(normalizeSearchText(category.label), category.label);
    for (const item of category?.roles || []) {
      for (const term of [item.title, ...item.synonyms]) {
        const normalized = normalizeSearchText(term);
        if (normalized && !terms.has(normalized)) terms.set(normalized, term);
      }
    }
  }
  return [...terms.values()];
}

function getListingSearchText(listing) {
  const skills = Array.isArray(listing?.skills)
    ? listing.skills.filter((skill) => typeof skill === 'string')
    : [];
  return normalizeSearchText([
    listing?.title,
    listing?.description,
    listing?.category,
    ...skills,
  ].filter((value) => typeof value === 'string').join(' '));
}

function matchesSearchTerm(text, term) {
  const normalizedText = normalizeSearchText(text);
  const normalizedTerm = normalizeSearchText(term);
  if (!normalizedText || !normalizedTerm) return false;
  const escapedTerm = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapedTerm}($|[^\\p{L}\\p{N}])`, 'u')
    .test(normalizedText);
}

export function matchesJobSelections(listing, {
  categories = [],
  role = '',
  query = '',
  skills = [],
} = {}) {
  const haystack = getListingSearchText(listing);
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery && !normalizedQuery.split(/\s+/).every((term) => haystack.includes(term))) return false;

  const selectedSkills = skills.filter((skill) => normalizeSearchText(skill) && !isUnrestrictedSkill(skill));
  if (selectedSkills.length && !selectedSkills.some((skill) => matchesSearchTerm(haystack, skill))) return false;

  if (!isUnrestrictedJobRole(role)) {
    return getRoleSearchTerms(role).some((term) => matchesSearchTerm(haystack, term));
  }
  const selectedCategories = categories.filter((categoryId) => (
    typeof categoryId === 'string'
      && normalizeSearchText(categoryId)
      && !UNRESTRICTED_ROLE_VALUES.has(normalizeSearchText(categoryId))
  ));
  if (selectedCategories.length) {
    return selectedCategories.some((categoryId) => {
      const category = JOB_CATEGORIES.find((item) => item.id === categoryId);
      return (category?.label && matchesSearchTerm(haystack, category.label))
        || category?.roles.some((item) => [item.title, ...item.synonyms].some((term) => (
        matchesSearchTerm(haystack, term)
        )));
    });
  }
  return true;
}

export function isValidDiscoveryListing(listing) {
  if (!listing || typeof listing !== 'object'
    || typeof listing.title !== 'string' || !listing.title.trim()
    || typeof listing.company !== 'string' || !listing.company.trim()
    || typeof listing.source !== 'string'
    || !['Remotive', 'Jobicy', 'Greenhouse', 'Lever', 'Ashby'].includes(listing.source)
    || typeof listing.url !== 'string' || !isValidHttpUrl(listing.url)) return false;
  try {
    const url = new URL(listing.url.trim());
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:') return false;
    if (listing.source === 'Remotive') return host === 'remotive.com' || host.endsWith('.remotive.com');
    if (listing.source === 'Jobicy') return host === 'jobicy.com' || host === 'www.jobicy.com';
    if (listing.source === 'Greenhouse') return ['boards.greenhouse.io', 'job-boards.greenhouse.io'].includes(host);
    if (listing.source === 'Lever') return ['jobs.lever.co', 'jobs.eu.lever.co'].includes(host);
    return host === 'jobs.ashbyhq.com';
  } catch {
    return false;
  }
}

export function filterDiscoveryListings(listings, { query = '', remoteOnly = false } = {}) {
  const normalizedQuery = normalizeSearchText(query);
  return listings.filter((listing) => {
    if (!isValidDiscoveryListing(listing)) return false;
    if (remoteOnly && listing.isRemote === false) return false;
    const searchableText = getListingSearchText(listing);
    return !normalizedQuery || normalizedQuery.split(/\s+/).every((term) => searchableText.includes(term));
  });
}

export function deduplicateDiscoveryListings(listings) {
  const seen = new Set();
  return listings.filter((listing) => {
    if (!isValidDiscoveryListing(listing)) return false;
    const url = new URL(listing.url.trim());
    url.search = '';
    url.hash = '';
    const urlKey = `${url.hostname.toLocaleLowerCase()}${url.pathname.replace(/\/+$/, '').toLocaleLowerCase()}`;
    const idKey = listing.id
      ? `${listing.source.toLocaleLowerCase()}:${String(listing.id).toLocaleLowerCase()}`
      : '';
    if (seen.has(urlKey) || (idKey && seen.has(idKey))) return false;
    seen.add(urlKey);
    if (idKey) seen.add(idKey);
    return true;
  });
}

export function filterAndSortDiscoveryListings(listings, filters = {}) {
  const {
    query = '',
    remoteOnly = false,
    workMode = 'Any work mode',
    categories = [],
    role = '',
    skills = [],
    company = '',
    experience = 'All opportunities',
    employment = 'Any employment',
    sortBy = 'relevance',
    location = '',
    matchResults = null,
  } = filters;
  const result = deduplicateDiscoveryListings(listings).filter((listing) => {
    if (!filterDiscoveryListings([listing], { query, remoteOnly }).length) return false;
    if (!matchesJobSelections(listing, { categories, role, skills })) return false;
    if (company && !normalizeSearchText(listing.company).includes(normalizeSearchText(company))) return false;
    const normalizedRequestedLocation = normalizeSearchText(location);
    if (normalizedRequestedLocation && !getLocationMatch(listing, location)) return false;
    if (normalizeSearchText(workMode) && normalizeSearchText(workMode) !== 'any work mode') {
      const knownWorkMode = getKnownWorkMode(listing);
      if (knownWorkMode && knownWorkMode !== workMode) return false;
    }
    if (normalizeSearchText(employment) && normalizeSearchText(employment) !== 'any employment') {
      const knownEmploymentTypes = getKnownEmploymentTypes(listing);
      if (knownEmploymentTypes.length && !knownEmploymentTypes.includes(employment)) return false;
    }
    if (normalizeSearchText(experience) && normalizeSearchText(experience) !== 'all opportunities') {
      const { classification } = getExperienceFilterClassificationDetails(listing, experience);
      if (experience === 'Internships' && !['internship', 'unknown'].includes(classification)) return false;
      if (experience === 'Freshers & graduates'
        && !['fresher/graduate', 'unknown'].includes(classification)) return false;
      if (experience === 'Entry-level jobs'
        && !['entry-level', 'unknown'].includes(classification)) return false;
      if (experience === 'Experienced jobs'
        && !['experienced', 'unknown'].includes(classification)) return false;
    }
    return true;
  });

  if (sortBy === 'newest') {
    result.sort((first, second) => Date.parse(second.publicationDate || '') - Date.parse(first.publicationDate || ''));
  } else if (sortBy === 'company') {
    result.sort((first, second) => first.company.localeCompare(second.company));
  } else if (sortBy === 'title') {
    result.sort((first, second) => first.title.localeCompare(second.title));
  } else if (sortBy === 'bestMatch') {
    const getScore = (listing) => {
      const key = String(listing.id || listing.url || '');
      const comparison = matchResults instanceof Map
        ? matchResults.get(key)
        : matchResults?.[key];
      return Number.isFinite(comparison?.score) ? comparison.score : null;
    };
    result.sort((first, second) => {
      const firstScore = getScore(first);
      const secondScore = getScore(second);
      if (firstScore === null && secondScore === null) return 0;
      if (firstScore === null) return 1;
      if (secondScore === null) return -1;
      return secondScore - firstScore;
    });
  }
  return result;
}

export function getKnownExperienceLevel(listing) {
  const classification = getExperienceClassification(listing);
  return classification === 'Unknown' ? '' : classification;
}

const EXPERIENCE_CLASS_PATTERNS = [
  ['fresher/graduate', /\b(?:freshers?|graduates?|new grad(?:uate)?)\b/u],
  ['entry-level', /\b(?:junior|entry level|apprentice|apprenticeship)\b/u],
  ['experienced', /\b(?:senior|principal|staff|lead|director|experienced|mid level|mid senior)\b/u],
];
const EXPERIENCE_TITLE_PATTERNS = [
  ['fresher/graduate', /\b(?:freshers?|graduates?|new grad(?:uate)?)\b/u],
  ['entry-level', /\b(?:junior|entry level)\b/u],
  ['experienced', /\b(?:senior|principal|experienced)\b/u],
];

const EXPERIENCE_CLASSIFICATION_LABELS = new Map([
  ['internship', 'internship'],
  ['non internship', 'non-internship'],
  ['fresher graduate', 'fresher/graduate'],
  ['entry level', 'entry-level'],
  ['experienced', 'experienced'],
  ['unknown', 'unknown'],
  ['not stated', 'unknown'],
]);
const EXPERIENCE_DISPLAY_LABELS = new Map([
  ['internship', 'Internship'],
  ['non-internship', 'Non-internship'],
  ['fresher/graduate', 'Fresher/Graduate'],
  ['entry-level', 'Entry-level'],
  ['experienced', 'Experienced'],
  ['unknown', 'Unknown'],
]);

function getExperienceSignals(value, { title = false } = {}) {
  const normalized = normalizeSearchText(value);
  if (!normalized) return new Set();
  const patterns = title ? EXPERIENCE_TITLE_PATTERNS : EXPERIENCE_CLASS_PATTERNS;
  return new Set(patterns
    .filter(([, pattern]) => pattern.test(normalized))
    .map(([classification]) => classification));
}

const DESCRIPTION_INTERNSHIP_PATTERN = /\b(?:internship\s+(?:position|role|opportunity|program)|summer\s+internship|(?:as|working\s+as)\s+an?\s+intern|intern\s+(?:position|role|opportunity)|(?:this|the|advertised)\s+(?:position|role|opportunity)\s+(?:is|will\s+be)\s+(?:an?\s+)?(?:paid\s+)?internship|this\s+is\s+(?:an?\s+)?(?:paid\s+)?internship)\b/iu;
const DESCRIPTION_FRESHER_PATTERN = /\b(?:open\s+to|welcome(?:d)?\s+to\s+apply|encouraged\s+to\s+apply|designed\s+for|seeking|looking\s+for|ideal\s+for|intended\s+for|accept(?:ing)?\s+applications\s+from)\s+(?:recent\s+|new\s+)?(?:college\s+)?(?:graduates?|grads?|freshers?)\b|\b(?:recent|new)\s+(?:college\s+)?(?:graduates?|grads?|freshers?)\s+(?:are\s+)?(?:welcome|encouraged|eligible|invited)\b/iu;
const DESCRIPTION_NO_EXPERIENCE_PATTERN = /(?:^|[\r\n]|[.!?;:,]\s*|[-*]\s*)(?:no\s+(?:(?:prior|previous|professional)\s+)?experience\s+(?:is\s+)?(?:required|needed|necessary)|(?:(?:prior|previous|professional)\s+)?experience\s+(?:is\s+)?not\s+required)\b/iu;
const DESCRIPTION_ENTRY_LEVEL_PATTERN = /\bentry[- ]level\s+(?:position|role|opportunity)\b/iu;
const DESCRIPTION_NEGATED_INTERNSHIP_PATTERN = /\b(?:not|isn't|is\s+not|is\s+never)\s+(?:an?\s+)?(?:paid\s+)?internship(?:\s+(?:position|role|opportunity|program))?\b/iu;
const DESCRIPTION_ROLE_EXPERIENCE_PATTERN = /\b(?<years>\d+(?:\.\d+)?\+?|one|two|three|four|five|six|seven|eight|nine|ten)\s+years?\s+(?:of\s+)?experience\s+(?:(?:as|working\s+as)\s+(?:an?\s+)?[^.;\n]{1,100}\b(?:engineer|developer|analyst|scientist|architect|designer|administrator|technician|specialist|consultant|manager|professional|role|position)\b|in\s+(?:similar|related)\s+roles?\b|in\s+(?:an?\s+)?[^.;\n]{1,80}\b(?:role|position)\b|providing\s+[^.;\n]{1,100}\b(?:services?|support|operations|engineering|development|management)\b)/iu;
const EXPERIENCE_NUMBER_WORDS = new Map([
  ['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5],
  ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10],
]);
const EXPERIENCE_CLASSIFICATION_SOURCES = new Set([
  'provider',
  'title',
  'description',
  'description-inferred',
  'unknown',
]);

function getDescriptionSenioritySignal(description = '') {
  const matches = [];
  for (const [classification, pattern] of [
    ['entry-level', DESCRIPTION_NO_EXPERIENCE_PATTERN],
    ['entry-level', DESCRIPTION_ENTRY_LEVEL_PATTERN],
    ['fresher/graduate', DESCRIPTION_FRESHER_PATTERN],
  ]) {
    matches.push(...[...description.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))]
      .map((match) => ({ classification, match })));
  }
  for (const match of description.matchAll(new RegExp(
    DESCRIPTION_ROLE_EXPERIENCE_PATTERN.source,
    `${DESCRIPTION_ROLE_EXPERIENCE_PATTERN.flags}g`,
  ))) {
    const rawYears = match.groups.years.toLocaleLowerCase().replace(/\+$/, '');
    const years = EXPERIENCE_NUMBER_WORDS.get(rawYears) ?? Number.parseFloat(rawYears);
    if (years >= 2) matches.push({ classification: 'experienced', match });
  }

  const classifications = new Set(matches.map(({ classification }) => classification));
  if (!classifications.size) return null;
  if (classifications.size > 1) {
    return {
      classification: 'unknown',
      evidence: matches.slice(0, 2).map(({ match }) => match[0].trim()).join('; '),
    };
  }
  const classification = [...classifications][0];
  return {
    classification,
    evidence: matches.find((item) => item.classification === classification).match[0].trim(),
  };
}

function resolveExperienceDimension({
  providerSignals,
  titleSignals,
  descriptionSignal,
  providerEvidence,
  title,
  unknownEvidence,
}) {
  if (descriptionSignal?.classification === 'unknown') {
    return {
      classification: 'unknown',
      source: 'unknown',
      evidence: `Description contains conflicting seniority evidence: ${descriptionSignal.evidence}`,
    };
  }
  if (providerSignals.size > 1) {
    return { classification: 'unknown', source: 'unknown', evidence: 'Provider metadata indicates conflicting values.' };
  }
  if (providerSignals.size === 1) {
    const classification = [...providerSignals][0];
    if ((titleSignals.size && (titleSignals.size > 1 || !titleSignals.has(classification)))
      || (descriptionSignal && descriptionSignal.classification !== classification)) {
      return { classification: 'unknown', source: 'unknown', evidence: 'Provider metadata, title, or description indicate conflicting values.' };
    }
    return { classification, source: 'provider', evidence: providerEvidence.join('; ') };
  }
  if (titleSignals.size > 1) {
    return { classification: 'unknown', source: 'unknown', evidence: 'The title contains conflicting experience-level terms.' };
  }
  if (titleSignals.size === 1) {
    const classification = [...titleSignals][0];
    if (descriptionSignal && descriptionSignal.classification !== classification) {
      return { classification: 'unknown', source: 'unknown', evidence: 'The title and description indicate conflicting experience levels.' };
    }
    return { classification, source: 'title', evidence: title.trim() };
  }
  if (descriptionSignal) {
    return {
      classification: descriptionSignal.classification,
      source: 'description',
      evidence: descriptionSignal.evidence,
    };
  }
  return { classification: 'unknown', source: 'unknown', evidence: unknownEvidence };
}

export function getExperienceClassificationDetails(listing) {
  const suppliedClassification = EXPERIENCE_CLASSIFICATION_LABELS.get(
    normalizeSearchText(listing?.experienceClassification),
  );
  const suppliedSource = EXPERIENCE_CLASSIFICATION_SOURCES.has(listing?.experienceClassificationSource)
    ? listing.experienceClassificationSource
    : '';

  const providerValues = [];
  if (typeof listing?.experienceLevel === 'string' && listing.experienceLevel.trim()) {
    providerValues.push(listing.experienceLevel.trim());
  }
  if (Array.isArray(listing?.experienceMetadata)) {
    providerValues.push(...listing.experienceMetadata
      .filter((entry) => entry && typeof entry.value === 'string' && entry.value.trim())
      .map((entry) => entry.value.trim()));
  }
  const distinctProviderValues = [...new Map(
    providerValues.map((value) => [normalizeSearchText(value), value]),
  ).values()];

  const providerSenioritySignals = new Set(distinctProviderValues
    .flatMap((value) => [...getExperienceSignals(value)]));
  const providerSeniorityEvidence = distinctProviderValues
    .filter((value) => getExperienceSignals(value).size > 0);
  const providerOpportunityEvidence = distinctProviderValues
    .filter((value) => /\b(?:intern|internship)\b/u.test(normalizeSearchText(value)));
  const providerOpportunitySignals = new Set(
    providerOpportunityEvidence.map(() => 'internship'),
  );
  const employmentType = typeof listing?.employmentType === 'string' ? listing.employmentType : '';
  const knownEmploymentTypes = getKnownEmploymentTypes(listing);
  if (knownEmploymentTypes.includes('Internship')) {
    providerOpportunitySignals.add('internship');
    providerOpportunityEvidence.push(`employment type: ${employmentType.trim()}`);
  }
  if (knownEmploymentTypes.some((type) => type !== 'Internship')) {
    providerOpportunitySignals.add('non-internship');
    providerOpportunityEvidence.push(`employment type: ${employmentType.trim()}`);
  }
  const title = typeof listing?.title === 'string' ? listing.title.trim() : '';
  const titleSenioritySignals = getExperienceSignals(title, { title: true });
  const titleOpportunitySignals = /\b(?:intern|internship)\b/u.test(normalizeSearchText(title))
    ? new Set(['internship'])
    : new Set();
  const description = typeof listing?.description === 'string' ? listing.description : '';
  const descriptionSenioritySignal = getDescriptionSenioritySignal(description);
  const descriptionOpportunityMatch = DESCRIPTION_INTERNSHIP_PATTERN.exec(description);
  const descriptionInternshipNegation = DESCRIPTION_NEGATED_INTERNSHIP_PATTERN.exec(description);
  const descriptionOpportunitySignal = descriptionOpportunityMatch
    ? {
      classification: descriptionInternshipNegation ? 'unknown' : 'internship',
      evidence: [descriptionOpportunityMatch, descriptionInternshipNegation]
        .filter(Boolean)
        .map((match) => match[0].trim())
        .join('; '),
    }
    : null;

  const inferredSeniority = resolveExperienceDimension({
    providerSignals: providerSenioritySignals,
    titleSignals: titleSenioritySignals,
    descriptionSignal: descriptionSenioritySignal,
    providerEvidence: providerSeniorityEvidence,
    title,
    unknownEvidence: distinctProviderValues.length
      ? `Provider experience metadata is ambiguous: ${distinctProviderValues.join('; ')}`
      : 'The source did not state a seniority level, and the title or description has no clear eligibility signal.',
  });
  const inferredOpportunityType = resolveExperienceDimension({
    providerSignals: providerOpportunitySignals,
    titleSignals: titleOpportunitySignals,
    descriptionSignal: descriptionOpportunitySignal,
    providerEvidence: providerOpportunityEvidence,
    title,
    unknownEvidence: 'The source did not state an opportunity type, and the title or description does not clearly identify an internship.',
  });
  const normalizeSuppliedDimension = (classificationValue, sourceValue, evidenceValue, inferred) => {
    const classification = EXPERIENCE_CLASSIFICATION_LABELS.get(normalizeSearchText(classificationValue));
    if (!classification || !EXPERIENCE_CLASSIFICATION_SOURCES.has(sourceValue)) return inferred;
    return {
      classification,
      source: sourceValue,
      evidence: typeof evidenceValue === 'string' ? evidenceValue : '',
    };
  };
  const seniority = normalizeSuppliedDimension(
    listing?.experienceSeniority,
    listing?.experienceSenioritySource,
    listing?.experienceSeniorityEvidence,
    inferredSeniority,
  );
  const opportunityType = normalizeSuppliedDimension(
    listing?.experienceOpportunityType,
    listing?.experienceOpportunityTypeSource,
    listing?.experienceOpportunityTypeEvidence,
    inferredOpportunityType,
  );
  const primaryClassification = suppliedClassification && suppliedSource
    ? suppliedClassification
    : opportunityType.classification === 'internship'
        ? 'internship'
        : seniority.classification !== 'unknown'
          ? seniority.classification
          : 'unknown';
  const source = suppliedClassification && suppliedSource
    ? suppliedSource
    : opportunityType.classification === 'internship'
        ? opportunityType.source
        : seniority.classification !== 'unknown'
          ? seniority.source
          : 'unknown';
  const evidence = suppliedClassification && suppliedSource
    ? (typeof listing.experienceClassificationEvidence === 'string'
      ? listing.experienceClassificationEvidence
      : '')
    : opportunityType.classification === 'internship'
        ? opportunityType.evidence
        : seniority.classification !== 'unknown'
          ? seniority.evidence
          : 'Experience and opportunity type are not stated clearly by the source.';

  return {
    classification: EXPERIENCE_DISPLAY_LABELS.get(primaryClassification) || 'Unknown',
    source,
    evidence,
    opportunityType,
    seniority,
  };
}

export function getExperienceFilterClassificationDetails(listing, experience) {
  const details = getExperienceClassificationDetails(listing);
  return normalizeSearchText(experience) === 'internships'
    ? details.opportunityType
    : details.seniority;
}

export function getExperienceClassification(listing) {
  return getExperienceClassificationDetails(listing).classification;
}

export function partitionExperienceClassifications(listings, experience = '') {
  return listings.reduce((groups, listing) => {
    const { source } = experience
      ? getExperienceFilterClassificationDetails(listing, experience)
      : getExperienceClassificationDetails(listing);
    if (source === 'provider') groups.providerReported.push(listing);
    else if (source === 'title') groups.titleInferred.push(listing);
    else if (source === 'description' || source === 'description-inferred') groups.descriptionInferred.push(listing);
    else groups.unknown.push(listing);
    return groups;
  }, { providerReported: [], titleInferred: [], descriptionInferred: [], unknown: [] });
}

export function partitionExperienceFilterResults(listings, experience = '') {
  const groups = partitionExperienceClassifications(listings, experience);
  return {
    ...groups,
    confirmed: [...groups.providerReported, ...groups.titleInferred, ...groups.descriptionInferred],
    confirmedCount: groups.providerReported.length + groups.titleInferred.length + groups.descriptionInferred.length,
    unconfirmedCount: groups.unknown.length,
  };
}

export function getKnownWorkMode(listing) {
  const supplied = normalizeSearchText(listing?.workMode);
  if (matchesSearchTerm(supplied, 'Hybrid')) return 'Hybrid';
  if (matchesSearchTerm(supplied, 'Remote')) return 'Remote';
  if (['on site', 'onsite', 'in person'].some((term) => matchesSearchTerm(supplied, term))) return 'On-site';
  if (listing?.isRemote === true) return 'Remote';
  if (listing?.isRemote === false) return 'On-site';
  return '';
}

const EMPLOYMENT_TYPE_TERMS = [
  { label: 'Full-time', terms: ['full-time', 'full time', 'fulltime'] },
  { label: 'Part-time', terms: ['part-time', 'part time', 'parttime'] },
  { label: 'Internship', terms: ['internship', 'intern'] },
  { label: 'Contract', terms: ['contract', 'contractor'] },
];

export function getKnownEmploymentTypes(listing) {
  const supplied = normalizeSearchText(listing?.employmentType);
  if (!supplied) return [];
  return EMPLOYMENT_TYPE_TERMS
    .filter(({ terms }) => terms.some((term) => matchesSearchTerm(supplied, term)))
    .map(({ label }) => label);
}

export function getLocationMatch(listing, requestedLocation) {
  const requested = normalizeSearchText(requestedLocation);
  if (!requested) return '';
  const sourceLocation = normalizeSearchText(listing?.location);
  if (requested.split(/\s+/).every((term) => sourceLocation.includes(term))) return 'local';
  const isRemote = listing?.isRemote === true;
  if (isRemote && /\b(worldwide|anywhere|global)\b/.test(sourceLocation)) return 'remote-global';
  if (isRemote && !sourceLocation) return 'remote-unspecified';
  return '';
}

export function groupListingsByCompany(listings) {
  return listings.reduce((groups, listing) => {
    const name = listing.company.trim() || 'Company not provided';
    if (!groups[name]) groups[name] = [];
    groups[name].push(listing);
    return groups;
  }, {});
}

export function summarizeCompanyListings(listings) {
  const distinctCompanies = new Set(listings.map((listing) => normalizeSearchText(listing.company)));
  const experienceDetails = listings.map(getExperienceClassificationDetails);
  const seniorityClassifications = experienceDetails.map((details) => details.seniority.classification);
  const classificationSources = experienceDetails.map((details) => details.source);
  return {
    totalRetrieved: listings.length,
    distinctCompanies: distinctCompanies.size,
    internships: experienceDetails.filter((details) => details.opportunityType.classification === 'internship').length,
    fresherGraduate: seniorityClassifications.filter((classification) => classification === 'fresher/graduate').length,
    entryLevel: seniorityClassifications.filter((classification) => classification === 'entry-level').length,
    experienced: seniorityClassifications.filter((classification) => classification === 'experienced').length,
    unknownExperience: seniorityClassifications.filter((classification) => classification === 'unknown').length,
    providerReportedExperience: classificationSources.filter((source) => source === 'provider').length,
    titleInferredExperience: classificationSources.filter((source) => source === 'title').length,
    descriptionInferredExperience: classificationSources.filter(
      (source) => source === 'description' || source === 'description-inferred',
    ).length,
    localMatches: listings.filter((listing) => listing.locationMatch === 'local').length,
    remoteGlobal: listings.filter((listing) => listing.locationMatch === 'remote-global').length,
    remoteUnspecified: listings.filter((listing) => listing.locationMatch === 'remote-unspecified').length,
    officialListings: listings.filter((listing) => listing.sourceType === 'official_company_board').length,
    aggregatorListings: listings.filter((listing) => listing.sourceType === 'aggregator').length,
  };
}

export function createExternalCompanySearchLink(companyName) {
  const name = typeof companyName === 'string' ? companyName.trim() : '';
  if (!name) return null;
  return {
    name: 'Google company careers search (external)',
    url: `https://www.google.com/search?q=${encodeURIComponent(`${name} official careers jobs`)}`,
  };
}

export function extractJobRequirements(listing) {
  const providedSkills = Array.isArray(listing?.skills)
    ? listing.skills.filter((skill) => typeof skill === 'string' && skill.trim())
    : [];
  const description = typeof listing?.description === 'string' ? listing.description : '';
  const knownSkills = [
    'JavaScript', 'TypeScript', 'React', 'Angular', 'Vue', 'Node.js', 'Python', 'Java', 'C++', 'C#',
    'Go', 'Rust', 'SQL', 'PostgreSQL', 'MongoDB', 'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes',
    'Git', 'Linux', 'Machine Learning', 'TensorFlow', 'PyTorch', 'Figma', 'Unity', 'Unreal Engine',
    'Flutter', 'Swift', 'Kotlin', 'HTML', 'CSS', 'Django', 'FastAPI', 'Spring Boot', 'Selenium',
    'Playwright', 'Jira', 'Excel', 'Power BI', 'Tableau', 'Salesforce', 'SEO',
  ];
  const identified = knownSkills.filter((skill) => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9+#])${escaped}(?=$|[^a-z0-9+#])`, 'i').test(description);
  });
  return [...new Map([...providedSkills, ...identified].map((skill) => [
    normalizeSearchText(skill),
    skill.trim(),
  ])).values()];
}

function classifySkillMention(clause, skill) {
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(^|[^a-z0-9+#])(${escaped})(?=$|[^a-z0-9+#])`, 'i').exec(clause);
  if (!match) return null;
  const start = match.index + match[1].length;
  const end = start + match[2].length;
  const before = clause.slice(Math.max(0, start - 80), start);
  const after = clause.slice(end, end + 80);
  const context = `${before} ${match[2]} ${after}`;
  if (/\bnot\s+(?:required|necessary|mandatory)\b|\bno\s+(?:previous|prior|professional|work)?\s*(?:experience|knowledge|expertise)?\s*[^.!?;]{0,50}\b(?:necessary|required|mandatory)\b/iu.test(context)) {
    return 'negated';
  }
  const nearestCueDistance = (pattern) => {
    let distance = Infinity;
    for (const cue of context.matchAll(new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`))) {
      const cueStart = cue.index ?? 0;
      const cueEnd = cueStart + cue[0].length;
      const skillStart = before.length + 1;
      const skillEnd = skillStart + match[2].length;
      distance = Math.min(distance, Math.max(0, skillStart - cueEnd, cueStart - skillEnd));
    }
    return distance;
  };
  const optionalDistance = nearestCueDistance(/\b(?:optional|preferred|preferable|desired|helpful|a\s+plus|nice\s+to\s+have|bonus)\b/iu);
  const requiredDistance = nearestCueDistance(/\b(?:required|mandatory|must\s+(?:have|know|possess|meet)|candidates\s+must\s+(?:have|know|possess))\b/iu);
  if (Math.min(optionalDistance, requiredDistance) <= 40) {
    return optionalDistance < requiredDistance ? 'optional' : 'required';
  }
  if (/\b(?:required|mandatory)\s*(?::|skills?\s*(?::|include|are))\s*[^.!?;]*$/iu.test(before)) {
    return 'required';
  }
  return 'mentioned';
}

export function extractJobRequirementEvidence(listing) {
  const evidence = new Map();
  const getEntry = (skill) => {
    const normalized = normalizeJobRequirements([skill])[0];
    const key = normalizeSearchText(normalized);
    if (!evidence.has(key)) {
      evidence.set(key, {
        skill: normalized,
        status: '',
        source: [],
        provenance: [],
      });
    }
    return evidence.get(key);
  };
  stringsFrom(listing?.skills).forEach((skill) => {
    const entry = getEntry(skill);
    if (!entry.source.includes('provider')) entry.source.push('provider');
    entry.provenance.push(`Provider skill tag: ${skill.trim()}`);
  });

  const description = typeof listing?.description === 'string' ? listing.description : '';
  const knownSkills = extractJobRequirements({ description, skills: [] });
  const statusesBySkill = new Map();
  description.split(/(?<=[.!?;])\s+|[;\n]+/u).forEach((clause) => {
    knownSkills.forEach((skill) => {
      const status = classifySkillMention(clause, skill);
      if (!status) return;
      const key = normalizeSearchText(normalizeJobRequirements([skill])[0]);
      if (!statusesBySkill.has(key)) statusesBySkill.set(key, new Set());
      statusesBySkill.get(key).add(status);
      const entry = getEntry(skill);
      if (!entry.source.includes('description')) entry.source.push('description');
      entry.provenance.push(`Job description: "${clause.trim()}"`);
    });
  });

  statusesBySkill.forEach((statuses, key) => {
    const entry = evidence.get(key);
    if (statuses.has('required') && (statuses.has('negated') || statuses.has('optional'))) {
      entry.status = 'ambiguous';
    } else if (statuses.has('required')) {
      entry.status = 'required';
    } else if (statuses.has('negated')) {
      entry.status = 'negated';
    } else if (statuses.has('optional')) {
      entry.status = 'optional';
    } else {
      entry.status = 'mentioned';
    }
  });
  evidence.forEach((entry) => {
    if (!entry.status) entry.status = 'provider';
    entry.provenance = [...new Set(entry.provenance)];
  });
  return [...evidence.values()];
}

const JOB_MATCH_WEIGHTS = {
  skills: 45,
  careerAlignment: 20,
  experience: 15,
  education: 10,
  location: 4,
  workMode: 3,
  employmentType: 3,
};

const CAREER_ALIGNMENT_STOP_WORDS = new Set([
  'and', 'area', 'areas', 'career', 'careers', 'development', 'engineer', 'engineering',
  'for', 'in', 'of', 'or', 'role', 'roles', 'the', 'work',
]);

const EDUCATION_LEVELS = [
  { level: 'doctorate', rank: 3, pattern: /\b(?:ph\.?\s*d\.?|doctorate|doctoral(?:\s+degree)?)\b/giu },
  { level: 'master', rank: 2, pattern: /\b(?:master(?:['’]s)?|postgraduate|m\.?\s*tech|m\.?\s*s\.?|m\.?\s*e\.?|mba)\b/giu },
  { level: 'bachelor', rank: 1, pattern: /\b(?:bachelor(?:['’]s)?|undergraduate|b\.?\s*tech|b\.?\s*e\.?|b\.?\s*sc|b\.?\s*s\.?|b\.?\s*a\.?|bca|bcom)\b/giu },
  { level: 'associate', rank: 0, pattern: /\bassociate(?:['’]s)?\b/giu },
];

function stringsFrom(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()) : [];
}

function profileSkillEvidence(profile) {
  const projects = Array.isArray(profile?.projects) ? profile.projects : [];
  const certifications = Array.isArray(profile?.certifications) ? profile.certifications : [];
  return {
    skills: stringsFrom(profile?.skills),
    projects: projects
      .filter((project) => project && typeof project === 'object' && !Array.isArray(project))
      .map((project) => ({
        name: typeof project.name === 'string' ? project.name : '',
        description: typeof project.description === 'string' ? project.description : '',
        technologies: typeof project.technologies === 'string' ? project.technologies : '',
      })),
    certifications: certifications
      .filter((certification) => certification && typeof certification === 'object' && !Array.isArray(certification))
      .map((certification) => ({
        name: typeof certification.name === 'string' ? certification.name : '',
        issuer: typeof certification.issuer === 'string' ? certification.issuer : '',
        description: typeof certification.description === 'string' ? certification.description : '',
      })),
  };
}

function hasSkillEvidence(evidence) {
  return evidence.skills.length > 0
    || evidence.projects.some((project) => Object.values(project).some((value) => value.trim()))
    || evidence.certifications.some((certification) => Object.values(certification).some((value) => value.trim()));
}

function containsSkillEvidence(skill, evidence) {
  return typeof evidence === 'string'
    && Boolean(evidence.trim())
    && compareJobRequirements([skill], [evidence]).matchedCount === 1;
}

function describeProfileSkillEvidence(skill, evidence) {
  const savedSkill = evidence.skills.find((item) => containsSkillEvidence(skill, item));
  if (savedSkill) return `Saved skill: ${savedSkill}.`;
  const project = evidence.projects.find((item) => (
    Object.values(item).some((value) => containsSkillEvidence(skill, value))
  ));
  if (project) {
    const name = project.name.trim() || 'Unnamed project';
    const technologies = project.technologies.trim();
    return technologies
      ? `Project "${name}" (technologies: ${technologies}).`
      : `Project "${name}" includes matching evidence.`;
  }
  const certification = evidence.certifications.find((item) => (
    Object.values(item).some((value) => containsSkillEvidence(skill, value))
  ));
  if (certification) {
    const name = certification.name.trim() || 'Unnamed certification';
    return `Certification "${name}" includes matching evidence.`;
  }
  return 'Found in saved skills, projects, or certifications.';
}

function describeJobSkillEvidence(skill, listing) {
  const providerSkill = stringsFrom(listing?.skills).find((item) => containsSkillEvidence(skill, item));
  if (providerSkill) return `Provider skill tag: ${providerSkill}.`;
  const description = typeof listing?.description === 'string' ? listing.description : '';
  return containsSkillEvidence(skill, description)
    ? `Mentioned in the job description: ${skill}.`
    : 'Identified in the listing skill evidence.';
}

function createDimension(id, label, weight, {
  status = 'unknown',
  score = null,
  matchedEvidence = [],
  unmatchedRequirements = [],
  unknownInformation = [],
} = {}) {
  return {
    id,
    label,
    weight,
    status,
    score,
    evidenceCount: score === null ? 0 : matchedEvidence.length + unmatchedRequirements.length,
    matchedEvidence,
    unmatchedRequirements,
    unknownInformation,
    applicable: score !== null,
  };
}

function careerPreferenceMatches(jobText, preference) {
  if (matchesSearchTerm(jobText, preference)) return true;
  const distinctiveTerms = normalizeSearchText(preference)
    .split(/\s+/)
    .filter((term) => term.length > 2 && !CAREER_ALIGNMENT_STOP_WORDS.has(term));
  return distinctiveTerms.length > 1
    && distinctiveTerms.every((term) => matchesSearchTerm(jobText, term));
}

function extractEducationRequirements(description) {
  if (!description) return [];
  const requirements = new Map();
  for (const { level, rank, pattern } of EDUCATION_LEVELS) {
    for (const match of description.matchAll(pattern)) {
      const start = match.index ?? 0;
      const before = description.slice(Math.max(0, start - 24), start);
      const after = description.slice(start + match[0].length, start + match[0].length + 100);
      const hasEducationContext = /\bdegree\s+(?:in|of)\s*$/iu.test(before)
        || /^\s*(?:degree\b|in\b|of\b)/iu.test(after);
      if (!hasEducationContext) continue;

      const fieldTail = after
        .replace(/^\s+of\s+(?:science|arts|engineering|technology|business)(?:\s+degree)?\s+in\b/iu, ' in')
        .match(/^\s*(?:degree\s+)?in\s+([^.;\n,]+)/iu)?.[1] || '';
      const field = fieldTail
        .replace(/\s+(?:or\s+related(?:\s+field)?|or\s+equivalent|preferred|required)\b.*$/iu, '')
        .trim();
      const raw = field ? `${match[0].trim()} in ${field}` : match[0].trim();
      requirements.set(`${level}:${normalizeSearchText(field)}`, { level, rank, field, raw });
    }
  }
  return [...requirements.values()];
}

function profileEducationEvidence(profile) {
  const records = [];
  const addRecord = (entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
    const degree = ['degree', 'qualification']
      .map((field) => entry[field])
      .find((value) => typeof value === 'string' && value.trim()) || '';
    const fields = ['specialization', 'branch', 'field']
      .map((field) => entry[field])
      .filter((value) => typeof value === 'string' && value.trim());
    if (degree || fields.length) {
      records.push({
        degree: degree.trim(),
        fields: [...new Set(fields.map((value) => value.trim()))],
      });
    }
  };
  if (typeof profile?.degree === 'string' || typeof profile?.branch === 'string') {
    addRecord({ degree: profile.degree, branch: profile.branch });
  }
  if (Array.isArray(profile?.education)) {
    profile.education.forEach(addRecord);
  } else if (profile?.education && typeof profile.education === 'object') {
    addRecord(profile.education);
  }
  return records;
}

function educationRank(value) {
  const normalized = normalizeSearchText(value);
  const compact = normalized.replace(/[^a-z0-9]/gu, '');
  if (/\b(?:doctorate|doctoral)\b/u.test(normalized) || compact.includes('phd')) return 3;
  if (/\b(?:master|postgraduate)\b/u.test(normalized)
    || /^(?:mba|mtech|ms|msc|ma|me)$/u.test(compact)) return 2;
  if (/\b(?:bachelor|undergraduate)\b/u.test(normalized)
    || /^(?:btech|be|bsc|bs|ba|bca|bcom)$/u.test(compact)) return 1;
  if (/\bassociate\b/u.test(normalized)) return 0;
  return null;
}

function normalizeWorkMode(value) {
  const normalized = normalizeSearchText(value);
  if (['remote', 'remote work'].includes(normalized)) return 'Remote';
  if (['hybrid', 'hybrid work'].includes(normalized)) return 'Hybrid';
  if (['on site', 'onsite', 'in person'].includes(normalized)) return 'On-site';
  return '';
}

function jobWorkModes(listing) {
  const supplied = typeof listing?.workMode === 'string' ? listing.workMode : '';
  const explicitModes = ['Remote', 'Hybrid', 'On-site']
    .filter((mode) => matchesSearchTerm(supplied, mode));
  if (explicitModes.length > 1) return [];
  if (explicitModes.length === 1) return explicitModes;
  const inferred = getKnownWorkMode(listing);
  return inferred ? [inferred] : [];
}

function jobYearRequirement(listing) {
  const texts = [
    { source: 'description', value: listing?.description },
    { source: 'experience level', value: listing?.experienceLevel },
    ...(Array.isArray(listing?.experienceMetadata)
      ? listing.experienceMetadata
        .filter((entry) => typeof entry?.label === 'string'
          && /\b(?:experience|years?\s+required)\b/iu.test(entry.label))
        .map((entry) => ({ source: 'experience metadata', value: entry.value }))
      : []),
  ].filter((item) => typeof item.value === 'string');
  const statements = [];
  const expression = /(\d+(?:\.\d+)?)\s*(?:(?:-|–|—|to)\s*(\d+(?:\.\d+)?))?\s*(\+)?\s*(?:years?|yrs?)\b/giu;
  texts.forEach(({ source, value }) => {
    const clauses = value
      .split(/[;!?]+|(?<!\d)\.(?!\d)|\s+and\s+(?=\d+(?:\.\d+)?\s*(?:-|–|—|to)?\s*\d*\s*\+?\s*(?:years?|yrs?)\b)/iu)
      .filter(Boolean);
    clauses.forEach((clause) => {
      const yearMatches = [...clause.matchAll(expression)];
      for (const match of clause.matchAll(expression)) {
        const before = clause.slice(0, match.index);
        const after = clause.slice((match.index ?? 0) + match[0].length);
        const isNegated = /\bnot\s+(?:required|necessary|mandatory)\b/iu.test(after)
          || /\bno\s+(?:previous|prior)?\s*experience\b[\s\S]{0,40}\b(?:necessary|required|mandatory)\b/iu.test(clause);
        const cueDistance = (pattern) => {
          const beforeWindow = before.slice(-35);
          const context = `${beforeWindow} ${match[0]} ${after.slice(0, 35)}`;
          const yearStart = beforeWindow.length + 1;
          const yearEnd = yearStart + match[0].length;
          let distance = Infinity;
          for (const cue of context.matchAll(new RegExp(`${pattern.source}`, `${pattern.flags.replace('g', '')}g`))) {
            const cueStart = cue.index ?? 0;
            const cueEnd = cueStart + cue[0].length;
            distance = Math.min(distance, Math.max(0, yearStart - cueEnd, cueStart - yearEnd));
          }
          return distance;
        };
        const preferredDistance = cueDistance(/\b(?:preferred|preferable|desired|helpful|a\s+plus|nice\s+to\s+have)\b/iu);
        const requiredDistance = cueDistance(/\b(?:required|minimum|at\s+least|mandatory|must\s+(?:have|meet))\b/iu);
        const isPreferred = preferredDistance <= 35 && preferredDistance <= requiredDistance;
        const isRequired = requiredDistance <= 35 && requiredDistance <= preferredDistance;
        const hasExperienceContext = source !== 'description'
          || /\bexperience\b/iu.test(clause)
          || (/\byears?\s+in\s+(?:the\s+)?(?:software\s+development|professional\s+services?|engineering|similar\s+roles?|related\s+roles?|(?:software|engineering|sales|marketing|finance|data|product|design)\s+(?:development|engineering|analysis|roles?))\b/iu.test(clause)
            && (isRequired || isPreferred))
          || (yearMatches.length > 1
            && !/\b(?:warrant(?:y|ies)|service|product|subscription|support|maintenance)\b/iu.test(clause)
            && (isRequired || isPreferred));
        if (!hasExperienceContext) continue;
        if (isNegated) {
          statements.push({ status: 'negated', source, text: clause.trim() });
        } else if (isPreferred && isRequired) {
          statements.push({ status: 'ambiguous', source, text: clause.trim() });
        } else if (isPreferred) {
          statements.push({ status: 'preferred', source, text: clause.trim() });
        } else if (isRequired) {
          statements.push({
            status: 'required',
            minimum: Number.parseFloat(match[1]),
            maximum: match[2] ? Number.parseFloat(match[2]) : null,
            source,
            text: clause.trim(),
          });
        } else if (hasExperienceContext) {
          statements.push({ status: 'ambiguous', source, text: clause.trim() });
        }
      }
    });
  });
  const requiredStatements = statements.filter((statement) => statement.status === 'required');
  const requiredRanges = new Set(requiredStatements.map((statement) => (
    `${statement.minimum}:${statement.maximum === null ? '' : statement.maximum}`
  )));
  if (statements.some((statement) => statement.status === 'ambiguous')
    || requiredRanges.size > 1) {
    return { status: 'ambiguous', statements };
  }
  if (requiredStatements.length) {
    return { ...requiredStatements[0], status: 'required', statements };
  }
  if (statements.some((statement) => statement.status === 'preferred')) {
    return { status: 'preferred', statements };
  }
  if (statements.some((statement) => statement.status === 'negated')) {
    return { status: 'negated', statements };
  }
  return { status: 'none', statements };
}

function profileYearsExperience(profile) {
  const value = profile?.yearsExperience ?? profile?.yearsOfExperience;
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function experienceRank(value) {
  const normalized = normalizeSearchText(value);
  if (['beginner', 'fresher', 'graduate', 'fresher graduate'].includes(normalized)) return 0;
  if (['intermediate', 'entry level', 'junior'].includes(normalized)) return 1;
  if (['advanced', 'experienced', 'senior'].includes(normalized)) return 2;
  return null;
}

export function compareListingWithProfile(listing, profile) {
  const sourceProfile = profile && typeof profile === 'object' && !Array.isArray(profile) ? profile : {};
  const skillEvidence = profileSkillEvidence(sourceProfile);
  const requirementEvidence = extractJobRequirementEvidence(listing);
  const requiredEvidence = requirementEvidence.filter((item) => item.status === 'required');
  const required = requiredEvidence.length
    ? normalizeJobRequirements(requiredEvidence.map((item) => item.skill))
    : [];
  const hasProfileSkills = hasSkillEvidence(skillEvidence);
  const skillComparison = required.length && hasProfileSkills
    ? compareJobRequirements(required, skillEvidence)
    : null;
  const matchedSkills = skillComparison?.matchedRequirements || [];
  const skillResults = requirementEvidence.map((evidence) => {
    const isRequired = evidence.status === 'required';
    const status = !isRequired
      ? evidence.status
      : !hasProfileSkills
        ? 'unknown'
        : matchedSkills.includes(evidence.skill) ? 'matched' : 'unmatched';
    return {
      skill: evidence.skill,
      status,
      source: evidence.source,
      provenance: evidence.provenance,
      mandatory: isRequired,
    };
  });
  const skillDimension = !required.length
    ? createDimension('skills', 'Skills', JOB_MATCH_WEIGHTS.skills, {
      unknownInformation: ['No explicitly required skills were identified. Provider tags and unqualified, optional, or negated mentions do not count as mandatory requirements.'],
    })
    : !hasProfileSkills
      ? createDimension('skills', 'Skills', JOB_MATCH_WEIGHTS.skills, {
        unknownInformation: ['No profile skills, project technologies, project descriptions, or certification evidence are available to compare.'],
      })
      : createDimension('skills', 'Skills', JOB_MATCH_WEIGHTS.skills, {
        status: matchedSkills.length === required.length ? 'matched' : matchedSkills.length ? 'partial' : 'unmatched',
        score: matchedSkills.length / required.length,
        matchedEvidence: matchedSkills.map((skill) => ({
          dimension: 'skills',
          requirement: skill,
          profileEvidence: describeProfileSkillEvidence(skill, skillEvidence),
          jobEvidence: describeJobSkillEvidence(skill, listing),
        })),
        unmatchedRequirements: skillResults
          .filter((item) => item.mandatory && item.status === 'unmatched')
          .map((item) => `Skill: ${item.skill} (not documented in the saved profile)`),
      });

  const jobText = [
    typeof listing?.title === 'string' ? listing.title : '',
    typeof listing?.description === 'string' ? listing.description : '',
    typeof listing?.category === 'string' ? listing.category : '',
  ].filter(Boolean).join(' ');
  const careerPreferences = [
    ...stringsFrom(sourceProfile.interests),
    ...stringsFrom(sourceProfile.careerInterests),
    ...stringsFrom(sourceProfile.preferredIndustries),
    ...stringsFrom(sourceProfile.preferredWorkAreas),
  ];
  const uniqueCareerPreferences = [...new Set(careerPreferences.map((item) => item.trim()))];
  const matchedPreferences = uniqueCareerPreferences
    .filter((preference) => careerPreferenceMatches(jobText, preference));
  const careerDimension = !uniqueCareerPreferences.length
    ? createDimension('careerAlignment', 'Career alignment', JOB_MATCH_WEIGHTS.careerAlignment, {
      unknownInformation: ['No career interests, preferred industries, or preferred work areas are recorded in the profile.'],
    })
    : !jobText.trim()
      ? createDimension('careerAlignment', 'Career alignment', JOB_MATCH_WEIGHTS.careerAlignment, {
        unknownInformation: ['The job listing has no title, description, or category to compare with career preferences.'],
      })
      : createDimension('careerAlignment', 'Career alignment', JOB_MATCH_WEIGHTS.careerAlignment, {
        status: matchedPreferences.length ? 'matched' : 'unmatched',
        score: matchedPreferences.length ? 1 : 0,
        matchedEvidence: matchedPreferences.map((preference) => ({
          dimension: 'careerAlignment',
          requirement: preference,
          profileEvidence: `Saved career preference: ${preference}.`,
          jobEvidence: 'Preference appears in the job title, description, or category.',
        })),
        unmatchedRequirements: matchedPreferences.length
          ? []
          : ['Career alignment: none of the saved career preferences appear in the job title, description, or category.'],
      });

  const seniority = getExperienceClassificationDetails(listing).seniority;
  const profileExperience = typeof sourceProfile.experienceLevel === 'string'
    ? sourceProfile.experienceLevel.trim()
    : '';
  const yearRequirement = jobYearRequirement(listing);
  let experienceDimension;
  if (yearRequirement.status === 'ambiguous') {
    experienceDimension = createDimension('experience', 'Experience', JOB_MATCH_WEIGHTS.experience, {
      unknownInformation: [`The listing's years-of-experience wording is ambiguous: ${yearRequirement.statements.map((item) => item.text).join('; ')}`],
    });
  } else if (yearRequirement.status === 'required') {
    const years = profileYearsExperience(sourceProfile);
    experienceDimension = years === null
      ? createDimension('experience', 'Experience', JOB_MATCH_WEIGHTS.experience, {
        unknownInformation: [`The listing states ${yearRequirement.minimum}${yearRequirement.maximum === null ? '+' : `–${yearRequirement.maximum}`} years of experience, but the profile has no numeric years-of-experience value.`],
      })
      : createDimension('experience', 'Experience', JOB_MATCH_WEIGHTS.experience, {
        status: years >= yearRequirement.minimum
          && (yearRequirement.maximum === null || years <= yearRequirement.maximum) ? 'matched' : 'unmatched',
        score: years >= yearRequirement.minimum
          && (yearRequirement.maximum === null || years <= yearRequirement.maximum) ? 1 : 0,
        matchedEvidence: years >= yearRequirement.minimum
          && (yearRequirement.maximum === null || years <= yearRequirement.maximum) ? [{
          dimension: 'experience',
          requirement: `${yearRequirement.minimum}${yearRequirement.maximum === null ? '+' : `–${yearRequirement.maximum}`} years`,
          profileEvidence: `${years} years recorded in the profile.`,
          jobEvidence: `Required experience: ${yearRequirement.text}.`,
        }] : [],
        unmatchedRequirements: years >= yearRequirement.minimum
          && (yearRequirement.maximum === null || years <= yearRequirement.maximum)
          ? []
          : [`Experience: ${yearRequirement.minimum}${yearRequirement.maximum === null ? '+' : `–${yearRequirement.maximum}`} years required; ${years} years recorded in the profile.`],
      });
  } else if (!profileExperience || seniority.classification === 'unknown') {
    experienceDimension = createDimension('experience', 'Experience', JOB_MATCH_WEIGHTS.experience, {
      unknownInformation: [
        !profileExperience
          ? 'No self-reported experience level is recorded in the profile.'
          : yearRequirement.status === 'preferred'
            ? `The listing mentions preferred years of experience, but does not state a mandatory numeric minimum: ${yearRequirement.statements.map((item) => item.text).join('; ')}`
            : `The listing experience requirement is unknown or ambiguous: ${seniority.evidence}`,
      ],
    });
  } else {
    const profileRank = experienceRank(profileExperience);
    const requiredRank = experienceRank(seniority.classification);
    experienceDimension = profileRank === null || requiredRank === null
      ? createDimension('experience', 'Experience', JOB_MATCH_WEIGHTS.experience, {
        unknownInformation: [`Profile level "${profileExperience}" or listing level "${seniority.classification}" cannot be compared reliably.`],
      })
      : createDimension('experience', 'Experience', JOB_MATCH_WEIGHTS.experience, {
        status: profileRank >= requiredRank ? 'matched' : 'unmatched',
        score: profileRank >= requiredRank ? 1 : 0,
        matchedEvidence: profileRank >= requiredRank ? [{
          dimension: 'experience',
          requirement: seniority.classification,
          profileEvidence: `Self-reported current level: ${profileExperience}.`,
          jobEvidence: `${seniority.classification} (${seniority.source}-identified).`,
        }] : [],
        unmatchedRequirements: profileRank >= requiredRank
          ? []
          : [`Experience: listing indicates ${seniority.classification}; profile self-rating is ${profileExperience}.`],
      });
  }

  const educationRequirements = extractEducationRequirements(
    typeof listing?.description === 'string' ? listing.description : '',
  );
  const educationEvidence = profileEducationEvidence(sourceProfile);
  const educationDimension = !educationRequirements.length
    ? createDimension('education', 'Education', JOB_MATCH_WEIGHTS.education, {
      unknownInformation: ['The listing does not explicitly state a degree-level education requirement.'],
    })
    : !educationEvidence.length
      ? createDimension('education', 'Education', JOB_MATCH_WEIGHTS.education, {
        unknownInformation: ['The profile does not include education evidence to compare with the stated requirement.'],
      })
      : (() => {
        const matched = [];
        const unmatched = [];
        const unknown = [];
        educationRequirements.forEach((requirement) => {
          const knownRanks = educationEvidence.map((record) => educationRank(record.degree)).filter((rank) => rank !== null);
          if (!knownRanks.length) {
            unknown.push(`Cannot determine whether the recorded education meets "${requirement.raw}" because its degree level is unavailable or unrecognized.`);
            return;
          }
          const qualifyingRecords = educationEvidence.filter((record) => {
            const rank = educationRank(record.degree);
            return rank !== null && rank >= requirement.rank;
          });
          if (!qualifyingRecords.length) {
            if (educationEvidence.some((record) => educationRank(record.degree) === null)) {
              unknown.push(`Cannot determine whether an unrecognized recorded degree meets "${requirement.raw}".`);
            } else {
              unmatched.push(`Education: ${requirement.raw} (recorded degree level does not meet this stated level).`);
            }
            return;
          }
          if (!requirement.field) {
            const record = qualifyingRecords[0];
            matched.push({
              dimension: 'education',
              requirement: requirement.raw,
              profileEvidence: [record.degree, ...record.fields].filter(Boolean).join(' — '),
              jobEvidence: `Explicit education requirement: ${requirement.raw}.`,
            });
            return;
          }
          const matchingRecord = qualifyingRecords.find((record) => (
            record.fields.some((field) => matchesSearchTerm(field, requirement.field))
          ));
          if (matchingRecord) {
            matched.push({
              dimension: 'education',
              requirement: requirement.raw,
              profileEvidence: [matchingRecord.degree, ...matchingRecord.fields].filter(Boolean).join(' — '),
              jobEvidence: `Explicit education requirement: ${requirement.raw}.`,
            });
          } else {
            const hasUnknownField = qualifyingRecords.some((record) => record.fields.length === 0)
              || educationEvidence.some((record) => educationRank(record.degree) === null);
            if (hasUnknownField) {
              unknown.push(`The listing requires education in ${requirement.field}, but a qualifying degree has no recorded field of study.`);
            } else {
              unmatched.push(`Education field: ${requirement.field} (not found on any recorded degree that meets the required level).`);
            }
          }
        });
        const total = matched.length + unmatched.length;
        const score = total ? matched.length / total : null;
        return createDimension('education', 'Education', JOB_MATCH_WEIGHTS.education, {
          status: score === null
            ? 'unknown'
            : unknown.length ? 'partial' : score === 1 ? 'matched' : score > 0 ? 'partial' : 'unmatched',
          score,
          matchedEvidence: matched,
          unmatchedRequirements: unmatched,
          unknownInformation: unknown,
        });
      })();

  const preferredLocations = stringsFrom(sourceProfile.preferredLocations);
  const jobLocation = typeof listing?.location === 'string' ? listing.location.trim() : '';
  const locationResults = preferredLocations.map((preference) => ({
    preference,
    result: getLocationMatch(listing, preference),
  }));
  const locationMatches = locationResults.filter(({ result }) => (
    result === 'local' || result === 'remote-global'
  ));
  const locationIsUnspecified = locationResults.some(({ result }) => result === 'remote-unspecified');
  const locationDimension = !jobLocation
    ? createDimension('location', 'Location', JOB_MATCH_WEIGHTS.location, {
      unknownInformation: ['The listing does not provide a location.'],
    })
    : !preferredLocations.length
      ? createDimension('location', 'Location', JOB_MATCH_WEIGHTS.location, {
        unknownInformation: ['No preferred location is recorded in the profile.'],
      })
      : locationIsUnspecified && !locationMatches.length
        ? createDimension('location', 'Location', JOB_MATCH_WEIGHTS.location, {
          unknownInformation: ['The listing is remote but does not state whether it is available in the preferred location.'],
        })
      : createDimension('location', 'Location', JOB_MATCH_WEIGHTS.location, {
        status: locationMatches.length ? 'matched' : 'unmatched',
        score: locationMatches.length ? 1 : 0,
        matchedEvidence: locationMatches.map(({ preference, result }) => ({
          dimension: 'location',
          requirement: preference,
          profileEvidence: `Preferred location: ${preference}.`,
          jobEvidence: result === 'remote-global'
            ? 'The listing states a worldwide remote location.'
            : `Listing location: ${jobLocation}.`,
        })),
        unmatchedRequirements: locationMatches.length ? [] : [`Location: listing location "${jobLocation}" does not match the saved preferred locations.`],
      });

  const preferredWorkModes = stringsFrom(sourceProfile.preferredWorkModes)
    .map(normalizeWorkMode)
    .filter(Boolean);
  const listingWorkModes = jobWorkModes(listing);
  const workModeDimension = !listingWorkModes.length
    ? createDimension('workMode', 'Work mode', JOB_MATCH_WEIGHTS.workMode, {
      unknownInformation: ['The listing work mode is missing or ambiguous.'],
    })
    : !preferredWorkModes.length
      ? createDimension('workMode', 'Work mode', JOB_MATCH_WEIGHTS.workMode, {
        unknownInformation: ['No preferred work mode is recorded in the profile.'],
      })
      : (() => {
        const matches = preferredWorkModes.filter((mode) => listingWorkModes.includes(mode));
        return createDimension('workMode', 'Work mode', JOB_MATCH_WEIGHTS.workMode, {
          status: matches.length ? 'matched' : 'unmatched',
          score: matches.length ? 1 : 0,
          matchedEvidence: matches.map((mode) => ({
            dimension: 'workMode',
            requirement: mode,
            profileEvidence: `Preferred work mode: ${mode}.`,
            jobEvidence: `Listing work mode: ${mode}.`,
          })),
          unmatchedRequirements: matches.length ? [] : [`Work mode: listing is ${listingWorkModes.join(', ')}, not among the saved preferences.`],
        });
      })();

  const preferredEmploymentTypes = stringsFrom(sourceProfile.preferredEmploymentTypes)
    .flatMap((value) => getKnownEmploymentTypes({ employmentType: value }));
  const listingEmploymentTypes = getKnownEmploymentTypes(listing);
  const employmentDimension = listingEmploymentTypes.length !== 1
    ? createDimension('employmentType', 'Employment type', JOB_MATCH_WEIGHTS.employmentType, {
      unknownInformation: [listingEmploymentTypes.length
        ? 'The listing contains multiple or conflicting employment types.'
        : 'The listing does not provide a recognized employment type.'],
    })
    : !preferredEmploymentTypes.length
      ? createDimension('employmentType', 'Employment type', JOB_MATCH_WEIGHTS.employmentType, {
        unknownInformation: ['No preferred employment type is recorded in the profile.'],
      })
      : (() => {
        const matches = preferredEmploymentTypes.filter((type) => listingEmploymentTypes.includes(type));
        return createDimension('employmentType', 'Employment type', JOB_MATCH_WEIGHTS.employmentType, {
          status: matches.length ? 'matched' : 'unmatched',
          score: matches.length ? 1 : 0,
          matchedEvidence: matches.map((type) => ({
            dimension: 'employmentType',
            requirement: type,
            profileEvidence: `Preferred employment type: ${type}.`,
            jobEvidence: `Listing employment type: ${type}.`,
          })),
          unmatchedRequirements: matches.length ? [] : [`Employment type: listing is ${listingEmploymentTypes[0]}, not among the saved preferences.`],
        });
      })();

  const dimensions = [
    skillDimension,
    careerDimension,
    experienceDimension,
    educationDimension,
    locationDimension,
    workModeDimension,
    employmentDimension,
  ];
  const applicableDimensions = dimensions.filter((dimension) => dimension.applicable);
  const comparableWeight = applicableDimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
  const totalPossibleWeight = dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
  const evidenceCoverage = totalPossibleWeight
    ? Math.round(comparableWeight / totalPossibleWeight * 100)
    : 0;
  const comparableEvidenceCount = applicableDimensions.reduce(
    (sum, dimension) => sum + dimension.evidenceCount,
    0,
  );
  const canScore = applicableDimensions.length >= 2
    && comparableWeight >= 40
    && comparableEvidenceCount >= 3;
  const score = canScore
    ? Math.round(applicableDimensions.reduce(
      (sum, dimension) => sum + dimension.score * dimension.weight,
      0,
    ) / comparableWeight * 100)
    : null;
  const weightSummary = dimensions
    .map((dimension) => `${dimension.label} ${dimension.weight}%`)
    .join(', ');
  const scoreExplanation = canScore
    ? `Weighted average across ${applicableDimensions.length} comparable dimensions and ${comparableEvidenceCount} evidence comparisons (${comparableWeight}% of the total possible weight): ${weightSummary}. Missing or ambiguous dimensions are excluded, not scored as mismatches.`
    : `A percentage is withheld because only ${applicableDimensions.length} dimensions (${comparableWeight}% of total weight) and ${comparableEvidenceCount} evidence comparisons are comparable. A score requires at least 2 dimensions, 40% of the total weight, and 3 evidence comparisons. Missing or ambiguous information is unknown, not a mismatch.`;
  const matchedEvidence = dimensions.flatMap((dimension) => dimension.matchedEvidence);
  const unmatchedRequirements = dimensions.flatMap((dimension) => dimension.unmatchedRequirements);
  const unknownInformation = dimensions.flatMap((dimension) => dimension.unknownInformation);
  const needsVerification = required.filter((skill) => !matchedSkills.includes(skill));
  return {
    matchedSkills,
    needsVerification,
    identifiedRequirements: required.length,
    requirements: skillResults,
    requirementEvidence,
    dimensions,
    matchedEvidence,
    unmatchedRequirements,
    unknownInformation,
    score,
    evidenceCoverage,
    comparableWeight,
    totalPossibleWeight,
    scoreLabel: canScore ? 'weighted evidence-match score' : 'Not enough comparable evidence to score',
    scoreExplanation,
    comparableDimensionCount: applicableDimensions.length,
    comparableEvidenceCount,
  };
}

export function createJobPreparationRoadmap(listing, profile, durationWeeks = 4) {
  const weeks = [2, 4, 8, 12].includes(Number(durationWeeks)) ? Number(durationWeeks) : 4;
  const comparison = compareListingWithProfile(listing, profile);
  const identifiedSkills = extractJobRequirements(listing);
  const profileEvidence = profileSkillEvidence(profile);
  const roadmapSkillMatches = identifiedSkills.length && hasSkillEvidence(profileEvidence)
    ? compareJobRequirements(identifiedSkills, profileEvidence).matchedRequirements
    : [];
  const roadmapSkillsToVerify = identifiedSkills.filter((skill) => !roadmapSkillMatches.includes(skill));
  const targetSkills = (roadmapSkillsToVerify.length
    ? roadmapSkillsToVerify
    : roadmapSkillMatches.length ? roadmapSkillMatches : identifiedSkills)
    .slice(0, Math.min(6, weeks));
  const role = listing?.title || 'this role';
  const perSkill = Math.max(1, Math.floor((weeks - 1) / Math.max(1, targetSkills.length)));
  const tasks = targetSkills.map((skill, index) => ({
    id: `skill-${index}`,
    week: Math.min(weeks, index * perSkill + 1),
    title: `${roadmapSkillMatches.includes(skill) ? 'Strengthen' : 'Learn and verify'} ${skill}`,
    objective: `Review how ${skill} is used in the ${role} posting and document your current evidence.`,
    exercise: `Complete a small ${role}-relevant exercise that demonstrates ${skill}; record the result and what you learned.`,
    milestone: `Create one reviewable artifact demonstrating ${skill}.`,
    resources: `Use CareerScout AI's Skill Gap & Learning Resources for ${skill}, then review the original job posting.`,
    skill,
    completed: false,
  }));
  tasks.push({
    id: 'portfolio',
    week: Math.max(1, weeks - 1),
    title: 'Prepare a role-relevant portfolio example',
    objective: `Connect your documented skills to the actual responsibilities listed for ${role}.`,
    exercise: 'Select an existing project or create a focused work sample; clearly explain your contribution and tools.',
    milestone: 'Publish or organize a project summary and verify its links.',
    resources: 'Use your saved Student Profile projects and the original job posting as references.',
    skill: '',
    completed: false,
  }, {
    id: 'resume',
    week: weeks,
    title: 'Improve your role-aligned resume',
    objective: `Make your documented evidence relevant to the responsibilities for ${role}.`,
    exercise: 'Review the original posting and tailor the summary, skills, and project evidence without adding unverified claims.',
    milestone: 'Complete a resume review that maps each included skill to profile or project evidence.',
    resources: 'Use your saved Student Profile and the original employer posting.',
    skill: '',
    completed: false,
  }, {
    id: 'interview',
    week: weeks,
    title: 'Practice role-specific interviews',
    objective: `Prepare to explain your experience and ask informed questions about ${role}.`,
    exercise: 'Practice concise project examples and list role requirements that need clarification.',
    milestone: 'Complete one mock interview and a list of questions for the employer.',
    resources: 'Use the original job posting and your project evidence; confirm details with the employer.',
    skill: '',
    completed: false,
  });
  return { weeks, role, requirements: comparison, tasks };
}

function searchQuery(query, location) {
  return [query.trim(), location.trim()].filter(Boolean).join(' ');
}

export function createExternalJobSearchLinks(query, location) {
  const keywords = searchQuery(query, location);
  if (!keywords) return [];
  const encoded = encodeURIComponent(keywords);
  const params = new URLSearchParams();
  params.set('keywords', query.trim());
  if (location.trim()) params.set('location', location.trim());
  const indeed = new URLSearchParams();
  indeed.set('q', query.trim());
  if (location.trim()) indeed.set('l', location.trim());
  const naukri = new URLSearchParams();
  naukri.set('k', query.trim());
  if (location.trim()) naukri.set('l', location.trim());

  return [
    { name: 'LinkedIn Jobs', url: `https://www.linkedin.com/jobs/search/?${params.toString()}` },
    { name: 'Naukri', url: `https://www.naukri.com/job-search?${naukri.toString()}` },
    { name: 'Indeed', url: `https://www.indeed.com/jobs?${indeed.toString()}` },
    { name: 'Google Jobs', url: `https://www.google.com/search?ibp=htl;jobs&q=${encoded}` },
  ];
}

function trackerEmploymentType(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toLocaleLowerCase();
  return EMPLOYMENT_TYPES.find((type) => type.toLocaleLowerCase() === normalized) || '';
}

export function createTrackerPrefill(listing) {
  if (!isValidDiscoveryListing(listing)) return null;
  return {
    companyName: listing.company.trim().slice(0, 120),
    jobTitle: listing.title.trim().slice(0, 120),
    jobUrl: listing.url.trim().slice(0, 2048),
    location: (typeof listing.location === 'string' ? listing.location : '').trim().slice(0, 120),
    employmentType: trackerEmploymentType(listing.employmentType),
    status: 'Saved',
    dateApplied: '',
    followUpDate: '',
    description: (typeof listing.description === 'string' ? listing.description : '').trim().slice(0, MAX_DESCRIPTION_LENGTH),
    notes: '',
  };
}

export function formatDiscoveryDate(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

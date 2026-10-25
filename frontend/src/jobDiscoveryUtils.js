import { EMPLOYMENT_TYPES, MAX_DESCRIPTION_LENGTH, isValidHttpUrl } from './jobApplicationUtils.js';

export const MAX_JOB_SEARCH_LENGTH = 100;
export const MAX_JOB_LOCATION_LENGTH = 120;

export const JOB_CATEGORIES = [
  { id: 'software-development', label: 'Software Development', roles: [
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

export function getRoleSearchTerms(roleTitle) {
  const normalizedTitle = normalizeSearchText(roleTitle);
  const role = getAllJobRoles().find((item) => normalizeSearchText(item.title) === normalizedTitle);
  return role ? [role.title, ...role.synonyms] : (roleTitle ? [roleTitle] : []);
}

export function matchesJobSelections(listing, { categories = [], role = '', query = '' } = {}) {
  const haystack = normalizeSearchText([listing?.title, listing?.description, listing?.category].join(' '));
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery && !normalizedQuery.split(/\s+/).every((term) => haystack.includes(term))) return false;

  if (role) {
    return getRoleSearchTerms(role).some((term) => {
      const normalizedTerm = normalizeSearchText(term);
      return normalizedTerm && haystack.includes(normalizedTerm);
    });
  }
  if (categories.length) {
    return categories.some((categoryId) => {
      const category = JOB_CATEGORIES.find((item) => item.id === categoryId);
      return category?.roles.some((item) => [item.title, ...item.synonyms].some((term) => (
        haystack.includes(normalizeSearchText(term))
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
    const searchableText = normalizeSearchText([listing.title, listing.description].filter(Boolean).join(' '));
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
    company = '',
    experience = 'All opportunities',
    employment = 'Any employment',
    sortBy = 'relevance',
    location = '',
  } = filters;
  const result = deduplicateDiscoveryListings(listings).filter((listing) => {
    if (!filterDiscoveryListings([listing], { query, remoteOnly }).length) return false;
    if (!matchesJobSelections(listing, { categories, role })) return false;
    if (company && !normalizeSearchText(listing.company).includes(normalizeSearchText(company))) return false;
    const normalizedLocation = normalizeSearchText(listing.location);
    const normalizedRequestedLocation = normalizeSearchText(location);
    if (normalizedRequestedLocation && !getLocationMatch(listing, location)) return false;
    if (workMode !== 'Any work mode' && listing.workMode) {
      if (normalizeSearchText(listing.workMode) !== normalizeSearchText(workMode)) return false;
    } else if (workMode === 'Remote' && listing.isRemote === false) {
      return false;
    }
    if (employment !== 'Any employment' && listing.employmentType
      && normalizeSearchText(listing.employmentType) !== normalizeSearchText(employment)) return false;
    if (experience !== 'All opportunities') {
      const classification = getExperienceClassification(listing);
      if (experience === 'Internships' && !['Internship', 'Not stated'].includes(classification)) return false;
      if (['Freshers & graduates', 'Entry-level jobs'].includes(experience)
        && !['Entry-level', 'Not stated'].includes(classification)) return false;
      if (experience === 'Experienced jobs'
        && !['Experienced', 'Not stated'].includes(classification)) return false;
    }
    return true;
  });

  if (sortBy === 'newest') {
    result.sort((first, second) => Date.parse(second.publicationDate || '') - Date.parse(first.publicationDate || ''));
  } else if (sortBy === 'company') {
    result.sort((first, second) => first.company.localeCompare(second.company));
  } else if (sortBy === 'title') {
    result.sort((first, second) => first.title.localeCompare(second.title));
  }
  return result;
}

export function getKnownExperienceLevel(listing) {
  const classification = getExperienceClassification(listing);
  return classification === 'Not stated' ? '' : classification;
}

export function getExperienceClassification(listing) {
  const supplied = normalizeSearchText(listing?.experienceClassification);
  if (supplied === 'internship') return 'Internship';
  if (supplied === 'entry level') return 'Entry-level';
  if (supplied === 'experienced') return 'Experienced';
  const explicit = normalizeSearchText(listing?.experienceLevel);
  const employment = normalizeSearchText(listing?.employmentType);
  const title = normalizeSearchText(listing?.title);
  if (/\b(intern|internship)\b/.test(`${explicit} ${employment} ${title}`)) return 'Internship';
  if (/\b(fresher|graduate|new grad|graduate trainee|apprentice|student researcher|junior|associate|entry level)\b/.test(`${explicit} ${title}`)) {
    return 'Entry-level';
  }
  if (/\b(senior|principal|staff engineer|lead engineer|manager|experienced|mid level)\b/.test(`${explicit} ${title}`)) return 'Experienced';
  return 'Not stated';
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
  const classifications = listings.map(getExperienceClassification);
  return {
    totalRetrieved: listings.length,
    distinctCompanies: distinctCompanies.size,
    internships: classifications.filter((classification) => classification === 'Internship').length,
    entryLevel: classifications.filter((classification) => classification === 'Entry-level').length,
    experienced: classifications.filter((classification) => classification === 'Experienced').length,
    unknownExperience: classifications.filter((classification) => classification === 'Not stated').length,
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

export function compareListingWithProfile(listing, profile) {
  const required = extractJobRequirements(listing);
  const profileEvidence = [
    ...(Array.isArray(profile?.skills) ? profile.skills : []),
    ...(Array.isArray(profile?.projects) ? profile.projects.flatMap((project) => [
      project?.name,
      project?.description,
      project?.technologies,
    ]) : []),
    ...(Array.isArray(profile?.certifications) ? profile.certifications.flatMap((certification) => [
      certification?.name,
      certification?.description,
    ]) : []),
  ].filter((value) => typeof value === 'string').join(' ');
  const normalizedEvidence = normalizeSearchText(profileEvidence);
  const matchedSkills = required.filter((skill) => {
    const normalized = normalizeSearchText(skill);
    return normalized && normalizedEvidence.includes(normalized);
  });
  const needsVerification = required.filter((skill) => !matchedSkills.includes(skill));
  return {
    matchedSkills,
    needsVerification,
    identifiedRequirements: required.length,
    score: required.length ? Math.round((matchedSkills.length / required.length) * 100) : null,
    scoreLabel: required.length ? 'share of identified requirements found in your profile' : 'Not enough structured requirements to calculate',
  };
}

export function createJobPreparationRoadmap(listing, profile, durationWeeks = 4) {
  const weeks = [2, 4, 8, 12].includes(Number(durationWeeks)) ? Number(durationWeeks) : 4;
  const comparison = compareListingWithProfile(listing, profile);
  const targetSkills = (comparison.needsVerification.length
    ? comparison.needsVerification
    : comparison.matchedSkills).slice(0, Math.min(6, weeks));
  const role = listing?.title || 'this role';
  const perSkill = Math.max(1, Math.floor((weeks - 1) / Math.max(1, targetSkills.length)));
  const tasks = targetSkills.map((skill, index) => ({
    id: `skill-${index}`,
    week: Math.min(weeks, index * perSkill + 1),
    title: `${comparison.matchedSkills.includes(skill) ? 'Strengthen' : 'Learn and verify'} ${skill}`,
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

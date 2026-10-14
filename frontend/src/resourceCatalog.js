import { careerDomains, careerRoles } from './careerCatalog.js';

const verifiedOn = '2026-10-14';

export const resourceTypes = [
  'structured-online-course',
  'official-documentation',
  'guided-learning-path',
  'hands-on-lab',
  'interactive-practice',
  'tutorial-video',
  'certification-preparation',
  'portfolio-project-guide',
];

export const resourceCatalogue = [
  {
    id: 'kaggle-python', title: 'Python', provider: 'Kaggle Learn', careerDomains: ['software-development', 'data-analytics', 'artificial-intelligence', 'software-quality', 'cybersecurity'], careerRoles: ['Software Engineer', 'Data Analyst', 'Data Scientist', 'Machine Learning Engineer', 'QA Engineer'], topics: ['Python', 'programming fundamentals'], level: 'beginner', resourceType: 'interactive-practice', url: 'https://www.kaggle.com/learn/python', languages: ['English'], costStatus: 'free', prerequisites: ['Basic computer use'], description: 'Short lessons and exercises introducing Python for data work.', lastVerified: verifiedOn,
  },
  {
    id: 'kaggle-pandas', title: 'Pandas', provider: 'Kaggle Learn', careerDomains: ['data-analytics', 'artificial-intelligence'], careerRoles: ['Data Analyst', 'Data Scientist', 'Data Engineer', 'Business Intelligence Analyst'], topics: ['Pandas', 'data cleaning', 'data analysis'], level: 'beginner', resourceType: 'interactive-practice', url: 'https://www.kaggle.com/learn/pandas', languages: ['English'], costStatus: 'free', prerequisites: ['Python fundamentals'], description: 'Hands-on lessons for reading, transforming, and analyzing tabular data.', lastVerified: verifiedOn,
  },
  {
    id: 'kaggle-sql', title: 'Intro to SQL', provider: 'Kaggle Learn', careerDomains: ['data-analytics', 'finance-accounting', 'business-operations', 'logistics-supply-chain'], careerRoles: ['Data Analyst', 'Business Intelligence Analyst', 'Financial Data Analyst', 'Business Analyst'], topics: ['SQL', 'relational data', 'queries'], level: 'beginner', resourceType: 'interactive-practice', url: 'https://www.kaggle.com/learn/intro-to-sql', languages: ['English'], costStatus: 'free', prerequisites: ['Basic computer use'], description: 'Interactive practice querying data with SQL.', lastVerified: verifiedOn,
  },
  {
    id: 'kaggle-data-visualization', title: 'Data Visualization', provider: 'Kaggle Learn', careerDomains: ['data-analytics', 'finance-accounting', 'marketing-communications', 'agriculture-environment'], careerRoles: ['Data Analyst', 'Business Intelligence Analyst', 'Marketing Analyst', 'Financial Analyst'], topics: ['data visualization', 'charts', 'seaborn'], level: 'beginner', resourceType: 'interactive-practice', url: 'https://www.kaggle.com/learn/data-visualization', languages: ['English'], costStatus: 'free', prerequisites: ['Basic Python is useful'], description: 'Practice creating and interpreting data visualizations.', lastVerified: verifiedOn,
  },
  {
    id: 'kaggle-intro-ml', title: 'Intro to Machine Learning', provider: 'Kaggle Learn', careerDomains: ['artificial-intelligence', 'data-analytics'], careerRoles: ['Data Scientist', 'Machine Learning Engineer', 'AI Engineer'], topics: ['machine learning', 'model evaluation', 'scikit-learn'], level: 'beginner', resourceType: 'interactive-practice', url: 'https://www.kaggle.com/learn/intro-to-machine-learning', languages: ['English'], costStatus: 'free', prerequisites: ['Introductory Python'], description: 'Build and evaluate initial machine-learning models through exercises.', lastVerified: verifiedOn,
  },
  {
    id: 'google-ml-crash-course', title: 'Machine Learning Crash Course', provider: 'Google for Developers', careerDomains: ['artificial-intelligence', 'data-analytics'], careerRoles: ['AI Engineer', 'Machine Learning Engineer', 'Data Scientist', 'AI Research Assistant'], topics: ['machine learning', 'model evaluation', 'neural networks', 'responsible AI'], level: 'beginner', resourceType: 'structured-online-course', url: 'https://developers.google.com/machine-learning/crash-course', languages: ['English'], costStatus: 'unknown', prerequisites: ['Review the course prerequisite guide before starting'], description: 'Practical modules with videos, interactive visualizations, and exercises; provider course page, not a certification guarantee.', lastVerified: verifiedOn,
  },
  {
    id: 'microsoft-learn-catalogue', title: 'Browse Microsoft Learn training catalogue', provider: 'Microsoft Learn', careerDomains: ['software-development', 'data-analytics', 'artificial-intelligence', 'cybersecurity', 'cloud-infrastructure', 'software-quality', 'business-operations', 'finance-accounting', 'education-research'], careerRoles: [], topics: ['Azure', 'cloud', 'data', 'AI', 'security', 'developer', 'DevOps', 'Power BI', 'Microsoft 365'], level: 'all', resourceType: 'guided-learning-path', url: 'https://learn.microsoft.com/en-us/training/browse/', languages: ['English'], costStatus: 'unknown', prerequisites: [], description: 'Official catalogue of Microsoft learning paths and modules; search for the desired role or product.', lastVerified: verifiedOn,
  },
  {
    id: 'microsoft-data-analyst-path', title: 'Training for Data Analysts', provider: 'Microsoft Learn', careerDomains: ['data-analytics', 'finance-accounting', 'business-operations'], careerRoles: ['Data Analyst', 'Business Intelligence Analyst', 'Business Data Analyst', 'Financial Data Analyst'], topics: ['data analysis', 'Power BI', 'data modeling', 'reporting'], level: 'beginner', resourceType: 'guided-learning-path', url: 'https://learn.microsoft.com/en-us/training/career-paths/data-analyst', languages: ['English'], costStatus: 'unknown', prerequisites: [], description: 'Microsoft Learn role page linking to its current data-analyst plan and related training.', lastVerified: verifiedOn,
  },
  {
    id: 'microsoft-ai-engineer-path', title: 'Training for AI Engineers', provider: 'Microsoft Learn', careerDomains: ['artificial-intelligence', 'cloud-infrastructure'], careerRoles: ['AI Engineer', 'Machine Learning Engineer', 'Generative AI Developer'], topics: ['AI engineering', 'Azure AI', 'model integration'], level: 'intermediate', resourceType: 'guided-learning-path', url: 'https://learn.microsoft.com/en-us/training/career-paths/ai-engineer', languages: ['English'], costStatus: 'unknown', prerequisites: ['Review the role page for current prerequisites'], description: 'Microsoft Learn role page with self-paced training options and a current official plan.', lastVerified: verifiedOn,
  },
  {
    id: 'microsoft-security-engineer-path', title: 'Training for Security Engineers', provider: 'Microsoft Learn', careerDomains: ['cybersecurity', 'cloud-infrastructure'], careerRoles: ['Security Engineer', 'Cloud Security Engineer', 'Cybersecurity Analyst'], topics: ['security engineering', 'cloud security', 'identity', 'defensive security'], level: 'intermediate', resourceType: 'guided-learning-path', url: 'https://learn.microsoft.com/en-us/training/career-paths/security-engineer', languages: ['English'], costStatus: 'unknown', prerequisites: ['Security and cloud fundamentals are useful'], description: 'Official security-engineer learning path with role context and Microsoft training options.', lastVerified: verifiedOn,
  },
  {
    id: 'google-skills-catalogue', title: 'Google Skills learning paths catalogue', provider: 'Google Skills', careerDomains: ['artificial-intelligence', 'data-analytics', 'cybersecurity', 'cloud-infrastructure'], careerRoles: [], topics: ['Google Cloud', 'AI', 'data', 'security', 'infrastructure'], level: 'all', resourceType: 'guided-learning-path', url: 'https://www.skills.google/paths', languages: ['English'], costStatus: 'unknown', prerequisites: [], description: 'Catalogue of Google-managed learning paths; individual path access and terms vary.', lastVerified: verifiedOn,
  },
  {
    id: 'google-cloud-devops-path', title: 'Professional Cloud DevOps Engineer learning path', provider: 'Google Skills', careerDomains: ['cloud-infrastructure'], careerRoles: ['DevOps Engineer', 'Site Reliability Engineer', 'Cloud Engineer'], topics: ['cloud DevOps', 'SRE', 'monitoring', 'reliability'], level: 'intermediate', resourceType: 'guided-learning-path', url: 'https://www.skills.google/paths/20', languages: ['English'], costStatus: 'unknown', prerequisites: ['Cloud and operations fundamentals are useful'], description: 'Google Skills path shown in the official paths catalogue for Professional Cloud DevOps Engineer.', lastVerified: verifiedOn,
  },
  {
    id: 'google-network-security-path', title: 'Network Security learning path', provider: 'Google Skills', careerDomains: ['cybersecurity', 'cloud-infrastructure'], careerRoles: ['Network Engineer', 'Cybersecurity Analyst', 'Security Engineer'], topics: ['network security', 'security monitoring', 'cloud security'], level: 'intermediate', resourceType: 'guided-learning-path', url: 'https://www.skills.google/paths/1839', languages: ['English'], costStatus: 'unknown', prerequisites: ['Networking fundamentals are useful'], description: 'Google Skills network-security path listed in the official learning-path catalogue.', lastVerified: verifiedOn,
  },
  {
    id: 'tryhackme-pre-security', title: 'Pre Security', provider: 'TryHackMe', careerDomains: ['cybersecurity', 'cloud-infrastructure'], careerRoles: ['Cybersecurity Analyst', 'SOC Analyst', 'Ethical Hacker', 'Penetration Tester', 'Network Engineer'], topics: ['computer fundamentals', 'Linux', 'networking', 'web basics', 'cybersecurity'], level: 'beginner', resourceType: 'hands-on-lab', url: 'https://tryhackme.com/path/outline/presecurity', languages: ['English'], costStatus: 'unknown', prerequisites: ['No prior cyber experience required; follow platform rules'], description: 'Beginner controlled labs covering computing, operating systems, networking, and introductory cyber concepts. Practice only in authorized labs.', lastVerified: verifiedOn,
  },
  {
    id: 'tryhackme-soc-level-1', title: 'SOC Level 1', provider: 'TryHackMe', careerDomains: ['cybersecurity'], careerRoles: ['SOC Analyst', 'Cybersecurity Analyst', 'Incident Response Analyst', 'Digital Forensics Analyst'], topics: ['defensive security', 'SIEM', 'logs', 'incident response', 'network monitoring'], level: 'beginner', resourceType: 'hands-on-lab', url: 'https://tryhackme.com/path/outline/soclevel1', languages: ['English'], costStatus: 'unknown', prerequisites: ['Networking and operating-system basics are useful'], description: 'Defensive SOC learning path with controlled analysis labs and simulations. Do not test systems outside the assigned lab scope.', lastVerified: verifiedOn,
  },
  {
    id: 'google-certificate-data-analytics', title: 'Google Data Analytics Certificate', provider: 'Google Career Certificates', careerDomains: ['data-analytics', 'business-operations', 'finance-accounting'], careerRoles: ['Data Analyst', 'Business Data Analyst', 'Business Intelligence Analyst', 'Marketing Analyst'], topics: ['data analytics', 'spreadsheets', 'SQL', 'visualization'], level: 'beginner', resourceType: 'certification-preparation', url: 'https://grow.google/intl/en_in/data-analytics-course/', languages: ['English'], costStatus: 'paid', prerequisites: [], description: 'Official Google certificate information page; enrollment is hosted on Coursera and pricing may vary by location.', lastVerified: verifiedOn,
  },
  {
    id: 'google-certificate-cybersecurity', title: 'Google Cybersecurity Certificate', provider: 'Google Career Certificates', careerDomains: ['cybersecurity'], careerRoles: ['Cybersecurity Analyst', 'SOC Analyst', 'Security Engineer', 'Incident Response Analyst'], topics: ['security operations', 'SIEM', 'Linux', 'Python', 'incident response'], level: 'beginner', resourceType: 'certification-preparation', url: 'https://grow.google/intl/en_in/cybersecurity-course/', languages: ['English'], costStatus: 'paid', prerequisites: [], description: 'Official Google certificate information page covering entry-level defensive security topics; enrollment is hosted on Coursera and pricing may vary.', lastVerified: verifiedOn,
  },
  {
    id: 'google-certificate-ux-design', title: 'Google UX Design Certificate', provider: 'Google Career Certificates', careerDomains: ['design-product'], careerRoles: ['UX Designer', 'UX Researcher', 'UI Designer', 'Product Designer'], topics: ['UX research', 'wireframes', 'prototypes', 'usability testing'], level: 'beginner', resourceType: 'certification-preparation', url: 'https://grow.google/intl/en_in/ux-design-course/', languages: ['English'], costStatus: 'paid', prerequisites: [], description: 'Official Google certificate information page; enrollment is hosted on Coursera and pricing may vary by location.', lastVerified: verifiedOn,
  },
  {
    id: 'google-certificate-project-management', title: 'Google Project Management Certificate', provider: 'Google Career Certificates', careerDomains: ['business-operations', 'education-research'], careerRoles: ['Project Manager', 'Business Analyst', 'Operations Analyst'], topics: ['project management', 'planning', 'risk', 'stakeholders'], level: 'beginner', resourceType: 'certification-preparation', url: 'https://grow.google/intl/en_in/project-management-course/', languages: ['English'], costStatus: 'paid', prerequisites: [], description: 'Official Google certificate information page; enrollment is hosted on Coursera and pricing may vary by location.', lastVerified: verifiedOn,
  },
  {
    id: 'google-certificate-digital-marketing', title: 'Google Digital Marketing and E-commerce Certificate', provider: 'Google Career Certificates', careerDomains: ['marketing-communications', 'business-operations'], careerRoles: ['Digital Marketing Specialist', 'SEO Specialist', 'Marketing Analyst', 'Content Strategist'], topics: ['digital marketing', 'SEO', 'campaign analytics', 'e-commerce'], level: 'beginner', resourceType: 'certification-preparation', url: 'https://grow.google/intl/en_in/digital-marketing-ecommerce-course/', languages: ['English'], costStatus: 'paid', prerequisites: [], description: 'Official Google certificate information page; enrollment is hosted on Coursera and pricing may vary by location.', lastVerified: verifiedOn,
  },
  {
    id: 'google-certificate-ai-professional', title: 'Google AI Professional Certificate', provider: 'Google Career Certificates', careerDomains: ['artificial-intelligence', 'business-operations', 'education-research'], careerRoles: ['AI Engineer', 'Generative AI Developer', 'Technical Trainer'], topics: ['AI literacy', 'generative AI', 'AI applications'], level: 'beginner', resourceType: 'certification-preparation', url: 'https://grow.google/intl/en_in/ai-professional/', languages: ['English'], costStatus: 'unknown', prerequisites: [], description: 'Official Google certificate information page for its AI Professional Certificate; verify current access and pricing on the provider site.', lastVerified: verifiedOn,
  },
  {
    id: 'skill-india-catalogue', title: 'Skill India Digital Hub course catalogue', provider: 'Skill India Digital Hub', careerDomains: ['software-development', 'data-analytics', 'artificial-intelligence', 'cybersecurity', 'cloud-infrastructure', 'design-product', 'marketing-communications', 'engineering-manufacturing', 'healthcare-life-sciences', 'agriculture-environment', 'logistics-supply-chain', 'hospitality-tourism', 'public-social-impact'], careerRoles: [], topics: ['development', 'data science', 'AI', 'cybersecurity', 'cloud', 'digital marketing', 'UI/UX', 'engineering', 'healthcare', 'agriculture'], level: 'all', resourceType: 'structured-online-course', url: 'https://www.skillindiadigital.gov.in/', languages: [], costStatus: 'unknown', prerequisites: [], description: 'Government of India learning hub and course catalogue. Search within the portal; course availability, languages, and cost vary by listing.', lastVerified: verifiedOn,
  },
  {
    id: 'swayam-plus-catalogue', title: 'SWAYAM Plus course catalogue', provider: 'SWAYAM Plus', careerDomains: ['software-development', 'data-analytics', 'artificial-intelligence', 'cybersecurity', 'cloud-infrastructure', 'design-product', 'business-operations', 'finance-accounting', 'marketing-communications', 'education-research', 'engineering-manufacturing', 'healthcare-life-sciences', 'agriculture-environment', 'logistics-supply-chain', 'hospitality-tourism', 'public-social-impact'], careerRoles: [], topics: ['career learning', 'technology', 'business', 'multilingual learning'], level: 'all', resourceType: 'structured-online-course', url: 'https://swayamplus.education.gov.in/catalog', languages: [], costStatus: 'unknown', prerequisites: [], description: 'Ministry of Education, Government of India course catalogue. Course language and whether access is free or paid vary by listing.', lastVerified: verifiedOn,
  },
  {
    id: 'mdn-web-learning', title: 'Learn web development', provider: 'MDN Web Docs', careerDomains: ['software-development', 'software-quality', 'design-product'], careerRoles: ['Frontend Developer', 'Full-Stack Developer', 'UI Designer', 'Accessibility Specialist'], topics: ['HTML', 'CSS', 'JavaScript', 'accessibility', 'web development'], level: 'beginner', resourceType: 'guided-learning-path', url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development', languages: ['English'], costStatus: 'free', prerequisites: [], description: 'Community-maintained learning area with structured web tutorials, exercises, and challenges.', lastVerified: verifiedOn,
  },
  {
    id: 'python-official-tutorial', title: 'The Python Tutorial', provider: 'Python Software Foundation', careerDomains: ['software-development', 'data-analytics', 'artificial-intelligence', 'software-quality', 'cybersecurity', 'cloud-infrastructure'], careerRoles: ['Software Engineer', 'Data Analyst', 'AI Engineer', 'QA Engineer', 'Cybersecurity Analyst'], topics: ['Python', 'programming'], level: 'beginner', resourceType: 'official-documentation', url: 'https://docs.python.org/3/tutorial/', languages: ['English'], costStatus: 'free', prerequisites: ['Designed for people new to Python, not new to programming'], description: 'Official Python tutorial and language documentation.', lastVerified: verifiedOn,
  },
  {
    id: 'postgresql-tutorial', title: 'PostgreSQL Tutorial', provider: 'PostgreSQL Global Development Group', careerDomains: ['software-development', 'data-analytics', 'cloud-infrastructure', 'finance-accounting'], careerRoles: ['Backend Developer', 'Data Engineer', 'Database Administrator', 'Data Analyst'], topics: ['SQL', 'relational databases', 'database administration'], level: 'beginner', resourceType: 'official-documentation', url: 'https://www.postgresql.org/docs/current/tutorial.html', languages: ['English'], costStatus: 'free', prerequisites: [], description: 'Official introductory tutorial to PostgreSQL, relational databases, and SQL.', lastVerified: verifiedOn,
  },
  {
    id: 'figma-resource-library', title: 'Figma Resource Library', provider: 'Figma', careerDomains: ['design-product', 'marketing-communications', 'business-operations'], careerRoles: ['UI Designer', 'UX Designer', 'UX Researcher', 'Product Designer', 'Content Strategist'], topics: ['UI/UX', 'design research', 'prototyping', 'accessibility', 'product design'], level: 'all', resourceType: 'official-documentation', url: 'https://www.figma.com/resource-library/', languages: ['English'], costStatus: 'free', prerequisites: [], description: 'Figma resource catalogue with articles on design, research, prototyping, and product work; it is a catalogue rather than a single course.', lastVerified: verifiedOn,
  },
  {
    id: 'microsoft-excel-help', title: 'Excel help and learning', provider: 'Microsoft Support', careerDomains: ['data-analytics', 'finance-accounting', 'business-operations', 'marketing-communications', 'logistics-supply-chain'], careerRoles: ['Financial Analyst', 'Accountant', 'Data Analyst', 'Operations Analyst', 'Marketing Analyst'], topics: ['Excel', 'spreadsheets', 'financial analysis', 'reporting'], level: 'all', resourceType: 'official-documentation', url: 'https://support.microsoft.com/en-us/excel', languages: ['English'], costStatus: 'unknown', prerequisites: [], description: 'Official Excel help and learning catalogue; software access and related services may require a license.', lastVerified: verifiedOn,
  },
];

export function validateResourceCatalogue(resources = resourceCatalogue) {
  const ids = new Set();
  const domainIds = new Set(careerDomains.map((domain) => domain.id));
  const roleTitles = new Set(careerRoles.map((role) => role.title));
  for (const resource of resources) {
    if (!resource?.id || ids.has(resource.id)) throw new Error(`Resource ID is missing or duplicated: ${resource?.id || '(empty)'}`);
    ids.add(resource.id);
    if (!resource.title || !resource.provider || !resource.description) throw new Error(`Resource metadata is incomplete: ${resource.id}`);
    let url;
    try {
      url = new URL(resource.url);
    } catch {
      throw new Error(`Resource URL is invalid: ${resource.id}`);
    }
    if (url.protocol !== 'https:') throw new Error(`Resource URL must use HTTPS: ${resource.id}`);
    if (!resourceTypes.includes(resource.resourceType)) throw new Error(`Resource type is invalid: ${resource.id}`);
    if (!['beginner', 'intermediate', 'advanced', 'all'].includes(resource.level)) throw new Error(`Resource level is invalid: ${resource.id}`);
    if (!['free', 'paid', 'freemium', 'unknown'].includes(resource.costStatus)) throw new Error(`Resource cost status is invalid: ${resource.id}`);
    if (!Array.isArray(resource.careerDomains) || !Array.isArray(resource.careerRoles) || !Array.isArray(resource.topics) || !Array.isArray(resource.prerequisites)) {
      throw new Error(`Resource categories are invalid: ${resource.id}`);
    }
    if (resource.careerDomains.some((domainId) => !domainIds.has(domainId))) throw new Error(`Resource domain is unknown: ${resource.id}`);
    if (resource.careerRoles.some((roleTitle) => !roleTitles.has(roleTitle))) throw new Error(`Resource role is unknown: ${resource.id}`);
    if (!Array.isArray(resource.languages)) throw new Error(`Resource languages are invalid: ${resource.id}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(resource.lastVerified) || Number.isNaN(Date.parse(`${resource.lastVerified}T00:00:00Z`))) {
      throw new Error(`Resource verification date is invalid: ${resource.id}`);
    }
  }
  return true;
}

const normalize = (value) => String(value || '').toLocaleLowerCase().replace(/[^a-z0-9+#.]+/g, ' ').trim();

export function getResourcesForCareer({ domainId, roleTitle, topics = [], limit = 8 } = {}) {
  const requestedTopics = topics.map(normalize).filter(Boolean);
  return resourceCatalogue
    .map((resource) => {
      const roleMatch = Boolean(roleTitle && resource.careerRoles.some((role) => role.toLocaleLowerCase() === roleTitle.toLocaleLowerCase()));
      const domainMatch = Boolean(domainId && resource.careerDomains.includes(domainId));
      const isProviderCatalogue = resource.careerRoles.length === 0;
      const topicMatches = resource.topics.filter((topic) => requestedTopics.some((requested) => {
        const normalizedTopic = normalize(topic);
        return normalizedTopic === requested || normalizedTopic.includes(requested) || requested.includes(normalizedTopic);
      }));
      const score = (roleMatch ? 8 : 0) + (domainMatch && isProviderCatalogue ? 3 : 0) + topicMatches.length;
      return { resource, score };
    })
    .filter(({ score }) => score > 0)
    .sort((first, second) => second.score - first.score || first.resource.title.localeCompare(second.resource.title))
    .slice(0, limit)
    .map(({ resource }) => resource);
}

export function getResourceById(resourceId) {
  return resourceCatalogue.find((resource) => resource.id === resourceId) || null;
}
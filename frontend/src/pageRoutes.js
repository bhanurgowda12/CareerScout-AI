export const pageHashes = {
  home: '',
  dashboard: '#student-dashboard',
  profile: '#student-profile',
  recommendations: '#career-recommendations',
  learning: '#skill-gap-learning',
  jobMatch: '#job-match-analyzer',
  jobTracker: '#job-application-tracker',
  jobDiscovery: '#job-discovery',
  resume: '#resume-builder',
  settings: '#settings',
  login: '#sign-in',
  register: '#get-started',
  username: '#choose-username',
};

export function getPageFromHash(hash) {
  if (hash === '#top') return 'home';
  return Object.entries(pageHashes).find(([, routeHash]) => routeHash && routeHash === hash)?.[0] || 'home';
}

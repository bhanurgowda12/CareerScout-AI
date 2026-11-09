function focusProgrammatically(target) {
  const hadTabIndex = target.hasAttribute('tabindex');
  const originalTabIndex = target.getAttribute('tabindex');
  if (!hadTabIndex) {
    target.setAttribute('tabindex', '-1');
    target.addEventListener('blur', () => {
      if (target.getAttribute('tabindex') === '-1') target.removeAttribute('tabindex');
    }, { once: true });
  }
  target.focus({ preventScroll: true });
}

function getHashTarget(root, hash) {
  if (!hash || hash === '#') return null;
  let id;
  try {
    id = decodeURIComponent(hash.slice(1));
  } catch {
    return null;
  }
  const target = root.ownerDocument?.getElementById(id);
  return target && root.contains(target) ? target : null;
}

export function focusNavigationContent(root, { hash = '', routeHashes = {} } = {}) {
  if (!root) return false;

  const isRouteHash = Object.values(routeHashes).includes(hash);
  const target = !isRouteHash ? getHashTarget(root, hash) : null;
  const pageHeading = root.querySelector('h1');
  const appContent = root.querySelector('.app-content');
  const focusTarget = target || pageHeading || appContent || root;

  focusProgrammatically(focusTarget);
  return true;
}

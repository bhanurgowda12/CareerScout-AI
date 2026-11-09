import React, { Component, Suspense } from 'react';

function PageLoadingFallback() {
  return React.createElement(
    'div',
    {
      className: 'recommendation-state dashboard-state page-loading',
      role: 'status',
      'aria-live': 'polite',
      'aria-busy': 'true',
    },
    React.createElement('span', { className: 'recommendation-spinner', 'aria-hidden': 'true' }),
    React.createElement('p', null, 'Loading this page...'),
  );
}

function PageLoadErrorFallback() {
  return React.createElement(
    'div',
    { className: 'recommendation-state dashboard-state page-load-error', role: 'alert' },
    React.createElement('p', null, 'This page could not be loaded. Check your connection and try again.'),
    React.createElement(
      'button',
      {
        className: 'button button-secondary',
        type: 'button',
        onClick: () => window.location.reload(),
      },
      'Retry',
    ),
  );
}

export class PageLoadErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Page loading failed.', error, info);
  }

  render() {
    if (this.state.hasError) return React.createElement(PageLoadErrorFallback);
    return this.props.children;
  }
}

export default function PageContent({ pageKey, children }) {
  return React.createElement(
    PageLoadErrorBoundary,
    { key: pageKey },
    React.createElement(Suspense, { fallback: React.createElement(PageLoadingFallback) }, children),
  );
}

import React, { lazy } from 'react';
import { createRoot } from 'react-dom/client';
import PageContent from '../../src/PageContent.js';

const UsernameSetup = lazy(() => import('../../src/UsernameSetup.jsx'));
const testUser = { uid: 'playwright-user', emailVerified: true };

createRoot(document.getElementById('root')).render(
  <PageContent pageKey="username">
    <UsernameSetup user={testUser} onSaved={() => {}} />
  </PageContent>,
);

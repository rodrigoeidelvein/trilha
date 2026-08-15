import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Self-hosted, not fetched from a CDN: the whole premise is that the app opens
// instantly on bad gym wifi, and the mono columns are what the design uses for
// scanning (ADR-0013). Only the weights the app actually uses.
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';

import './styles/tokens.css';
import './styles/base.css';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

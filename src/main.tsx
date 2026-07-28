import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { exposeCspCanary } from './devHandles.ts';
import './index.css';

// Measured here, from bundled code, before anything else runs — see the comment
// on exposeCspCanary for why a probe cannot measure this for itself.
exposeCspCanary();

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

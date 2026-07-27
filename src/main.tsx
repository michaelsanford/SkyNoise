import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { isFramed, renderFrameWarning } from './frame-guard';

const container = document.getElementById('root')!;

// Refuse to mount inside a frame. See frame-guard.ts for why this is a scripted
// check rather than a frame-ancestors directive, and what it does and does not
// guarantee.
if (isFramed()) {
  renderFrameWarning(container, window.location.href);
} else {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

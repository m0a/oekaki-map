import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { setupGlobalErrorHandler } from './lib/errorLogger';
import './styles/global.css';

// Setup global error handler
setupGlobalErrorHandler();

// Extract canvas ID from URL path: /c/:canvasId
function getCanvasIdFromUrl(): string | undefined {
  const path = window.location.pathname;
  const match = path.match(/^\/c\/([a-zA-Z0-9_-]+)$/);
  return match?.[1];
}

// Get canvas ID from URL
const canvasId = getCanvasIdFromUrl();

// Render the app
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App canvasId={canvasId} />
  </StrictMode>
);

import React from 'react';
import { createRoot } from 'react-dom/client';
import { PopupApp } from '../../src/popup/PopupApp';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Popup root container was not found.');
}

createRoot(container).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>
);

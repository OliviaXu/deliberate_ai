import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThinkingJournalApp } from '../../src/thinking-journal/ThinkingJournalApp';
import '../../src/thinking-journal/thinking-journal.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Thinking Journal root container was not found.');
}

createRoot(container).render(
  <React.StrictMode>
    <ThinkingJournalApp />
  </React.StrictMode>
);

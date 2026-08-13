import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThinkingJournalApp } from '../../src/thinking-journal/thinking-journal-app';
import '../../src/thinking-journal/thinking-journal.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Thinking Journal root container was not found.');
}

const featuredEntryId = new URLSearchParams(window.location.search).get('featured') || undefined;

createRoot(container).render(
  <React.StrictMode>
    <ThinkingJournalApp {...(featuredEntryId ? { featuredEntryId } : {})} />
  </React.StrictMode>
);

import React from 'react';
import { createRoot } from 'react-dom/client';
import Newsletter from './Newsletter';
import './index.css';

const el = document.getElementById('root');
if (!el) throw new Error('#root missing from the newsletter page');
const mode = el.dataset.mode === 'unsubscribe' ? 'unsubscribe' : 'confirm';
createRoot(el).render(
  <React.StrictMode>
    <Newsletter mode={mode} />
  </React.StrictMode>
);

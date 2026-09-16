import React from 'react';
import { createRoot } from 'react-dom/client';
import Legal from './Legal';
import { privacy } from './legal/privacy';
import { terms } from './legal/terms';
import './index.css';

const el = document.getElementById('root');
if (!el) throw new Error('#root missing from the legal page');
const current = el.dataset.doc === 'terms' ? 'terms' : 'privacy';
createRoot(el).render(
  <React.StrictMode>
    <Legal doc={current === 'terms' ? terms : privacy} current={current} />
  </React.StrictMode>
);

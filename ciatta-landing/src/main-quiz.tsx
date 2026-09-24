import React from 'react';
import { createRoot } from 'react-dom/client';
import Quiz from './Quiz';
import './index.css';

const el = document.getElementById('root');
if (!el) throw new Error('#root missing from quiz/index.html');
createRoot(el).render(
  <React.StrictMode>
    <Quiz />
  </React.StrictMode>
);

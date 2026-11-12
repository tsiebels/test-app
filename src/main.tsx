import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

try {
  const t = localStorage.getItem('cc-theme'); if (t) document.documentElement.dataset.theme = t;
  const w = localStorage.getItem('cc-ask-w'); if (w && window.innerWidth > 820) document.documentElement.style.setProperty('--ask-w', w);
} catch { /* storage unavailable */ }

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

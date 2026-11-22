import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';
import { isSecurePwaContext } from './utils/security';

// Apply saved theme immediately before first paint (CSP-safe external module, no inline script)
try {
  const savedTheme = localStorage.getItem('nexlive_theme');
  if (savedTheme === 'light') {
    document.documentElement.classList.remove('dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#F8FAFC');
  } else {
    document.documentElement.classList.add('dark');
  }
} catch {
  // ignore
}

// Register PWA service worker strictly on HTTPS (or localhost dev)
if (isSecurePwaContext(window.location.protocol, window.location.hostname)) {
  registerSW({ immediate: true });
}

createRoot(document.getElementById('root')!).render(<App />);

import { render } from 'preact';
import App from './App';
import { captureOAuthCallback } from './core/meta';
import './index.css';

captureOAuthCallback();
render(<App />, document.getElementById('root')!);
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch(() => {
        // No user data is emitted. Surface the offline limitation without blocking the vault.
        const notice = document.createElement('p');
        notice.setAttribute('role', 'status');
        notice.textContent = 'Offline installation is unavailable. Check your browser storage permissions.';
        document.body.append(notice);
      });
  });
}

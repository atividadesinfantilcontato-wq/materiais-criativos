import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { APP_BUILD_ID } from './types';

console.log("APP_BUILD_ID:", APP_BUILD_ID);

// Automatically unregister any legacy service worker, clear stale caches, localStorage, sessionStorage, and IndexedDB
if (typeof window !== 'undefined') {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (const registration of registrations) {
        registration.unregister();
      }
    }).catch(() => {});
  }

  if ('caches' in window) {
    caches.keys().then(keys => {
      keys.forEach(key => caches.delete(key));
    }).catch(() => {});
  }

  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch (e) {}

  if ('indexedDB' in window && indexedDB.databases) {
    indexedDB.databases().then(dbs => {
      dbs.forEach(db => {
        if (db.name) indexedDB.deleteDatabase(db.name);
      });
    }).catch(() => {});
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

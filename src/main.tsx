import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n"; // Initialize i18next

// Migrazione dominio Lovable → Vercel: una tantum unregister vecchi SW + clear cache, poi registra il nuovo
const SW_MIGRATION_KEY = 'lexora_sw_migrated_v2';
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const runMigrationThenRegister = () => {
      const migrated = localStorage.getItem(SW_MIGRATION_KEY);
      if (migrated) {
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((reg) => {
          reg.addEventListener('updatefound', () => {
            const worker = reg.installing;
            if (!worker) return;
            worker.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                worker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });
        }).catch((err) => console.error('[SW] Registrazione fallita:', err));
        return;
      }
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
        return caches.keys();
      }).then((cacheNames) => {
        return Promise.all(cacheNames.map((name) => caches.delete(name)));
      }).then(() => {
        try { localStorage.setItem(SW_MIGRATION_KEY, '1'); } catch { /* ignore */ }
        window.location.reload();
      });
    };
    runMigrationThenRegister();
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);

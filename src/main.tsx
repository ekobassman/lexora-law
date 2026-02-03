import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n"; // Initialize i18next

// Service Worker disabilitato per risolvere problema offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((r) => r.unregister());
      return caches.keys();
    }).then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {});
  });
}
// if ('serviceWorker' in navigator && import.meta.env.PROD) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker.register('/sw.js', { scope: '/' })...
//   });
// }

createRoot(document.getElementById("root")!).render(<App />);
// force deploy Tue Feb  3 15:45:18 WEST 2026

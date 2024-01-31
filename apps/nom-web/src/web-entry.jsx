import "./polyfills";
import React from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { inject as injectVercelAnalytics } from "@vercel/analytics";
import App from "./app.jsx";
import "./reset.css";
import "./index.css";

// const registerServiceWorker = () => {
//   if ("serviceWorker" in navigator) {
//     window.addEventListener("load", () => {
//       navigator.serviceWorker.register("/service-worker.js");
//     });
//   }
// };

// const unregisterServiceWorker = () => {
//   if ("serviceWorker" in navigator) {
//     navigator.serviceWorker.getRegistrations().then((registrations) => {
//       for (let registration of registrations) registration.unregister();
//     });
//   }
// };

if (import.meta.env.NODE_ENV === "production") {
  Sentry.init({ dsn: import.meta.env.PUBLIC_SENTRY_DSN });
  // registerServiceWorker();
  injectVercelAnalytics();
} else {
  // unregisterServiceWorker();
}

createRoot(document.getElementById("app-mount")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

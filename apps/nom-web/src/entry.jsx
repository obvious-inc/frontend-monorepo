import "./polyfills";
import React from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { inject as injectVercelAnalytics } from "@vercel/analytics";
import App from "./app.jsx";
import "./reset.css";
import "./index.css";

if (import.meta.env.PROD) {
  Sentry.init({ dsn: import.meta.env.PUBLIC_SENTRY_DSN });
  injectVercelAnalytics();
}

createRoot(document.getElementById("app-mount")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

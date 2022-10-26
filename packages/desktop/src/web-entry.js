import "./polyfills";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import * as Sentry from "@sentry/react";
import App from "./app";
import "./reset.css";
import "./index.css";

if (process.env.NODE_ENV === "production")
  Sentry.init({ dsn: process.env.SENTRY_DSN });

createRoot(document.getElementById("app-mount")).render(
  <BrowserRouter>
    <App tab="home" />
  </BrowserRouter>
);

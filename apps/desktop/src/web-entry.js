import "./polyfills";
import { render } from "react-dom";
import * as Sentry from "@sentry/react";
import App from "./app";
import "./reset.css";
import "./index.css";

if (process.env.NODE_ENV === "production")
  Sentry.init({ dsn: process.env.SENTRY_DSN });

render(<App />, document.getElementById("app-mount"));

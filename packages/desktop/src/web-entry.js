import { render } from "react-dom";
import { BrowserRouter } from "react-router-dom";
import * as Sentry from "@sentry/react";
import App from "./app";
import "./index.css";

if (process.env.NODE_ENV === "production")
  Sentry.init({ dsn: process.env.SENTRY_DSN });

render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
  document.getElementById("app-mount")
);

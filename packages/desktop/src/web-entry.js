import Styles from "@rainbow-me/rainbowkit/styles.css";
import "./polyfills";
import { render } from "react-dom";
import { BrowserRouter } from "react-router-dom";
import * as Sentry from "@sentry/react";
import App from "./app";
import "./reset.css";
import "./index.css";
// RainbowKit styling doesn’t load without this, no idea why
// eslint-disable-next-line
console.log(Styles);

if (process.env.NODE_ENV === "production")
  Sentry.init({ dsn: process.env.SENTRY_DSN });

render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
  document.getElementById("app-mount")
);

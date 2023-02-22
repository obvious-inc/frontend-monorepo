import "./polyfills";
import { render } from "react-dom";
import * as Sentry from "@sentry/react";
import App from "./app";
import "./reset.css";
import "./index.css";
import {
  NoisePublicKey,
  Handshake,
  NoiseHandshakePatterns,
  MessageNametagBuffer,
  PayloadV2,
} from "@waku/noise";
import * as x25519 from "@stablelib/x25519";
import { randomBytes } from "@stablelib/random";
import { HMACDRBG } from "@stablelib/hmac-drbg";

if (process.env.NODE_ENV === "production")
  Sentry.init({ dsn: process.env.SENTRY_DSN });

render(<App />, document.getElementById("app-mount"));

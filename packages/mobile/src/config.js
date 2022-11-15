import Constants from "expo-constants";
import * as Application from "expo-application";

const buildVersionString = () => {
  if (process.env.NODE_ENV !== "production")
    return Application.nativeBuildVersion;

  const appVersion = [
    Application.nativeApplicationVersion,
    Application.nativeBuildVersion,
  ].join(".");

  const sha = Constants.expoConfig.extra.gitCommitSha;

  if (sha == null) return appVersion;

  const truncatedSha = [sha.slice(0, 3), "...", sha.slice(-3)].join("");

  return [appVersion, truncatedSha].join("-");
};

export const VERSION = buildVersionString();

export const API_ENDPOINT = Constants.expoConfig.extra.apiEndpoint;
export const WEB_APP_ENDPOINT = Constants.expoConfig.extra.webAppEndpoint;
export const PUSHER_KEY = Constants.expoConfig.extra.pusherKey;
export const INFURA_PROJECT_ID = Constants.expoConfig.extra.infuraProjectId;
export const CLOUDFLARE_ACCOUNT_HASH =
  Constants.expoConfig.extra.cloudflareAccountHash;

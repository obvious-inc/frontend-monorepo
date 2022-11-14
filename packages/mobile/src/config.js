import Constants from "expo-constants";
import Application from "expo-application";

const buildVersionString = () => {
  const nativeVersion = [Application.nativeApplicationVersion, Application]
    .filter(Boolean)
    .join(".");

  return [nativeVersion, Constants.expoConfig.extra.gitCommitSha]
    .filter(Boolean)
    .join("-");
};

export const API_ENDPOINT = Constants.expoConfig.extra.apiEndpoint;
export const WEB_APP_ENDPOINT = Constants.expoConfig.extra.webAppEndpoint;
export const PUSHER_KEY = Constants.expoConfig.extra.pusherKey;
export const INFURA_PROJECT_ID = Constants.expoConfig.extra.infuraProjectId;

export const VERSION = buildVersionString();

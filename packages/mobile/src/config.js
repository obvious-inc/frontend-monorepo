import Constants from "expo-constants";
import * as Application from "expo-application";

const version = [
  Application.nativeBuildVersion,
  Constants.expoConfig.extra.gitCommitSha,
]
  .filter(Boolean)
  .join("-");

export const VERSION = version;

export const API_ENDPOINT = Constants.expoConfig.extra.apiEndpoint;
export const WEB_APP_ENDPOINT = Constants.expoConfig.extra.webAppEndpoint;
export const PUSHER_KEY = Constants.expoConfig.extra.pusherKey;
export const INFURA_PROJECT_ID = Constants.expoConfig.extra.infuraProjectId;

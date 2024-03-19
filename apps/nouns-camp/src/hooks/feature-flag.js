import { useWallet } from "./wallet.js";

const canaryFeatures = ["revotes"];
const betaFeatures = [];

const isCanarySession =
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).get("canary") != null;

const isBetaSession =
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).get("canary") != null;

const useFeatureFlag = (id) => {
  const { isCanaryAccount, isBetaAccount } = useWallet();
  if (canaryFeatures.includes(id)) return isCanaryAccount || isCanarySession;
  if (betaFeatures.includes(id)) return isBetaAccount || isBetaSession;
  return true;
};

export default useFeatureFlag;

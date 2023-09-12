import React from "react";
import { useLatestCallback } from "@shades/common/react";
import { useWallet } from "@shades/common/wallet";
import { useCachedState } from "@shades/common/app";

export const createCacheKey = (address) =>
  [address?.toLowerCase(), "signer"].filter(Boolean).join("-");

export const SignerContext = React.createContext({});

export const Provider = ({ children }) => {
  const [error, setError] = React.useState(null);
  const { accountAddress: address } = useWallet();
  const [fid, setFid] = React.useState(null);
  const [signer, setSigner] = useCachedState(createCacheKey(address));
  const [broadcasted, setBroadcasted] = React.useState(false);

  const reset = React.useCallback(() => {
    setError(null);
    setFid(null);
  }, []);

  const loginWithFarcasterId = useLatestCallback(async (farcasterId) => {
    setError(null);
    setFid(farcasterId);
  });

  const addSigner = useLatestCallback(async (signer) => {
    setError(null);
    setSigner(signer);
  });

  const contextValue = React.useMemo(
    () => ({
      address,
      fid,
      signer,
      broadcasted,
      setBroadcasted,
      login: loginWithFarcasterId,
      addSigner,
      reset,
      error,
    }),
    [
      address,
      fid,
      signer,
      broadcasted,
      loginWithFarcasterId,
      addSigner,
      reset,
      error,
    ]
  );

  return (
    <SignerContext.Provider value={contextValue}>
      {children}
    </SignerContext.Provider>
  );
};

const useSigner = () => React.useContext(SignerContext);

export default useSigner;

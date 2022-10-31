import { Wallet } from "ethers";
import { useSignMessage } from "wagmi";
import React from "react";
import { useAuth } from "@shades/common/app";
import { useLatestCallback } from "@shades/common/react";
import * as eth from "../utils/ethereum";

const WalletLoginContext = React.createContext({});

export const Provider = ({ children }) => {
  const { signMessageAsync: signMessage } = useSignMessage();
  const [status, setStatus] = React.useState("idle");
  const [error, setError] = React.useState(null);

  const { login } = useAuth();

  const loginWithWalletSignature = useLatestCallback(async (address) => {
    setError(null);
    setStatus("requesting-signature");
    try {
      return await eth
        .signLoginMessage(signMessage, address)
        .catch((e) =>
          Promise.reject(
            new Error(
              e.code === 4001
                ? "signature-rejected"
                : "signature-rejected-or-failed"
            )
          )
        )
        .then(({ signature, message, signedAt, nonce }) =>
          login({
            message,
            signature,
            signedAt,
            address,
            nonce,
          }).catch((e) => {
            console.log(e);
            return Promise.reject(new Error("server-login-request-error"));
          })
        );
    } catch (e) {
      console.log(e);
      setError(e.message);
      return Promise.reject(e);
    } finally {
      setStatus("idle");
    }
  });

  const loginWithThrowawayWallet = useLatestCallback(async () => {
    const wallet = Wallet.createRandom();

    const { message, signedAt, nonce } = eth.prepareLoginMessage(
      wallet.address
    );

    const signature = await wallet.signMessage(message);

    return await login({
      address: wallet.address,
      message,
      signature,
      signedAt,
      nonce,
    });
  });

  const contextValue = React.useMemo(
    () => ({
      login: loginWithWalletSignature,
      loginWithThrowawayWallet,
      status,
      error,
    }),
    [loginWithWalletSignature, loginWithThrowawayWallet, status, error]
  );

  return (
    <WalletLoginContext.Provider value={contextValue}>
      {children}
    </WalletLoginContext.Provider>
  );
};

const useWalletLogin = () => React.useContext(WalletLoginContext);

export default useWalletLogin;

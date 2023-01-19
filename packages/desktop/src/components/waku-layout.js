import {
  getPublicKey as getEdDSAPublicKey,
  utils as EdDSAUtils,
} from "@noble/ed25519";
import { bytesToHex, hexToBytes } from "@waku/byte-utils";
import { encrypt, decrypt } from "@metamask/browser-passworder";
import React from "react";
import {
  Provider as ClientProvider,
  useClientState,
} from "@shades/common/waku";
import { Outlet } from "react-router-dom";
import useWallet from "../hooks/wallet";

const useSignerPrivateKey = (custodyAddress) => {
  const [signerPrivateKey, setSignerPrivateKey] = React.useState(null);

  React.useEffect(() => {
    if (custodyAddress == null) return;

    const cacheKey = `ns:keycache:${custodyAddress.toLowerCase()}`;
    const storeKey = `ns:keystore:${custodyAddress.toLowerCase()}`;

    const runCreateSignerFlow = () => {
      const privateKey = `0x${bytesToHex(EdDSAUtils.randomPrivateKey())}`;

      setSignerPrivateKey(privateKey);

      const password = prompt(
        "Signer key created. Password protect your key, or leave empty to use a throwaway key."
      );

      if ((password?.trim() || "") === "") return;

      encrypt(password, { signer: privateKey }).then((blob) => {
        localStorage.setItem(storeKey, blob);
      });
    };

    const cachedPrivateKey = sessionStorage.getItem(cacheKey);
    const storedBlob = localStorage.getItem(storeKey);

    if (cachedPrivateKey != null) {
      setSignerPrivateKey(cachedPrivateKey);
      return;
    }

    if (storedBlob == null) {
      runCreateSignerFlow();
      return;
    }

    const password = prompt(
      "Unlock stored signer key, or leave emply to create a new one."
    );
    const gavePassword = (password?.trim() || "") !== "";

    if (!gavePassword) {
      runCreateSignerFlow();
      return;
    }

    decrypt(password, storedBlob).then(
      ({ signer: privateKey }) => {
        setSignerPrivateKey(privateKey);
        // Cache it!
        sessionStorage.setItem(cacheKey, privateKey);
      },
      () => {
        location.reload();
      }
    );

    return () => {
      sessionStorage.removeItem(cacheKey);
    };
  }, [custodyAddress]);

  return signerPrivateKey;
};

const WakuLayout = () => {
  const { accountAddress } = useWallet();

  const [signerPublicKey, setSignerPublicKey] = React.useState(null);
  const signerPrivateKey = useSignerPrivateKey(accountAddress);

  React.useEffect(() => {
    if (signerPrivateKey == null) return;

    getEdDSAPublicKey(hexToBytes(signerPrivateKey)).then((publicKeyBytes) => {
      const publicKeyHex = `0x${bytesToHex(publicKeyBytes)}`;
      setSignerPublicKey(publicKeyHex);
    });
  }, [signerPrivateKey]);

  return (
    <ClientProvider
      identity={accountAddress}
      signerKeyPair={
        signerPublicKey == null
          ? null
          : {
              privateKey: signerPrivateKey,
              publicKey: signerPublicKey,
            }
      }
    >
      <OutletOrLoader />
    </ClientProvider>
  );
};

const OutletOrLoader = () => {
  const { didInitialize: didInitializeClient } = useClientState();

  if (didInitializeClient) return <Outlet />;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      Establishing network connection...
    </div>
  );
};

export default WakuLayout;

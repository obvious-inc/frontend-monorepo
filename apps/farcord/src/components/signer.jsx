import React from "react";
import { useLatestCallback } from "@shades/common/react";
import { useCachedState } from "@shades/common/app";
import { getPublicKeyAsync, utils as EdDSAUtils } from "@noble/ed25519";
import { bytesToHex, encodeAbiParameters, parseAbi } from "viem";
import { useSignerByPublicKey } from "../hooks/hub";
import { usePublicClient, useWriteContract, useSimulateContract } from "wagmi";
import {
  DEFAULT_CHAIN_ID,
  KEY_GATEWAY_ADDRESS,
  KEY_METADATA_TYPE,
  KEY_REGISTRY_ADDRESS,
} from "../utils/farcaster";
import useFarcasterAccount from "./farcaster-account";

const { EDGE_API_BASE_URL } = import.meta.env;

const warpcastApi = "https://api.warpcast.com";

export const createCacheKey = (address) =>
  [address?.toLowerCase(), "signer"].filter(Boolean).join("-");

export const SignerContext = React.createContext({});

export const Provider = ({ children }) => {
  const [error, setError] = React.useState(null);
  const [status, setStatus] = React.useState("idle");

  const { fid, account, address } = useFarcasterAccount();
  const cacheKey = createCacheKey(
    account?.address ?? fid?.toString() ?? address
  );
  const [signer, setCachedSigner] = useCachedState(cacheKey);
  const onChainSigner = useSignerByPublicKey(fid, signer?.publicKey);
  const [broadcasted, setBroadcasted] = React.useState(onChainSigner != null);

  const publicClient = usePublicClient({ chainId: DEFAULT_CHAIN_ID });

  const setSigner = useLatestCallback((keypair) => {
    setCachedSigner(keypair);
  });

  const reset = React.useCallback(() => {
    setError(null);
    setStatus("idle");
  }, []);

  const resetSigner = React.useCallback(() => {
    setSigner(null);
    setBroadcasted(false);
  }, [setSigner]);

  const createSigner = useLatestCallback(async () => {
    if (signer) return signer;

    const signerPrivateKey = EdDSAUtils.randomPrivateKey();
    return getPublicKeyAsync(signerPrivateKey)
      .then((publicKey) => {
        const createdSigner = {
          privateKey: bytesToHex(signerPrivateKey),
          publicKey: bytesToHex(publicKey),
        };
        setSigner(createdSigner);
        return createdSigner;
      })
      .catch((e) => {
        setError(e);
      });
  });

  const { writeContractAsync: writeContract } = useWriteContract();

  const { data: walletRemoveSignerData } = useSimulateContract({
    address: KEY_REGISTRY_ADDRESS,
    abi: parseAbi(["function remove(bytes calldata key) external"]),
    chainId: DEFAULT_CHAIN_ID,
    functionName: "remove",
    args: [signer?.publicKey],
    query: {
      // enabled: !!signer?.publicKey && !!broadcasted,
      enabled: false, // TODO: set this up properly when planning revoke signer feature
    },
  });

  const createWarpcastSignKeyRequest = useLatestCallback(
    async ({ publicKey }) => {
      const deadline = Math.floor(Date.now() / 1000) + 86400; // signature is valid for 1 day
      setError(null);
      setStatus("requesting-signed-key-request");
      try {
        return await fetch(`${EDGE_API_BASE_URL}/farc-app`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            key: publicKey,
            deadline: deadline,
          }),
        })
          .then(async (res) => {
            return await res.json();
          })
          .then((data) => {
            return data.data.signature;
          })
          .then(async (signature) => {
            const res = await fetch(`${EDGE_API_BASE_URL}/farc-app`);
            const data = await res.json();
            return await fetch(`${warpcastApi}/v2/signed-key-requests`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                key: publicKey,
                requestFid: data.data.fid,
                signature,
                deadline,
              }),
            })
              .then((response) => {
                return response.json();
              })
              .then((response) => {
                return response.result.signedKeyRequest;
              });
          });
      } catch (e) {
        console.error(e);
        setError(e.message);
        return Promise.reject(e);
      } finally {
        setStatus("idle");
      }
    },
    [fid, signer]
  );

  const broadcastSigner = useLatestCallback(
    async ({ publicKey }) => {
      const deadline = Math.floor(Date.now() / 1000) + 86400; // signature is valid for 1 day
      setError(null);
      setStatus("requesting-signature");

      try {
        const [farcordSignatureResponse, farcordAccountResponse] =
          await Promise.all([
            fetch(`${EDGE_API_BASE_URL}/farc-app`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key: publicKey, deadline: deadline }),
            }).then((res) => res.json()),
            fetch(`${EDGE_API_BASE_URL}/farc-app`).then((res) => res.json()),
          ]);

        setStatus("requesting-transaction");

        const hash = await writeContract({
          address: KEY_GATEWAY_ADDRESS,
          abi: parseAbi([
            "function add(uint32 keyType, bytes calldata key, uint8 metadataType, bytes calldata metadata) external",
          ]),
          chainId: DEFAULT_CHAIN_ID,
          functionName: "add",
          args: [
            1,
            publicKey,
            1,
            encodeAbiParameters(KEY_METADATA_TYPE, [
              {
                requestFid: BigInt(farcordAccountResponse.data.fid),
                requestSigner: farcordAccountResponse.data.address,
                signature: farcordSignatureResponse.data.signature,
                deadline: BigInt(deadline),
              },
            ]),
          ],
        });

        setStatus("waiting-broadcasting");
        await publicClient.waitForTransactionReceipt({ hash });
        setBroadcasted(true);
      } catch (e) {
        console.error(e);
        const error = new Error(
          e.code === 32003
            ? "transaction-rejected"
            : "transaction-rejected-or-failed"
        );
        setError(error.message);
        return Promise.reject(error);
      } finally {
        setStatus("idle");
      }
    },
    [fid, signer]
  );

  const removeSigner = useLatestCallback(async () => {
    setError(null);
    setStatus("requesting-transaction");
    try {
      const hash = await writeContract(walletRemoveSignerData.request);
      setStatus("waiting-revoking");
      await publicClient.waitForTransactionReceipt({ hash });
      resetSigner();
      return hash;
    } catch (e) {
      setError("transaction-rejected-or-failed");
      console.error(e);
    } finally {
      setStatus("idle");
    }
  });

  React.useEffect(() => {
    if (!onChainSigner) setBroadcasted(false);
    else setBroadcasted(true);
  }, [onChainSigner]);

  const contextValue = React.useMemo(
    () => ({
      address,
      fid,
      signer,
      broadcasted,
      setBroadcasted,
      reset,
      error,
      createSigner,
      status,
      broadcastSigner,
      removeSigner,
      setSigner,
      resetSigner,
      isAddSignerPending: status === "waiting-broadcasting",
      isAddSignerSuccess: broadcasted,
      isRevokeSignerPending: status === "waiting-revoking",
      createWarpcastSignKeyRequest,
    }),
    [
      address,
      fid,
      signer,
      broadcasted,
      reset,
      error,
      createSigner,
      status,
      broadcastSigner,
      removeSigner,
      setSigner,
      resetSigner,
      createWarpcastSignKeyRequest,
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

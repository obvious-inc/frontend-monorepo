import React from "react";
import { css } from "@emotion/react";
import {
  useWalletFarcasterId,
  useSignKeyRegistry,
  useBroadcastKey,
} from "../hooks/farcord";
import Button from "@shades/ui-web/button";
import { useWallet, useWalletLogin } from "@shades/common/wallet";
import Spinner from "@shades/ui-web/spinner";
import { useNeynarUser } from "../hooks/neynar";
import { useNetwork, useSwitchNetwork } from "wagmi";
import { getPublicKeyAsync, utils as EdDSAUtils } from "@noble/ed25519";
import { bytesToHex } from "viem";
import { ethereum as ethereumUtils } from "@shades/common/utils";
import useSigner from "./signer";
import { useSignerByPublicKey } from "../hooks/hub";

const { truncateAddress } = ethereumUtils;

const DEFAULT_CHAIN_ID = 10;

const FarcasterUser = ({ fid }) => {
  const { user: farcasterUser, isFetching: isFetchingNeynarUser } =
    useNeynarUser(fid);

  if (!fid) {
    return <p>Connect your Farcaster custody wallet</p>;
  }

  if (isFetchingNeynarUser) {
    return <Spinner size="1rem" />;
  }

  return (
    <>
      <p
        css={(t) =>
          css({
            fontWeight: t.text.weights.emphasis,
          })
        }
      >
        {farcasterUser?.displayName}{" "}
        <span
          css={(t) =>
            css({
              color: t.colors.textMuted,
            })
          }
        >
          (@{farcasterUser?.username})
        </span>
      </p>
    </>
  );
};

const FarcasterSigner = ({ fid, address }) => {
  const { signer, addSigner, setBroadcasted } = useSigner();

  const createSigner = async () => {
    const signerPrivateKey = EdDSAUtils.randomPrivateKey();
    getPublicKeyAsync(signerPrivateKey).then((publicKey) => {
      addSigner({
        privateKey: bytesToHex(signerPrivateKey),
        publicKey: bytesToHex(publicKey),
      });
    });
  };

  const onchainSigner = useSignerByPublicKey(fid, signer?.publicKey);

  const deadline = Math.floor(Date.now() / 1000) + 86400; // signature is valid for 1 day

  const signKeyRegistrySigner = useSignKeyRegistry(
    fid,
    signer?.publicKey,
    deadline
  );
  const broadcastSigner = useBroadcastKey();

  React.useEffect(() => {
    if (!onchainSigner) return;

    setBroadcasted(true);
  }, [onchainSigner, address, setBroadcasted]);

  if (!signer) {
    return <Button onClick={createSigner}>Create a Signer</Button>;
  }

  return (
    <>
      <p>{truncateAddress(signer?.publicKey)}</p>
      {!onchainSigner && (
        <Button
          onClick={() => {
            signKeyRegistrySigner().then((signature) => {
              return broadcastSigner({
                fid,
                address,
                deadline,
                publicKey: signer?.publicKey,
                signature,
              });
            });
          }}
        >
          Broadcast
        </Button>
      )}
    </>
  );
};

const FarcasterAccount = () => {
  const {
    connect: connectWallet,
    accountAddress: walletAccountAddress,
    isConnecting: isConnectingWallet,
  } = useWallet();

  const { chain } = useNetwork();
  const { switchNetwork } = useSwitchNetwork();

  const { status: loginStatus } = useWalletLogin();

  const hasPendingWalletAction =
    isConnectingWallet || loginStatus === "requesting-signature";

  const { data: fid } = useWalletFarcasterId(walletAccountAddress);
  const { login, reset } = useSigner();

  React.useEffect(() => {
    if (!fid) return;

    login(fid);
    return () => {
      reset();
    };
  }, [fid, reset, login]);

  return (
    <>
      <div
        css={(t) =>
          css({
            margin: "0.6rem 0 0.2rem",
            padding: `0 0.8rem 0 calc( ${t.mainMenu.itemHorizontalPadding} + ${t.mainMenu.containerHorizontalPadding})`,
            minHeight: "2.4rem",
            display: "grid",
            alignItems: "center",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gridGap: "1rem",
          })
        }
      >
        {!walletAccountAddress ? (
          <Button size="small" variant="default" onClick={connectWallet}>
            Connect wallet
          </Button>
        ) : chain?.id !== DEFAULT_CHAIN_ID ? (
          <Button onClick={() => switchNetwork?.(DEFAULT_CHAIN_ID)}>
            Switch to Optimism
          </Button>
        ) : hasPendingWalletAction ? (
          <Spinner size="1rem" />
        ) : (
          <FarcasterUser fid={fid} />
        )}
      </div>
      <div
        css={(t) =>
          css({
            margin: "0.6rem 0 0.2rem",
            padding: `0 0.8rem 0 calc( ${t.mainMenu.itemHorizontalPadding} + ${t.mainMenu.containerHorizontalPadding})`,
            minHeight: "2.4rem",
            display: "grid",
            alignItems: "center",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gridGap: "1rem",
          })
        }
      >
        {fid && <FarcasterSigner fid={fid} address={walletAccountAddress} />}
      </div>
    </>
  );
};

export default FarcasterAccount;

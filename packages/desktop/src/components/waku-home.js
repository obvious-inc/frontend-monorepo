import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { css } from "@emotion/react";
import { useSubmitters, useChannels } from "@shades/common/waku";
import useWallet from "../hooks/wallet";
import Button from "./button";

const WakuHome = () => {
  const navigate = useNavigate();

  const {
    connect: connectWallet,
    accountAddress: connectedWalletAddress,
    isConnecting: isConnectingWallet,
  } = useWallet();

  const { submitChannelAdd } = useSubmitters();
  const channels_ = useChannels();
  const channels = channels_.filter((c) => c.name != null);

  if (connectedWalletAddress == null)
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Button onClick={connectWallet} disabled={isConnectingWallet}>
          Connect wallet
        </Button>
      </div>
    );

  return (
    <div
      css={(t) =>
        css({
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "1.6rem",
          li: { listStyle: "none" },
          a: { color: t.colors.link },
        })
      }
    >
      <div>
        {channels.length !== 0 && (
          <ul style={{ marginBottom: "1.6rem" }}>
            {channels.map((c) => (
              <li key={c.id}>
                <Link to={`/waku/${c.id}`}>{c.name ?? c.id}</Link>
              </li>
            ))}
          </ul>
        )}

        <Button
          onClick={() => {
            const name = prompt("Channel name");
            if ((name?.trim() ?? "") === "") return;
            submitChannelAdd({ name: name.trim() }).then((c) => {
              navigate(`/waku/${c.id}`);
            });
          }}
        >
          Create channel
        </Button>
      </div>
    </div>
  );
};

export default WakuHome;

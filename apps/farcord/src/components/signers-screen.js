import { css } from "@emotion/react";
import useFarcasterAccount from "./farcaster-account";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger";
import Button from "@shades/ui-web/button";
import { Small } from "./text";
import { useUserData, useUserSigners } from "../hooks/hub";
import useSigner from "./signer";
import { array as arrayUtils } from "@shades/common/utils";
import { decodeMetadata } from "../utils/farcaster";
import { ethereum as ethereumUtils } from "@shades/common/utils";
import { toHex } from "viem";
import FormattedDate from "./formatted-date";
import { useNavigate } from "react-router-dom";
import AccountPreview from "./account-preview";

const { sortBy } = arrayUtils;
const { truncateAddress } = ethereumUtils;

const SignerView = ({ signer }) => {
  const signerCreatedApprox = signer?.blockTimestamp * 1000;
  const publicKey = toHex(signer?.signerEventBody?.key);
  const metadata = signer?.signerEventBody?.metadata;
  const parsedMetadata = decodeMetadata(metadata);
  const appFid = Number(parsedMetadata?.[0].requestFid);
  const appData = useUserData(appFid);

  const { signer: currentSigner } = useSigner();

  return (
    <div
      css={css({
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        columnGap: "2rem",
        alignItems: "center",
        justifyContent: "space-between",
      })}
    >
      <div
        style={{
          display: "grid",
          gridAutoRows: "auto",
          rowGap: "0.5rem",
          justifyItems: "start",
        }}
      >
        <div
          css={() =>
            css({
              // textAlign: "left",
            })
          }
        >
          <p>
            <span style={{ fontWeight: "bold" }}>{appData?.displayName}</span>{" "}
            <AccountPreviewPopoverTrigger
              fid={appFid}
              // username={username}
              css={(t) => css({ color: t.colors.textMuted })}
            />
          </p>
        </div>
        <Small>
          {truncateAddress(publicKey)} /{" "}
          <FormattedDate
            value={signerCreatedApprox}
            month="short"
            day="numeric"
            hour="numeric"
            minute="numeric"
          />
        </Small>
      </div>
      <div
        style={{
          display: "grid",
          gridAutoRows: "auto",
          rowGap: "1rem",
          justifyItems: "end",
        }}
      >
        <Button
          size="small"
          danger={true}
          disabled={true}
          style={{ width: "13rem" }}
        >
          Revoke app
        </Button>
        {publicKey == currentSigner?.publicKey && (
          <Button size="small" disabled={true} style={{ width: "13rem" }}>
            Export
          </Button>
        )}
      </div>
    </div>
  );
};

const SignersView = () => {
  const navigate = useNavigate();
  const { fid } = useFarcasterAccount();
  const { signer, broadcasted: isOnchain } = useSigner();

  const userSigners = useUserSigners(fid);

  const sortedSigners = sortBy(
    { value: (s) => s.blockTimestamp, order: "desc" },
    Object.values(userSigners ?? [])
  );

  // todo: import signer?

  // if (!signer || !isOnchain) return <NewSignerView />;

  return (
    <div
      css={(t) =>
        css({
          position: "relative",
          zIndex: 0,
          flex: 1,
          minWidth: "min(30.6rem, 100vw)",
          background: t.colors.backgroundPrimary,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "auto",
          alignItems: "center",
        })
      }
    >
      <div
        css={css({
          display: "grid",
          gridTemplateRows: "auto",
          alignItems: "center",
          justifyContent: "center",
          alignContent: "center",
          textAlign: "center",
          rowGap: "2rem",
          minHeight: "100vh",
          padding: "0 1rem",
          maxWidth: "45rem",
        })}
      >
        <AccountPreview />

        {sortedSigners.length > 0 && (
          <Small>
            This is the list of apps that you have connected to your Farcaster
            account.
          </Small>
        )}

        <div
          style={{ display: "grid", gridTemplateRows: "auto", rowGap: "4rem" }}
        >
          {sortedSigners.map((signer) => (
            <SignerView key={signer?.signerEventBody?.key} signer={signer} />
          ))}
        </div>

        {(!signer || !isOnchain) && (
          <>
            <Small style={{ marginTop: "3rem" }}>
              Your account is{" "}
              <span style={{ fontWeight: "bold" }}>read-only</span>. You can
              still use Farcord for consuming content, but you won&apos;t be
              able to cast or interact with others 🥺
            </Small>

            <div
              css={css({
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                columnGap: "2rem",
              })}
            >
              <Button
                size="medium"
                onClick={() => navigate("/profile/apps/new")}
              >
                Connect Farcord
              </Button>
              <Button size="medium" disabled={true}>
                Import Signer
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SignersView;

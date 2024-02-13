import { css } from "@emotion/react";
import { useEnsName } from "wagmi";
import { ethereum as ethereumUtils } from "@shades/common/utils";
import { useAccountDisplayName } from "@shades/common/ethereum-react";
import Dialog from "@shades/ui-web/dialog";
import Button from "@shades/ui-web/button";
import { Cross as CrossIcon } from "@shades/ui-web/icons";
import { useDelegate } from "../store.js";
import { useNavigate } from "../hooks/navigation.js";
import { useCurrentDynamicQuorum } from "../hooks/dao-contract.js";
import { useWallet } from "../hooks/wallet.js";
import AccountAvatar from "./account-avatar.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import NounAvatar from "./noun-avatar.js";

const AccountDialog = ({ isOpen, close }) => (
  <Dialog
    isOpen={isOpen}
    onRequestClose={() => {
      close();
    }}
    width="38rem"
  >
    {(props) => <Content dismiss={close} {...props} />}
  </Dialog>
);

const Content = ({ titleProps, dismiss }) => {
  const navigate = useNavigate();

  const { address: accountAddress } = useWallet();
  const displayName = useAccountDisplayName(accountAddress);
  const { data: ensName } = useEnsName({ address: accountAddress });
  const truncatedAddress = ethereumUtils.truncateAddress(accountAddress);

  const delegate = useDelegate(accountAddress);
  const currentQuorum = useCurrentDynamicQuorum();

  const nounsRepresented = delegate?.nounsRepresented ?? [];
  const voteCount = nounsRepresented.length;
  const votePowerQuorumPercentage =
    currentQuorum == null
      ? null
      : Math.round((voteCount / currentQuorum) * 1000) / 10;

  return (
    <div>
      <header
        css={(t) =>
          css({
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            borderBottom: "0.1rem solid",
            borderColor: t.colors.borderLight,
            padding: "1.6rem",
            "@media (min-width: 600px)": {
              padding: "2rem",
            },
          })
        }
      >
        <h1
          {...titleProps}
          css={(t) =>
            css({
              flex: 1,
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              gap: "1.6rem",
              fontSize: t.text.sizes.header,
              fontWeight: t.text.weights.header,
              color: t.colors.textHeader,
              lineHeight: 1.3,
            })
          }
        >
          <AccountAvatar
            address={accountAddress}
            size="3.2rem"
            css={css({ margin: "-0.2rem" })}
          />
          <a
            href={`https://etherscan.io/address/${accountAddress}`}
            target="_blank"
            rel="noreferrer"
            css={css({
              color: "inherit",
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              maxHeight: "2.8rem",
              justifyContent: "center",
              "@media(hover: hover)": {
                ":hover [data-name]": { textDecoration: "underline" },
              },
            })}
          >
            <div data-name>{displayName}</div>
            {displayName !== truncatedAddress && (
              <div
                css={(t) =>
                  css({
                    fontSize: t.text.sizes.tiny,
                    fontWeight: "400",
                    color: t.colors.textDimmed,
                  })
                }
              >
                {truncatedAddress}
              </div>
            )}
          </a>
        </h1>
        <Button
          size="small"
          icon={
            <CrossIcon
              style={{ width: "1.5rem", height: "auto", margin: "auto" }}
            />
          }
          onClick={dismiss}
        />
      </header>
      <main
        css={css({
          padding: "1.6rem",
          "@media (min-width: 600px)": {
            padding: "2rem",
          },
        })}
      >
        <dl
          css={(t) =>
            css({
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) auto",
              gap: "1rem 1.6rem",
              dt: { fontWeight: t.text.weights.emphasis },
              dd: { textAlign: "right" },
              "dd[data-block]": {
                textAlign: "left",
                gridColumn: "span 2",
                paddingLeft: "1rem",
                paddingBottom: "1.6rem",
              },
            })
          }
        >
          <dt>Voting power</dt>
          <dd>
            {voteCount} {voteCount === 1 ? "vote" : "votes"}
            {voteCount !== 0 && (
              <>
                {votePowerQuorumPercentage == null ? (
                  <div style={{ paddingTop: "0.3rem" }}>
                    <div
                      css={(t) =>
                        css({
                          height: "1.8rem",
                          width: "11rem",
                          background: t.colors.backgroundModifierHover,
                          borderRadius: "0.3rem",
                        })
                      }
                    />
                  </div>
                ) : (
                  <div>{votePowerQuorumPercentage}% of quorum</div>
                )}
              </>
            )}
          </dd>
          {voteCount > 0 && (
            <>
              <dt>Nouns represented</dt>
              <dd data-block>
                <NounList items={nounsRepresented} />
              </dd>
            </>
          )}
        </dl>
      </main>

      <footer
        css={css({
          display: "flex",
          justifyContent: "flex-end",
          gap: "1rem",
          padding: "0 1.6rem 1.6rem",
          "@media (min-width: 600px)": {
            padding: "0 2rem 2rem",
          },
        })}
      >
        <Button
          onClick={() => {
            dismiss();
          }}
        >
          Close
        </Button>
        <Button
          onClick={() => {
            dismiss();
            navigate(`/campers/${ensName ?? accountAddress}`);
          }}
        >
          View account page
        </Button>
      </footer>
    </div>
  );
};

const NounList = ({ items }) => (
  <ul
    css={(t) =>
      css({
        listStyle: "none",
        display: "flex",
        flexDirection: "column",
        gap: "0.8rem",
        li: {
          display: "flex",
          gap: "0.8rem",
          em: { fontStyle: "normal", fontWeight: t.text.weights.emphasis },
          "[data-content]": { padding: "0.2rem 0" },
        },
      })
    }
  >
    {items.map((n) => (
      <li key={n.id}>
        <NounAvatar id={n.id} size="2.4rem" />
        <div data-content>
          Noun <em>{n.id}</em>
          {n.delegateId.toLowerCase() !== n.ownerId.toLowerCase() && (
            <>
              {" "}
              delegated from{" "}
              <AccountPreviewPopoverTrigger accountAddress={n.ownerId} />
            </>
          )}
        </div>
      </li>
    ))}
  </ul>
);

export default AccountDialog;

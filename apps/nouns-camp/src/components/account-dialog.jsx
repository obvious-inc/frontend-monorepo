import { getAddress as checksumEncodeAddress } from "viem";
import { css } from "@emotion/react";
import { ethereum as ethereumUtils } from "@shades/common/utils";
import Dialog from "@shades/ui-web/dialog";
import Button from "@shades/ui-web/button";
import { Cross as CrossIcon } from "@shades/ui-web/icons";
import { useAccount, useDelegate } from "@/store";
import { useNavigate } from "@/hooks/navigation";
import { useCurrentDynamicQuorum } from "@/hooks/dao-contract";
import { useWallet } from "@/hooks/wallet";
import { useState as useSessionState } from "@/session-provider";
import { useDialog } from "@/hooks/global-dialogs";
import useEnsName from "@/hooks/ens-name";
import useAccountDisplayName from "@/hooks/account-display-name";
import AccountAvatar from "@/components/account-avatar";
import AccountPreviewPopoverTrigger from "@/components/account-preview-popover-trigger";
import NounPreviewPopoverTrigger from "@/components/noun-preview-popover-trigger";
import NounAvatar from "@/components/noun-avatar";
import { buildEtherscanLink } from "@/utils/etherscan";

const AccountDialog = ({ isOpen, close }) => (
  <Dialog
    isOpen={isOpen}
    onRequestClose={() => {
      close();
    }}
    width="44rem"
  >
    {(props) => <Content dismiss={close} {...props} />}
  </Dialog>
);

const Content = ({ titleProps, dismiss }) => {
  const navigate = useNavigate();

  const { address: connectedAccountAddress } = useWallet();
  const { address: loggedInAccountAddress } = useSessionState();
  const accountAddress = connectedAccountAddress ?? loggedInAccountAddress;

  const displayName = useAccountDisplayName(accountAddress);
  const ensName = useEnsName(accountAddress);
  const truncatedAddress = ethereumUtils.truncateAddress(
    checksumEncodeAddress(accountAddress),
  );

  const { open: openProfileEditDialog } = useDialog("profile-edit");

  const account = useAccount(accountAddress);
  const delegate = useDelegate(accountAddress);
  const currentQuorum = useCurrentDynamicQuorum();

  const hasNouns = account?.nouns != null && account.nouns.length > 0;
  const nounsRepresented = delegate?.nounsRepresented ?? [];
  const nounsDelegatedToAccount = nounsRepresented.filter(
    (n) => n.ownerId.toLowerCase() !== accountAddress,
  );
  const voteCount = nounsRepresented.length;
  const votePowerQuorumPercentage =
    currentQuorum == null
      ? null
      : Math.round((voteCount / currentQuorum) * 1000) / 10;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      <header
        css={(t) =>
          css({
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            borderBottom: "0.1rem solid",
            borderColor: t.colors.borderLighter,
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
            href={buildEtherscanLink(`/address/${accountAddress}`)}
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
                    fontSize: t.text.sizes.small,
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
          flex: 1,
          minHeight: 0,
          overflow: "auto",
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
          <dt style={{ padding: "0 0 1.6rem" }}>Voting power</dt>
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
          {hasNouns && (
            <>
              <dt>Your nouns</dt>
              <dd data-block>
                <NounList
                  contextAccount={accountAddress}
                  items={account.nouns}
                />
              </dd>
            </>
          )}
          {nounsDelegatedToAccount.length > 0 && (
            <>
              <dt>Nouns delegated to you</dt>
              <dd data-block>
                <NounList
                  contextAccount={accountAddress}
                  items={nounsDelegatedToAccount}
                />
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
        {ensName != null && (
          <Button
            onClick={() => {
              dismiss();
              openProfileEditDialog();
            }}
          >
            Edit profile
          </Button>
        )}
        <Button
          onClick={() => {
            dismiss();
            navigate(`/voters/${ensName ?? accountAddress}`);
          }}
        >
          Public account page
        </Button>
      </footer>
    </div>
  );
};

export const NounList = ({ contextAccount, items }) => {
  return (
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
      {items.map((n) => {
        const isOwned =
          contextAccount != null &&
          n.ownerId.toLowerCase() === contextAccount.toLowerCase();
        const isDelegated =
          n.delegateId.toLowerCase() !== n.ownerId.toLowerCase();
        return (
          <li key={n.id}>
            <NounAvatar id={n.id} size="2.4rem" />
            <div data-content>
              <NounPreviewPopoverTrigger
                nounId={n.id}
                contextAccount={contextAccount}
              >
                <button
                  css={(t) =>
                    css({
                      outline: "none",
                      fontWeight: t.text.weights.emphasis,
                      "@media(hover: hover)": {
                        cursor: "pointer",
                        ":hover": { textDecoration: "underline" },
                      },
                    })
                  }
                >
                  Noun {n.id}
                </button>
              </NounPreviewPopoverTrigger>
              {isDelegated && (
                <>
                  {" "}
                  delegated {isOwned ? "to" : "from"}{" "}
                  <AccountPreviewPopoverTrigger
                    accountAddress={isOwned ? n.delegateId : n.ownerId}
                  />
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default AccountDialog;

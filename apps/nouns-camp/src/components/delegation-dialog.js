import React from "react";
import { css } from "@emotion/react";
import { isAddress } from "viem";
import Dialog from "@shades/ui-web/dialog";
import DialogHeader from "@shades/ui-web/dialog-header";
import Button from "@shades/ui-web/button";
import Spinner from "@shades/ui-web/spinner";
import {
  useAccount,
  useDelegate,
  useAccountFetch,
  useDelegateFetch,
} from "../store.js";
import useEnsAddress from "../hooks/ens-address.js";
import { useWallet } from "../hooks/wallet.js";
import { useDialog } from "../hooks/global-dialogs.js";
import { useSetDelegate } from "../hooks/token-contract.js";
import AddressInput from "./address-input.js";
import { NounList } from "./account-dialog.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import Callout from "./callout.js";

const DelegationDialog = ({ isOpen, close }) => {
  const { data } = useDialog("delegation");
  const targetAddress = data?.target;

  return (
    <Dialog
      isOpen={isOpen}
      onRequestClose={() => {
        close();
      }}
      width="44rem"
    >
      {(props) => (
        <Content
          key={targetAddress}
          dismiss={close}
          targetAddress={targetAddress}
          {...props}
        />
      )}
    </Dialog>
  );
};

const Content = ({ targetAddress, titleProps, dismiss }) => {
  const { address: accountAddress } = useWallet();

  const account = useAccount(accountAddress);
  const delegate = useDelegate(accountAddress);

  useAccountFetch(accountAddress, { fetchInterval: 3_000 });
  useDelegateFetch(accountAddress, { fetchInterval: 3_000 });

  const [accountQuery, setAccountQuery] = React.useState(targetAddress ?? "");
  const [hasPendingUpdate, setPendingUpdate] = React.useState(false);
  const [hasPendingClear, setPendingClear] = React.useState(false);
  const [submittedSuccessfulTransaction, setSuccessfulTransaction] =
    React.useState(false);

  const ensAddress = useEnsAddress(accountQuery.trim(), {
    enabled: accountQuery.trim().split("."),
  });

  const nounsRepresented = delegate?.nounsRepresented ?? [];
  const votingPower = nounsRepresented.length;

  const nounCount = account?.nouns?.length;
  const hasNouns = nounCount > 0;
  const isDelegating =
    hasNouns &&
    account?.delegate.id != null &&
    account.delegate.id !== accountAddress;
  const showClearDelegationButton = isDelegating && targetAddress == null;
  const showHeaderDismissButton = !hasNouns || showClearDelegationButton;

  const queryAccountAddress = isAddress(accountQuery)
    ? accountQuery
    : ensAddress;

  const setDelegate = useSetDelegate(queryAccountAddress);
  const clearDelegate = useSetDelegate(accountAddress);

  const hasChanges =
    queryAccountAddress != null &&
    queryAccountAddress.toLowerCase() !== account?.delegate.id;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessfulTransaction(false);
    setPendingUpdate(true);
    try {
      await setDelegate();
      setAccountQuery("");
      setSuccessfulTransaction(true);
    } catch (e) {
      console.error(e);
      alert("Ops, looks like something went wrong!");
    } finally {
      setPendingUpdate(false);
    }
  };

  if (account == null)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "18.3rem",
          gap: "1.6rem",
        }}
      >
        <Spinner />
      </div>
    );

  return (
    <div
      css={css({
        padding: "1.6rem",
        "@media (min-width: 600px)": {
          padding: "2rem",
        },
      })}
    >
      <DialogHeader
        title={hasNouns ? "Delegate votes" : "Delegation"}
        titleProps={titleProps}
        dismiss={showHeaderDismissButton ? dismiss : null}
      />
      <main
        css={(t) =>
          css({
            h2: {
              fontSize: "inherit",
              fontWeight: t.text.weights.emphasis,
            },
          })
        }
      >
        {submittedSuccessfulTransaction && (
          <Callout variant="info" style={{ margin: "0 0 2rem" }}>
            Transaction successful!
          </Callout>
        )}
        {!hasNouns ? (
          <>
            <p>You don’t have any nouns to delegate.</p>
            {votingPower > 0 && (
              <>
                <h2 style={{ margin: "2rem 0 1rem" }}>Current delegation</h2>
                <div style={{ padding: "0 0 1rem 1rem" }}>
                  <NounList items={nounsRepresented} />
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <p>
              {isDelegating ? (
                <>
                  Currently delegating {nounCount}{" "}
                  {nounCount === 1 ? "vote" : "votes"} to{" "}
                  <AccountPreviewPopoverTrigger
                    showAvatar
                    accountAddress={account.delegate.id}
                  />
                </>
              ) : (
                <>
                  You have {nounCount} {nounCount === 1 ? "vote" : "votes"} to{" "}
                  delegate.
                </>
              )}
            </p>

            <form
              id="delegate-form"
              onSubmit={handleSubmit}
              style={{ marginTop: "1.6rem" }}
            >
              <AddressInput
                label={isDelegating ? "New delegate" : "Delegate to"}
                value={accountQuery}
                onChange={(maybeAddress) => {
                  setSuccessfulTransaction(false);
                  setAccountQuery(maybeAddress);
                }}
                disabled={hasPendingUpdate || hasPendingClear}
                placeholder="0x..., vitalik.eth"
                hint={
                  !isAddress(accountQuery)
                    ? "Specify an Ethereum account address or ENS name"
                    : null
                }
              />
            </form>
          </>
        )}
      </main>
      {hasNouns && (
        <footer
          css={css({
            display: "flex",
            justifyContent: "flex-end",
            gap: "1rem",
            padding: "2rem 0 0",
          })}
        >
          {!showHeaderDismissButton && (
            <Button
              onClick={() => {
                dismiss();
              }}
            >
              Close
            </Button>
          )}
          {showClearDelegationButton && (
            <Button
              danger
              onClick={async () => {
                setPendingClear(true);
                setSuccessfulTransaction(false);
                try {
                  await clearDelegate();
                  setSuccessfulTransaction(true);
                } catch (e) {
                  console.error(e);
                  alert("Ops, looks like something went wrong!");
                } finally {
                  setPendingClear(false);
                }
              }}
              disabled={
                hasPendingClear || hasPendingUpdate || clearDelegate == null
              }
              isLoading={hasPendingClear}
            >
              Clear delegation
            </Button>
          )}
          <Button
            form="delegate-form"
            type="submit"
            variant="primary"
            disabled={
              !hasChanges ||
              hasPendingUpdate ||
              hasPendingClear ||
              setDelegate == null
            }
            isLoading={hasPendingUpdate}
          >
            {isDelegating
              ? "Update delegation"
              : `Delegate ${nounCount === 1 ? "vote" : `${nounCount} votes`}`}
          </Button>
        </footer>
      )}
    </div>
  );
};

export default DelegationDialog;

import React from "react";
import { css } from "@emotion/react";
import Dialog from "@shades/ui-web/dialog";
import DialogHeader from "@shades/ui-web/dialog-header";
import Spinner from "@shades/ui-web/spinner";
import NextLink from "next/link";
import Button from "@shades/ui-web/button";
import Input from "@shades/ui-web/input";
import {
  useStreamData,
  useStreamsRemainingBalances,
  useStreamWithdraw,
} from "../hooks/stream-contract";
import { resolveIdentifier } from "../contracts";
import { FormattedEthWithConditionalTooltip } from "./transaction-list";
import { useWallet } from "../hooks/wallet";
import { useAccountStreams, useProposal } from "../store";
import Link from "@shades/ui-web/link";
import { formatUnits, parseUnits } from "viem";
import { useQueryClient } from "@tanstack/react-query";
import Tag from "./tag";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip";
import Callout from "./callout";
import { buildEtherscanLink } from "../utils/etherscan";
import { CaretDown as CaretDownIcon } from "@shades/ui-web/icons";

const StreamsDialog = ({ isOpen, close }) => {
  const { address: connectedWalletAccountAddress } = useWallet();
  const accountStreams = useAccountStreams(connectedWalletAccountAddress);

  const sortedStreams = accountStreams.sort((a, b) => {
    return Number(b.proposalId) - Number(a.proposalId);
  });

  return (
    <Dialog
      isOpen={isOpen}
      onRequestClose={() => {
        close();
      }}
      width="60rem"
    >
      {(props) =>
        accountStreams == null ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "20rem",
            }}
          >
            <Spinner />
          </div>
        ) : (
          <Content dismiss={close} streams={sortedStreams} {...props} />
        )
      }
    </Dialog>
  );
};

const StreamStatusTag = ({
  startTime,
  stopTime,
  elapsedTime,
  canceledBalance,
  remainingBalance,
}) => {
  const streamState = React.useMemo(() => {
    if (!startTime) return;
    if (canceledBalance > 0) return "canceled";
    if (remainingBalance == 0) return "done";
    if (remainingBalance > 0 && elapsedTime >= stopTime - startTime)
      return "vested";

    if (new Date(Number(startTime) * 1000) > new Date()) return "pending";

    return "active";
  }, [elapsedTime, stopTime, startTime, canceledBalance, remainingBalance]);

  const variantByState = React.useMemo(
    () => ({
      active: "active",
      pending: "warning",
      vested: "special",
      done: "success",
      canceled: "error",
    }),
    [],
  );

  return (
    <Tag size="large" variant={variantByState[streamState]}>
      {streamState}
    </Tag>
  );
};

const StaticField = ({ label, children }) => {
  return (
    <div>
      <label
        css={(t) =>
          css({
            display: "inline-block",
            color: t.colors.textDimmed,
            fontSize: t.text.sizes.base,
            lineHeight: 1.2,
            margin: "0 0 0.8rem",
          })
        }
      >
        {label}
      </label>
      <div>{children}</div>
    </div>
  );
};

const StreamWithdrawForm = ({ stream }) => {
  const queryClient = useQueryClient();
  const proposal = useProposal(stream.proposalId);

  const proposalTitle =
    proposal?.title == null
      ? `${proposal.id}`
      : `${proposal.id}: ${proposal.title}`;

  const { streamContractAddress } = stream;
  const usdcTokenContract = resolveIdentifier("usdc-token")?.address;
  const wethTokenContract = resolveIdentifier("weth-token")?.address;

  const [hasPendingUpdate, setPendingUpdate] = React.useState(false);
  const [submittedSuccessfulTransaction, setSuccessfulTransaction] =
    React.useState(false);
  const [withdrawAmount, setWithdrawAmount] = React.useState(0);

  const { token, recipientBalance, queryKey } = useStreamData({
    streamContractAddress,
  });

  const parsedWithdrawAmount = () => {
    if (!token || !withdrawAmount) return 0;
    switch (token.toLowerCase()) {
      case wethTokenContract:
        return parseUnits(withdrawAmount, 18);
      case usdcTokenContract:
        return parseUnits(withdrawAmount, 6);
      default:
        throw new Error("Unsupported token", token);
    }
  };

  const formatInputAmount = (amount) => {
    if (!token || !amount) return 0;
    switch (token.toLowerCase()) {
      case wethTokenContract:
        return formatUnits(amount, 18);
      case usdcTokenContract:
        return formatUnits(amount, 6);
      default:
        throw new Error("Unsupported token", token);
    }
  };

  const streamWithdraw = useStreamWithdraw(
    streamContractAddress,
    parsedWithdrawAmount(),
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPendingUpdate(true);
    setSuccessfulTransaction(false);
    try {
      await streamWithdraw();
      setSuccessfulTransaction(true);

      // invalidate query key
      queryClient.invalidateQueries({ queryKey });
    } catch (e) {
      console.error(e);
      alert("Ops, looks like something went wrong!");
    } finally {
      setPendingUpdate(false);
    }
  };

  return (
    <div>
      <form
        id={`withdraw-form-${streamContractAddress}`}
        onSubmit={handleSubmit}
        css={css({
          display: "grid",
          gridTemplateColumns: "repeat(2, auto) 25%",
          rowGap: "1.6rem",
          columnGap: "2rem",
          position: "relative",
        })}
      >
        <StaticField label="Stream">
          <a
            href={buildEtherscanLink(`/address/${streamContractAddress}`)}
            target="_blank"
            rel="noreferrer"
            css={(t) =>
              css({
                color: `${t.colors.textNormal} !important`,
                textOverflow: "ellipsis",
              })
            }
          >
            {proposalTitle}
          </a>
        </StaticField>

        <StaticField label="Available to withdraw">
          <FormattedAmount
            amount={recipientBalance}
            token={token}
            hasMaxButton={recipientBalance > 0 ? true : false}
            handleMaxButtonClick={() =>
              setWithdrawAmount(formatInputAmount(recipientBalance))
            }
          />
        </StaticField>

        <Input
          label="Amount to withdraw"
          type="number"
          value={withdrawAmount}
          disabled={hasPendingUpdate}
          onChange={(e) => {
            setWithdrawAmount(e.target.value);
          }}
        />
      </form>

      <footer
        css={css({
          display: "flex",
          justifyContent: "flex-end",
          gap: "1rem",
          padding: "2rem 0 2rem",
        })}
      >
        <Button
          form={`withdraw-form-${streamContractAddress}`}
          type="submit"
          variant="primary"
          disabled={hasPendingUpdate || streamWithdraw == null}
          isLoading={hasPendingUpdate}
        >
          Withdraw
        </Button>
      </footer>
      {submittedSuccessfulTransaction && (
        <Callout variant="info" style={{ margin: "0 0 2rem" }}>
          Transaction successful!
        </Callout>
      )}
    </div>
  );
};

const Stream = ({ stream }) => {
  const { streamContractAddress, tokenAmount } = stream;
  const {
    token,
    startTime,
    stopTime,
    elapsedTime,
    remainingBalance,
    recipientBalance,
    recipientCancelBalance,
  } = useStreamData({
    streamContractAddress,
  });

  return (
    <div data-row>
      <Link
        underline
        component={NextLink}
        href={`/proposals/${stream.proposalId}`}
      >
        {stream.proposalId}
      </Link>

      <StreamStatusTag
        startTime={startTime}
        stopTime={stopTime}
        elapsedTime={elapsedTime}
        totalBalance={tokenAmount}
        remainingBalance={remainingBalance}
        activeBalance={recipientBalance}
        canceledBalance={recipientCancelBalance}
        css={css({ justifySelf: "center" })}
      />

      <div css={css({ justifySelf: "end" })}>
        {stopTime && (
          <FormattedDateWithTooltip
            disableRelative
            disableTooltip
            month="short"
            day="numeric"
            year="numeric"
            value={Number(stopTime) * 1000}
          />
        )}
      </div>

      <div css={css({ justifySelf: "end" })}>
        <FormattedAmount amount={tokenAmount} token={token} />
      </div>

      <div css={css({ justifySelf: "end" })}>
        <FormattedAmount amount={remainingBalance} token={token} />
      </div>

      <div css={css({ justifySelf: "end" })}>
        <FormattedAmount amount={recipientBalance} token={token} />
      </div>
    </div>
  );
};

const Content = ({ streams, titleProps, dismiss }) => {
  const [showFullStreamHistory, setShowFullStreamHistory] =
    React.useState(false);

  const streamAddresses = streams.map((stream) => stream.streamContractAddress);
  const remainingBalances = useStreamsRemainingBalances(streamAddresses);

  const activeStreams = streams.filter((_, index) => {
    const streamInfo = remainingBalances[index];
    const remainingBalance = streamInfo?.remainingBalance;
    const recipientBalance = streamInfo?.recipientBalance;
    return remainingBalance > 0 || recipientBalance > 0;
  });

  return (
    <div
      css={(t) =>
        css({
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          a: {
            color: t.colors.textDimmed,
            textDecoration: "none",
            "@media(hover: hover)": {
              ":hover": { textDecoration: "underline", color: "inherit" },
            },
          },
          "[data-label-row]": {
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(auto, 0.5fr)) repeat(4, 1fr)",
            marginBottom: "1rem",
            fontSize: t.text.sizes.small,
            color: t.colors.textDimmed,
          },
          "[data-row]": {
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(auto, 0.5fr)) repeat(4, 1fr)",
            alignItems: "center",
            marginBottom: "0.5rem",
            fontSize: t.text.sizes.small,
          },
        })
      }
    >
      <DialogHeader
        title="Streams"
        titleProps={titleProps}
        dismiss={dismiss}
        css={css({
          margin: "0",
          padding: "1.5rem",
          "@media (min-width: 600px)": {
            margin: "0",
            padding: "2rem",
          },
        })}
      />
      <main
        css={css({
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          padding: "0.5rem 1.5rem 1.5rem",
          "@media (min-width: 600px)": {
            padding: "0 2rem 2rem",
          },
        })}
      >
        <Heading>Active</Heading>
        {activeStreams?.length > 0 ? (
          activeStreams.map((stream) => (
            <StreamWithdrawForm
              key={stream.streamContractAddress}
              stream={stream}
            />
          ))
        ) : (
          <div css={css({ marginBottom: "2rem" })}>
            <p>No active streams</p>
          </div>
        )}

        <button
          onClick={() => setShowFullStreamHistory((s) => !s)}
          css={(t) =>
            css({
              display: "block",
              fontSize: t.text.sizes.small,
              color: t.colors.textDimmed,
              "@media(hover: hover)": {
                cursor: "pointer",
              },
            })
          }
        >
          <Heading>
            All{" "}
            <span>
              <CaretDownIcon
                style={{
                  display: "inline-flex",
                  width: "0.7em",
                  transform: showFullStreamHistory
                    ? "scaleY(-1)"
                    : "translateY(1px)",
                }}
              />
            </span>
          </Heading>
        </button>

        {showFullStreamHistory && (
          <div>
            <div data-label-row>
              <p>Proposal</p>
              <p css={css({ justifySelf: "center" })}>Status</p>
              <p css={css({ justifySelf: "end" })}>End date</p>
              <p css={css({ justifySelf: "end" })}>Total</p>
              <p css={css({ justifySelf: "end" })}>Remaining</p>
              <p css={css({ justifySelf: "end" })}>Available</p>
            </div>
            {streams.map((stream) => (
              <Stream key={stream.streamContractAddress} stream={stream} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

const Heading = (props) => (
  <h2
    css={(t) =>
      css({
        textTransform: "uppercase",
        fontSize: t.text.sizes.small,
        fontWeight: t.text.weights.emphasis,
        color: t.colors.textDimmed,
        margin: "0 0 1rem",
        "* + &": { marginTop: "2.8rem" },
      })
    }
    {...props}
  />
);

const FormattedAmount = React.memo(
  ({ amount = 0, token, hasMaxButton, handleMaxButtonClick }) => {
    const usdcTokenContract = resolveIdentifier("usdc-token")?.address;
    const wethTokenContract = resolveIdentifier("weth-token")?.address;

    const formattedAmount = React.useCallback(
      (amount) => {
        if (!token) return null;

        switch (token?.toLowerCase()) {
          case wethTokenContract:
            return (
              <FormattedEthWithConditionalTooltip
                value={Number(amount)}
                tokenSymbol="WETH"
              />
            );
          case usdcTokenContract:
            return (
              <FormattedEthWithConditionalTooltip
                value={Number(amount)}
                currency="usdc"
                decimals={2}
                truncationDots={false}
                tokenSymbol="USDC"
                localeFormatting
              />
            );
          default:
            throw new Error("Unsupported token", token);
        }
      },
      [token, wethTokenContract, usdcTokenContract],
    );

    if (hasMaxButton) {
      return (
        <div
          css={css({
            display: "grid",
            gridTemplateColumns: "auto auto",
            gap: "1rem",
            justifyContent: "start",
          })}
        >
          <>{formattedAmount(amount)}</>
          <Button
            type="button"
            size="tiny"
            onClick={handleMaxButtonClick}
            css={(t) =>
              css({
                color: t.colors.textDimmed,
              })
            }
          >
            max
          </Button>
        </div>
      );
    }

    return formattedAmount(amount);
  },
);

export default StreamsDialog;

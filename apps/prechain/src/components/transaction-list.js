import datesDifferenceInMonths from "date-fns/differenceInCalendarMonths";
import { formatEther, formatUnits } from "viem";
import React from "react";
import { css } from "@emotion/react";
import { ethereum as ethereumUtils } from "@shades/common/utils";
import { useAccountDisplayName } from "@shades/common/app";
import * as Tooltip from "@shades/ui-web/tooltip";
import useDecodedFunctionData from "../hooks/decoded-function-data.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";
import {
  DAO_PAYER_CONTRACT,
  DAO_TOKEN_BUYER_CONTRACT,
  WETH_TOKEN_CONTRACT_ADDRESS,
  useContract,
} from "../contracts.js";

const decimalsByCurrency = {
  ETH: 18,
  WETH: 18,
  USDC: 6,
};

const createEtherscanAddressUrl = (address) =>
  `https://etherscan.io/address/${address}`;

const useEnhancedParsedTransaction = (transaction) => {
  const { type, target, calldata, value } = transaction;
  const isUnparsed = [
    "unparsed-function-call",
    "unparsed-payable-function-call",
  ].includes(type);

  const decodedFunctionData = useDecodedFunctionData(
    { target, calldata },
    { enabled: isUnparsed }
  );

  if (decodedFunctionData == null) return transaction;

  const enhancedType = [
    decodedFunctionData.proxy ? "proxied" : null,
    type === "unparsed-payable-function-call" ? "payable" : null,
    "function-call",
  ]
    .filter(Boolean)
    .join("-");

  return {
    target,
    proxyImplementationAddress: decodedFunctionData.proxyImplementationAddress,
    type: enhancedType,
    functionName: decodedFunctionData.name,
    functionInputs: decodedFunctionData.inputs,
    value,
  };
};

const TransactionList = ({ transactions }) => (
  <ol
    data-count={transactions.length}
    css={(t) =>
      css({
        margin: 0,
        padding: 0,
        fontSize: t.text.sizes.base,
        li: { listStyle: "none" },
        '&:not([data-count="1"])': {
          paddingLeft: "2rem",
          li: { listStyle: "decimal" },
        },
        "li + li": { marginTop: "1.5rem" },
        "li:has(pre code) + li": {
          marginTop: "2.6rem",
        },
        "pre:has(code)": {
          marginTop: "0.8rem",
        },
      })
    }
  >
    {transactions.map((t, i) => (
      <li key={i}>
        <ListItem transaction={t} />
      </li>
    ))}
  </ol>
);

const ListItem = ({ transaction }) => {
  const t = useEnhancedParsedTransaction(transaction);

  const renderCode = () => {
    switch (t.type) {
      case "function-call":
      case "payable-function-call":
      case "proxied-function-call":
      case "proxied-payable-function-call":
        return (
          <Code block>
            <AddressDisplayNameWithTooltip address={t.target} data-identifier>
              {ethereumUtils.truncateAddress(t.target)}
              {/* contract */}
            </AddressDisplayNameWithTooltip>
            .
            <Tooltip.Root
              // Disable the tooltip if the function lack arguments
              open={t.functionInputs.length === 0 ? false : undefined}
            >
              <Tooltip.Trigger asChild>
                <span data-function-name>{t.functionName}</span>
              </Tooltip.Trigger>
              <Tooltip.Content side="top" sideOffset={6}>
                <Code>
                  {t.functionName}(
                  {t.functionInputs.map((i) => i.type).join(", ")})
                </Code>
              </Tooltip.Content>
            </Tooltip.Root>
            (
            {(t.functionInputs.length > 0 || t.value > 0) && (
              <>
                <br />
                {t.functionInputs.map((input, i, inputs) => (
                  <React.Fragment key={i}>
                    &nbsp;&nbsp;
                    {Array.isArray(input.value) ? (
                      <>
                        [
                        {input.value.map((item, i, items) => (
                          <React.Fragment key={item.toString()}>
                            <span data-argument>
                              {input.type === "address[]" ? (
                                <a
                                  href={createEtherscanAddressUrl(item)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {item}
                                </a>
                              ) : (
                                item.toString()
                              )}
                            </span>
                            {i < items.length - 1 && <>, </>}
                          </React.Fragment>
                        ))}
                        ]
                      </>
                    ) : (
                      <span data-argument>
                        {input.type === "address" ? (
                          <a
                            href={createEtherscanAddressUrl(input.value)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {input.value}
                          </a>
                        ) : (
                          input.value.toString()
                        )}
                      </span>
                    )}
                    {(i !== inputs.length - 1 || t.value > 0) && (
                      <>
                        ,<br />
                      </>
                    )}
                  </React.Fragment>
                ))}
                {t.value > 0 && (
                  <span data-argument>{formatEther(t.value)} ETH</span>
                )}
                <br />
              </>
            )}
            )
          </Code>
        );

      case "unparsed-function-call":
      case "unparsed-payable-function-call":
        return (
          <Code block>
            <span data-identifier>contract</span>:{" "}
            <span data-argument>{t.target}</span>
            <br />
            <span data-identifier>calldata</span>:{" "}
            <span data-argument>{t.calldata}</span>
            {t.value > 0 && (
              <>
                <br />
                <span data-identifier>ETH</span>:{" "}
                <span data-argument>{formatEther(t.value)}</span>
              </>
            )}
          </Code>
        );

      case "transfer":
      case "weth-transfer":
      case "usdc-transfer-via-payer":
      case "weth-deposit":
      case "weth-stream-funding":
      case "usdc-stream-funding-via-payer":
      case "token-buyer-top-up":
      case "stream":
        return null;

      default:
        throw new Error(`Unknown transaction type: "${t.type}"`);
    }
  };

  const explanation = <TransactionExplanation transaction={t} />;

  return (
    <>
      <div
        css={(t) =>
          css({
            a: { color: t.colors.textDimmed },
            em: {
              color: t.colors.textDimmed,
              fontStyle: "normal",
              fontWeight: t.text.weights.emphasis,
            },
          })
        }
      >
        {explanation}
      </div>
      {renderCode()}
      {t.type === "unparsed-function-call" && (
        <div
          css={(t) =>
            css({
              fontSize: t.text.sizes.small,
              color: t.colors.textDimmed,
              marginTop: "0.8rem",
            })
          }
        >
          Displaying the raw calldata as the contract ABI cound not be fetched
          from Etherscan.
        </div>
      )}
      {t.type === "proxied-function-call" && (
        <div
          css={(t) =>
            css({
              a: { color: "currentcolor" },
              fontSize: t.text.sizes.small,
              color: t.colors.textDimmed,
              marginTop: "0.8rem",
            })
          }
        >
          Implementation contract at{" "}
          <AddressDisplayNameWithTooltip
            address={t.proxyImplementationAddress}
          />
        </div>
      )}
      {t.type === "token-buyer-top-up" && (
        <div
          css={(t) =>
            css({
              a: { color: "currentcolor" },
              fontSize: t.text.sizes.small,
              color: t.colors.textDimmed,
              marginTop: "0.2rem",
            })
          }
        >
          This transaction refills USDC to the{" "}
          <AddressDisplayNameWithTooltip address={DAO_PAYER_CONTRACT} />{" "}
          contract via the{" "}
          <AddressDisplayNameWithTooltip address={DAO_TOKEN_BUYER_CONTRACT} /> (
          <FormattedEthWithConditionalTooltip value={t.value} />
          ).
        </div>
      )}
      {t.type === "usdc-stream-funding-via-payer" && (
        <div
          css={(t) =>
            css({
              a: { color: "currentcolor" },
              fontSize: t.text.sizes.small,
              color: t.colors.textDimmed,
              marginTop: "0.2rem",
            })
          }
        >
          This transaction funds the stream with the required amount via the{" "}
          <AddressDisplayNameWithTooltip address={DAO_PAYER_CONTRACT} />.
        </div>
      )}

      {t.type === "weth-stream-funding" && (
        <div
          css={(t) =>
            css({
              a: { color: "currentcolor" },
              fontSize: t.text.sizes.small,
              color: t.colors.textDimmed,
              marginTop: "0.2rem",
            })
          }
        >
          This transaction funds the stream with the required amount via the{" "}
          <AddressDisplayNameWithTooltip
            address={WETH_TOKEN_CONTRACT_ADDRESS}
          />
          .
        </div>
      )}
    </>
  );
};

export const TransactionExplanation = ({ transaction: t }) => {
  switch (t.type) {
    case "transfer":
      return (
        <>
          Transfer{" "}
          <em>
            <FormattedEthWithConditionalTooltip value={t.value} />
          </em>{" "}
          to{" "}
          <em>
            <AddressDisplayNameWithTooltip address={t.target} />
          </em>
        </>
      );

    case "weth-transfer":
      return (
        <>
          Transfer{" "}
          <em>
            <FormattedEthWithConditionalTooltip
              value={t.value}
              tokenSymbol="WETH"
            />
          </em>{" "}
          to{" "}
          <em>
            <AddressDisplayNameWithTooltip address={t.target} />
          </em>
        </>
      );

    case "usdc-transfer-via-payer":
      return (
        <>
          Transfer{" "}
          <em>{parseFloat(formatUnits(t.value, 6)).toLocaleString()} USDC</em>{" "}
          to{" "}
          <em>
            <AddressDisplayNameWithTooltip address={t.target} />
          </em>
        </>
      );

    case "weth-deposit":
      return (
        <>
          Deposit{" "}
          <em>
            <FormattedEthWithConditionalTooltip value={t.value} />
          </em>{" "}
          to the{" "}
          <em>
            <AddressDisplayNameWithTooltip
              address={WETH_TOKEN_CONTRACT_ADDRESS}
            />
          </em>
        </>
      );

    case "token-buyer-top-up":
      return (
        <>
          Top up the{" "}
          <em>
            <AddressDisplayNameWithTooltip address={DAO_TOKEN_BUYER_CONTRACT} />
          </em>
        </>
      );

    case "stream": {
      const formattedUnits = formatUnits(
        t.tokenAmount,
        decimalsByCurrency[t.token]
      );
      // TODO: handle unknown token contract
      return (
        <>
          Stream{" "}
          {t.token != null && (
            <>
              <em>
                {t.token === "USDC"
                  ? parseFloat(formattedUnits).toLocaleString()
                  : formattedUnits}{" "}
                {t.token}
              </em>{" "}
            </>
          )}
          to{" "}
          <em>
            <AddressDisplayNameWithTooltip address={t.receiverAddress} />
          </em>{" "}
          between{" "}
          <FormattedDateWithTooltip
            disableRelative
            day="numeric"
            month="short"
            year="numeric"
            value={t.startDate}
          />{" "}
          and{" "}
          <FormattedDateWithTooltip
            disableRelative
            day="numeric"
            month="short"
            year="numeric"
            value={t.endDate}
          />{" "}
          ({datesDifferenceInMonths(t.endDate, t.startDate)} months)
        </>
      );
    }

    case "usdc-stream-funding-via-payer":
    case "weth-stream-funding":
      return (
        <>
          Fund the{" "}
          <em>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <a
                  href={createEtherscanAddressUrl(t.target)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Stream Contract
                </a>
              </Tooltip.Trigger>
              <Tooltip.Content side="top" sideOffset={6}>
                {t.target}
              </Tooltip.Content>
            </Tooltip.Root>
          </em>
        </>
      );

    case "function-call":
    case "unparsed-function-call":
    case "payable-function-call":
    case "unparsed-payable-function-call":
    case "proxied-function-call":
    case "proxied-payable-function-call":
      return (
        <>
          {t.value > 0 ? (
            <>
              <em>
                <FormattedEthWithConditionalTooltip value={t.value} />
              </em>{" "}
              payable function call
            </>
          ) : (
            "Function call"
          )}{" "}
          to{" "}
          {t.proxyImplementationAddress != null ? "proxy contract" : "contract"}{" "}
          <em>
            <AddressDisplayNameWithTooltip address={t.target} />
          </em>
        </>
      );

    default:
      throw new Error(`Unknown transaction type: "${t.type}"`);
  }
};

export const FormattedEthWithConditionalTooltip = ({
  value,
  tokenSymbol = "ETH",
}) => {
  const ethString = formatEther(value);
  const [ethValue, ethDecimals] = ethString.split(".");
  const trimDecimals = ethDecimals != null && ethDecimals.length > 3;
  const trimmedEthString = [
    ethValue,
    trimDecimals ? `${ethDecimals.slice(0, 3)}...` : ethDecimals,
  ]
    .filter(Boolean)
    .join(".");

  if (!trimDecimals) return `${ethString} ${tokenSymbol}`;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <span role="button">{trimmedEthString} ETH</span>
      </Tooltip.Trigger>
      <Tooltip.Content side="top" sideOffset={6}>
        {ethString} {tokenSymbol}
      </Tooltip.Content>
    </Tooltip.Root>
  );
};

const AddressDisplayNameWithTooltip = ({ address, children, ...props }) => {
  const knownContract = useContract(address);
  const { displayName } = useAccountDisplayName(address);
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild {...props}>
        <a
          href={createEtherscanAddressUrl(address)}
          target="_blank"
          rel="noreferrer"
        >
          {children ?? knownContract?.name ?? displayName}
        </a>
      </Tooltip.Trigger>
      <Tooltip.Content side="top" sideOffset={6}>
        {knownContract?.description && (
          <p css={(t) => css({ fontWeight: t.text.weights.smallHeader })}>
            {knownContract.description}
          </p>
        )}
        {address}
      </Tooltip.Content>
    </Tooltip.Root>
  );
};

const Code = ({ block, ...props }) => {
  const code = (
    <code
      css={(t) =>
        css({
          userSelect: "text",
          fontFamily: t.text.fontStacks.monospace,
          fontSize: t.text.sizes.tiny,
          color: t.colors.textDimmed,
        })
      }
      {...props}
    />
  );

  if (!block) return code;

  return (
    <pre
      css={(t) =>
        css({
          display: "block",
          padding: "0.8rem 1rem",
          overflow: "auto",
          background: t.colors.backgroundSecondary,
          borderRadius: "0.3rem",
          "[data-indent]": { paddingLeft: "1rem" },
          "[data-comment]": { color: t.colors.textMuted },
          "[data-indentifier]": { color: t.colors.textDimmed },
          "[data-function-name]": {
            color: t.colors.textPrimary,
            fontWeight: t.text.weights.emphasis,
          },
          "[data-argument]": { color: t.colors.textNormal },
          a: {
            textDecoration: "none",
            color: "currentColor",
            "@media(hover: hover)": {
              ":hover": { textDecoration: "underline" },
            },
          },
        })
      }
    >
      {code}
    </pre>
  );
};

export default TransactionList;

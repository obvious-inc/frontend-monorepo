import { isAddress, formatEther } from "viem";
import React from "react";
import { useAccount, useBlockNumber, usePublicClient } from "wagmi";
import { decodeCalldata, formatSolidityValue } from "../utils.js";
import useAddress from "../hooks/address.jsx";
import {
  useNounsDaoV4Write,
  useNounsDaoV4Read,
  useNounsDaoV4Reads,
} from "../hooks/contracts.js";
import { useNounTokens, useDelegationTokens } from "../hooks/tokens.js";
import AccountDisplayName from "./account-display-name.jsx";
import EtherscanLink from "./etherscan-link.jsx";
import SelectWithArrows from "./select-with-arrows.jsx";
import MultiSelect from "./multi-select.jsx";

const useProposalIds = ({ order } = {}) => {
  const { data: count } = useNounsDaoV4Read("proposalCount", { watch: true });
  if (count == null) return null;

  const ids = Array.from({ length: Number(count) }).map(
    (_, index) => index + 1,
  );

  return order === "desc" ? ids.reverse() : ids;
};

// const useCheckpointableDelegatedNouns = (address) => {
//   const nounsTokenAddress = useAddress("nouns-token");
//   const publicClient = usePublicClient();

//   const [dataByAddress, setDataByAddress] = React.useState({});

//   React.useEffect(() => {
//     (async () => {
//       const events = await publicClient.getLogs({
//         address: nounsTokenAddress,
//         event: {
//           name: "DelegateChanged",
//           type: "event",
//           inputs: [
//             { name: "delegator", type: "address", indexed: true },
//             { name: "fromDelegate", type: "address", indexed: true },
//             { name: "toDelegate", type: "address", indexed: true },
//           ],
//         },
//         args: {
//           delegator: address,
//           // fromDelegate: address,
//           // toDelegate: address,
//         },
//         // fromBlock: proposal.startBlock - 100000n,
//         // toBlock: proposal.startBlock,
//       });

//       console.log(events);

//       setDataByAddress((s) => ({
//         ...s,
//         [address]: {
//           //
//         },
//       }));
//     })();
//   }, [publicClient, nounsTokenAddress, address]);
// };

const useProposal = (id, { content = true } = {}) => {
  const nounsDaoProxyAddress = useAddress("nouns-dao-v4");
  const publicClient = usePublicClient();

  const [dataById, setDataById] = React.useState({});

  const { data: proposal } = useNounsDaoV4Read("proposalsV3", {
    args: [id],
    enabled: id != null,
  });

  React.useEffect(() => {
    if (proposal == null || !content) return;

    (async () => {
      const events = await publicClient.getLogs({
        address: nounsDaoProxyAddress,
        event: {
          name: "ProposalCreated",
          type: "event",
          inputs: [
            { name: "id", type: "uint256" },
            { name: "proposer", type: "address" },
            { name: "targets", type: "address[]" },
            { name: "values", type: "uint256[]" },
            { name: "signatures", type: "string[]" },
            { name: "calldatas", type: "bytes[]" },
            { name: "startBlock", type: "uint256" },
            { name: "endBlock", type: "uint256" },
            { name: "description", type: "string" },
          ],
        },
        fromBlock: proposal.startBlock - 100000n,
        toBlock: proposal.startBlock,
      });

      const event = events.find((e) => {
        // if (e.args == null) console.log(e);
        return e.args != null && Number(e.args.id) === Number(id);
      });

      if (event == null) return;

      setDataById((s) => ({
        ...s,
        [id]: {
          description: event?.args.description ?? null,
          actions: event.args.targets.map((target, i) => ({
            target,
            value: event.args.values[i],
            signature: event.args.signatures[i],
            calldata: event.args.calldatas[i],
          })),
        },
      }));
    })();
  }, [publicClient, nounsDaoProxyAddress, id, content, proposal]);

  if (proposal == null) return null;

  return { ...proposal, ...dataById[id] };
};

const useControlledTokenIds = (address) => {
  const nounTokens = useNounTokens(address, { includeDelegate: true });
  const delegationTokens = useDelegationTokens(address);

  if (nounTokens == null || delegationTokens == null) return null;

  const controlledTokenIds = delegationTokens.map((t) => t.id);

  for (const t of nounTokens) {
    if (controlledTokenIds.includes(t.id)) continue; // Happens when delegating to oneself
    if (t.delegate != null) continue;
    controlledTokenIds.push(t.id);
  }

  return controlledTokenIds;
};

const NounsDaoV4 = () => {
  const { address: connectedAccount } = useAccount();

  const daoV4ContractAddress = useAddress("nouns-dao");

  const proposalIds = useProposalIds({ order: "desc" });

  if (daoV4ContractAddress == null) return null;

  return (
    <>
      {connectedAccount != null && (
        <div style={{ marginBottom: "4.8rem" }}>
          <ConnectedAccountSection />
        </div>
      )}

      <details>
        <summary>Propose</summary>
        <div style={{ marginBottom: "3.2rem" }}>
          <Propose />
        </div>
      </details>

      <details open style={{ marginTop: "1.6rem" }}>
        <summary>Browse proposals</summary>
        <div style={{ marginBottom: "3.2rem" }}>
          {(() => {
            if (proposalIds == null) return null;
            return <Proposals proposalIds={proposalIds} />;
          })()}
        </div>
      </details>
    </>
  );
};

const useProposalState = (id) => {
  const { data: stateNumber } = useNounsDaoV4Read("state", {
    watch: true,
    args: [id],
    enabled: id != null,
  });
  if (stateNumber == null) return null;
  return [
    "pending",
    "active",
    "canceled",
    "defeated",
    "succeeded",
    "queued",
    "expired",
    "executed",
    "vetoed",
    "objection-period",
    "updatable",
  ][Number(stateNumber)];
};

const Proposals = ({ proposalIds }) => {
  const { address: connectedAccount } = useAccount();
  const { data: blockNumber } = useBlockNumber({ watch: true });

  const [proposalId, setProposalId] = React.useState(proposalIds[0]);

  const proposal = useProposal(proposalId);
  const proposalState = useProposalState(proposalId);

  const controlledTokenIds = useControlledTokenIds(connectedAccount);

  // TODO: How to we know how you voter given we don’t know your token delegation at that time
  const { data: voteReceiptResponses } = useNounsDaoV4Reads("votingReceipt", {
    args: controlledTokenIds?.map((id) => [proposalId, id]),
    enabled: connectedAccount != null,
    watch: true,
  });

  const hasVotesLeftToCast =
    voteReceiptResponses != null &&
    voteReceiptResponses.some((r) => !r.data[0]);

  const endBlock =
    proposal == null
      ? null
      : (proposal.objectionPeriodEndBlock ?? 0) > (proposal.endBlock ?? 0)
        ? proposal.objectionPeriodEndBlock
        : proposal.endBlock;

  const votingStarted =
    blockNumber != null &&
    proposal != null &&
    blockNumber >= proposal.startBlock;
  const votingEnded = votingStarted && blockNumber >= endBlock;

  if (proposalIds.length === 0) return "No proposals";

  return (
    <>
      <label htmlFor="proposals">Select a proposal</label>
      <SelectWithArrows
        id="proposals"
        value={proposalId ?? ""}
        onChange={(id) => {
          setProposalId(id);
        }}
        options={[
          {
            label: "Select proposal",
            value: "",
            disabled: true,
          },
          ...proposalIds.map((id) => ({ value: id, label: `Proposal ${id}` })),
        ]}
        reverseNavDirection
        containerProps={{ style: { marginTop: "0.8rem" } }}
      />

      {proposal != null && (
        <>
          <dl style={{ marginTop: "1.6rem" }}>
            {[
              {
                label: "State",
                render: () => (
                  <span style={{ textTransform: "capitalize" }}>
                    {proposalState ?? "..."}
                  </span>
                ),
              },
              {
                label: "Proposer",
                render: () => (
                  <EtherscanLink address={proposal.proposer}>
                    <AccountDisplayName address={proposal.proposer} />
                  </EtherscanLink>
                ),
              },
              {
                label: "Start block",
                value: (
                  <>
                    {Number(proposal.startBlock)}
                    {blockNumber != null &&
                      blockNumber < proposal.startBlock && (
                        <>
                          {" "}
                          ({Number(proposal.startBlock - blockNumber)} blocks
                          left)
                        </>
                      )}
                  </>
                ),
              },
              {
                label: "End block",
                value: (
                  <>
                    {Number(proposal.endBlock)}
                    {votingStarted &&
                      blockNumber != null &&
                      blockNumber < proposal.endBlock && (
                        <>
                          {" "}
                          ({Number(proposal.endBlock - blockNumber)} blocks
                          left)
                        </>
                      )}
                  </>
                ),
              },
              {
                value:
                  blockNumber == null ? (
                    "..."
                  ) : blockNumber > proposal.startBlock ? (
                    <>
                      {Number(proposal.forVotes)} for,{" "}
                      {Number(proposal.abstainVotes)} abstain,{" "}
                      {Number(proposal.againstVotes)} against
                      {/* {voteReceiptResponses != null && (
                        <p style={{ margin: "0.8rem 0 0" }}>
                          {(() => {
                            const hasVoted = voteReceiptResponses.some(
                              (r) => r.data[0],
                            );

                            if (!hasVoted)
                              return "You did not vote for this proposal";

                            const votesBySupport = voteReceiptResponses.reduce(
                              (acc, r) => {
                                if (!r.data[0]) return acc; // didn’t vote
                                const support = r.data[1];
                                const count = acc[support] ?? 0;
                                return { ...acc, [support]: count + 1 };
                              },
                              {},
                            );

                            return (
                              <>
                                {" "}
                                You voted{" "}
                                {Object.entries(votesBySupport).map(
                                  ([support, voteCount], i) => {
                                    const voteWord = {
                                      0: "AGAINST",
                                      1: "FOR",
                                      2: "ABSTAIN",
                                    }[support];

                                    return (
                                      <React.Fragment key={support}>
                                        {i > 0 && <> ,</>}
                                        {voteWord} ({voteCount}{" "}
                                        {voteCount === 1 ? "vote" : "votes"})
                                      </React.Fragment>
                                    );
                                  },
                                )}
                              </>
                            );
                          })()}
                        </p>
                      )} */}
                    </>
                  ) : (
                    "-"
                  ),
                label: "Votes",
              },
              {
                label: "Actions",
                render: () =>
                  proposal.actions == null ? (
                    "..."
                  ) : (
                    <ol
                      style={{
                        margin: "1.6rem 0",
                        padding: 0,
                        listStyle: "none",
                      }}
                    >
                      {proposal.actions.map((action, i) => {
                        const value = action.value.toString();
                        const { functionName, inputs, inputTypes } =
                          decodeCalldata(action) ?? {};

                        return (
                          <li
                            key={i}
                            style={{ marginTop: i === 0 ? 0 : "3.2rem" }}
                          >
                            <dl data-plain style={{ gap: "0.8rem 3.2rem" }}>
                              <dt>Target</dt>
                              <dd>
                                {isAddress(action.target) ? (
                                  <EtherscanLink address={action.target}>
                                    <AccountDisplayName
                                      address={action.target}
                                    />
                                  </EtherscanLink>
                                ) : (
                                  action.target
                                )}
                              </dd>
                              <dt>Signature</dt>
                              <dd>{action.signature || "-"}</dd>
                              <dt>Calldata</dt>
                              <dd>
                                {action.calldata ?? "0x"}

                                {inputs != null && (
                                  <pre>
                                    <code>
                                      {functionName}(<br />
                                      {inputs.map((value, i) => (
                                        <React.Fragment key={i}>
                                          {i !== 0 && (
                                            <>
                                              ,<br />
                                            </>
                                          )}
                                          &nbsp;&nbsp;
                                          {formatSolidityValue(
                                            inputTypes[i],
                                            value,
                                          )}
                                        </React.Fragment>
                                      ))}
                                      <br />)
                                    </code>
                                  </pre>
                                )}
                              </dd>
                              <dt>Value</dt>
                              <dd>
                                {value}
                                {value !== "0" && (
                                  <> ({formatEther(action.value)} ETH)</>
                                )}
                              </dd>
                            </dl>
                          </li>
                        );
                      })}
                    </ol>
                  ),
              },
              {
                label: "Description",
                render: () => (
                  <div
                    style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                  >
                    {proposal.description === undefined
                      ? "..."
                      : proposal.description}
                  </div>
                ),
              },
            ].map((item) => (
              <React.Fragment key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.render?.() ?? item.value}</dd>
              </React.Fragment>
            ))}
          </dl>

          {connectedAccount != null &&
            votingStarted &&
            !votingEnded &&
            hasVotesLeftToCast && (
              <div style={{ paddingLeft: "1.6rem" }}>
                <details open style={{ marginTop: "3.2rem" }}>
                  <summary>Vote</summary>
                  <VoteForm proposalId={proposalId} />
                </details>
              </div>
            )}
        </>
      )}
    </>
  );
};

const VoteForm = ({ proposalId }) => {
  const [selectedTokenIds, setTokenIds] = React.useState([]);
  const [reason, setReason] = React.useState("");
  const [support, setSupport] = React.useState(null);

  const { address: connectedAccount } = useAccount();
  const controlledTokenIds = useControlledTokenIds(connectedAccount);

  const { call: castVote, status: castVoteCallStatus } = useNounsDaoV4Write(
    "castRefundableVote",
    {
      args: [selectedTokenIds, proposalId, Number(support)],
      enabled: selectedTokenIds.length > 0 && support != null,
    },
  );
  const { call: castVoteWithReason, status: castVoteWithReasonCallStatus } =
    useNounsDaoV4Write("castRefundableVoteWithReason", {
      args: [selectedTokenIds, proposalId, Number(support), reason],
      enabled: selectedTokenIds.length > 0 && support != null,
    });

  const voteCall = reason.trim() === "" ? castVote : castVoteWithReason;
  const isPending =
    castVoteCallStatus === "pending" ||
    castVoteWithReasonCallStatus === "pending";

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          voteCall();
        }}
      >
        <label htmlFor="tokens">Token IDs</label>
        <MultiSelect
          id="tokens"
          selectedValues={selectedTokenIds}
          options={
            controlledTokenIds == null
              ? []
              : controlledTokenIds.map((id) => ({
                  value: id,
                  label: `Noun ${id}`,
                }))
          }
          onSelect={(ids) => {
            setTokenIds(ids);
          }}
          disabled={controlledTokenIds == null || isPending}
          style={{ width: "100%", height: "auto" }}
        />
        <label htmlFor="reason" style={{ marginTop: "1.6rem" }}>
          Reason (optional)
        </label>
        <textarea
          id="reason"
          placeholder="..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{ width: "100%" }}
          disabled={isPending}
        />
        <label htmlFor="support" style={{ marginTop: "1.6rem" }}>
          Support
        </label>
        <select
          id="support"
          value={support ?? ""}
          onChange={(e) => {
            setSupport(e.target.value);
          }}
          style={{ width: "100%", marginTop: "0.8rem" }}
          disabled={isPending}
        >
          <option disabled value="">
            Select support
          </option>
          {[
            { value: 1, label: "For" },
            { value: 0, label: "Against" },
            { value: 2, label: "Abstain" },
          ].map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "1.6rem",
          }}
        >
          <button type="submit" disabled={voteCall == null || isPending}>
            Cast vote{reason.trim() !== "" && <> with reason</>}
          </button>
        </div>
      </form>
    </>
  );
};

const Propose = () => {
  const { address: connectedAccount } = useAccount();

  const [selectedTokenIds, setTokenIds] = React.useState([]);
  const [description, setDescription] = React.useState("");
  const [actions, setActions] = React.useState([
    { target: "", signature: "", calldata: "", value: "" },
  ]);

  const { call: propose, status: proposeCallStatus } = useNounsDaoV4Write(
    "propose",
    {
      args: [
        selectedTokenIds,
        ...actions.reduce(
          ([targets, values, signatures, calldatas], a) => [
            [...targets, a.target],
            [...values, a.value],
            [...signatures, a.signature],
            [...calldatas, a.calldata],
          ],
          [[], [], [], []],
        ),
        description,
      ],
      enabled: description.trim() !== "",
    },
  );

  const { data: proposalThreshold } = useNounsDaoV4Read("proposalThreshold");
  const controlledTokenIds = useControlledTokenIds(connectedAccount);
  const votingPower = controlledTokenIds?.length;
  const canPropose =
    votingPower != null &&
    proposalThreshold != null &&
    votingPower > proposalThreshold;

  const hasRequiredInputs = propose != null;

  if (connectedAccount == null)
    return (
      <p data-small data-warning data-box>
        Connect account to propose
      </p>
    );

  return (
    <>
      {votingPower <= proposalThreshold ? (
        <p data-small data-warning data-box style={{ marginBottom: "3.2rem" }}>
          You do not have enough voting power to propose
        </p>
      ) : null}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await propose();
          setDescription("");
          setTokenIds("");
          setActions([{ target: "", signature: "", calldata: "", value: "" }]);
        }}
      >
        <label htmlFor="tokens">Token IDs</label>
        <MultiSelect
          id="tokens"
          selectedValues={selectedTokenIds}
          options={
            controlledTokenIds == null
              ? []
              : controlledTokenIds.map((id) => ({
                  value: id,
                  label: `Noun ${id}`,
                }))
          }
          onSelect={(ids) => {
            setTokenIds(ids);
          }}
          disabled={controlledTokenIds == null}
          style={{ width: "100%", height: "auto", marginBottom: "3.2rem" }}
        />

        <label htmlFor="description">Description (markdown)</label>
        <textarea
          id="description"
          value={description}
          rows={5}
          placeholder={`# Title\n\n## TLDR\n\nLorem ipsum dolor sit amet...`}
          onChange={(e) => setDescription(e.target.value)}
          style={{ width: "100%", marginBottom: "3.2rem" }}
        />
        {actions.map((a, i) => (
          <fieldset
            key={i}
            style={{
              border: 0,
              padding: "0 0 0 1.6rem",
              marginTop: i === 0 ? 0 : "3.2rem",
            }}
          >
            <legend
              style={{
                display: "list-item",
                padding: 0,
                width: "100%",
                marginBottom: "1.6rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <div style={{ flex: 1, minWidth: 0 }}>Action {i + 1}</div>
                {actions.length > 1 && (
                  <button
                    type="button"
                    data-small
                    onClick={() => {
                      setActions((as) => as.filter((_, i_) => i_ !== i));
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </legend>
            {[
              { value: "target", label: "Target", placeholder: "0x..." },
              { value: "signature", label: "Signature", placeholder: "foo()" },
              { value: "calldata", label: "Calldata", placeholder: "0x..." },
              { value: "value", label: "Value", placeholder: "0" },
            ].map((item, inputIndex) => (
              <React.Fragment key={`${item.value}-${i}`}>
                <label
                  htmlFor={`${item.value}-${i}`}
                  style={{ marginTop: inputIndex === 0 ? 0 : "1.6rem" }}
                >
                  {item.label}
                </label>
                <input
                  id={`${item.value}-${i}`}
                  value={a[item.value]}
                  placeholder={item.placeholder}
                  onChange={(e) =>
                    setActions((as) =>
                      as.map((a, i_) =>
                        i === i_ ? { ...a, [item.value]: e.target.value } : a,
                      ),
                    )
                  }
                  autoCorrect="off"
                  style={{ width: "100%" }}
                />
              </React.Fragment>
            ))}
          </fieldset>
        ))}
        <div style={{ marginTop: "3.2rem", paddingLeft: "1.6rem" }}>
          <button
            data-small
            type="button"
            onClick={() => {
              setActions((as) => [
                ...as,
                { target: "", signature: "", calldata: "", value: "" },
              ]);
            }}
          >
            Add another action
          </button>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "1.6rem",
          }}
        >
          <button
            type="submit"
            disabled={
              !canPropose ||
              !hasRequiredInputs ||
              proposeCallStatus === "pending"
            }
          >
            Submit proposal
          </button>
        </div>
      </form>
    </>
  );
};

const ConnectedAccountSection = () => {
  const { address: connectedAccount } = useAccount();
  const { data: proposalThreshold } = useNounsDaoV4Read("proposalThreshold");
  const controlledTokenIds = useControlledTokenIds(connectedAccount);
  const votingPower = controlledTokenIds?.length;

  return (
    <>
      <dl>
        <dt>Voting power</dt>
        <dd>{votingPower ?? "..."}</dd>
        <dt>Proposal threshold</dt>
        <dd>{proposalThreshold == null ? "..." : Number(proposalThreshold)}</dd>
      </dl>
    </>
  );
};

export default NounsDaoV4;

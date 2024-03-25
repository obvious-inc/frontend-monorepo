import {
  isAddress,
  formatEther,
  parseAbiItem,
  decodeAbiParameters,
} from "viem";
import React from "react";
import { useAccount, useBlockNumber, usePublicClient } from "wagmi";
import { useAddress } from "../addresses.js";
import {
  useNounsTokenRead,
  useNounsDaoWrite,
  useNounsDaoRead,
  // useNounsDaoReads,
} from "../hooks/contracts.js";
import AccountDisplayName from "./account-display-name.jsx";
import EtherscanLink from "./etherscan-link.jsx";
import SelectWithArrows from "./select-with-arrows.jsx";

const decodeCalldata = (action) => {
  try {
    const { name, inputs: inputTypes } = parseAbiItem(
      `function ${action.signature}`,
    );
    if (inputTypes.length === 0) return null;
    const inputs = decodeAbiParameters(inputTypes, action.calldata);
    return { functionName: name, inputs, inputTypes };
  } catch (e) {
    return null;
  }
};

const formatSolidityValue = ({ type, components }, v) => {
  if (type === "string") return `"${v}"`;

  if (type.slice(-2) === "[]") {
    const elementType = { type: type.slice(0, -2), components };
    return `[${v.map((element) => formatSolidityValue(elementType, element)).join(",")}]`;
  }

  if (type !== "tuple") return v.toString();

  const formattedEntries = components.reduce(
    (acc, { name, type, components }) => {
      const formattedValue = formatSolidityValue({ type, components }, v[name]);
      if (acc == null) return `${name}: ${formattedValue}`;
      return `${acc}, ${name}: ${formattedValue}`;
    },
    null,
  );

  return `{${formattedEntries}}`;
};

const useProposalIds = ({ order } = {}) => {
  const { data: count } = useNounsDaoRead("proposalCount", { watch: true });
  if (count == null) return null;

  const ids = Array.from({ length: Number(count) }).map(
    (_, index) => index + 1,
  );

  return order === "desc" ? ids.reverse() : ids;
};

const useProposal = (id, { content = true } = {}) => {
  const nounsDaoProxyAddress = useAddress("nouns-dao");
  const publicClient = usePublicClient();

  const [dataById, setDataById] = React.useState({});

  const { data: proposal } = useNounsDaoRead("proposalsV3", {
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

      const event = events.find((e) => Number(e.args.id) === Number(id));

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

const NounsDaoV3 = () => {
  // const { data: adjustedTotalSupply } = useNounsDaoRead("adjustedTotalSupply");
  // const { data: proposalThreshold } = useNounsDaoRead("proposalThreshold");

  const proposalIds = useProposalIds({ order: "desc" });

  return (
    <>
      {/* <dl style={{ marginBottom: "3.2rem" }}> */}
      {/*   <dt>Adjusted total supply</dt> */}
      {/*   <dd> */}
      {/*     {adjustedTotalSupply == null ? "..." : Number(adjustedTotalSupply)} */}
      {/*   </dd> */}
      {/*   <dt>Proposal threshold</dt> */}
      {/*   <dd>{proposalThreshold == null ? "..." : Number(proposalThreshold)}</dd> */}
      {/* </dl> */}

      <details>
        <summary>Propose</summary>
        <div style={{ marginBottom: "3.2rem" }}>
          <Propose />
        </div>
      </details>

      <details style={{ marginTop: "1.6rem" }}>
        <summary>Vote</summary>
        <div style={{ marginBottom: "3.2rem" }}>
          {(() => {
            if (proposalIds == null) return null;
            return <VoteSection proposalIds={proposalIds} />;
          })()}
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
  const { data: stateNumber } = useNounsDaoRead("state", {
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
  const [proposalId, setProposalId] = React.useState(proposalIds[0]);

  const { data: blockNumber } = useBlockNumber({ watch: true });

  const proposal = useProposal(proposalId);
  const proposalState = useProposalState(proposalId);

  const votingStarted =
    blockNumber != null &&
    proposal != null &&
    blockNumber >= proposal.startBlock;

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
                  {blockNumber != null && blockNumber < proposal.startBlock && (
                    <>
                      {" "}
                      ({Number(proposal.startBlock - blockNumber)} blocks left)
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
                        ({Number(proposal.endBlock - blockNumber)} blocks left)
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
                                  <AccountDisplayName address={action.target} />
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
      )}
    </>
  );
};

const VoteForm = ({ proposalId }) => {
  const [reason, setReason] = React.useState("");
  const [support, setSupport] = React.useState(null);

  const { call: castVote, status: castVoteCallStatus } = useNounsDaoWrite(
    "castRefundableVote",
    {
      args: [proposalId, support],
      enabled: support != null,
    },
  );
  const { call: castVoteWithReason, status: castVoteWithReasonCallStatus } =
    useNounsDaoWrite("castRefundableVoteWithReason", {
      args: [proposalId, support, reason],
      enabled: support != null,
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
        <label htmlFor="reason">Reason (optional)</label>
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
        <button
          type="submit"
          disabled={voteCall == null || isPending}
          style={{ marginTop: "1.6rem" }}
        >
          Cast vote{reason.trim() !== "" && <> with reason</>}
        </button>
      </form>
    </>
  );
};

const useActiveProposalId = () => {
  const { address: accountAddress } = useAccount();
  const { data: latestProposalId } = useNounsDaoRead("latestProposalIds", {
    args: [accountAddress],
  });
  const state = useProposalState(latestProposalId);

  if (latestProposalId === undefined || state === undefined) return undefined;

  const isActive = [
    "updatable",
    "pending",
    "active",
    "objection-period",
  ].includes(state);

  return isActive ? latestProposalId : null;
};

const Propose = () => {
  const { address: connectedAccount } = useAccount();

  const [description, setDescription] = React.useState("");
  const [actions, setActions] = React.useState([
    { target: "", signature: "", calldata: "", value: "" },
  ]);

  const { call: propose, status: proposeCallStatus } = useNounsDaoWrite(
    "propose",
    {
      args: [
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

  const { data: proposalThreshold } = useNounsDaoRead("proposalThreshold");
  const { data: votingPower } = useNounsTokenRead("getCurrentVotes", {
    args: [connectedAccount],
    enabled: connectedAccount != null,
  });
  const activeProposalId = useActiveProposalId();
  const canPropose =
    activeProposalId == null &&
    votingPower != null &&
    proposalThreshold != null &&
    votingPower > proposalThreshold;

  const hasRequiredInputs = propose != null;

  if (connectedAccount == null)
    return (
      <p data-small data-dimmed>
        Connect account to propose
      </p>
    );

  return (
    <>
      {activeProposalId != null ? (
        <p data-small data-warning data-box style={{ marginBottom: "3.2rem" }}>
          You may not propose until voting for Prop {Number(activeProposalId)}{" "}
          ends
        </p>
      ) : votingPower <= proposalThreshold ? (
        <p data-small data-warning data-box style={{ marginBottom: "3.2rem" }}>
          You do not have enough voting power to propose
        </p>
      ) : null}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await propose();
          setDescription("");
          setActions([{ target: "", signature: "", calldata: "", value: "" }]);
        }}
      >
        <label htmlFor="description">Description</label>
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

const VoteSection = ({ proposalIds }) => {
  const [proposalId, setProposalId] = React.useState(proposalIds[0]);

  const { data: blockNumber } = useBlockNumber({ watch: true });
  const { address: connectedAccount } = useAccount();

  const { data: voteReceipt } = useNounsDaoRead("getReceipt", {
    args: [proposalId, connectedAccount],
    enabled: connectedAccount != null,
    watch: true,
  });

  const proposal = useProposal(proposalId, { content: false });

  if (connectedAccount == null)
    return (
      <p data-small data-dimmed>
        Connect account to vote
      </p>
    );

  return (
    <>
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

      {(() => {
        if (blockNumber == null || proposal == null || voteReceipt == null)
          return <p>...</p>;

        const endBlock =
          (proposal.objectionPeriodEndBlock ?? 0) > (proposal.endBlock ?? 0)
            ? proposal.objectionPeriodEndBlock
            : proposal.endBlock;

        const votingStarted = blockNumber >= proposal.startBlock;
        const votingEnded = blockNumber >= endBlock;

        if (!votingStarted) return <p>Voting has not started</p>;

        if (votingEnded || voteReceipt.hasVoted)
          return (
            <p>
              {(() => {
                if (!voteReceipt.hasVoted)
                  return "You did not vote for this proposal";

                const voteWord = (() => {
                  switch (voteReceipt.support) {
                    case 0:
                      return "AGAINST";
                    case 1:
                      return "FOR";
                    case 2:
                      return "ABSTAIN";
                    default:
                      throw new Error();
                  }
                })();
                const voteCount = Number(voteReceipt.votes);

                return `You voted ${voteWord} (${voteCount} ${voteCount === 1 ? "vote" : "votes"})`;
              })()}
            </p>
          );
        return <VoteForm proposalId={proposalId} />;
      })()}
    </>
  );
};

export default NounsDaoV3;

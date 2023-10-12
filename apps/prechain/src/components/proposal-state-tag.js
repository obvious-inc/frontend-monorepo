import { getStateLabel as getProposalStateLabel } from "../utils/proposals.js";
import { useProposal } from "../store.js";
import Tag from "./tag.js";

const ProposalStateTag = ({ proposalId, ...props }) => {
  const proposal = useProposal(proposalId);

  const variantByState = {
    active: "active",
    "objection-period": "warning",
    defeated: "error",
    vetoed: "error",
    succeeded: "success",
    queued: "success",
    executed: "success",
  };

  // `state` might be null before we have fetched the current block number
  if (proposal.state == null) return null

  return (
    <Tag size="large" variant={variantByState[proposal.state]} {...props}>
      {getProposalStateLabel(proposal.state)}
    </Tag>
  );
};

export default ProposalStateTag;

import { useParams } from "react-router-dom";
import { css } from "@emotion/react";
import {
  useProposalCandidate,
  useProposalCandidateFetch,
} from "../hooks/prechain.js";

const ProposalCandidateScreen = () => {
  const { candidateId } = useParams();
  const candidate = useProposalCandidate(candidateId);

  useProposalCandidateFetch(candidateId);

  if (candidate == null) return null;

  return (
    <div css={css({ padding: "2rem 1.6rem", whiteSpace: "pre-line" })}>
      Proposer: {candidate.proposer}
      <br />
      <br />
      {candidate.latestVersion.description}
    </div>
  );
};

export default ProposalCandidateScreen;

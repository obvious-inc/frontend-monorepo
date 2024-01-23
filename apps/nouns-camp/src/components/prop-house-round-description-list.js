import React from "react";
import { usePublicClient } from "wagmi";
import { parseTimedRoundConfigStruct } from "../utils/prop-house.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";

const votingStrategyTitle = (identifier) => {
  switch (identifier) {
    case "nouns-token":
      return "Nouns token holders";
    case "custom":
      return "Custom";
    default:
      throw new Error();
  }
};
const formatMillis = (millis) => {
  const days = Math.round(millis / 1000 / 60 / 60 / 24);
  if (days === 1) return `${days} day`;
  return `${days} days`;
};

const PropHouseRoundDescriptionList = ({
  round: { title, description, configStruct },
}) => {
  const publicClient = usePublicClient();

  const {
    votingStrategy,
    voteMultiplier,
    proposalPeriodStartMillis,
    proposalPeriodDurationMillis,
    votePeriodDurationMillis,
    winnerCount,
    awardAssets,
  } = parseTimedRoundConfigStruct(configStruct, {
    publicClient,
  });

  return (
    <dl>
      <dt>Title</dt>
      <dd>{title}</dd>
      <dt>Voters</dt>
      <dd>{votingStrategyTitle(votingStrategy)}</dd>
      {voteMultiplier != null && voteMultiplier > 1 && (
        <>
          <dt>
            {votingStrategy === "nouns-token"
              ? "Votes per token"
              : "Vote count"}
          </dt>
          <dd>{voteMultiplier}</dd>
        </>
      )}
      <dt>Proposal period start date</dt>
      <dd>
        <FormattedDateWithTooltip
          disableRelative
          day="numeric"
          month="short"
          value={new Date(proposalPeriodStartMillis)}
        />
      </dd>
      <dt>Proposal period duration</dt>
      <dd>{formatMillis(proposalPeriodDurationMillis)}</dd>
      <dt>Vote period duration</dt>
      <dd>{formatMillis(votePeriodDurationMillis)}</dd>
      <dt>Number of winners</dt>
      <dd>{winnerCount}</dd>
      <dt>Awards</dt>
      <dd>
        {awardAssets.map((a, i) => {
          if (a.type !== "eth") throw new Error();
          return (
            <React.Fragment key={i}>
              {i !== 0 && <>, </>}
              {a.amount} ETH
            </React.Fragment>
          );
        })}
      </dd>
      <dt>Description</dt>
      <dd>{description}</dd>
    </dl>
  );
};

export default PropHouseRoundDescriptionList;

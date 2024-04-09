import { css } from "@emotion/react";
import { array as arrayUtils } from "@shades/common/utils";
import * as Tooltip from "@shades/ui-web/tooltip";

const VotingBar = ({
  votes = [],
  quorumVotes = 0,
  height = "1.2rem",
  ...props
}) => {
  const [forVoteCount, abstainVoteCount, againstVoteCount] = votes.reduce(
    ([for_, abstain, against], v) => {
      switch (v.support) {
        case 0:
          return [for_, abstain, against + v.votes];
        case 1:
          return [for_ + v.votes, abstain, against];
        case 2:
          return [for_, abstain + v.votes, against];
        default:
          throw new Error();
      }
    },
    [0, 0, 0],
  );

  const {
    0: againstVotes = [],
    1: forVotes = [],
    2: abstainVotes = [],
  } = arrayUtils.groupBy(
    (v) => v.support,
    votes.filter((v) => v.votes > 0),
  );

  // const totalVoteCount =
  //   Math.max(forVoteCount, quorumVotes) + againstVoteCount + abstainVoteCount;

  const sortedForVotes = arrayUtils.sortBy(
    { value: (v) => v.votes, order: "desc" },
    // (v) => v.createdBlock,
    forVotes,
  );

  const getVoteIndex = (votes, threshold) => {
    let sum = 0;
    for (const [i, v] of votes.entries()) {
      if (sum + v.votes >= threshold) return [i, threshold - sum - 1];
      sum += v.votes;
    }
    return [-1];
  };

  const [quorumVoteIndex, quorumVoteOffset] = getVoteIndex(
    sortedForVotes,
    quorumVotes,
  );

  return (
    <div css={css({ containerType: "inline-size" })}>
      <div
        css={(t) =>
          css({
            display: "flex",
            alignItems: "stretch",
            gap: "2px",
            "--for-color": t.colors.textPositive,
            "--against-color": t.colors.textNegative,
            "--abstain-color": t.colors.textMuted,
            "--undetermined-color": t.colors.backgroundModifierNormal,
            "--quorum-color": t.colors.secondary,
            ".votes-container": {
              minWidth: "1px",
              display: "flex",
              alignItems: "stretch",
              gap: "2px",
            },
            "[data-vote]": { minWidth: "1px" },
            '[data-vote="for"]': { background: "var(--for-color)" },
            '[data-vote="against"]': { background: "var(--against-color)" },
            '[data-vote="abstain"]': { background: "var(--abstain-color)" },
            '[data-vote="undetermined"]': {
              background: "var(--undetermined-color)",
            },
            '[data-vote="quorum"]': {
              background: "var(--quorum-color)",
              margin: "-0.2rem 0",
              minWidth: "2px",
            },
            "[data-contains-quorum]": { position: "relative" },
            "@container(min-width: 600px)": {
              gap: "3px",
              ".votes-container": { gap: "3px" },
              "[data-vote]": { minWidth: "2px" },
            },
          })
        }
        {...props}
        style={{ height, ...props.style }}
      >
        {forVoteCount > 0 && (
          <div
            key="for"
            className="votes-container"
            style={{ flex: forVoteCount }}
          >
            {sortedForVotes.map((v, i) => (
              <div
                key={i}
                data-vote="for"
                data-contains-quorum={quorumVoteIndex === i || undefined}
                style={{ flex: v.votes }}
              >
                {quorumVoteIndex === i && (
                  <Tooltip.Root key="quorum">
                    <Tooltip.Trigger asChild>
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          bottom: 0,
                          left: `calc(100% * (${quorumVoteOffset} / ${v.votes}))`,
                          width: `calc(100% / ${v.votes})`,
                          boxShadow: "0 0 0.3rem hsl(0 0% 0% / 60%)",
                        }}
                      >
                        <div
                          data-vote="quorum"
                          style={{
                            width: "100%",
                            height: "calc(100% + 0.4rem)",
                          }}
                        />
                      </div>
                    </Tooltip.Trigger>
                    <Tooltip.Content sideOffset={8}>
                      Quorum {quorumVotes}
                    </Tooltip.Content>
                  </Tooltip.Root>
                )}
              </div>
            ))}
          </div>
        )}

        {quorumVotes > forVoteCount && (
          <div
            key="undetermined"
            className="votes-container"
            style={{ flex: quorumVotes - forVoteCount }}
          >
            <div
              key="undetermined-before-quorum"
              data-vote="undetermined"
              style={{ flex: quorumVotes - forVoteCount - 1 }}
            />
            <Tooltip.Root key="quorum">
              <Tooltip.Trigger asChild>
                <div key="quorum" data-vote="quorum" style={{ flex: 1 }} />
              </Tooltip.Trigger>
              <Tooltip.Content sideOffset={8}>
                Quorum {quorumVotes}
              </Tooltip.Content>
            </Tooltip.Root>
          </div>
        )}

        {abstainVoteCount > 0 && (
          <div
            key="abstain"
            className="votes-container"
            style={{ flex: abstainVoteCount }}
          >
            {arrayUtils
              .sortBy(
                { value: (v) => v.votes, order: "desc" },
                // (v) => v.createdBlock,
                abstainVotes,
              )
              .map((v, i) => (
                <div key={i} data-vote="abstain" style={{ flex: v.votes }} />
              ))}
          </div>
        )}

        {againstVoteCount > 0 && (
          <div
            key="against"
            className="votes-container"
            style={{ flex: againstVoteCount }}
          >
            {arrayUtils
              .sortBy(
                { value: (v) => v.votes },
                // { value: (v) => v.createdBlock, order: "desc" },
                againstVotes,
              )
              .map((v, i) => (
                <div key={i} data-vote="against" style={{ flex: v.votes }} />
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VotingBar;

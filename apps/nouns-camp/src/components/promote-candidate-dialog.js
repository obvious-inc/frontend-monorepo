import React from "react";
import { css } from "@emotion/react";
import { useNavigate } from "react-router-dom";
import { ListBox, ListBoxItem } from "react-aria-components";
import {
  array as arrayUtils,
  function as functionUtils,
} from "@shades/common/utils";
import { useAccountDisplayName } from "@shades/common/app";
import Button from "@shades/ui-web/button";
import { Label } from "@shades/ui-web/input";
import Dialog from "@shades/ui-web/dialog";
import DialogHeader from "@shades/ui-web/dialog-header";
import AccountAvatar from "./account-avatar.js";
import Callout from "./callout.js";
import { getSponsorSignatures } from "../utils/candidates.js";
import {
  useActions,
  useProposals,
  useProposalCandidate,
  useDelegate,
} from "../store.js";
import {
  useProposalThreshold,
  useCreateProposal,
  useCreateProposalWithSignatures,
} from "../hooks/dao-contract.js";

const PromoteCandidateDialog = ({ isOpen, candidateId, dismiss }) => {
  const navigate = useNavigate();

  const candidate = useProposalCandidate(candidateId);
  const proposerDelegate = useDelegate(candidate.proposerId);
  const proposalThreshold = useProposalThreshold();
  const activeProposerIds = useProposals({ filter: "active" }).map(
    (p) => p.proposerId
  );

  const { fetchProposal } = useActions();
  const createProposal = useCreateProposal();
  const createProposalWithSignatures = useCreateProposalWithSignatures();

  const [selectedSignerIds, setSelectedSignerIds] = React.useState(new Set());
  const [pendingSubmitTarget, setPendingSubmitTarget] = React.useState(null);

  const hasPendingSubmit = pendingSubmitTarget != null;

  const validSignatures = getSponsorSignatures(candidate, {
    excludeInvalid: true,
    activeProposerIds,
  });

  const selectedSignatures = [...selectedSignerIds].map((id) =>
    validSignatures.find((s) => s.signer.id === id)
  );

  const selectedSponsorsVotingPower = arrayUtils.unique(
    selectedSignatures.flatMap((s) =>
      s.signer.nounsRepresented.map((n) => n.id)
    )
  ).length;

  const proposerVotingPower =
    proposerDelegate == null ? 0 : proposerDelegate.nounsRepresented.length;

  const canProposeWithoutSponsors = proposerVotingPower > proposalThreshold;

  const canProposeWithSelectedSponsors =
    selectedSignatures.length > 0 &&
    proposerVotingPower + selectedSponsorsVotingPower > proposalThreshold;

  const submit = async (targetType) => {
    const { description, transactions } = candidate.latestVersion.content;

    setPendingSubmitTarget(targetType);

    return Promise.resolve()
      .then(() => {
        switch (targetType) {
          case "propose":
            return createProposal({ description, transactions });

          case "propose-by-sigs":
            return createProposalWithSignatures({
              description,
              transactions,
              // TODO: Make sure sort order mirrors the original proposal for updates
              proposerSignatures: selectedSignatures.map((s) => ({
                sig: s.sig,
                signer: s.signer.id,
                expirationTimestamp: s.expirationTimestamp.getTime() / 1000,
              })),
            });

          default:
            throw new Error();
        }
      })
      .then(
        (res) => {
          functionUtils
            .retryAsync(() => fetchProposal(res.id), {
              retries: 100,
            })
            .then(() => {
              navigate(`/${res.id}`);
            });
        },
        (e) => {
          if (e.message.startsWith("User rejected the request."))
            return Promise.reject(e);

          alert(
            "Ops, looks like something went wrong submitting your proposal!"
          );
          console.error(e);
          return Promise.reject(e);
        }
      )
      .catch(() => {
        // This should only happen for errors occuring after a successful submit
      })
      .finally(() => {
        setPendingSubmitTarget(null);
      });
  };

  return (
    <Dialog
      isOpen={isOpen}
      onRequestClose={dismiss}
      width="50rem"
      css={css({ overflow: "auto" })}
    >
      {({ titleProps }) => (
        <div
          css={css({
            overflow: "auto",
            padding: "1.5rem",
            "@media (min-width: 600px)": {
              padding: "2rem",
            },
          })}
        >
          <DialogHeader
            title="Promote candidate"
            titleProps={titleProps}
            dismiss={dismiss}
          />
          {canProposeWithoutSponsors && validSignatures.length === 0 ? (
            <>
              <main>
                <Callout style={{ margin: "0 0 3.2rem" }}>
                  Because your voting power ({proposerVotingPower}) meets the
                  current proposal threshold ({proposalThreshold + 1}), you can
                  propose without sponsors.
                </Callout>
              </main>
              <footer
                css={css({
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: "2.5rem",
                  "@media (min-width: 600px)": {
                    marginTop: "3rem",
                  },
                })}
              >
                <div css={css({ display: "flex", gap: "1rem" })}>
                  <Button type="button" size="medium" onClick={dismiss}>
                    Cancel
                  </Button>
                  <Button
                    size="medium"
                    variant="primary"
                    isLoading={hasPendingSubmit}
                    disabled={hasPendingSubmit}
                    onClick={() => {
                      submit("propose");
                    }}
                  >
                    Propose without sponsors
                  </Button>
                </div>
              </footer>
            </>
          ) : (
            <>
              <main>
                {canProposeWithoutSponsors ? (
                  <Callout style={{ margin: "0 0 3.2rem" }}>
                    <p>
                      Because your voting power ({proposerVotingPower}) meets
                      the current proposal theshold ({proposalThreshold + 1}),
                      you can propose without sponsors.
                    </p>
                    <p>
                      <Button
                        type="button"
                        variant="primary"
                        isLoading={pendingSubmitTarget === "propose"}
                        disabled={hasPendingSubmit}
                        onClick={() => {
                          submit("propose");
                        }}
                      >
                        Propose without sponsors
                      </Button>
                    </p>
                  </Callout>
                ) : validSignatures.length === 0 ? (
                  // Dialog triggers will not display in this state
                  <>Not enough voting power to propose</>
                ) : null}

                {validSignatures.length > 0 && (
                  <>
                    <div
                      css={(t) =>
                        css({
                          margin: "0 0 3.2rem",
                          "p + p": { marginTop: "1.6rem" },
                          "[data-small]": {
                            fontSize: t.text.sizes.small,
                            color: t.colors.textDimmed,
                          },
                          em: {
                            color: t.colors.textNormal,
                            fontStyle: "normal",
                            fontWeight: t.text.weights.emphasis,
                          },
                        })
                      }
                    >
                      <p>
                        Select signatures to submit with your proposal. The
                        combined voting power of signers
                        {proposerVotingPower > 0 && (
                          <>
                            , <i>and your account</i>,
                          </>
                        )}{" "}
                        must meet the current proposal threshold (
                        {proposalThreshold + 1}).
                      </p>
                      <p data-small>
                        Sponsors will have permission to{" "}
                        <em>cancel your proposal</em> — choose with care.
                      </p>
                    </div>
                    <Label htmlFor="signature-list" id="signature-list-label">
                      Select sponsor signatures
                    </Label>
                    <SignatureListBox
                      id="signature-list"
                      aria-labelledby="signature-list-label"
                      options={validSignatures.map((s) => ({
                        id: s.signer.id,
                        name: s.signer.id,
                        signature: s,
                      }))}
                      selectedKeys={selectedSignerIds}
                      onSelectionChange={(ids) => {
                        setSelectedSignerIds(ids);
                      }}
                      disabledKeys={
                        hasPendingSubmit
                          ? validSignatures.map((s) => s.signer.id)
                          : []
                      }
                    />
                  </>
                )}
              </main>
              <footer
                css={css({
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: "2.5rem",
                  "@media (min-width: 600px)": {
                    marginTop: "3rem",
                  },
                })}
              >
                <div css={css({ display: "flex", gap: "1rem" })}>
                  <Button type="button" size="medium" onClick={dismiss}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="medium"
                    variant="primary"
                    isLoading={pendingSubmitTarget === "propose-by-sigs"}
                    disabled={
                      hasPendingSubmit || !canProposeWithSelectedSponsors
                    }
                    onClick={() => {
                      submit("propose-by-sigs");
                    }}
                  >
                    Submit proposal
                  </Button>
                </div>
              </footer>
            </>
          )}
        </div>
      )}
    </Dialog>
  );
};

const SignatureListBox = ({
  options,
  selectedKeys,
  onSelectionChange,
  ...props
}) => (
  <ListBox
    items={options}
    selectedKeys={selectedKeys}
    selectionMode="multiple"
    onSelectionChange={onSelectionChange}
    css={css({
      display: "flex",
      flexDirection: "column",
      gap: "0.8rem",
    })}
    {...props}
  >
    {(item) => (
      <ListBoxItem
        css={(t) =>
          css({
            border: "0.1rem solid",
            borderColor: t.colors.borderLight,
            borderRadius: "0.5rem",
            padding: "0.8rem",
            outline: "none",
            "&[data-focus-visible]": {
              boxShadow: t.shadows.focus,
            },
            "&[data-selected]": {
              borderColor: t.colors.primary,
              background: t.colors.backgroundModifierSelected,
            },
            "@media(hover: hover)": {
              ":not(&[data-disabled])": {
                cursor: "pointer",
                ":not(&[data-selected]):hover": {
                  background: t.colors.backgroundModifierNormal,
                },
              },
            },
          })
        }
        textValue={item.name}
      >
        <SignatureItemContent signature={item.signature} />
      </ListBoxItem>
    )}
  </ListBox>
);

const SignatureItemContent = ({ signature }) => {
  const { displayName } = useAccountDisplayName(signature.signer.id);
  const votingPower = signature.signer.nounsRepresented.length;
  return (
    <div css={css({ display: "flex", alignItems: "center", gap: "1rem" })}>
      <AccountAvatar
        address={signature.signer.id}
        size="2.4rem"
        placeholder={false}
      />
      <div style={{ flex: 1, minWidth: 0 }}>{displayName}</div>
      <div
        css={(t) =>
          css({
            color: t.colors.textDimmed,
            fontSize: t.text.sizes.small,
            padding: "0 0.5rem",
          })
        }
      >
        {votingPower} {votingPower === 1 ? "noun" : "nouns"}
      </div>
    </div>
  );
};

export default PromoteCandidateDialog;

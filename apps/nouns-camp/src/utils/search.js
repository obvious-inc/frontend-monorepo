"use client";

import { searchRecords } from "@shades/common/utils";
import { search as searchEns } from "@/utils/ens";
import { isRichTextNodeEmpty } from "@shades/ui-web/rich-text-editor";

/**
 * Performs search across multiple sources of content
 *
 * @param {Object} params - Search parameters
 * @param {string} params.query - Search query string
 * @param {Array} params.proposals - Proposals to search through
 * @param {Array} params.proposalDrafts - Proposal drafts to search through
 * @param {Array} params.candidates - Candidates to search through
 * @param {Array} params.topics - Topics to search through
 * @param {Array} params.proposalUpdateCandidates - Proposal update candidates to search through
 * @param {Object} params.primaryEnsNameByAddress - ENS names by address mapping
 * @returns {Array} - Search results
 */
export function performSearch(dataset, query) {
  if (query == null || query.trim() === "") return [];

  const {
    proposals = [],
    proposalDrafts = [],
    candidates = [],
    topics = [],
    proposalUpdateCandidates = [],
    primaryEnsNameByAddress = {},
  } = dataset;

  // Process drafts to filter empty ones
  const filteredProposalDrafts = proposalDrafts
    .filter((d) => {
      if (d.name.trim() !== "") return true;
      return d.body.some((n) => !isRichTextNodeEmpty(n, { trim: true }));
    })
    .map((d) => ({ ...d, type: "draft" }));

  // Find matching ENS addresses
  const matchingAddresses =
    query.length >= 3 ? searchEns(primaryEnsNameByAddress, query) : [];

  // Search all records
  const matchingRecords = searchRecords(
    [
      // Proposal drafts
      ...filteredProposalDrafts.map((d) => ({
        type: "draft",
        data: d,
        tokens: [
          { value: d.id, exact: true },
          { value: d.proposerId, exact: true },
          { value: d.name },
        ],
        fallbackSortProperty: Infinity,
      })),
      // Proposals
      ...proposals.map((p) => ({
        type: "proposal",
        data: p,
        tokens: [
          { value: p.id, exact: true },
          { value: p.proposerId, exact: true },
          { value: p.title },
          ...(p.signers ?? []).map((s) => ({ value: s.id, exact: true })),
        ],
        fallbackSortProperty: p.createdBlock,
      })),
      // Candidates, topics, and updates
      ...[...topics, ...candidates, ...proposalUpdateCandidates].map((c) => ({
        type: "candidate",
        data: c,
        tokens: [
          { value: c.id, exact: true },
          { value: c.proposerId, exact: true },
          { value: c.latestVersion?.content.title },
          ...(c.latestVersion?.content.contentSignatures ?? []).map((s) => ({
            value: s.signer.id,
            exact: true,
          })),
        ],
        fallbackSortProperty: c.createdBlock,
      })),
    ],
    [query, ...matchingAddresses],
  );

  // Add ENS address matches
  let results = [...matchingRecords];

  if (matchingAddresses.length > 0) {
    // Add ENS matches at the beginning
    for (const address of matchingAddresses.toReversed()) {
      results.unshift({
        type: "account",
        data: { id: address },
      });
    }
  }

  return results;
}

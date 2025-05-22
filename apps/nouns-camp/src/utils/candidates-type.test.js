import { describe, it, expect } from "vitest";
import { isApplicationSlug, matchTopicTransactions, determineCandidateType } from "./candidates";

describe("isApplicationSlug", () => {
  it("returns true for slugs starting with nouns-grants-", () => {
    expect(isApplicationSlug("nouns-grants-example")).toBe(true);
    expect(isApplicationSlug("nouns-grants-123")).toBe(true);
    expect(isApplicationSlug("nouns-grants-")).toBe(true);
  });

  it("returns false for other slugs", () => {
    expect(isApplicationSlug("example-slug")).toBe(false);
    expect(isApplicationSlug("nouns-grant-example")).toBe(false);
    expect(isApplicationSlug("nouns-grants")).toBe(false);
    expect(isApplicationSlug("")).toBe(false);
    expect(isApplicationSlug(null)).toBe(false);
    expect(isApplicationSlug(undefined)).toBe(false);
  });
});

describe("matchTopicTransactions", () => {
  it("returns true for empty transactions", () => {
    expect(matchTopicTransactions([])).toBe(true);
  });

  it("returns false for multiple transactions", () => {
    expect(
      matchTopicTransactions([
        { type: "transfer", target: "0x", value: 0n },
        { type: "transfer", target: "0x", value: 0n },
      ]),
    ).toBe(false);
  });

  it("returns true for zero value transfers to zero address", () => {
    const ZERO_ADDRESS = "0x".padEnd(42, "0");
    expect(
      matchTopicTransactions([
        { type: "transfer", target: ZERO_ADDRESS, value: 0n },
      ]),
    ).toBe(true);
  });
});

describe("determineCandidateType", () => {
  it("returns 'application' for application slugs regardless of transactions", () => {
    const ZERO_ADDRESS = "0x".padEnd(42, "0");
    const zeroValueTransfer = [{ type: "transfer", target: ZERO_ADDRESS, value: 0n }];
    const nonZeroValueTransfer = [{ type: "transfer", target: ZERO_ADDRESS, value: 1n }];
    
    expect(determineCandidateType("nouns-grants-example", zeroValueTransfer)).toBe("application");
    expect(determineCandidateType("nouns-grants-example", nonZeroValueTransfer)).toBe("application");
    expect(determineCandidateType("nouns-grants-example", [])).toBe("application");
  });

  it("returns 'topic' for non-application slugs with topic transactions", () => {
    const ZERO_ADDRESS = "0x".padEnd(42, "0");
    const zeroValueTransfer = [{ type: "transfer", target: ZERO_ADDRESS, value: 0n }];
    
    expect(determineCandidateType("example-slug", zeroValueTransfer)).toBe("topic");
    expect(determineCandidateType("topic-example", zeroValueTransfer)).toBe("topic");
    expect(determineCandidateType("", zeroValueTransfer)).toBe("topic");
  });

  it("returns 'proposal' for non-application slugs with non-topic transactions", () => {
    const ZERO_ADDRESS = "0x".padEnd(42, "0");
    const nonZeroValueTransfer = [{ type: "transfer", target: ZERO_ADDRESS, value: 1n }];
    const multipleTransactions = [
      { type: "transfer", target: ZERO_ADDRESS, value: 0n },
      { type: "transfer", target: ZERO_ADDRESS, value: 0n },
    ];
    
    expect(determineCandidateType("example-slug", nonZeroValueTransfer)).toBe("proposal");
    expect(determineCandidateType("proposal-example", multipleTransactions)).toBe("proposal");
  });
});
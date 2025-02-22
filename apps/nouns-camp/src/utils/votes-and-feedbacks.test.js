import { expect, test, describe } from "vitest";
import {
  REPLY_REGEX,
  createRepostExtractor,
  createReplyExtractor,
  formatReply,
  formatRepost,
} from "./votes-and-feedbacks.js";

describe("repost extraction", () => {
  const sourceReasons = ["foo", "bar", `baz\n\n+1\n\n> foo`, "foo\u2028bar"];

  const extract = createRepostExtractor(
    sourceReasons.map((reason) => ({ reason })),
  );

  test("matches simple repost", () => {
    const [matchingPosts] = extract("+1\n\n> foo");
    expect(matchingPosts).toHaveLength(1);
    expect(matchingPosts[0].reason).toBe("foo");
  });

  test("matches multiple reposts with comments", () => {
    const [matchingPosts] = extract(
      `comment\n\n+1\n\n> bar\n\ncomment\n\n+1\n\n>baz\n\ncomment`,
    );
    expect(matchingPosts).toHaveLength(2);
    expect(matchingPosts[0].reason).toBe("bar");
    expect(matchingPosts[1].reason).toBe("baz\n\n+1\n\n> foo");
  });

  test("matches nested repost", () => {
    const [matchingPosts] = extract(
      `comment\n\n+1\n\n> baz\n>\n> +1\n>\n> > foo`,
    );
    expect(matchingPosts).toHaveLength(1);
    expect(matchingPosts[0].reason).toBe("baz\n\n+1\n\n> foo");
  });

  test("matches repost with unicode line separator", () => {
    const [matchingPosts] = extract("+1\n\n> foo\u2028> bar");
    expect(matchingPosts).toHaveLength(1);
    expect(matchingPosts[0].reason).toBe("foo\u2028bar");
  });

  test("matches repost with quoted unicode line separator", () => {
    const [matchingPosts] = extract("+1\n\n> foo\u2028> bar");
    expect(matchingPosts).toHaveLength(1);
    expect(matchingPosts[0].reason).toBe("foo\u2028bar");
  });
});

describe("REPLY_REGEX", () => {
  test("matches valid reply format", () => {
    const text = "@0x1234...5678\n\nReply content\n\n> Original message";
    const matches = [...text.matchAll(REPLY_REGEX)];
    expect(matches).toHaveLength(1);
    expect(matches[0].groups).toEqual({
      author: "0x1234...5678",
      reply: "Reply content\n",
      quote: "> Original message",
    });
  });

  test("doesn't match invalid formats", () => {
    const invalidTexts = [
      "@0x1234\nNo double newline",
      "@invalidAddress\n\nMissing quote",
      "Missing @ symbol\n\nContent\n\n> Quote",
    ];

    invalidTexts.forEach((text) => {
      const matches = [...text.matchAll(REPLY_REGEX)];
      expect(matches).toHaveLength(0);
    });
  });
});

describe("reply extraction", () => {
  const sourceVotesAndFeedbacks = [
    {
      voterId: "0x123456789012345678901234567890123456abcd",
      reason: "Original message",
    },
    {
      voterId: "0xabcdef1234567890123456789012345678901234",
      reason: "Another message",
    },
  ];

  const extract = createReplyExtractor(sourceVotesAndFeedbacks);

  test("extracts single reply", () => {
    const [replies, remaining] = extract(
      "@0x1234...abcd\n\nReply text\n\n> Original message",
    );
    expect(replies).toHaveLength(1);
    expect(replies[0]).toEqual({
      body: "Reply text\n",
      target: sourceVotesAndFeedbacks[0],
    });
    expect(remaining.trim()).toBe("");
  });

  test("extracts multiple replies", () => {
    const [replies, remaining] = extract(
      "@0x1234...abcd\n\nFirst reply\n\n> Original message\n\n@0xabcd...1234\n\nSecond reply\n\n> Another message",
    );
    expect(replies).toHaveLength(2);
    expect(replies[0].body).toBe("First reply\n");
    expect(replies[1].body).toBe("Second reply\n");
    expect(remaining.trim()).toBe("");
  });

  test("handles no matches", () => {
    const [replies, remaining] = extract("Just regular text");
    expect(replies).toHaveLength(0);
    expect(remaining).toBe("Just regular text");
  });

  test("handles null input", () => {
    const [replies, remaining] = extract(null);
    expect(replies).toHaveLength(0);
    expect(remaining).toBe(null);
  });
});

describe("formatRepost", () => {
  test("formats single line reason", () => {
    expect(formatRepost("Original text")).toBe("+1\n\n> Original text");
  });

  test("formats multi-line reason", () => {
    expect(formatRepost("First line\nSecond line")).toBe(
      "+1\n\n> First line\n> Second line",
    );
  });

  test("trims whitespace", () => {
    expect(formatRepost("  Text with spaces  \n\n")).toBe(
      "+1\n\n> Text with spaces",
    );
  });
});

describe("formatReply", () => {
  test("formats valid reply", () => {
    expect(
      formatReply({
        target: {
          voterId: "0x1234567890123456789012345678901234567890",
          reason: "Original comment",
        },
        body: "Reply text",
      }),
    ).toBe("@0x1234...7890\n\nReply text\n\n> Original comment");
  });

  test("formats reply with multiline reason", () => {
    expect(
      formatReply({
        target: {
          voterId: "0x1234567890123456789012345678901234567890",
          reason: "First line\nSecond line",
        },
        body: "Reply text",
      }),
    ).toBe("@0x1234...7890\n\nReply text\n\n> First line\n> Second line");
  });

  test("throws error on empty body", () => {
    expect(() =>
      formatReply({
        target: {
          voterId: "0x1234567890123456789012345678901234567890",
          reason: "Original comment",
        },
        body: "",
      }),
    ).toThrow("body is required");
  });

  test("throws error on whitespace-only body", () => {
    expect(() =>
      formatReply({
        target: {
          voterId: "0x1234567890123456789012345678901234567890",
          reason: "Original comment",
        },
        body: "   \n  ",
      }),
    ).toThrow("body is required");
  });
});

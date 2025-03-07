import {
  invariant,
  markdown as markdownUtils,
  ethereum as ethereumUtils,
} from "@shades/common/utils";

// Matches a paragraph "+1", followed by the quoted repost target `reason`.
//
// Example:
//
//     +1
//
//     > Voting against this prop for no good reason
export const REPOST_REGEX = /^\+1$(\n){2}(?<quote>(?:^>.*?$\s*)+)/gms;

// Matches an @-prefixed truncated address like "@0xe3D7...A436", followed by
// the reply content, and an end boundry consisting of the quoted reply target
// `reason`.
//
// Example:
//
//     @0xe3D7...A436
//
//     I don't know 😭
//
//     > Why can't we have nice things?
export const REPLY_REGEX =
  /^@(?<author>0x[a-zA-Z0-9]{4}(\.){3}[a-zA-Z0-p]{4})(\n){2}(?<reply>.+?)\n(?<quote>(?:^>.*?$\s*)+)/gms;

// A more general reply pattern that can match replies with complex structure
// This helps with extracting replies with embedded quotes
export const GENERAL_REPLY_REGEX =
  /^@(?<author>0x[a-zA-Z0-9]{4}(\.){3}[a-zA-Z0-9]{4})(\n){2}(?<content>[\s\S]+)/gm;

/**
 * Helper function to extract structured reply data from text.
 * Used internally by createReplyExtractor when dealing with complex replies.
 */
function extractStructuredReply(text) {
  if (!text) return null;

  const matches = [...text.matchAll(GENERAL_REPLY_REGEX)];
  if (matches.length === 0) return null;

  const { author, content } = matches[0].groups;

  // Find the last substantial quote block in the content
  // We treat this as the original message being replied to
  const quoteBlocks = [];
  let currentQuote = [];
  let inQuote = false;

  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("> ") || line === ">") {
      // Start or continue a quote block
      inQuote = true;
      currentQuote.push(line);
    } else if (inQuote) {
      // End of a quote block
      if (currentQuote.length > 0) {
        quoteBlocks.push(currentQuote.join("\n"));
        currentQuote = [];
      }
      inQuote = false;
    }
  }

  // Add the last quote block if we're still in one
  if (currentQuote.length > 0) {
    quoteBlocks.push(currentQuote.join("\n"));
  }

  // If no quote blocks found, this isn't a reply
  if (quoteBlocks.length === 0) return null;

  // The last quote block is likely the original message being replied to
  const quote = quoteBlocks[quoteBlocks.length - 1];

  // Everything before the last quote block is the reply
  const lastQuoteIndex = content.lastIndexOf(quote);
  const reply = content.substring(0, lastQuoteIndex).trim();

  return {
    author,
    reply,
    quote,
  };
}

/**
 * Helper function to extract all reply structures from a text containing multiple replies.
 * Used internally by createReplyExtractor.
 */
function extractAllReplies(text) {
  if (!text) return [];

  const replies = [];

  // Split the text by a regex that matches the start of a reply (@address)
  const segments = text.split(
    /(?=^@0x[a-zA-Z0-9]{4}\.{3}[a-zA-Z0-9]{4}\n\n)/gm,
  );

  // Process each segment that looks like a reply
  for (const segment of segments) {
    if (segment.match(/^@0x[a-zA-Z0-9]{4}\.{3}[a-zA-Z0-9]{4}\n\n/)) {
      const reply = extractStructuredReply(segment);
      if (reply) {
        replies.push(reply);
      }
    }
  }

  return replies;
}

/**
 * Creates a function that extracts reply data from reason text.
 *
 * Enhancement: Now properly handles:
 * - Embedded quotes within reply text
 * - Multiple replies in a single feedback
 * - Case-insensitive address comparison
 */
export const createReplyExtractor =
  (ascendingSourceVotesAndFeedbackPosts) => (reason) => {
    if (reason == null || reason.trim() === "") return [[], reason];

    // First try standard extraction
    const simpleMatches = [...reason.matchAll(REPLY_REGEX)];

    // If simple matching works, use it
    if (simpleMatches.length > 0) {
      let strippedText = reason;
      const replies = [];

      for (const match of simpleMatches) {
        try {
          const quoteBody = markdownUtils.unquote(match.groups.quote.trim());
          const truncatedReplyTargetAuthorAddress =
            match.groups.author.toLowerCase();
          const matchedReplyTarget = ascendingSourceVotesAndFeedbackPosts.find(
            ({ voterId: originVoterId, reason: originReason }) => {
              if (originReason == null) return false;

              // Check content
              if (originReason.trim() !== quoteBody.trim()) return false;

              // Check author
              const truncatedOriginVoterId = [
                originVoterId.slice(0, 6),
                originVoterId.slice(-4),
              ].join("...");
              return (
                truncatedOriginVoterId.toLowerCase() ===
                truncatedReplyTargetAuthorAddress
              );
            },
          );
          if (matchedReplyTarget == null) {
            continue;
          }
          strippedText = strippedText.replace(match[0], "");
          replies.push({
            body: match.groups.reply,
            target: matchedReplyTarget,
          });
        } catch (e) {
          continue;
        }
      }

      return [replies, strippedText];
    }

    // If simple extraction didn't work, try enhanced extraction for complex replies
    // This helps with handling embedded quotes or multiple replies
    const parsedReplies = extractAllReplies(reason);
    if (parsedReplies.length === 0) return [[], reason];

    const replies = [];
    let strippedText = reason;

    // Process each parsed reply
    for (const { author, reply, quote } of parsedReplies) {
      try {
        const quoteBody = markdownUtils.unquote(quote.trim());
        const truncatedReplyTargetAuthorAddress = author.toLowerCase();

        // Find matching post by comparing content and author
        const matchedReplyTarget = ascendingSourceVotesAndFeedbackPosts.find(
          ({ voterId: originVoterId, reason: originReason }) => {
            if (originReason == null) return false;

            // Check content
            const contentMatch = originReason.trim() === quoteBody.trim();

            // Check author - we compare truncated IDs
            const truncatedOriginVoterId = [
              originVoterId.slice(0, 6),
              originVoterId.slice(-4),
            ].join("...");
            const authorMatch =
              truncatedOriginVoterId.toLowerCase() ===
              truncatedReplyTargetAuthorAddress;

            return contentMatch && authorMatch;
          },
        );

        // If we found a matching target, add to replies
        if (matchedReplyTarget != null) {
          replies.push({
            body: reply,
            target: matchedReplyTarget,
          });
        }
      } catch (e) {
        continue;
      }
    }

    // If we found replies, consider the text processed
    if (replies.length > 0) {
      strippedText = "";
    }

    return [replies, strippedText];
  };

export const createRepostExtractor =
  (ascendingSourceVotesAndFeedbackPosts) => (reason) => {
    if (reason == null || reason.trim() === "") return [[], reason];

    const matches = [...reason.matchAll(REPOST_REGEX)];

    let strippedText = reason;
    const reposts = [];

    for (const match of matches) {
      try {
        const quoteBody = markdownUtils
          .unquote(match.groups.quote.trim())
          .trim();
        const matchedPost = ascendingSourceVotesAndFeedbackPosts.find(
          ({ reason: originReason }) => {
            if (originReason == null) return false;
            // Check if the whole reason matches
            // (can't use e.g. `includes` since that might include nested reposts)
            if (originReason.trim() === quoteBody.trim()) return true;

            // Check if the reason matches when stripping it of reposts
            return (
              // Checking `includes` first to not match the regex unnecessarily
              originReason.includes(quoteBody.trim()) &&
              originReason.replaceAll(REPOST_REGEX, "").trim() ===
                quoteBody.trim()
            );
          },
        );
        if (matchedPost == null) {
          continue;
        }
        strippedText = strippedText.replace(match[0], "");
        reposts.push(matchedPost);
      } catch (e) {
        continue;
      }
    }

    return [reposts, strippedText];
  };

export const formatRepost = (targetReason) =>
  `+1\n\n${markdownUtils.blockquote(targetReason.trim())}`;

export const formatReply = ({ target, body }) => {
  invariant(body != null && body.trim() !== "", "body is required");
  return [
    `@${ethereumUtils.truncateAddress(target.voterId)}`,
    body,
    markdownUtils.blockquote(target.reason),
  ].join("\n\n");
};

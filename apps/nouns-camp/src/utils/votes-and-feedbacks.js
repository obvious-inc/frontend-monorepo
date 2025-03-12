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
// the reply content, and an end boundary consisting of the quoted reply target
// `reason`.
//
// Example:
//
//     @0xe3D7...A436
//
//     I don’t know 😭
//
//     > Why can’t we have nice things?
export const REPLY_REGEX =
  /^@(?<author>0x[a-zA-Z0-9]{4}(\.){3}[a-zA-Z0-p]{4})(\n){2}(?<reply>.+?)\n(?<quote>(?:^>.*?$\s*)+)/gms;

// Matches the initial pattern of a reply (@address followed by double newline)
// Used to extract the author and the rest of the content for further processing
const REPLY_SHAPE_REGEX =
  /^@(?<author>0x[a-zA-Z0-9]{4}(?:\.){3}[a-zA-Z0-p]{4})(?:\n){2}(?<rest>.*)/gms;

// Matches a blockquote (one or more lines starting with '>')
const BLOCKQUOTE_REGEX = /^>.*(?:\n^>.*)*$/gm;

export const createReplyExtractor =
  (ascendingSourceVotesAndFeedbackPosts) => (reason) => {
    if (reason == null || reason.trim() === "") return [[], reason];

    // Split the text by @mention patterns to process each potential reply separately
    const matches = reason
      .slice(
        Math.max(
          0,
          reason.indexOf(/^@0x[a-zA-Z0-9]{4}(?:\.){3}[a-zA-Z0-p]{4}$/m),
        ),
      )
      .split(/(?=^@0x[a-zA-Z0-9]{4}(?:\.){3}[a-zA-Z0-p]{4}$)/m);

    let strippedText = reason;
    const replies = [];

    for (const match_ of matches) {
      // Extract the author and rest of the content
      const [match] = match_.matchAll(REPLY_SHAPE_REGEX);
      if (match == null) continue;

      // Process each blockquote in the content
      for (const [blockquote] of [
        ...match.groups.rest.matchAll(BLOCKQUOTE_REGEX),
      ]) {
        try {
          // Extract the unquoted content from the blockquote
          const quoteBody = markdownUtils.unquote(blockquote.trim());
          const truncatedReplyTargetAuthorAddress =
            match.groups.author.toLowerCase();

          // Find the matching target post
          const matchedReplyTarget = ascendingSourceVotesAndFeedbackPosts.find(
            ({ voterId: originVoterId, reason: originReason }) => {
              if (originReason == null) return false;

              // Check if content matches
              if (originReason.trim() !== quoteBody.trim()) return false;

              // Check if author matches
              const truncatedOriginVoterId = [
                originVoterId.slice(0, 6),
                originVoterId.slice(-4),
              ]
                .join("...")
                .toLowerCase();

              return (
                truncatedOriginVoterId === truncatedReplyTargetAuthorAddress
              );
            },
          );

          if (matchedReplyTarget == null) continue;

          // Identify the entire reply section
          const matchedReply = match[0].slice(
            0,
            match[0].indexOf(blockquote) + blockquote.length,
          );

          const content = match.groups.rest;

          // Extract the reply text (everything before the blockquote)
          const replyText = content.slice(0, content.indexOf(blockquote));

          // Remove the processed reply from the original text
          strippedText = strippedText.replace(matchedReply, "");

          replies.push({
            body: replyText.trimEnd(),
            target: matchedReplyTarget,
          });
        } catch (e) {
          continue;
        }
      }
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
            // (can’t use e.g. `includes` since that might include nested reposts)
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
          // console.warn(`No match found for repost quote body "${quoteBody}"`);
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

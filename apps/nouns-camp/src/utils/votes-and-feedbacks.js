import {
  markdown as markdownUtils,
  ethereum as ethereumUtils,
} from "@shades/common/utils";

export const REPOST_REGEX = /^\+1$\n\n(?<quote>(?:^>.*?$\n?)+)/gms;
// Matches an @-prefixed truncated address like "@0xe3D7...A436"
export const REPLY_REGEX =
  /^@(?<author>0x[a-zA-Z0-9]{4}\.\.\.[a-zA-Z0-p]{4})\n\n(?<reply>.+?)\n(?<quote>(?:^>.*?$\n?)+)/gms;

const unquote = (markdown) =>
  markdown
    .split("\n")
    .map((line) => {
      if (line[0] !== ">") throw new Error();
      if (line[1] === " ") return line.slice(2);
      return line.slice(1);
    })
    .join("\n");

export const createReplyExtractor =
  (ascendingSourceVotesAndFeedbackPosts) => (reason) => {
    if (reason == null || reason.trim() === "") return [[], reason];

    const matches = reason.matchAll(REPLY_REGEX);

    if (matches == null) return [[], reason];

    let strippedText = reason;
    const replies = [];

    for (const match of matches) {
      const quoteBody = unquote(match.groups.quote.trim());
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
          return truncatedOriginVoterId === truncatedReplyTargetAuthorAddress;
        },
      );
      if (matchedReplyTarget == null) {
        console.warn(`No match found for reply target "${match.groups.quote}"`);
        continue;
      }
      strippedText = strippedText.replace(match[0], "");
      replies.push({
        body: match.groups.reply,
        target: matchedReplyTarget,
      });
    }

    return [replies, strippedText];
  };

export const createRepostExtractor =
  (ascendingSourceVotesAndFeedbackPosts) => (reason) => {
    if (reason == null || reason.trim() === "") return [[], reason];

    const matches = reason.matchAll(REPOST_REGEX);

    if (matches == null) return [[], reason];

    let strippedText = reason;
    const reposts = [];

    for (const match of matches) {
      const quoteBody = unquote(match.groups.quote.trim()).trim();
      const matchedPost = ascendingSourceVotesAndFeedbackPosts.find(
        ({ reason: originReason }) => {
          if (originReason == null) return false;
          // Check if the whole reason matches
          // (can’t use e.g. `includes` since that might include nested reposts)
          if (originReason.trim() === quoteBody) return true;
          // Check if the reason matches when stripping it of reposts
          return (
            // Checking `includes` first to not match the regex unnecessarily
            originReason.includes(quoteBody) &&
            originReason.replaceAll(REPOST_REGEX, "").trim() === quoteBody
          );
        },
      );
      if (matchedPost == null) {
        console.warn(`No match found for repost quote body "${quoteBody}"`);
        continue;
      }
      strippedText = strippedText.replace(match[0], "");
      reposts.push(matchedPost);
    }

    return [reposts, strippedText];
  };

export const formatRepost = (targetReason) =>
  `+1\n\n${markdownUtils.blockquote(targetReason.trim())}`;

export const formatReply = ({ target, body }) =>
  [
    `@${ethereumUtils.truncateAddress(target.voterId)}`,
    body,
    markdownUtils.blockquote(target.reason),
  ].join("\n\n");

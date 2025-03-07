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
 * 
 * Enhanced to handle multiple quotes, embedded quotes, and preserving intro text.
 */
function extractStructuredReply(text) {
  if (!text) return null;

  const matches = [...text.matchAll(GENERAL_REPLY_REGEX)];
  if (matches.length === 0) return null;

  const { author, content } = matches[0].groups;

  // Split content into segments (quote blocks and text blocks)
  const segments = [];
  let currentQuote = [];
  let currentText = [];
  let inQuote = false;

  const lines = content.split("\n");
  
  // Process each line and build segments
  for (const line of lines) {
    const isQuoteLine = line.startsWith("> ") || line === ">";

    if (isQuoteLine) {
      // Starting or continuing a quote block
      if (!inQuote && currentText.length > 0) {
        segments.push({
          type: "text",
          content: currentText.join("\n"),
          index: segments.length
        });
        currentText = [];
      }
      inQuote = true;
      currentQuote.push(line);
    } else {
      // Regular text
      if (inQuote && currentQuote.length > 0) {
        segments.push({
          type: "quote",
          content: currentQuote.join("\n"),
          index: segments.length
        });
        currentQuote = [];
        inQuote = false;
      }
      
      if (line.trim() !== '') {
        currentText.push(line);
      }
    }
  }

  // Add any remaining segment
  if (inQuote && currentQuote.length > 0) {
    segments.push({ type: "quote", content: currentQuote.join("\n"), index: segments.length });
  } else if (currentText.length > 0) {
    segments.push({ type: "text", content: currentText.join("\n"), index: segments.length });
  }

  // Extract quotes and intro text
  const quoteSegments = segments.filter(s => s.type === "quote");
  if (quoteSegments.length === 0) return null;
  
  const firstSegment = segments[0] || {};
  const introText = (firstSegment.type === "text") ? firstSegment.content.trim() : "";

  // Simple case: just one quote with intro text as the reply
  if (quoteSegments.length === 1 && segments.length === 2 && introText) {
    return {
      author,
      reply: introText,
      quote: quoteSegments[0].content,
    };
  }
  
  // Find reply/quote pairs
  const replies = [];
  
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].type !== "quote") continue;
    
    const quote = segments[i];
    const nextSegment = segments[i+1];
    const prevSegment = segments[i-1];
    
    // Check for text after quote (reply follows quote)
    if (nextSegment && nextSegment.type === "text") {
      replies.push({
        author,
        reply: nextSegment.content.trim(),
        quote: quote.content,
        quoteIndex: quote.index
      });
    }
    
    // Check for text before quote (if not intro text)
    if (prevSegment && prevSegment.type === "text" && prevSegment.index > 0) {
      replies.push({
        author,
        reply: prevSegment.content.trim(),
        quote: quote.content,
        quoteIndex: quote.index
      });
    }
  }
  
  // For complex cases with multiple replies
  if (replies.length > 0) {
    // Sort replies by quote position
    const sortedReplies = [...replies].sort((a, b) => a.quoteIndex - b.quoteIndex);
    
    // Clean up the replies
    const cleanedReplies = sortedReplies.map(({ author, reply, quote }) => ({
      author, reply, quote
    }));
    
    return {
      multipleReplies: true,
      introText,
      replies: cleanedReplies,
      author,
    };
  }

  // Fallback: use the last quote and the first text segment as reply
  const lastQuote = quoteSegments[quoteSegments.length - 1].content;
  
  return {
    author,
    reply: introText || "",
    quote: lastQuote,
  };
}

/**
 * Helper function to extract all reply structures from a text containing multiple replies.
 * Used internally by createReplyExtractor.
 */
export function extractAllReplies(text) {
  if (!text) return [];

  const allReplies = [];
  const replyStartPattern = /^@0x[a-zA-Z0-9]{4}\.{3}[a-zA-Z0-9]{4}\n\n/;

  // Split text into segments at each reply marker (@address)
  const segments = text.split(/(?=^@0x[a-zA-Z0-9]{4}\.{3}[a-zA-Z0-9]{4}\n\n)/gm);
  
  // Process each valid reply segment
  for (const segment of segments) {
    if (!segment.match(replyStartPattern)) continue;
    
    const result = extractStructuredReply(segment);
    if (!result) continue;
    
    // Handle both simple and complex reply structures
    if (result.multipleReplies) {
      allReplies.push({
        type: 'structuredReply',
        introText: result.introText,
        replies: result.replies,
        author: result.author
      });
    } else {
      allReplies.push(result);
    }
  }

  return allReplies;
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

    // Extract information from structured and simple replies
    let introText = '';
    let structuredItem = null;
    
    // First pass: look for structured replies and intro text
    for (const item of parsedReplies) {
      if (item.type === 'structuredReply') {
        structuredItem = item;
        introText = item.introText || '';
        break;
      } else if (item.type === 'introText') {
        introText = item.content || '';
      }
    }
    
    // Process structured replies if we found any
    if (structuredItem && structuredItem.replies.length > 0) {
      // Set intro text as the stripped text
      strippedText = introText;
      
      // Process each structured reply
      for (const { author, reply, quote } of structuredItem.replies) {
        // Skip empty replies or ones that duplicate the intro text
        if (!reply || reply.trim() === '' || reply.trim() === introText.trim()) {
          continue;
        }
        
        // Try to match this reply to a source post
        const quoteBody = markdownUtils.unquote(quote.trim());
        const truncatedAuthorAddress = author.toLowerCase();
        
        const matchedTarget = findMatchingPost(
          ascendingSourceVotesAndFeedbackPosts,
          quoteBody,
          truncatedAuthorAddress
        );
        
        // If we found a matching target, add to replies
        if (matchedTarget) {
          replies.push({
            body: reply,
            target: matchedTarget,
          });
        }
      }
      
      // If we found replies, return them with the intro text
      if (replies.length > 0) {
        return [replies, strippedText];
      }
    }
    
    // Process simple replies if structured approach didn't work
    for (const item of parsedReplies) {
      // Skip processed items
      if (item.type === 'structuredReply' || item.type === 'introText') {
        continue;
      }
      
      const { author, reply, quote } = item;
      
      // Skip empty replies
      if (!reply || reply.trim() === '') continue;
      
      // Try to match this reply to a source post
      const quoteBody = markdownUtils.unquote(quote.trim());
      const truncatedAuthorAddress = author.toLowerCase();
      
      const matchedTarget = findMatchingPost(
        ascendingSourceVotesAndFeedbackPosts,
        quoteBody,
        truncatedAuthorAddress
      );
      
      // If we found a matching target, add to replies
      if (matchedTarget) {
        replies.push({
          body: reply,
          target: matchedTarget,
        });
      }
    }
    
    // Set stripped text if we found any replies
    if (replies.length > 0) {
      strippedText = introText || '';
    }
    
    // Helper function to find matching posts
    function findMatchingPost(posts, quoteBody, authorAddress) {
      return posts.find(({ voterId, reason }) => {
        if (!reason) return false;
        
        // Check content - try both exact and substring matches
        const exactMatch = reason.trim() === quoteBody.trim();
        const substringMatch = quoteBody.length > 50 && reason.includes(quoteBody.trim());
        const contentMatch = exactMatch || substringMatch;
        
        // Check author
        const truncatedId = [voterId.slice(0, 6), voterId.slice(-4)].join("...");
        const authorMatch = truncatedId.toLowerCase() === authorAddress;
        
        return contentMatch && authorMatch;
      });
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

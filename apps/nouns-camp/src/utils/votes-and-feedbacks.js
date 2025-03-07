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
 * Enhanced to better handle:
 * - Multiple quotes within the same feedback
 * - Embedded quotes within reply text
 * - Preserving intro text separate from replies
 * - More accurate pairing of replies with their quotes
 */
function extractStructuredReply(text) {
  if (!text) return null;

  const matches = [...text.matchAll(GENERAL_REPLY_REGEX)];
  if (matches.length === 0) return null;

  const { author, content } = matches[0].groups;

  // First, let's scan the entire content and identify:
  // 1. All quote blocks (the > prefix lines)
  // 2. All text segments (non-quoted text)
  // 3. The correct sequence and relationship of these blocks

  const segments = [];
  let currentQuote = [];
  let currentText = [];
  let inQuote = false;

  const lines = content.split("\n");

  // First pass: identify all segments and their types in sequence
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isQuoteLine = line.startsWith("> ") || line === ">";

    if (isQuoteLine) {
      // We're entering or continuing a quote block
      if (!inQuote) {
        // If we were collecting text, save it before starting the quote
        if (currentText.length > 0) {
          segments.push({
            type: "text", 
            content: currentText.join("\n"),
            index: segments.length
          });
          currentText = [];
        }
        inQuote = true;
      }
      currentQuote.push(line);
    } else {
      // We're in regular text
      if (inQuote) {
        // We just finished a quote block, save it
        if (currentQuote.length > 0) {
          segments.push({
            type: "quote", 
            content: currentQuote.join("\n"),
            index: segments.length
          });
          currentQuote = [];
        }
        inQuote = false;
      }
      
      // Add this line to the current text block if it's not empty
      if (line.trim() !== '') {
        currentText.push(line);
      }
    }
  }

  // Handle any remaining content
  if (inQuote && currentQuote.length > 0) {
    segments.push({
      type: "quote", 
      content: currentQuote.join("\n"),
      index: segments.length
    });
  } else if (currentText.length > 0) {
    segments.push({
      type: "text", 
      content: currentText.join("\n"),
      index: segments.length
    });
  }

  // If no quote blocks found, this isn't a reply
  const quoteSegments = segments.filter(s => s.type === "quote");
  if (quoteSegments.length === 0) return null;

  // Determine the intro text - this is the first text segment (if any)
  const firstSegment = segments.length > 0 ? segments[0] : null;
  const introText = (firstSegment && firstSegment.type === "text") 
    ? firstSegment.content.trim() 
    : "";

  // Now identify the replies
  // A reply could be:
  // 1. Simple: text segment followed by a quote - the text is directly replying to the quote
  // 2. Complex: quote followed by text - the text is a reply to the quoted content
  
  const replies = [];
  
  // For each quote, find the text that might be a reply to it
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    
    if (segment.type === "quote") {
      // Check if the segment following this quote is text
      const nextIndex = i + 1;
      if (nextIndex < segments.length && segments[nextIndex].type === "text") {
        // This is likely a reply to the quote
        replies.push({
          author,
          reply: segments[nextIndex].content.trim(),
          quote: segment.content,
          replyLocation: "after", // The reply appears after the quote
          quoteIndex: segment.index,
          replyIndex: segments[nextIndex].index
        });
      }
      
      // Also check if the segment before this quote is text
      // (but not if it was the intro text and we already have a "after" reply for a previous quote)
      const prevIndex = i - 1;
      if (prevIndex >= 0 && segments[prevIndex].type === "text") {
        // Only treat this as a reply if:
        // 1. It's not the first text segment (which is the intro)
        // 2. OR if there are multiple quotes and this is clearly a reply
        const isFirstText = prevIndex === 0 && segments[0].type === "text";
        const hasMultipleQuotes = quoteSegments.length > 1;
        
        if (!isFirstText || (hasMultipleQuotes && quoteSegments[0].index > 0)) {
          replies.push({
            author,
            reply: segments[prevIndex].content.trim(),
            quote: segment.content,
            replyLocation: "before", // The reply appears before the quote
            quoteIndex: segment.index,
            replyIndex: segments[prevIndex].index
          });
        }
      }
    }
  }
  
  // Special handling for the simple case of one quote
  if (quoteSegments.length === 1 && replies.length === 0 && introText) {
    // If there's just one quote and intro text but no identified replies,
    // the intro text is probably the reply
    return {
      author,
      reply: introText,
      quote: quoteSegments[0].content,
    };
  }
  
  // For complex cases with multiple replies or quotes
  if (replies.length > 0) {
    // Sort replies by their original sequence in the text
    const sortedReplies = [...replies].sort((a, b) => {
      // First by quote index, then by reply position
      if (a.quoteIndex !== b.quoteIndex) return a.quoteIndex - b.quoteIndex;
      if (a.replyLocation === "before" && b.replyLocation === "after") return -1;
      if (a.replyLocation === "after" && b.replyLocation === "before") return 1;
      return a.replyIndex - b.replyIndex;
    });
    
    // Remove position info from final output
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

  // Fall back to the original behavior as a last resort
  const quote = quoteSegments[quoteSegments.length - 1].content;
  
  // Look for any text that appears before this quote as the reply
  const lastQuoteIndex = segments.findIndex(s => 
    s.type === "quote" && s.content === quote
  );
  
  const replySegment = lastQuoteIndex > 0 ? segments[lastQuoteIndex - 1] : null;
  const reply = (replySegment && replySegment.type === "text") 
    ? replySegment.content.trim() 
    : introText;

  return {
    author,
    reply: reply || "", // Use empty string if no reply text found
    quote,
  };
}

/**
 * Helper function to extract all reply structures from a text containing multiple replies.
 * Used internally by createReplyExtractor.
 */
export function extractAllReplies(text) {
  if (!text) return [];

  const allReplies = [];

  // Split the text by a regex that matches the start of a reply (@address)
  const segments = text.split(
    /(?=^@0x[a-zA-Z0-9]{4}\.{3}[a-zA-Z0-9]{4}\n\n)/gm,
  );

  // Process each segment that looks like a reply
  for (const segment of segments) {
    if (segment.match(/^@0x[a-zA-Z0-9]{4}\.{3}[a-zA-Z0-9]{4}\n\n/)) {
      const result = extractStructuredReply(segment);
      
      if (!result) continue;
      
      // Handle the new multipleReplies format
      if (result.multipleReplies) {
        // Add a special marker to the whole structured reply
        allReplies.push({
          type: 'structuredReply',
          introText: result.introText,
          replies: result.replies,
          author: result.author
        });
      } else {
        // Just a regular reply
        allReplies.push(result);
      }
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
    let introText = '';
    let strippedText = reason;

    // First look for complex structures with intro text and multiple replies
    let foundIntroText = '';
    let complexReplies = [];
    
    // Find all complex structure replies
    for (const item of parsedReplies) {
      // Handle the special structuredReply format
      if (item.type === 'structuredReply') {
        foundIntroText = item.introText || '';
        complexReplies = item.replies || [];
        break;
      }
    }
    
    // If we found a complex structure with multiple replies
    if (complexReplies.length > 0) {
      // First, set the stripped text to the intro paragraph immediately,
      // so it's preserved even if no replies match
      strippedText = foundIntroText;
      
      // Process each reply in the complex structure
      for (const { author, reply, quote } of complexReplies) {
        try {
          // Skip empty replies
          if (!reply || reply.trim() === '') continue;
          
          // Skip if the reply text appears to be the intro text (duplicate)
          // This can happen due to how the parser works
          if (reply.trim() === foundIntroText.trim()) continue;
          
          const quoteBody = markdownUtils.unquote(quote.trim());
          const truncatedReplyTargetAuthorAddress = author.toLowerCase();
  
          // Find matching post by comparing content and author
          const matchedReplyTarget = ascendingSourceVotesAndFeedbackPosts.find(
            ({ voterId: originVoterId, reason: originReason }) => {
              if (originReason == null) return false;
  
              // Check content - try both exact and substring matches
              // This helps with partial quotes or where formatting might differ slightly
              const exactMatch = originReason.trim() === quoteBody.trim();
              
              // For longer quotes (over 50 chars), also try substring matching
              // This helps with cases where only part of the message is quoted
              const substringMatch = quoteBody.length > 50 && 
                originReason.includes(quoteBody.trim());
              
              const contentMatch = exactMatch || substringMatch;
  
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
      
      // If we found replies, return them along with intro text
      if (replies.length > 0) {
        return [replies, strippedText];
      }
    }
    
    // Fall back to processing individual replies if we didn't find a complex structure
    // Or, even if we found complex structure, but couldn't match any replies
    for (const item of parsedReplies) {
      try {
        // Skip complex reply structures (already processed) and intro text
        if (item.type === 'introText' || item.type === 'structuredReply') continue;
        
        // Handle items with type='introText' separately
        if (item.type === 'introText') {
          introText = item.content || '';
          continue;
        }
        
        const { author, reply, quote } = item;
        
        // Skip empty replies
        if (!reply || reply.trim() === '') continue;
        
        const quoteBody = markdownUtils.unquote(quote.trim());
        const truncatedReplyTargetAuthorAddress = author.toLowerCase();

        // Find matching post by comparing content and author
        const matchedReplyTarget = ascendingSourceVotesAndFeedbackPosts.find(
          ({ voterId: originVoterId, reason: originReason }) => {
            if (originReason == null) return false;

            // Check content - try both exact and substring matches
            const exactMatch = originReason.trim() === quoteBody.trim();
            
            // Also try to match if the quote is a substring of the original reason
            // This helps with partial quotes or nested quotes
            const substringMatch = quoteBody.length > 50 && 
              originReason.includes(quoteBody.trim());
              
            const contentMatch = exactMatch || substringMatch;

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

    // If we found replies but didn't already set strippedText:
    if (replies.length > 0 && strippedText === reason) {
      // 1. First check if there's a dedicated introText 
      for (const item of parsedReplies) {
        if (item.type === 'introText') {
          strippedText = item.content || '';
          break;
        }
      }
      
      // 2. If we didn't find explicit introText, check if we already collected any
      if (strippedText === reason && introText) {
        strippedText = introText;
      }
      
      // 3. If we still didn't find intro text, check if foundIntroText exists
      if (strippedText === reason && foundIntroText) {
        strippedText = foundIntroText;
      }
      
      // 4. Finally, if we have no intro text, empty the strippedText
      if (strippedText === reason) {
        strippedText = '';
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

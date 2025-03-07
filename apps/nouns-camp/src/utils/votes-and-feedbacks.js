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

  // Find all the quote blocks in the content
  const quoteBlocks = [];
  let currentQuote = [];
  let inQuote = false;
  let replyTexts = []; // Will collect text segments between quotes
  let currentReplyText = [];

  const lines = content.split("\n");

  // First pass: identify all quote blocks and text segments
  // Add a marker for the first line to ensure we capture intro text correctly
  let isFirstText = true;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("> ") || line === ">") {
      // Start or continue a quote block
      if (!inQuote && currentReplyText.length > 0) {
        // Store the text before this quote as a potential reply
        const textType = isFirstText ? 'introText' : 'replyText';
        replyTexts.push({
          type: textType,
          content: currentReplyText.join("\n")
        });
        isFirstText = false;
        currentReplyText = [];
      }
      
      inQuote = true;
      currentQuote.push(line);
    } else {
      if (inQuote) {
        // End of a quote block
        if (currentQuote.length > 0) {
          quoteBlocks.push(currentQuote.join("\n"));
          currentQuote = [];
        }
        inQuote = false;
      }
      
      // Add to current reply text if not empty
      if (line.trim() !== '') {
        currentReplyText.push(line);
      }
    }
  }

  // Add the last quote block if we're still in one
  if (currentQuote.length > 0) {
    quoteBlocks.push(currentQuote.join("\n"));
  }
  
  // Add any remaining reply text
  if (currentReplyText.length > 0) {
    const textType = isFirstText ? 'introText' : 'replyText';
    replyTexts.push({
      type: textType,
      content: currentReplyText.join("\n")
    });
  }

  // If no quote blocks found, this isn't a reply
  if (quoteBlocks.length === 0) return null;

  // Extract intro text if it exists
  let introText = '';
  let actualReplies = [];
  
  // Separate intro text and reply texts
  for (const textItem of replyTexts) {
    if (textItem.type === 'introText') {
      introText = textItem.content;
    } else {
      actualReplies.push(textItem.content);
    }
  }
  
  // For the simplest case with no complex structure,
  // use the traditional approach
  if (quoteBlocks.length === 1 && actualReplies.length === 0 && introText) {
    return {
      author,
      reply: introText.trim(),
      quote: quoteBlocks[0],
    };
  }
  
  // For more complex cases, we need to identify replies and pair them with quotes
  const replies = [];
  
  // Each quote is paired with the text that follows it (if any)
  for (let i = 0; i < quoteBlocks.length; i++) {
    const quote = quoteBlocks[i];
    
    // Find the text that comes AFTER this quote (if any)
    const replyText = i < actualReplies.length ? actualReplies[i] : '';
    
    replies.push({
      author,
      reply: replyText.trim(),
      quote,
    });
  }
  
  // If we found reply segments, return them along with intro text
  if (replies.length > 0) {
    // Filter out empty replies
    const validReplies = replies.filter(r => r.reply.trim() !== '');
    
    if (validReplies.length > 0) {
      return {
        multipleReplies: true,
        introText,
        replies: validReplies,
        author,
      };
    }
  }

  // Fall back to the original behavior as a last resort
  // This should rarely happen with the improved algorithm
  const quote = quoteBlocks[quoteBlocks.length - 1];
  const lastQuoteIndex = content.lastIndexOf(quote);
  const reply = content.substring(0, lastQuoteIndex).trim();

  return {
    author,
    reply: reply || introText, // Use intro text if reply is empty
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
        // Add the intro text as a special type (if it exists)
        if (result.introText && result.introText.trim() !== '') {
          allReplies.push({
            type: 'introText',
            author: result.author,
            content: result.introText
          });
        }
        
        // Add each reply separately
        for (const reply of result.replies) {
          allReplies.push(reply);
        }
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

    // First look for intro text and multiple replies structure
    let foundIntroText = '';
    let complexReplies = [];
    
    for (const item of parsedReplies) {
      // Handle the special multipleReplies format
      if (item.multipleReplies) {
        foundIntroText = item.introText || '';
        complexReplies = item.replies || [];
        break;
      }
    }
    
    // If we found a complex structure with intro text and multiple replies
    if (complexReplies.length > 0) {
      // Process each reply in the complex structure
      for (const { author, reply, quote } of complexReplies) {
        try {
          // Skip empty replies
          if (!reply || reply.trim() === '') continue;
          
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
      
      // Set the stripped text to the intro paragraph
      strippedText = foundIntroText;
      
      // If we found replies, return them along with intro text
      if (replies.length > 0) {
        return [replies, strippedText];
      }
    }
    
    // Fall back to normal processing if we didn't find a complex structure
    for (const item of parsedReplies) {
      try {
        // Skip anything that's not a normal reply
        if (item.type === 'introText' || item.multipleReplies) continue;
        
        const { author, reply, quote } = item;
        
        // Skip empty replies
        if (!reply || reply.trim() === '') continue;
        
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

    // If we found replies but didn't already set strippedText,
    // check if there's intro text from any introText type
    if (replies.length > 0 && strippedText === reason) {
      for (const item of parsedReplies) {
        if (item.type === 'introText') {
          strippedText = item.content || '';
          break;
        }
      }
      
      // If we still didn't find intro text, empty the strippedText
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

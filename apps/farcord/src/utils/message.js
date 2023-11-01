import { message } from "@shades/common/utils";

export const validateUrl = (string) => {
  if (string.match(/\s/)) return false;
  if (!string.split("www.").slice(-1)[0].includes(".")) return false;

  try {
    const url = new URL(string);
    return ["http:", "https:"].some((p) => url.protocol === p);
  } catch (_) {
    return false;
  }
};

const getImages = (nodes) => {
  const images = [];

  message.iterate((node) => {
    if (node.type === "image-attachment") {
      images.push(node.url);
    }
  }, nodes);

  return images;
};

export const parseImagesFromBlocks = (blocks) => {
  const imageNodes = message.filter(
    (n) => n.type == "attachments" || n.type == "image-attachment",
    blocks
  );

  return getImages(imageNodes);
};

export const parseBlocksToFarcasterComponents = (blocks) => {
  // remove mentions from text
  const text = message.stringifyBlocks(blocks, {
    humanReadable: false,
  });

  let textBuffer = Buffer.from(text, "utf-8");

  // todo: parse cast ids to add to embeds

  const embeds = [];
  const imageEmbeds = parseImagesFromBlocks(blocks);
  // todo: url embeds
  embeds.push(...imageEmbeds.map((image) => ({ url: image })));

  // convert slate mentions to farcaster
  const matches = [...text.matchAll(/@<u:(\d+)>/gi)];
  let updatedText = text;
  let mentionsPositions = [];
  let mentionedFids = [];

  for (const match of matches) {
    const matchedFid = match[1];
    mentionedFids.push(Number(matchedFid));

    const position = textBuffer.indexOf(match[0]);
    mentionsPositions.push(position);

    updatedText = updatedText.replace(match[0], "");
    textBuffer = Buffer.from(updatedText, "utf-8");
  }

  return {
    text: updatedText,
    embeds,
    mentions: mentionedFids,
    mentionsPositions,
  };
};

export const parseString = (text, mentionedProfiles) => {
  let string = text;
  if (!string || string?.trim() === "") return [];

  const usernameMatches = [...string.matchAll(/@([\w-]+(\.eth)?)/gi)];

  // for each match, fetch user by username and replace with fid
  usernameMatches.map((match) => {
    const username = match[1];
    try {
      const user = mentionedProfiles?.find((p) => p.username === username);
      const fid = user?.fid;
      if (fid) {
        string = string.replace(match[0], `@<u:${fid}>`);
      }
    } catch (e) {
      console.warn("Couldn't find a match for username", username, e);
    }
  });

  const paragraphStrings = string.split(/^\s*$/m).map((s) => s.trim());

  const paragraphElements = paragraphStrings.map((paragraphString) => {
    const paragraphChildren = paragraphString
      .split(/\n/)
      .reduce((paragraphElements, line, i, lines) => {
        const isLastLine = i === lines.length - 1;

        const lineElements = line.split(/\s+/).reduce((els, word) => {
          const prev = els[els.length - 1];
          const isMention = word.includes("@<u:") && word.length > 1;

          if (isMention) {
            if (prev != null && prev.text) prev.text = `${prev.text} `;

            const fidMatch = word.match(/@<u:(\d+)>/);
            const fid = fidMatch[1];
            const mentionEl = { type: "user", ref: fid };

            if (fidMatch[0].length !== word.length) {
              const before = word.slice(0, fidMatch.index);
              const after = word.slice(fidMatch.index + fidMatch[0].length);

              const hasBefore = before !== "";
              const hasAfter = after !== "";

              const beforeEl = { text: before };
              const afterEl = { text: after };

              if (hasBefore && hasAfter) {
                return [...els, beforeEl, mentionEl, afterEl];
              } else if (hasBefore) {
                return [...els, beforeEl, mentionEl];
              } else if (hasAfter) {
                return [...els, mentionEl, afterEl];
              } else {
                return [...els, mentionEl];
              }
            }

            return [...els, mentionEl];
          }

          const isValidUrl = validateUrl(word);

          if (isValidUrl) {
            const disalloedEndCharacters = [".", ",", ";", ")"];
            let cleanedUrl = word;
            let trailingPart = "";
            while (
              disalloedEndCharacters.includes(cleanedUrl[cleanedUrl.length - 1])
            ) {
              trailingPart = cleanedUrl[cleanedUrl.length - 1] + trailingPart;
              cleanedUrl = cleanedUrl.slice(0, -1);
            }

            if (prev != null && prev.text) prev.text = `${prev.text} `;
            const url = new URL(cleanedUrl);
            const linkEl = { type: "link", url: url.href };
            if (trailingPart === "") return [...els, linkEl];
            return [...els, linkEl, { text: trailingPart }];
          }

          if (prev == null || prev.type === "link" || prev.type === "user")
            return [...els, { text: prev == null ? word : ` ${word}` }];

          prev.text = `${prev.text} ${word}`;

          return els;
        }, []);

        if (isLastLine) return [...paragraphElements, ...lineElements];

        return [...paragraphElements, ...lineElements, { text: "\n" }];
      }, []);

    return createParagraphElement(paragraphChildren);
  });

  return paragraphElements;
};

export const createParagraphElement = (content = "") => ({
  type: "paragraph",
  children: typeof content === "string" ? [{ text: content }] : content,
});

export const createEmptyParagraphElement = () => createParagraphElement();

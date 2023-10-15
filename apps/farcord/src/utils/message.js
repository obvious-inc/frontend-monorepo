import { message } from "@shades/common/utils";

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

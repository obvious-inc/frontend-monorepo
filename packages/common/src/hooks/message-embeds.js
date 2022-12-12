import React from "react";
import { useMessage } from "./channel.js";

const useMessageEmbeds = (messageId) => {
  const message = useMessage(messageId);

  const embeds = React.useMemo(() => {
    if (message?.embeds == null || message.embeds.length === 0) return [];

    return message.embeds.map((embed) => {
      const { title: title_, favicon: favicon_, url, metatags } = embed;

      const title = metatags["og:title"] ?? title_;
      const description =
        title === metatags["og:description"]
          ? null
          : metatags["og:description"];
      const sub =
        (description ?? title) === metatags.meta ? null : metatags.meta;
      const image = metatags["og:image"];
      const video = metatags["og:video"];
      const hostname = new URL(url).hostname;
      const siteName = metatags["og:site_name"] ?? hostname;
      const favicon = favicon_.trim() === "" ? null : favicon_;

      return {
        title,
        description,
        sub,
        url,
        image,
        video,
        hostname,
        siteName,
        favicon,
        metatags,
      };
    });
  }, [message.embeds]);

  return embeds;
};

export default useMessageEmbeds;

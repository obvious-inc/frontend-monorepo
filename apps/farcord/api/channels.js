const WARPCAST_CHANNELS_STATIC_LIST =
  "https://api.warpcast.com/v2/all-channels";

const WARPCAST_CHANNELS_INFO_ENDPOINT =
  "https://client.warpcast.com/v2/channel";

import { readFileSync } from "fs";
import path from "path";
import allChannels from "./_all-channels";

export default async function handler(_, response) {
  const allChannels = allChannels;
  console.log("channels", allChannels);
  // response.setHeader("Cache-Control", "s-maxage=86400");
  response.status(200).json({ channels: allChannels });
  return response;

  const channels = await fetch(WARPCAST_CHANNELS_STATIC_LIST)
    .then(async (res) => {
      if (res.ok) return res.json();
      return Promise.reject(new Error(res.statusText));
    })
    .then(async (data) => {
      const channels = data?.result?.channels;
      if (!channels) return [];

      return Promise.all(
        channels.map((channel) =>
          fetch(WARPCAST_CHANNELS_INFO_ENDPOINT + "?key=" + channel.id)
            .then((res) => {
              if (res.ok) return res.json();
              else {
                throw new Error(res.statusText);
              }
            })
            .then((body) => {
              if (!body) return;
              const warpcastChannel = body.result.channel;
              return {
                id: channel.id,
                parentUrl: channel.url,
                name: warpcastChannel.name,
                imageUrl: warpcastChannel.fastImageUrl,
                followerCount: warpcastChannel.followerCount,
                description: warpcastChannel.description,
              };
            })
            .catch((e) => {
              console.error("Error fetching channel info for " + channel.id, e);
              return null;
            })
        )
      ).then((result) => {
        // filter undefined keys
        return result.filter((c) => c);
      });
    })
    .catch((e) => {
      console.error("Error fetching warpcast channels, using JSON backup: ", e);

      try {
        const filePath = path.join(process.cwd(), "files", "all-channels.json");
        const fileContents = readFileSync
          ? readFileSync(filePath, "utf8")
          : require
          ? require(filePath)
          : null;

        if (fileContents) {
          return JSON.parse(fileContents);
        }
      } catch (e) {
        console.error("Error reading backup JSON file: ", e);
        return [];
      }

      return [];
    });

  response.setHeader("Cache-Control", "s-maxage=86400");
  response.status(200).json({ channels: channels });
}

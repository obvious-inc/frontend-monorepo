const WARPCAST_CHANNELS_STATIC_LIST =
  "https://api.warpcast.com/v2/all-channels";

const WARPCAST_CHANNELS_INFO_ENDPOINT =
  "https://client.warpcast.com/v2/channel";

const NEYNAR_V2_ENDPOINT = "https://api.neynar.com/v2/farcaster";

const fetchAllChannels = async () => {
  let params = new URLSearchParams({
    api_key: process.env.FARCASTER_HUB_API_KEY,
  });

  return fetch(NEYNAR_V2_ENDPOINT + "/channel/list?" + params)
    .then((result) => {
      console.log("neynar result", result.status, result.statusText);
      return result.json();
    })
    .then((data) => {
      return data.channels;
    })
    .catch((err) => {
      throw err;
    });
};

const fetchTrendingChannels = async () => {
  let params = new URLSearchParams({
    api_key: process.env.FARCASTER_HUB_API_KEY,
    time_window: "7d",
  });

  return fetch(NEYNAR_V2_ENDPOINT + "/channel/trending?" + params)
    .then((result) => {
      return result.json();
    })
    .then((data) => {
      return data.channels;
    })
    .then((channels) => {
      // return channel field for each channel
      return channels.map((channelObject) => {
        return {
          ...channelObject.channel,
          parentUrl: channelObject.channel.parent_url,
          imageUrl: channelObject.channel.image_url,
          cast_count: Number(channelObject["cast_count_7d"]),
        };
      });
    })
    .catch((err) => {
      throw err;
    });
};

export default async function handler(_, response) {
  const trendingChannels = await fetchTrendingChannels();
  response.setHeader("Cache-Control", "s-maxage=86400");
  return response.status(200).json({ channels: trendingChannels });

  const allChannelsById = ALL_CHANNELS.reduce((acc, channel) => {
    acc[channel.id] = channel;
    return acc;
  }, {});

  const channels = await fetch(WARPCAST_CHANNELS_STATIC_LIST)
    .then(async (res) => {
      if (res.ok) return res.json();
      return Promise.reject(new Error(res.statusText));
    })
    .then(async (data) => {
      const channels = data?.result?.channels;
      if (!channels) return [];

      // filter out channels that are not in the ALL_CHANNELS list
      const filteredChannels = await channels.filter((channel) => {
        return allChannelsById[channel.id];
      });

      const remainingChannels = channels.filter((channel) => {
        return !allChannelsById[channel.id];
      });

      console.log("Number of channels missing", filteredChannels.length);

      const missingInfoChannels = await Promise.all(
        filteredChannels.map((channel) => {
          if (!channel.id) return Promise.resolve(null);
          // const storedChannel = allChannelsById[channel.id];
          // if (storedChannel)
          //   return Promise.resolve({
          //     ...storedChannel,
          //     parentUrl: storedChannel.url,
          //   });

          // console.debug("fetching new channel info", channel.id);
          return fetch(WARPCAST_CHANNELS_INFO_ENDPOINT + "?key=" + channel.id)
            .then((res) => {
              if (res.ok) return res.json();
              else {
                return Promise.reject(new Error(res.statusText));
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
            });
        })
      ).then((result) => {
        // filter undefined keys
        return result.filter((c) => c);
      });

      console.log(
        "Number of channels fetched for new info",
        missingInfoChannels.length
      );

      // merge remainingChannels with missingInfoChannels
      return remainingChannels.concat(missingInfoChannels);
    })
    .catch((e) => {
      console.error("Error fetching warpcast channels", e);
      return [];
    });

  response.setHeader("Cache-Control", "s-maxage=86400");
  response.status(200).json({ channels: channels });

  return response;
}

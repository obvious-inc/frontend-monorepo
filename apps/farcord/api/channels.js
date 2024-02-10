const NEYNAR_V2_ENDPOINT = "https://api.neynar.com/v2/farcaster";

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
      return channels.map((channelObject) => {
        return {
          ...channelObject.channel,
          parentUrl: channelObject.channel.parent_url,
          imageUrl: channelObject.channel.image_url,
          castCount: Number(channelObject["cast_count_7d"]),
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
}

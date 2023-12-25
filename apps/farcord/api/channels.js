const WARPCAST_CHANNELS_STATIC_LIST =
  "https://api.warpcast.com/v2/all-channels";

const WARPCAST_CHANNELS_INFO_ENDPOINT =
  "https://client.warpcast.com/v2/channel";

export default async function handler(request, response) {
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
                console.error("Error fetching channel info for " + channel.id);
                return null;
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
        )
      ).then((result) => {
        // filter undefined keys
        return result.filter((c) => c);
      });
    });

  response.setHeader("Cache-Control", "s-maxage=86400");
  response.status(200).json({ channels: channels });
}

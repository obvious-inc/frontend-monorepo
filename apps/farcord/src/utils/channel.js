export const parseChannelFromUrl = (url) => {
  // https://github.com/farcasterxyz/protocol/discussions/71#discussioncomment-5586731

  // 1. parse Web URL
  // 2. parse CAIP-19 URI

  return { url };
};

export const getChannelLink = (channel) => {
  if (!channel) return;

  // the id for custom channels is the parentUrl
  if (channel.id == channel.parentUrl) {
    return `/channels/${encodeURIComponent(channel.parentUrl)}`;
  }

  return `/channels/${channel.id}`;
};

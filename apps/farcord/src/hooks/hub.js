import { getHubRpcClient } from "@farcaster/hub-web";
import { useFarcasterChannel } from "./farcord";

const farcasterClient = getHubRpcClient(
  process.env.FARCASTER_HUB_RPC_ENDPOINT,
  {
    metadata: false,
    isBrowser: true,
  }
);

export const useUserCasts = (fid) => {
  return farcasterClient
    .getCastsByFid({
      fid: fid,
      pageSize: 10,
      reverse: true,
    })
    .then((result) => {
      if (result.isErr()) {
        throw result.error;
      }

      result.map((casts) =>
        casts.messages.map((cast) => console.log(cast.data?.castAddBody?.text))
      );

      return result;
    })
    .catch((err) => {
      throw err;
    });
};

export const useChannelCasts = (channelId) => {
  return null;
  // const channel = useFarcasterChannel(channelId);
  // const parentUrl = channel.parentUrl;

  // return farcasterClient
  //   .getCastsByParent({
  //     parentUrl,
  //     pageSize: 10,
  //     reverse: true,
  //   })
  //   .then((result) => {
  //     if (result.isErr()) {
  //       throw result.error;
  //     }

  //     result.map((casts) =>
  //       casts.messages.map((cast) => console.log(cast.data?.castAddBody?.text))
  //     );

  //     return result;
  //   })
  //   .catch((err) => {
  //     throw err;
  //   });
};

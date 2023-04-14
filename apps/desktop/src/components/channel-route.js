import React from "react";
import { useParams } from "react-router-dom";
import { Helmet as ReactHelmet } from "react-helmet";
import {
  useChannel,
  useChannelName,
  useAuth,
  useCachedState,
} from "@shades/common/app";
import { getImageDimensionsFromUrl } from "@shades/common/utils";
import Channel from "./channel.js";

const useCompactnessPreference = () => {
  const compactModeOverride = location.search.includes("compact=1");
  const bubblesModeOverride = location.search.includes("bubbles=1");
  const [compactPreference] = useCachedState("preferred-compactness");
  const preference = compactModeOverride
    ? "compact"
    : bubblesModeOverride
    ? "bubbles"
    : compactPreference;
  return preference ?? "normal";
};

const ChannelRoute = (props) => {
  const params = useParams();
  const { status } = useAuth();
  const compactnessPreference = useCompactnessPreference();
  if (status === "loading") return null;
  return (
    <>
      <MetaTags channelId={params.channelId} />
      <Channel
        channelId={params.channelId}
        {...props}
        layout={compactnessPreference}
      />
    </>
  );
};

const MetaTags = ({ channelId }) => {
  const channel = useChannel(channelId);
  const name = useChannelName(channelId);

  const [imageDimensions, setImageDimensions] = React.useState(null);

  React.useEffect(() => {
    if (channel?.image == null) {
      setImageDimensions(null);
      return;
    }

    getImageDimensionsFromUrl(channel.image).then((dimensions) => {
      setImageDimensions(dimensions);
    });
  }, [channel?.image]);

  if (channel == null) return null;

  return (
    <ReactHelmet>
      <link
        rel="canonical"
        href={`https://app.newshades.xyz/channels/${channelId}`}
      />

      <title>{`${name} - NewShades`}</title>
      <meta name="description" content={channel.description} />

      <meta property="og:title" content={name} />
      <meta property="og:description" content={channel.description} />

      {channel.image != null && (
        <meta property="og:image" content={channel.image} />
      )}

      {imageDimensions != null && (
        <meta property="og:image:width" content={imageDimensions.width} />
      )}
      {imageDimensions != null && (
        <meta property="og:image:height" content={imageDimensions.height} />
      )}
    </ReactHelmet>
  );
};

export default ChannelRoute;

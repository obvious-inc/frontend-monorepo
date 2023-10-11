import React from "react";
import { MainLayout } from "./layouts.js";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ThreadScreen } from "./cast-screen.js";
import { useMatchMedia } from "@shades/common/react";
import ChannelView from "./channel-screen.js";
import NotificationsView from "./notifications-screen.js";

const MainScreen = ({ screenType = "channel" }) => {
  const navigate = useNavigate();
  const { channelId } = useParams();
  const [searchParams] = useSearchParams();
  const searchUrl = searchParams.get("url");
  const castHash = searchParams.get("cast");
  const isSmallScreen = useMatchMedia("(max-width: 800px)");
  const hideMainView = isSmallScreen && castHash;

  React.useEffect(() => {
    const gotoChannelUrl = (channelUrl) => {
      searchParams.delete("url");
      navigate({
        pathname: `/channels/${encodeURIComponent(channelUrl)}`,
        search: searchParams.toString(),
      });
    };

    if (!channelId && searchUrl) {
      gotoChannelUrl(searchUrl);
    }
  }, [channelId, searchParams, navigate, searchUrl]);

  const screenItem = React.useMemo(() => {
    switch (screenType) {
      case "channel":
        return <ChannelView channelId={channelId} />;
      case "feed":
        return <ChannelView isFeed />;
      case "recent":
        return <ChannelView isRecent />;
      case "notifications":
        return <NotificationsView />;
      default:
        return null;
    }
  }, [screenType, channelId]);

  return (
    <MainLayout>
      {!hideMainView && screenItem}
      {castHash && <ThreadScreen castHash={castHash} />}
    </MainLayout>
  );
};

export default MainScreen;
import React from "react";
import { MainLayout } from "./layouts";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import ThreadScreen from "./cast-screen";
import { useMatchMedia } from "@shades/common/react";
import ChannelView from "./channel-screen";
import NotificationsView from "./notifications-screen";
import RegisterView from "./register-screen";
import ProfileView from "./profile-screen";
import LoginView from "./login-screen";
import WarpcastAuthScreen from "./warpcast-screen";
import SignersView from "./signers-screen";
import NewSignerView from "./new-signer-view";

const MainScreen = ({ screenType = "channel", fullScreen = false }) => {
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
      case "login":
        return <LoginView />;
      case "login-with-warpcast":
        return <WarpcastAuthScreen />;
      case "register":
        return <RegisterView />;
      case "profile":
        return <ProfileView />;
      case "apps":
        return <SignersView />;
      case "apps-new":
        return <NewSignerView />;
      default:
        return null;
    }
  }, [screenType, channelId]);

  return (
    <MainLayout>
      {!hideMainView && screenItem}
      {castHash && !fullScreen && <ThreadScreen castHash={castHash} />}
    </MainLayout>
  );
};

export default MainScreen;

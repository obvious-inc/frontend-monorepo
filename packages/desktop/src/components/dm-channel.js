import { useParams } from "react-router";
import { useAppScope } from "@shades/common";
import { ChannelBase } from "./channel";
import { Header } from "./channel-layout";

const DmChannel = () => {
  const params = useParams();
  const { state } = useAppScope();
  const channel = state.selectChannel(params.channelId);
  if (channel == null) return null;
  return (
    <ChannelBase
      channel={channel}
      headerContent={<Header>{channel.name}</Header>}
    />
  );
};

export default DmChannel;

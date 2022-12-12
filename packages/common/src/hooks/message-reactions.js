import { useMessage } from "./channel.js";

const useMessageEmbeds = (messageId) => {
  const message = useMessage(messageId);

  return message?.reactions ?? [];
};

export default useMessageEmbeds;

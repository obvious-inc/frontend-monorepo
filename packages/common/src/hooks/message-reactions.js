import { useMessage } from "./channel.js";

const useMessageReactions = (messageId) => {
  const message = useMessage(messageId);

  return message?.reactions ?? [];
};

export default useMessageReactions;

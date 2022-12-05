import { useAppScope } from "../app-scope.js";

const useMessageEmbeds = (messageId) => {
  const { state } = useAppScope();
  const message = state.selectMessage(messageId);

  return message?.reactions ?? [];
};

export default useMessageEmbeds;

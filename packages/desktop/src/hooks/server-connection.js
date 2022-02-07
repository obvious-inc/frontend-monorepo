import React from "react";
import Pusher from "pusher-js";
import { API_ENDPOINT } from "../constants/api";
import { identity } from "../utils/function";
import { decompressData } from "../utils/misc";

const clientEventMap = {
  "request-user-data": ["client-connection-request"],
  "mark-channel-read": [
    "client-channel-mark",
    (clientPayload) => ({
      channel_id: clientPayload.channelId,
      last_read_at: clientPayload.date.toISOString(),
    }),
  ],
};
const serverEventMap = {
  CONNECTION_READY: "user-data",
  MESSAGE_CREATE: "message-created",
};

const useServerConnection = ({
  accessToken,
  userId,
  PUSHER_KEY = process.env.PUSHER_KEY,
  debug = false,
} = {}) => {
  const channelRef = React.useRef();
  const listenersRef = React.useRef([]);

  const send = React.useCallback((event, payload = { no: "data" }) => {
    const [serverEvent, payloadMapper = identity] = clientEventMap[event];
    if (serverEvent == null) throw new Error(`Unknown event "${event}"`);

    // Pusher returns true if the message is successfully sent, false otherwise
    return channelRef.current.trigger(serverEvent, payloadMapper(payload));
  }, []);

  const addListener = React.useCallback((fn) => {
    listenersRef.current = [...listenersRef.current, fn];
    return () => {
      listenersRef.current = listenersRef.current.filter((fn_) => fn !== fn_);
    };
  }, []);

  React.useEffect(() => {
    if (accessToken == null || userId == null) return;
    Pusher.logToConsole = debug;

    const pusher = new Pusher(PUSHER_KEY, {
      cluster: "eu",
      authEndpoint: `${API_ENDPOINT}/websockets/auth`,
      auth: {
        params: { provider: "pusher" },
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    });

    const channel = pusher.subscribe(`private-${userId}`);
    channelRef.current = channel;

    channel.bind("pusher:subscription_succeeded", () => {
      channel.trigger("client-connection-request", { no: "data" });
    });

    const serverEvents = Object.keys(serverEventMap);

    for (let event of serverEvents)
      channel.bind(event, (data) => {
        const clientEventName = serverEventMap[event];
        if (data.compressed) {
          let compressedData = data.compressed.data;
          let compressionAlg = data.compressed.alg;
          data = decompressData(compressedData, compressionAlg);
        }

        listenersRef.current.forEach((fn) =>
          fn(clientEventName, data)
        );
      });
  }, [PUSHER_KEY, debug, userId, accessToken]);

  const serverConnection = React.useMemo(
    () => ({ send, addListener }),
    [send, addListener]
  );

  return serverConnection;
};

export default useServerConnection;

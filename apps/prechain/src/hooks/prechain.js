import React from "react";
import {
  useActions as useNomActions,
  usePublicChannels,
} from "@shades/common/app";

const PROPOSALS_TAG = "prechain/1/proposal";

export const useActions = () => {
  const { fetchPubliclyReadableChannels, createOpenChannel } = useNomActions();

  const fetchChannels = React.useCallback(
    () => fetchPubliclyReadableChannels({ tags: [PROPOSALS_TAG] }),
    [fetchPubliclyReadableChannels]
  );

  const createChannel = React.useCallback(
    (properties) => createOpenChannel({ ...properties, tags: [PROPOSALS_TAG] }),
    [createOpenChannel]
  );

  return { fetchChannels, createChannel };
};

export const useChannels = (options) => {
  const channels = usePublicChannels(options);
  return React.useMemo(
    () =>
      channels.filter((c) => c.tags != null && c.tags.includes(PROPOSALS_TAG)),
    [channels]
  );
};

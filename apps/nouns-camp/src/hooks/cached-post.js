import React from "react";
import { useCachedState } from "@shades/common/app";

const useCachedPost = (cacheId, { initialState, searchParams }) => {
  const [post, setPost] = useCachedState(cacheId, {
    comment: initialState?.comment ?? "",
    support: initialState?.support ?? null,
    replies: initialState?.replies ?? {},
    reposts: initialState?.reposts ?? [],
  });

  const urlInitRef = React.useRef(true);

  const setComment = (comment) => setPost((s) => ({ ...s, comment }));
  const setSupport = (support) => setPost((s) => ({ ...s, support }));

  const addReply = (feedItemId) => {
    if (Object.keys(post?.replies ?? {}).includes(feedItemId)) return;
    setReply(feedItemId, "");
  };

  const setReply = (feedItemId, reply) => {
    setPost((s) => ({
      ...s,
      replies: {
        ...(s?.replies ?? {}),
        [feedItemId]: reply,
      },
    }));
  };

  const deleteReply = (feedItemId) => {
    setPost((s) => {
      const replies = { ...(s?.replies ?? {}) };
      delete replies[feedItemId];
      return { ...s, replies };
    });
  };

  const addRepost = (feedItemId) => {
    setPost((s) => {
      const currentReposts = s?.reposts ?? [];
      if (currentReposts.includes(feedItemId)) return s;
      return {
        ...s,
        reposts: [...currentReposts, feedItemId],
      };
    });
  };
  const deleteRepost = (feedItemId) => {
    setPost((s) => ({
      ...s,
      reposts: (s?.reposts ?? []).filter((id) => id !== feedItemId),
    }));
  };

  const clearPost = () => setPost(null);

  // add reply/repost from search params only once
  React.useEffect(() => {
    // post not fetched from cache yet
    if (post === undefined) return;

    if (!urlInitRef.current) return;

    const replyTarget = searchParams.get("reply-target");
    const repostTarget = searchParams.get("repost-target");

    if (replyTarget)
      setPost((s) => ({
        ...s,
        replies: {
          ...(s?.replies ?? {}),
          [replyTarget]: "",
        },
      }));

    if (repostTarget)
      setPost((s) => ({
        ...s,
        reposts: [...(s?.reposts ?? []), repostTarget],
      }));

    urlInitRef.current = false;
  }, [searchParams, post, setPost]);

  const { comment = "", support, replies, reposts } = post ?? {};

  return [
    { comment, support, replies, reposts },
    {
      setComment,
      setSupport,
      setReply,
      addReply,
      deleteReply,
      addRepost,
      deleteRepost,
      clearPost,
    },
  ];
};

export default useCachedPost;

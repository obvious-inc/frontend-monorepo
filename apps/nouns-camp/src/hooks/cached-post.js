import { useCachedState } from "@shades/common/app";

const useCachedPost = (cacheId, { initialSupport }) => {
  const [post, setPost] = useCachedState(cacheId, {
    comment: "",
    support: initialSupport,
    replies: null,
    reposts: null,
  });

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

  return [
    {
      comment: post?.comment ?? "",
      support: post?.support,
      replies: post?.replies,
      reposts: post?.reposts,
    },
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

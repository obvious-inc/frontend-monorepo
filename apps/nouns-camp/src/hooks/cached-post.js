import React from "react";
import { useCachedState } from "@shades/common/app";

const cacheKeyNamespace = "post-drafts";

const emptyPost = {
  comment: "",
  support: null,
  replies: {},
  reposts: [],
};

const useCachedPost = (
  cacheId,
  { initialRepostPostId, initialReplyTargetPostId } = {},
) => {
  const [post, setPost] = useCachedState(cacheId, emptyPost);

  const hasSetInitialStateRef = React.useRef(false);

  const setComment = (comment) => setPost((s) => ({ ...s, comment }));
  const setSupport = (support) => setPost((s) => ({ ...s, support }));

  const setReply = React.useCallback(
    (feedItemId, reply) => {
      setPost((s) => ({
        ...s,
        replies: { ...s.replies, [feedItemId]: reply },
      }));
    },
    [setPost],
  );

  const addReply = React.useCallback(
    (feedItemId) => {
      setPost((s) => {
        if (s.replies[feedItemId] != null) return s;
        return {
          ...s,
          replies: { ...s.replies, [feedItemId]: "" },
        };
      });
    },
    [setPost],
  );

  const deleteReply = (feedItemId) => {
    setPost((s) => {
      const replies = { ...s.replies };
      delete replies[feedItemId];
      return { ...s, replies };
    });
  };

  const addRepost = React.useCallback(
    (feedItemId) => {
      setPost((s) => {
        if (s.reposts.includes(feedItemId)) return s;
        return {
          ...s,
          reposts: [...s.reposts, feedItemId],
        };
      });
    },
    [setPost],
  );

  const deleteRepost = (feedItemId) => {
    setPost((s) => ({
      ...s,
      reposts: s.reposts.filter((id) => id !== feedItemId),
    }));
  };

  const clearPost = () => setPost(emptyPost);

  // add reply/repost from search params only once
  React.useEffect(() => {
    if (hasSetInitialStateRef.current) return;

    if (initialRepostPostId != null) addRepost(initialRepostPostId);
    if (initialReplyTargetPostId != null) addReply(initialReplyTargetPostId);

    hasSetInitialStateRef.current = true;
  }, [initialRepostPostId, initialReplyTargetPostId, addRepost, addReply]);

  const { comment = "", support, replies = [], reposts = [] } = post;

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

export const useCachedProposalPost = (proposalId, opts) => {
  const cacheKey = [cacheKeyNamespace, "proposals", proposalId].join(":");
  return useCachedPost(cacheKey, opts);
};

export const useCachedCandidatePost = (candidateId, opts) => {
  const cacheKey = [cacheKeyNamespace, "candidates", candidateId].join(":");
  return useCachedPost(cacheKey, opts);
};

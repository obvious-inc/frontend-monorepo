import React from "react";
import Avatar from "@shades/ui-web/avatar";
import { useNoun } from "../store.js";
import { useNounSeed } from "../hooks/token-contract.js";

const useNounDataUri = (seed, { enabled = true, transparent = false } = {}) => {
  const [avatarUrl, setAvatarUrl] = React.useState(null);

  React.useEffect(() => {
    if (!enabled || seed == null) return;
    import("@shades/common/nouns").then((module) => {
      const url = module.buildDataUriFromSeed(seed, { transparent });
      setAvatarUrl(url);
    });
  }, [enabled, transparent, seed]);

  return avatarUrl;
};

const NounAvatar = React.forwardRef(
  ({ id, transparent = false, signatureFallback = true, ...props }, ref) => {
    const noun = useNoun(id);
    const seed = useNounSeed(id, { enabled: noun?.seed == null });

    const nounAvatarUrl = useNounDataUri(noun?.seed ?? seed, {
      transparent,
    });

    return (
      <Avatar
        ref={ref}
        url={nounAvatarUrl}
        signature={signatureFallback ? id : null}
        signatureLength={4}
        {...props}
      />
    );
  },
);

export default NounAvatar;

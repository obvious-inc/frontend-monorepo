import React from "react";
import Avatar from "@shades/ui-web/avatar";

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
  ({ id, seed, transparent = false, ...props }, ref) => {
    const nounAvatarUrl = useNounDataUri(seed, {
      transparent,
    });

    return <Avatar ref={ref} url={nounAvatarUrl} signature={id} {...props} />;
  }
);

export default NounAvatar;

import React from "react";
import { css } from "@emotion/react";
import { useEnsName, useEnsAvatar } from "wagmi";
import { array as arrayUtils } from "@shades/common/utils";
import Avatar from "@shades/ui-web/avatar";
import { useDelegate } from "../hooks/prechain.js";

const { reverse } = arrayUtils;

const useNounAvatars = (
  seeds,
  { enabled = true, transparent = false } = {}
) => {
  const [avatarUrls, setAvatarUrls] = React.useState(null);

  React.useEffect(() => {
    if (!enabled || seeds == null) return;
    import("@shades/common/nouns").then((module) => {
      const urls = seeds.map((seed) =>
        module.buildDataUriFromSeed(seed, { transparent })
      );
      setAvatarUrls(urls);
    });
  }, [enabled, transparent, seeds == null]); // eslint-disable-line

  return avatarUrls;
};

const NounsAccountAvatar = React.forwardRef(
  (
    {
      address: accountAddress,
      transparent = false,
      maxStackCount = 2,
      ...props
    },
    ref
  ) => {
    const delegate = useDelegate(accountAddress);
    const nounSeeds = delegate?.nounsRepresented.map((n) => n.seed);

    const { data: ensName } = useEnsName({ address: accountAddress });
    const { data: ensAvatarUrl } = useEnsAvatar({
      name: ensName,
      enabled: ensName != null,
    });

    const enablePlaceholder = ensAvatarUrl == null;

    const nounAvatarUrls = useNounAvatars(nounSeeds, {
      enabled: enablePlaceholder,
      transparent,
    });

    if (
      ensAvatarUrl == null &&
      nounAvatarUrls != null &&
      nounAvatarUrls.length > 1
    )
      return (
        <AvatarStack urls={nounAvatarUrls} count={maxStackCount} {...props} />
      );

    const imageUrl = ensAvatarUrl ?? nounAvatarUrls?.[0];

    return (
      <Avatar
        ref={ref}
        url={imageUrl}
        signature={ensName ?? accountAddress.slice(2)}
        {...props}
      />
    );
  }
);

const AvatarStack = ({ urls = [], count: maxCount = 4, style, ...props }) => {
  const size = typeof props.size === "number" ? `${props.size}px` : props.size;
  const count = Math.min(urls.length, maxCount);
  const offset = `calc(${size} * (1 / (3 * ${count})))`;

  return (
    <div
      style={{
        width: props.size,
        height: props.size,
        position: "relative",
        ...style,
      }}
    >
      {reverse(urls.slice(0, count)).map((url, i) => (
        <Avatar
          key={url}
          url={url}
          {...props}
          css={css({
            position: "absolute",
            bottom: `calc(${offset} * ${i})`,
            right: `calc(${offset} * ${i})`,
            width: `calc(100% - ${offset} * ${count - 1})`,
            height: `calc(100% - ${offset} * ${count - 1})`,
            boxShadow: i !== 0 ? `1px 1px 0 0px rgb(0 0 0 / 30%)` : undefined,
          })}
        />
      ))}
    </div>
  );
};

export default NounsAccountAvatar;

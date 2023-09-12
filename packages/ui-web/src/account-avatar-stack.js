import { css, useTheme } from "@emotion/react";
import { array as arrayUtils } from "@shades/common/utils";
import AccountAvatar from "./account-avatar.js";

const { reverse } = arrayUtils;

const AccountAvatarStack = ({
  addresses = [],
  count: maxCount = 4,
  background,
  style,
  ...props
}) => {
  const size = typeof props.size === "number" ? `${props.size}px` : props.size;
  const theme = useTheme();
  const count = Math.min(addresses.length, maxCount);
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
      {reverse(addresses.slice(0, count)).map((accountAddress, i) => (
        <AccountAvatar
          key={accountAddress}
          address={accountAddress}
          background={background ?? theme.colors.backgroundSecondary}
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

export default AccountAvatarStack;

import { css, useTheme } from "@emotion/react";
import { array as arrayUtils } from "@shades/common/utils";
import UserAvatar from "./user-avatar.js";

const { reverse } = arrayUtils;

const UserAvatarStack = ({
  accounts = [],
  count: maxCount = 4,
  background,
  ...props
}) => {
  const size = typeof props.size === "number" ? `${props.size}px` : props.size;
  const theme = useTheme();
  const count = Math.min(accounts.length, maxCount);
  const offset = `calc(${size} * (1 / (3 + ${count})))`;
  return (
    <div
      style={{
        width: props.size,
        height: props.size,
        position: "relative",
      }}
    >
      {reverse(accounts.slice(0, count)).map((account, i) => (
        <UserAvatar
          key={account.walletAddress}
          walletAddress={account.walletAddress}
          background={background ?? theme.colors.backgroundSecondary}
          {...props}
          css={css({
            position: "absolute",
            bottom: `calc(${offset} * ${i})`,
            right: `calc(${offset} * ${i})`,
            // left: i === 0 ? gutter : 0,
            width: `calc(100% - ${offset} * ${count - 1})`,
            height: `calc(100% - ${offset} * ${count - 1})`,
            boxShadow: i !== 0 ? `1px 1px 0 0px rgb(0 0 0 / 30%)` : undefined,
          })}
        />
      ))}
    </div>
  );
};

export default UserAvatarStack;

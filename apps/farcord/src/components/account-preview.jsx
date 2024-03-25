import { css } from "@emotion/react";
import useFarcasterAccount from "./farcaster-account";
import Avatar from "@shades/ui-web/avatar";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger";
import { useUserData as useHubUserData } from "../hooks/hub";

const AccountPreview = ({ displayName, bio, username }) => {
  const { fid } = useFarcasterAccount();
  const userData = useHubUserData(fid);
  return (
    <>
      <div
        css={css({
          display: "grid",
          gridTemplateColumns: "5rem auto",
          columnGap: "1rem",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "2.4rem",
          maxWidth: "40rem",
          justifySelf: "center",
        })}
      >
        <div
          css={(t) =>
            css({
              background: t.colors.borderLighter,
              width: "5rem",
              height: "5rem",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            })
          }
        >
          <Avatar
            url={userData?.pfp}
            size="5rem"
            css={(t) =>
              css({
                background: t.colors.borderLighter,
              })
            }
          />
        </div>

        <div
          css={() =>
            css({
              textAlign: "left",
            })
          }
        >
          <p>
            <span style={{ fontWeight: "bold" }}>
              {displayName ?? userData?.displayName}
            </span>{" "}
            <AccountPreviewPopoverTrigger
              fid={fid}
              username={username}
              css={(t) => css({ color: t.colors.textMuted })}
            />
          </p>
          <p>{bio ?? userData?.bio}</p>
        </div>
      </div>
    </>
  );
};

export default AccountPreview;

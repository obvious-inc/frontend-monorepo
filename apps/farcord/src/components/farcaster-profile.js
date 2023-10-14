import { css } from "@emotion/react";
import Button from "@shades/ui-web/button";
import Spinner from "@shades/ui-web/spinner";
import { useNeynarUser } from "../hooks/neynar";
import useSigner from "./signer";
import { useNavigate, useSearchParams } from "react-router-dom";
import useFarcasterAccount from "./farcaster-account";

const FarcasterUser = () => {
  const navigate = useNavigate();
  const { fid } = useFarcasterAccount();
  const { user: farcasterUser, isFetching: isFetchingNeynarUser } =
    useNeynarUser(fid);

  const { broadcasted } = useSigner();

  if (isFetchingNeynarUser) {
    return <Spinner size="1rem" />;
  }

  const handleProfileClick = async () => {
    navigate("/profile");

    // if (!broadcasted) {
    //   setSearchParams({ "auth-dialog": 1, provider: "wallet" });
    // }
  };

  if (!farcasterUser?.displayName) {
    return (
      <Button
        size="small"
        variant="default"
        onClick={() => {
          navigate("/profile");
        }}
      >
        Set up your profile
      </Button>
    );
  }

  return (
    <Button
      onClick={() => {
        handleProfileClick();
      }}
      css={(theme) =>
        css({
          color: "inherit",
          textDecoration: "none",
          border: "none",
          width: "100%",
          ":hover": { color: theme.colors.linkModifierHover },
          height: "5rem",
        })
      }
    >
      <p
        css={(t) =>
          css({
            fontWeight: t.text.weights.emphasis,
          })
        }
      >
        {farcasterUser?.displayName}{" "}
        <span
          css={(t) =>
            css({
              color: t.colors.textMuted,
            })
          }
        >
          (@{farcasterUser?.username})
        </span>
      </p>
      {!broadcasted && (
        <p
          css={(t) =>
            css({
              fontSize: t.text.sizes.small,
              color: t.colors.pink,
              textAlign: "center",
              marginTop: "0.5rem",
            })
          }
        >
          read-only
        </p>
      )}
    </Button>
  );
};

const FarcasterProfile = () => {
  const { fid } = useFarcasterAccount();
  const { signer } = useSigner();
  const [, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  return (
    <>
      <div
        css={(t) =>
          css({
            margin: "0.6rem 0 0.2rem",
            padding: `0 0.8rem 0 calc( ${t.mainMenu.itemHorizontalPadding} + ${t.mainMenu.containerHorizontalPadding})`,
            minHeight: "2.4rem",
            display: "grid",
            alignItems: "center",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gridGap: "1rem",
          })
        }
      >
        {!fid ? (
          <Button
            size="small"
            variant="default"
            onClick={() => {
              navigate("/register");
            }}
          >
            Connect your wallet
          </Button>
        ) : !signer ? (
          <Button
            size="small"
            variant="default"
            onClick={() => {
              setSearchParams({ "auth-dialog": 1 });
            }}
          >
            Sign in with Farcaster
          </Button>
        ) : (
          <FarcasterUser />
        )}
      </div>
    </>
  );
};

export default FarcasterProfile;

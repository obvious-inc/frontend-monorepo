import { css } from "@emotion/react";
import { useAuth } from "@shades/common";
import Button from "./button";
import { StrokedStar } from "./icons";

const AuthHome = () => {
  const { authorizedFetch } = useAuth();
  const params = new URLSearchParams(location.search);

  const submitAuth = () => {
    authorizedFetch("/oauth/authorize?" + params, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "consent=1",
    })
      .then((response) => {
        window.location = response["location"];
      })
      .catch((error) => {
        console.error(error);
      });
  };

  return (
    <div
      css={(theme) =>
        css({
          flex: 1,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: theme.colors.backgroundPrimary,
        })
      }
    >
      <div
        css={css({
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        })}
      >
        <div
          css={css({
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          })}
        >
          <div>
            {params.get("client_id") ? (
              <Button onClick={submitAuth}>Allow</Button>
            ) : (
              <StrokedStar
                style={{
                  width: "6rem",
                  color: "rgb(255 255 255 / 5%)",
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthHome;

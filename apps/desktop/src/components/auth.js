import React from "react";
import { css } from "@emotion/react";
import { useAuth, useChannel, useChannelName } from "@shades/common/app";
import { permission as permissionUtils } from "@shades/common/utils";
import Button from "@shades/design-system/button";

const { parseScopes } = permissionUtils;

const AuthHome = () => {
  const { authorizedFetch } = useAuth();

  const params = new URLSearchParams(location.search);
  const clientId = params.get("client_id");
  const channelId = params.get("channel");
  const scopes = params.get("scope")?.split(" ");
  const redirectURI = params.get("redirect_uri");

  const channel = useChannel(channelId);
  const channelName = useChannelName(channelId);

  const [clientName, setClientName] = React.useState(null);
  const [scopeContent, setScopeContent] = React.useState(parseScopes(scopes));

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

  const cancelAuth = () => {
    window.location = redirectURI + "?error=access_denied";
  };

  React.useEffect(() => {
    if (clientId == null) return;
    authorizedFetch(`/apps/?client_id=${clientId}`).then((res) => {
      const client = res[0];
      setClientName(client?.name);

      if (!scopes) setScopeContent(parseScopes(client.scopes));
    });
  }, [authorizedFetch, clientId, scopes]);

  if (clientId == null || channel == null) return null;

  return (
    <div
      css={css({
        height: "100%",
        userSelect: "text",
        overflow: "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      })}
    >
      <div
        css={css({
          margin: "auto",
          width: "48rem",
          maxWidth: "100%",
          padding: "4rem 2rem",
          lineHeight: "1.3",
        })}
      >
        <header
          css={(theme) =>
            css({
              fontSize: theme.fontSizes.large,
              textAlign: "center",
              margin: "0 0 3rem",
            })
          }
        >
          <Em>{clientName}</Em> will be able to connect to{" "}
          <Em>#{channelName}</Em> and...
        </header>
        <main
          css={(theme) =>
            css({
              margin: "0 0 2rem",
              fontSize: theme.fontSizes.default,
              li: {
                listStyle: "none",
                padding: "1rem 0",
                ":not(:first-of-type)": {
                  borderTop: "0.1rem solid",
                  borderColor: "hsl(0 0% 100% / 5%)",
                },
              },
            })
          }
        >
          <ul>
            {scopeContent?.map(({ key, content }) => (
              <li key={key}>{content}</li>
            ))}
          </ul>
        </main>

        <footer
          css={css({
            display: "flex",
            justifyContent: "center",
            padding: "2rem 0",
          })}
        >
          <div
            css={css({
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0,1fr))",
              gridGap: "2rem",
            })}
          >
            <Button fullWidth size="large" onClick={cancelAuth}>
              Cancel
            </Button>
            <Button
              fullWidth
              variant="primary"
              size="large"
              onClick={submitAuth}
            >
              Authorize
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
};

const Em = (props) => (
  <em css={css({ fontWeight: "600", fontStyle: "normal" })} {...props} />
);

export default AuthHome;

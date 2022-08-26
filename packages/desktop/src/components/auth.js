import React from "react";
import { css } from "@emotion/react";
import { useAuth } from "@shades/common";
import Button from "./button";

const AuthHome = () => {
  const { authorizedFetch } = useAuth();
  const params = new URLSearchParams(location.search);
  const clientId = params.get("client_id");

  const [something, setSomething] = React.useState(null);

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

  React.useEffect(() => {
    if (clientId == null) return;
    authorizedFetch(`/apps?client_id=${clientId}`).then((res) => {
      setSomething(res[0]?.name);
    });
  }, [authorizedFetch, clientId]);

  if (clientId == null) return null;

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
          <Em>Anvil</Em> will be able to connect to <Em>Acme corp</Em> and...
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
            {[
              { content: "Confirm your identity on foo" },
              { content: "Send messages as bar" },
              {
                content: (
                  <>
                    Access information about your public channels on{" "}
                    <a
                      href="https://google.com"
                      target="_blank"
                      rel="noreferrer"
                      css={(t) => css({ color: t.colors.linkColor })}
                    >
                      {something}
                    </a>
                  </>
                ),
              },
            ].map(({ content }) => (
              <li key={content}>{content}</li>
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
            <Button
              fullWidth
              size="large"
              onClick={() => {
                // TODO
              }}
            >
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

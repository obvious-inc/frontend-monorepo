import { css } from "@emotion/react";
import NextLink from "next/link";
import Button from "@shades/ui-web/button";
import Layout from "./layout.js";
import Code from "./code.js";

const ErrorScreen = ({
  title = "Error",
  description = "Ops, looks like something went wrong.",
  imageSrc,
  linkLabel = "Go back",
  linkHref = "/",
  navigationStack,
  error,
}) => (
  <Layout navigationStack={navigationStack}>
    <div
      css={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "1.6rem 1.6rem 6.4rem",
        "@media (min-width: 600px)": {
          flex: 1,
          padding: "5vh 1.6rem 20vh",
        },
      })}
    >
      <div style={{ maxWidth: "100%" }}>
        <div
          css={(t) =>
            css({
              fontSize: "3.6rem",
              fontWeight: t.text.weights.header,
              color: t.colors.textHeader,
              margin: "0 0 1.6rem",
              lineHeight: 1.3,
            })
          }
        >
          {title}
        </div>
        {imageSrc != null && (
          <div style={{ margin: "2.4rem 0 2.8rem" }}>
            <img
              src={imageSrc}
              style={{
                maxWidth: "32rem",
                margin: "auto",
                borderRadius: "0.3rem",
              }}
            />
          </div>
        )}
        <div
          css={(t) =>
            css({
              fontSize: t.text.sizes.larger,
              wordBreak: "break-word",
              margin: "1em auto",
              maxWidth: "44rem",
            })
          }
        >
          {description}
        </div>
        {error?.stack != null && (
          <details
            style={{ margin: "1em auto", width: "58rem", maxWidth: "100%" }}
          >
            <summary
              css={(t) =>
                css({ color: t.colors.textDimmed, cursor: "pointer" })
              }
            >
              Click to show error
            </summary>
            <div
              css={(t) =>
                css({
                  marginTop: "1.6rem",
                  textAlign: "left",
                  fontSize: t.text.sizes.large,
                })
              }
            >
              <Code block>{error.stack}</Code>
            </div>
          </details>
        )}
        <div style={{ margin: "4.8rem 0 0" }}>
          <Button
            component={NextLink}
            href={linkHref}
            variant="primary"
            size="large"
            style={{ minWidth: "12rem" }}
          >
            {linkLabel}
          </Button>
        </div>
      </div>
    </div>
  </Layout>
);

export default ErrorScreen;

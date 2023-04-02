import { css } from "@emotion/react";

const ChannelPrologue = ({ title, subtitle, body, image, info, ...props }) => {
  return (
    <div
      css={(t) =>
        css({
          padding: "6rem 1.6rem 0",
          color: t.colors.textDimmed,
          fontSize: t.text.sizes.channelMessages,
        })
      }
      {...props}
    >
      <div
        css={(theme) =>
          css({
            borderBottom: "0.1rem solid",
            borderColor: theme.colors.borderLighter,
            padding: "0 0 1.5rem",
          })
        }
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          {image != null && (
            <div style={{ marginRight: "1.2rem" }}>{image}</div>
          )}
          <div>
            <div
              css={(t) =>
                css({
                  fontSize: t.text.sizes.header,
                  fontWeight: t.text.weights.header,
                  color: t.colors.textHeader,
                  lineHeight: 1.3,
                })
              }
            >
              {title}
            </div>
            {subtitle != null && (
              <div
                css={(t) =>
                  css({
                    fontSize: t.text.sizes.default,
                  })
                }
              >
                {subtitle}
              </div>
            )}
          </div>
        </div>
        {(body ?? info) != null && (
          <div
            css={css({
              marginTop: "2rem",
              whiteSpace: "pre-wrap",
              "p + p": { marginTop: "1.5rem" },
            })}
          >
            {body}
            {info != null && (
              <div
                css={(t) =>
                  css({
                    color: t.colors.textHighlight,
                    fontSize: t.text.sizes.default,
                    marginTop: "1rem",
                  })
                }
              >
                {info}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChannelPrologue;

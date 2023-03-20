import React from "react";
import { useNavigate } from "react-router-dom";
import { css } from "@emotion/react";
// import { ethereum as ethereumUtils } from "@shades/common/utils";
import { useActions } from "@shades/common/app";
import Dialog from "@shades/design-system/dialog";
import Button from "@shades/design-system/button";

// const { truncateAddress } = ethereumUtils;

const NewMessageDialogContent = ({ titleProps, close, createChannel }) => {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [message, setMessage] = React.useState("");

  const [hasPendingRequest, setPendingRequest] = React.useState(false);

  const hasDraftableInput = [name, description, message].some(
    (t) => t.trim().length !== 0
  );
  const hasRequiredInput = [name, message].every((t) => t.trim().length !== 0);

  const submit = () => {
    setPendingRequest(true);
    createChannel({ name, description })
      .then(
        () => {
          close();
        },
        (e) => {
          alert("Ops, looks like something went wrong!");
          throw e;
        }
      )
      .finally(() => {
        setPendingRequest(true);
      });
  };

  return (
    <div
      css={css({
        flex: 1,
        overflow: "auto",
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        "@media (min-width: 600px)": {
          padding: "2.5rem",
        },
      })}
    >
      <header
        css={css({
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)",
          gridGap: "0.5rem",
          alignItems: "center",
          margin: "0 0 1.5rem",
        })}
      >
        <div />
        <h1
          css={(t) =>
            css({
              fontSize: t.fontSizes.large,
              fontWeight: t.text.weights.header,
              lineHeight: "1.2",
              margin: 0,
              color: t.colors.textHeader,
            })
          }
          {...titleProps}
        >
          New message
        </h1>
        <div css={css({ display: "flex", justifyContent: "flex-end" })}>
          <Button
            size="small"
            onClick={() => {
              close();
            }}
          >
            9 drafts
          </Button>
        </div>
      </header>
      <main css={css({ flex: 1, minHeight: 0 })}>
        <form
          id="new-message-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          css={(t) =>
            css({
              "input, textarea": {
                display: "block",
                border: 0,
                background: "none",
                width: "100%",
                outline: "none",
                color: t.colors.textNormal,
                padding: "1rem 0",
                fontSize: t.fontSizes.large,
                resize: "none",
                "::placeholder": { color: t.colors.textMuted },
              },
              input: {
                borderBottom: "0.1rem solid",
                borderColor: t.colors.borderLight,
              },
            })
          }
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            disabled={hasPendingRequest}
            placeholder="To"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={hasPendingRequest}
            placeholder="Subject"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={hasPendingRequest}
            placeholder="Type your message..."
            rows={8}
          />
        </form>
      </main>
      <footer
        css={css({
          display: "grid",
          gridTemplateColumns: "auto auto minmax(0,1fr) auto",
          justifyContent: "flex-start",
          gridGap: "1.5rem",
          paddingTop: "1.5rem",
          "@media (min-width: 600px)": {
            paddingTop: "2.5rem",
          },
        })}
      >
        <Button
          type="submit"
          form="new-message-form"
          size="medium"
          variant="primary"
          isLoading={hasPendingRequest}
          disabled={!hasRequiredInput || hasPendingRequest}
        >
          Send message
        </Button>
        <Button
          type="button"
          size="medium"
          variant="default"
          disabled={!hasDraftableInput || hasPendingRequest}
        >
          Save draft
        </Button>
        <div />
        <Button
          onClick={() => {
            close();
          }}
          css={css({
            width: "3.6rem",
            padding: 0,
            svg: {
              display: "block",
              margin: "auto",
              width: "1.5rem",
              height: "auto",
            },
          })}
        >
          <svg viewBox="0 0 16 16">
            <path
              fill="currentColor"
              d="M4.8623 15.4287H11.1445C12.1904 15.4287 12.8672 14.793 12.915 13.7402L13.3799 3.88965H14.1318C14.4736 3.88965 14.7402 3.62988 14.7402 3.28809C14.7402 2.95312 14.4736 2.69336 14.1318 2.69336H11.0898V1.66797C11.0898 0.62207 10.4268 0 9.29199 0H6.69434C5.56641 0 4.89648 0.62207 4.89648 1.66797V2.69336H1.86133C1.5332 2.69336 1.25977 2.95312 1.25977 3.28809C1.25977 3.62988 1.5332 3.88965 1.86133 3.88965H2.62012L3.08496 13.7471C3.13281 14.7998 3.80273 15.4287 4.8623 15.4287ZM6.1543 1.72949C6.1543 1.37402 6.40039 1.14844 6.7832 1.14844H9.20312C9.58594 1.14844 9.83203 1.37402 9.83203 1.72949V2.69336H6.1543V1.72949ZM4.99219 14.2188C4.61621 14.2188 4.34277 13.9453 4.32227 13.542L3.86426 3.88965H12.1152L11.6709 13.542C11.6572 13.9453 11.3838 14.2188 10.9941 14.2188H4.99219ZM5.9834 13.1182C6.27051 13.1182 6.45508 12.9336 6.44824 12.667L6.24316 5.50293C6.23633 5.22949 6.04492 5.05176 5.77148 5.05176C5.48438 5.05176 5.2998 5.23633 5.30664 5.50293L5.51172 12.667C5.51855 12.9404 5.70996 13.1182 5.9834 13.1182ZM8 13.1182C8.28711 13.1182 8.47852 12.9336 8.47852 12.667V5.50293C8.47852 5.23633 8.28711 5.05176 8 5.05176C7.71289 5.05176 7.52148 5.23633 7.52148 5.50293V12.667C7.52148 12.9336 7.71289 13.1182 8 13.1182ZM10.0166 13.1182C10.29 13.1182 10.4746 12.9404 10.4814 12.667L10.6934 5.50293C10.7002 5.23633 10.5088 5.05176 10.2285 5.05176C9.95508 5.05176 9.76367 5.22949 9.75684 5.50293L9.54492 12.667C9.53809 12.9336 9.72949 13.1182 10.0166 13.1182Z"
            />
          </svg>
        </Button>
      </footer>
    </div>
  );
};

const NewMessageDialog = ({ isOpen, close }) => {
  const actions = useActions();
  const navigate = useNavigate();

  return (
    <Dialog
      width="72rem"
      height="min(80vh, 82rem)"
      isOpen={isOpen}
      onRequestClose={close}
    >
      {({ titleProps }) => (
        <NewMessageDialogContent
          titleProps={titleProps}
          close={close}
          createChannel={async (...args) => {
            const channel = await actions.createPrivateChannel(...args);
            navigate(`/c/${channel.id}`);
          }}
        />
      )}
    </Dialog>
  );
};

export default NewMessageDialog;

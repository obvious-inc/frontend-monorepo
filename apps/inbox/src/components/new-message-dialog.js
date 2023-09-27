import { isAddress as isEthereumAccountAddress } from "viem";
import React from "react";
import { useNavigate } from "react-router-dom";
import { css } from "@emotion/react";
import { useEnsAddress } from "wagmi";
// import { ethereum as ethereumUtils } from "@shades/common/utils";
import { useActions } from "@shades/common/app";
import { message as messageUtils } from "@shades/common/utils";
import Dialog from "@shades/ui-web/dialog";
import Button from "@shades/ui-web/button";
import { TrashCan as TrashCanIcon } from "@shades/ui-web/icons";

// const { truncateAddress } = ethereumUtils;

const NewMessageDialogContent = ({ titleProps, close, createMessage }) => {
  const [recipient, setRecipient] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");

  const [hasPendingRequest, setPendingRequest] = React.useState(false);

  const { data: ensWalletAddress } = useEnsAddress({
    name: recipient,
    enabled: /^.+\.eth$/.test(recipient),
  });

  const recipientWalletAddress =
    ensWalletAddress ??
    (isEthereumAccountAddress(recipient) ? recipient : null);

  const hasDraftableInput = [recipient, subject, message].some(
    (t) => t.trim().length !== 0
  );
  const hasRequiredInput =
    recipientWalletAddress != null && message.trim().length !== 0;

  const submit = () => {
    setPendingRequest(true);
    createMessage({
      subject: subject.trim(),
      recipientWalletAddress,
      message: message.trim(),
    })
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
            autoFocus
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            disabled={hasPendingRequest}
            placeholder="To (ENS or wallet address)"
          />
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
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
          <TrashCanIcon />
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
          createMessage={async ({
            recipientWalletAddress,
            subject,
            message,
          }) => {
            const channel = await actions.createPrivateChannel({
              name: subject,
              memberWalletAddresses: [recipientWalletAddress],
            });
            await actions.createMessage({
              channel: channel.id,
              blocks: [messageUtils.createParagraphElement(message)],
            });
            navigate("/");
          }}
        />
      )}
    </Dialog>
  );
};

export default NewMessageDialog;

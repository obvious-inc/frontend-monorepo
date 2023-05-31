import React from "react";
import { useNavigate } from "react-router-dom";
import { css } from "@emotion/react";
import { message as messageUtils } from "@shades/common/utils";
import { useActions, useAuth } from "@shades/common/app";
import { useWallet, useWalletLogin } from "@shades/common/wallet";
import Button from "@shades/ui-web/button";
import { AddUser as AddUserIcon } from "@shades/ui-web/icons";
import RichTextEditor, {
  isNodeEmpty as isSlateNodeEmpty,
} from "@shades/ui-web/rich-text-editor";
import { useDialog } from "../hooks/dialogs.js";
import Select from "./select.js";

const { createEmptyParagraphElement } = messageUtils;

const CreateChannelDialogContent = ({
  // titleProps,
  createChannel,
}) => {
  const { status: authenticationStatus } = useAuth();
  const {
    connect: connectWallet,
    accountAddress: connectedWalletAccountAddress,
  } = useWallet();
  const {
    login: initAccountVerification,
    status: pendingAccountVerificationState,
  } = useWalletLogin();
  const {
    open: openAccountAuthenticationDialog,
    dismiss: dismissAccountAuthenticationDialog,
  } = useDialog("account-authentication");

  const [isPrivate, setPrivate] = React.useState(false);
  const [hasOpenWriteAccess, setOpenWriteAccess] = React.useState(true);

  const [name, setName] = React.useState("");
  const [body, setBody] = React.useState(() => [createEmptyParagraphElement()]);

  const [hasPendingRequest, setPendingRequest] = React.useState(false);

  const isBodyEmpty = body.length <= 1 && body.every(isSlateNodeEmpty);
  const hasRequiredInput = name.trim().length !== 0 && !isBodyEmpty;

  const submit = () => {
    setPendingRequest(true);
    const permissionType = isPrivate
      ? "private"
      : hasOpenWriteAccess
      ? "open"
      : "closed";

    createChannel({ name, body, permissionType })
      .catch((e) => {
        alert("Ops, looks like something went wrong!");
        throw e;
      })
      .finally(() => {
        setPendingRequest(false);
      });
  };

  return (
    <div
      css={css({
        minHeight: 0,
        flex: 1,
        display: "flex",
        flexDirection: "column",
      })}
    >
      <div
        style={{
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: "auto",
          gridGap: "1rem",
          justifyContent: "flex-end",
          padding: "1rem",
        }}
      >
        <Select
          value={isPrivate ? "private" : "public"}
          width="max-content"
          size="small"
          onChange={(value) => {
            setPrivate(value === "private");
          }}
          options={[
            {
              label: "Public topic",
              description: "Visible to anyone",
              value: "public",
            },
            {
              label: "Private topic",
              description: "Only visible to members",
              value: "private",
            },
          ]}
          renderTriggerContent={(selectedValue) => {
            switch (selectedValue) {
              case "public":
                return "Public topic";
              case "private":
                return "Private topic";
              default:
                throw new Error();
            }
          }}
          disabled={hasPendingRequest}
        />
        {!isPrivate && (
          <Select
            value={hasOpenWriteAccess ? "open" : "members-only"}
            size="small"
            width="max-content"
            onChange={(value) => {
              setOpenWriteAccess(value === "open");
            }}
            options={[
              { label: "Anyone can post", value: "open" },
              { label: "Only members can post", value: "members-only" },
            ]}
            renderTriggerContent={(selectedValue) => {
              switch (selectedValue) {
                case "open":
                  return "Anyone can post";
                case "members-only":
                  return "Only members can post";
                default:
                  throw new Error();
              }
            }}
            disabled={hasPendingRequest}
          />
        )}
        {(isPrivate || !hasOpenWriteAccess) && (
          <Button
            disabled
            size="small"
            icon={<AddUserIcon style={{ width: "1.6rem" }} />}
          >
            Add members
          </Button>
        )}
      </div>
      <form
        id="create-channel-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        css={css({
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        })}
      >
        <div
          style={{
            flex: 1,
            minHeight: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "auto",
          }}
        >
          <main
            css={css({
              flex: 1,
              minHeight: 1,
              width: "100%",
              maxWidth: "71rem",
              margin: "0 auto",
              padding: "1.5rem",
              "@media (min-width: 600px)": {
                padding: "8rem 2.5rem 2.5rem",
              },
            })}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              disabled={hasPendingRequest}
              placeholder="Untitled topic"
              css={(t) =>
                css({
                  background: "none",
                  fontSize: t.text.sizes.huge,
                  width: "100%",
                  outline: "none",
                  fontWeight: t.text.weights.header,
                  border: 0,
                  padding: 0,
                  margin: "0 0 1rem",
                  color: t.colors.textNormal,
                  "::placeholder": { color: t.colors.textMuted },
                })
              }
            />
            <RichTextEditor
              value={body}
              onChange={(e) => {
                setBody(e);
              }}
              placeholder={`Use markdown shortcuts like "# " and "1. " to create headings and lists.`}
              css={(t) =>
                css({
                  fontSize: t.text.sizes.large,
                  "[data-slate-placeholder]": {
                    opacity: "1 !important",
                    color: t.colors.textMuted,
                  },
                })
              }
              style={{ minHeight: "13.8rem" }}
            />
          </main>
        </div>
        <footer
          css={css({
            display: "grid",
            gridAutoColumns: "auto",
            gridAutoFlow: "column",
            gridGap: "1rem",
            justifyContent: "flex-end",
            alignItems: "center",
            padding: "1rem",
          })}
        >
          {authenticationStatus === "authenticated" ? (
            <>
              <Button type="button" size="medium" disabled>
                Save draft
              </Button>
              <Button
                type="submit"
                form="create-channel-form"
                size="medium"
                variant="primary"
                isLoading={hasPendingRequest}
                disabled={!hasRequiredInput || hasPendingRequest}
              >
                Create topic
              </Button>
            </>
          ) : (
            <>
              <div
                css={(t) =>
                  css({
                    fontSize: t.text.sizes.small,
                    color: t.colors.textDimmed,
                    padding: "0 0.6rem",
                    "@media (min-width: 600px)": {
                      paddingRight: "1rem",
                      fontSize: t.text.sizes.base,
                    },
                  })
                }
              >
                Account verification required to create topics
              </div>
              {connectedWalletAccountAddress == null ? (
                <Button
                  type="button"
                  size="medium"
                  variant="primary"
                  onClick={async () => {
                    const connectResponse = await connectWallet();
                    if (connectResponse == null) return;
                    openAccountAuthenticationDialog();
                    await initAccountVerification(connectResponse.account);
                    dismissAccountAuthenticationDialog();
                  }}
                >
                  Connect wallet
                </Button>
              ) : (
                <Button
                  type="button"
                  size="medium"
                  variant="primary"
                  onClick={async () => {
                    openAccountAuthenticationDialog();
                    try {
                      await initAccountVerification(
                        connectedWalletAccountAddress
                      );
                    } finally {
                      dismissAccountAuthenticationDialog();
                    }
                  }}
                  isLoading={pendingAccountVerificationState !== "idle"}
                  disabled={pendingAccountVerificationState !== "idle"}
                >
                  Verify account
                </Button>
              )}
            </>
          )}
        </footer>
      </form>
    </div>
  );
};

const CreateChannelDialog = ({ dismiss, titleProps }) => {
  const actions = useActions();
  const navigate = useNavigate();
  return (
    <CreateChannelDialogContent
      titleProps={titleProps}
      createChannel={async ({ name, description, body, permissionType }) => {
        const params = { name, description, body };

        const create = () => {
          switch (permissionType) {
            case "open":
              return actions.createOpenChannel(params);
            case "closed":
              return actions.createClosedChannel(params);
            case "private":
              return actions.createPrivateChannel(params);
            default:
              throw new Error(`Unrecognized channel type "${permissionType}"`);
          }
        };

        const channel = await create();
        dismiss();
        navigate(`/channels/${channel.id}`);
      }}
    />
  );
};

export default CreateChannelDialog;

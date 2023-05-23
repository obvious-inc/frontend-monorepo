import React from "react";
import { useNavigate } from "react-router-dom";
import { css } from "@emotion/react";
import {
  ethereum as ethereumUtils,
  message as messageUtils,
} from "@shades/common/utils";
import { useActions, useAuth } from "@shades/common/app";
import { useWallet, useWalletLogin } from "@shades/common/wallet";
import Button from "@shades/ui-web/button";
import { AddUser as AddUserIcon } from "@shades/ui-web/icons";
import { isNodeEmpty as isSlateNodeEmpty } from "../slate/utils.js";
import RichTextInput from "./rich-text-input.js";
import Select from "./select.js";

const { truncateAddress } = ethereumUtils;
const { createEmptyParagraphElement } = messageUtils;

const CreateChannelDialogContent = ({
  // titleProps,
  close,
  createChannel,
}) => {
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
            <RichTextInput
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
            padding: "1rem",
          })}
        >
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
        </footer>
      </form>
    </div>
  );
};

const CreateChannelDialog = ({ dismiss, titleProps }) => {
  const actions = useActions();
  const { status: authenticationStatus } = useAuth();
  const navigate = useNavigate();
  const { accountAddress: walletAccountAddress } = useWallet();
  const { login } = useWalletLogin();

  return (
    <CreateChannelDialogContent
      titleProps={titleProps}
      close={dismiss}
      createChannel={async ({ name, description, body, permissionType }) => {
        if (authenticationStatus !== "authenticated") {
          if (walletAccountAddress == null) {
            alert(
              "You need to connect and verify your account to create channels."
            );
            return;
          }
          if (
            !confirm(
              `You need to verify your account to create channels. Press ok to verify "${truncateAddress(
                walletAccountAddress
              )}" with wallet signature.`
            )
          )
            return;

          await login(walletAccountAddress);
        }

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

        navigate(`/channels/${channel.id}`);
      }}
    />
  );
};

export default CreateChannelDialog;

import React from "react";
import { useNavigate } from "react-router-dom";
import { css } from "@emotion/react";
import { ethereum as ethereumUtils } from "@shades/common/utils";
import { useActions, useAuth } from "@shades/common/app";
import { useWallet, useWalletLogin } from "@shades/common/wallet";
import Button from "@shades/ui-web/button";
import {
  Cross as CrossIcon,
  Globe as GlobeIcon,
  Lock as LockIcon,
  EyeOff as EyeOffIcon,
} from "@shades/ui-web/icons";
import Input from "./input";
import Select from "./select";

const { truncateAddress } = ethereumUtils;

const CreateChannelDialogContent = ({ titleProps, close, createChannel }) => {
  const [selectedType, setSelectedType] = React.useState("open");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");

  const [hasPendingRequest, setPendingRequest] = React.useState(false);

  const hasRequiredInput = name.trim().length !== 0;

  const submit = () => {
    setPendingRequest(true);
    createChannel({ name, description, permissionType: selectedType })
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
        position: "relative",
        padding: "1.5rem",
        "@media (min-width: 600px)": {
          padding: "4rem 2.5rem 2.5rem",
        },
      })}
    >
      <header
        css={css({
          textAlign: "center",
          margin: "0 0 1.5rem",
          "@media (min-width: 600px)": {
            margin: "0 0 2.5rem",
          },
        })}
      >
        <h1
          css={(t) =>
            css({
              fontSize: t.fontSizes.headerLarge,
              lineHeight: "1.2",
              margin: "0 0 1rem",
              color: t.colors.textHeader,
            })
          }
          {...titleProps}
        >
          Create a topic
        </h1>
        <div
          css={(t) =>
            css({
              color: t.colors.textDimmed,
              fontSize: t.fontSizes.default,
              lineHeight: 1.4,
              // width: "26rem",
              maxWidth: "100%",
              margin: "0 auto",
            })
          }
        >
          Use topics to organize conversations and access
        </div>
        <div
          css={css({ position: "absolute", top: "2.5rem", right: "2.5rem" })}
        >
          <Button
            size="small"
            onClick={() => {
              close();
            }}
            css={css({ width: "2.8rem", padding: 0 })}
          >
            <CrossIcon
              style={{ width: "1.5rem", height: "auto", margin: "auto" }}
            />
          </Button>
        </div>
      </header>
      <main>
        <form
          id="create-channel-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Input
            contrast
            size="large"
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            disabled={hasPendingRequest}
            placeholder="e.g. Bacon life"
            containerProps={{ style: { margin: "0 0 2rem" } }}
          />
          <Input
            contrast
            size="large"
            multiline
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={hasPendingRequest}
            label={
              <>
                Description{" "}
                <span
                  css={(t) =>
                    css({
                      fontSize: t.fontSizes.small,
                      color: t.colors.textMuted,
                    })
                  }
                >
                  (optional)
                </span>
              </>
            }
            containerProps={{ style: { margin: "0 0 2rem" } }}
          />

          <Select
            label="Access"
            value={selectedType}
            size="medium"
            onChange={(value) => {
              setSelectedType(value);
            }}
            options={[
              {
                label: "Open",
                description: "Visible to anyone, and no permission needed to join",
                value: "open",
                icon: <GlobeIcon style={{ width: "2rem" }} />,
              },
              {
                label: "Closed",
                description: "Visible to anyone, but requires an invite to join",
                value: "closed",
                icon: <LockIcon style={{ width: "2rem" }} />,
              },
              {
                label: "Private",
                description: "Only visible to members",
                value: "private",
                icon: <EyeOffIcon style={{ width: "2rem" }} />,
              },
            ].map((o) => ({
              ...o,
              icon: (
                <div
                  css={css({
                    width: "2.6rem",
                    display: "flex",
                    justifyContent: "center",
                  })}
                >
                  {o.icon}
                </div>
              ),
            }))}
            disabled={hasPendingRequest}
          />
        </form>
      </main>
      <footer
        css={css({
          display: "flex",
          justifyContent: "flex-end",
          paddingTop: "1.5rem",
          "@media (min-width: 600px)": {
            paddingTop: "2.5rem",
          },
        })}
      >
        <Button
          type="submit"
          form="create-channel-form"
          size="medium"
          variant="primary"
          isLoading={hasPendingRequest}
          disabled={!hasRequiredInput || hasPendingRequest}
        >
          Create
        </Button>
      </footer>
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
      createChannel={async ({ name, description, permissionType }) => {
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

        const params = { name, description };

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

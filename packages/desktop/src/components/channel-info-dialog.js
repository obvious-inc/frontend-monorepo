import React from "react";
import { useTab, useTabList, useTabPanel } from "react-aria";
import { Item, useTabListState } from "react-stately";
import { css } from "@emotion/react";
import { useAppScope } from "@shades/common/app";
import {
  array as arrayUtils,
  user as userUtils,
  ethereum as ethereumUtils,
} from "@shades/common/utils";
import Button from "./button";
import Input from "./input";
import Avatar from "./avatar";
import Dialog from "./dialog";
import * as Tooltip from "./tooltip";
import { Cross as CrossIcon } from "./icons";

const { sort } = arrayUtils;
const { truncateAddress } = ethereumUtils;

const Tabs = ({ ...props }) => {
  const state = useTabListState(props);
  const ref = React.useRef();
  const { tabListProps } = useTabList(props, state, ref);

  return (
    <>
      <div
        {...tabListProps}
        ref={ref}
        css={(t) =>
          css({
            display: "grid",
            gridAutoFlow: "column",
            gridAutoColumns: "auto",
            gridGap: "2rem",
            justifyContent: "flex-start",
            borderBottom: "0.1rem solid transparent",
            borderColor: t.colors.borderLight,
            padding: "0 1.5rem",
            "@media (min-width: 600px)": {
              padding: "0 2rem",
            },
          })
        }
      >
        {[...state.collection].map((item) => (
          <Tab
            key={item.key}
            item={item}
            state={state}
            orientation={props.orientation}
          />
        ))}
      </div>
      <TabPanel key={state.selectedItem?.key} state={state} />
    </>
  );
};

const Tab = ({
  item,
  state,
  // orientation
}) => {
  const { key, rendered } = item;
  const ref = React.useRef();
  const {
    tabProps,
    isSelected,
    // isDisabled
  } = useTab({ key }, state, ref);

  return (
    <div
      {...tabProps}
      ref={ref}
      css={(t) =>
        css({
          padding: "0.5rem 0",
          borderBottom: "0.2rem solid",
          fontSize: t.fontSizes.default,
          fontWeight: "500",
          color: isSelected ? t.colors.textNormal : t.colors.textDimmed,
          borderColor: isSelected ? t.colors.primary : "transparent",
          cursor: "pointer",
          outline: "none",
          marginBottom: "-0.1rem",
          borderTopLeftRadius: "0.3rem",
          borderTopRightRadius: "0.3rem",
          ":hover": { color: t.colors.textNormal },
          ":focus-visible": {
            boxShadow: `0 0 0 0.2rem ${t.colors.primary}`,
            borderColor: t.colors.borderLight,
          },
        })
      }
    >
      {rendered}
    </div>
  );
};

const TabPanel = ({ state, ...props }) => {
  const ref = React.useRef();
  const { tabPanelProps } = useTabPanel(props, state, ref);

  return (
    <div {...tabPanelProps} ref={ref} css={css({ flex: 1, minHeight: 0 })}>
      {state.selectedItem?.props.children}
    </div>
  );
};

const ChannelInfoDialog = ({
  channelId,
  initialTab = "about",
  titleProps,
  dismiss,
  showAddMemberDialog,
}) => {
  const { state } = useAppScope();
  const channel = state.selectChannel(channelId);

  return (
    <>
      <header
        css={css({
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) auto",
          gridGap: "1rem",
          alignItems: "flex-end",
          justifyContent: "flex-start",
          margin: "0 0 2rem",
          padding: "1.5rem 1.5rem 0",
          "@media (min-width: 600px)": {
            padding: "2rem 2rem 0",
          },
        })}
      >
        <h1
          css={(theme) =>
            css({
              fontSize: theme.fontSizes.header,
              lineHeight: 1.2,
            })
          }
          {...titleProps}
        >
          {channel.name}
        </h1>
        <div
          css={css({
            display: "grid",
            gridAutoColumns: "auto",
            gridAutoFlow: "column",
            gridGap: "1rem",
          })}
        >
          {/* <div */}
          {/*   css={(theme) => */}
          {/*     css({ */}
          {/*       color: theme.colors.textMuted, */}
          {/*       fontSize: theme.fontSizes.small, */}
          {/*     }) */}
          {/*   } */}
          {/* > */}
          {/*   {onlineMemberCount === 0 ? ( */}
          {/*     memberCount */}
          {/*   ) : ( */}
          {/*     <> */}
          {/*       {onlineMemberCount} of {memberCount} online */}
          {/*     </> */}
          {/*   )} */}
          {/* </div> */}
          {typeof showAddMemberDialog === "function" && (
            <Button
              size="small"
              variant="default"
              onClick={showAddMemberDialog}
            >
              Add member
            </Button>
          )}
          <Button
            size="small"
            variant="default"
            onClick={dismiss}
            css={css({ width: "2.8rem", padding: 0 })}
          >
            <CrossIcon />
          </Button>
        </div>
      </header>
      <Tabs
        aria-label="Channel details"
        defaultSelectedKey={initialTab}
        css={css({ flex: 1 })}
      >
        <Item key="about" title="About">
          <AboutTab channelId={channelId} />
        </Item>
        <Item key="members" title="Members">
          <MembersDirectoryTab channelId={channelId} />
        </Item>
      </Tabs>
    </>
  );
};
const AboutTab = ({ channelId }) => {
  const { state, actions } = useAppScope();
  const me = state.selectMe();
  const channel = state.selectChannel(channelId);
  const isAdmin = me != null && me.id === channel.ownerUserId;

  const [editDialogMode, setEditDialogMode] = React.useState(null);

  return (
    <>
      <div
        css={css({
          height: "100%",
          overflow: "auto",
          padding: "1.5rem",
          "@media (min-width: 600px)": {
            padding: "2rem",
          },
        })}
      >
        {isAdmin ? (
          <ul
            css={css({
              li: { listStyle: "none" },
              "li + li": { marginTop: "1rem" },
            })}
          >
            <li>
              <ProperyButton
                name="Name"
                value={channel.name}
                onClick={() => {
                  setEditDialogMode("name");
                }}
              />
            </li>
            <li>
              <ProperyButton
                name="Description"
                value={channel.description ?? "-"}
                onClick={() => {
                  setEditDialogMode("description");
                }}
              />
            </li>
          </ul>
        ) : (
          <dl
            css={(t) =>
              css({
                dt: {
                  color: t.colors.textDimmed,
                  fontSize: t.fontSizes.default,
                },
                dd: {
                  color: t.colors.textNormal,
                  fontSize: t.fontSizes.large,
                },
                "dd + dt": { marginTop: "1.5rem" },
              })
            }
          >
            <dt>Name</dt>
            <dd>{channel.name}</dd>
            <dt>Description</dt>
            <dd>{channel.description ?? "-"}</dd>
          </dl>
        )}
      </div>

      <Dialog
        isOpen={editDialogMode != null}
        onRequestClose={() => {
          setEditDialogMode(null);
        }}
        width="42rem"
      >
        {({ titleProps }) => {
          const editingPropery = editDialogMode;

          const title = {
            name: "Edit channel name",
            description: "Edit channel description",
          }[editingPropery];
          const placeholder = {
            name: "Add a clever title",
            description: "Add a fun description",
          }[editingPropery];
          const hint = {
            description: "Make sure to include a couple of emojis 🌸 🌈",
          }[editingPropery];

          const dismiss = () => setEditDialogMode(null);

          return (
            <FormDialog
              titleProps={titleProps}
              dismiss={dismiss}
              title={title}
              controls={[
                {
                  key: editingPropery,
                  initialValue: channel[editingPropery],
                  type:
                    editingPropery === "description"
                      ? "multiline-text"
                      : "text",
                  placeholder,
                  hint,
                  required: editingPropery === "name",
                  validate: (value) => {
                    switch (editingPropery) {
                      case "name":
                        return value.trim().length !== 0;
                      default:
                        throw new Error();
                    }
                  },
                },
              ]}
              submitLabel="Save"
              submit={async (data) => {
                const payload = { ...data };
                // Clear description if empty
                if (payload.description === "") payload.description = null;
                await actions.updateChannel(channelId, payload);
                dismiss();
              }}
            />
          );
        }}
      </Dialog>
    </>
  );
};

const ProperyButton = ({ name, value, ...props }) => (
  <button
    css={(t) =>
      css({
        width: "100%",
        borderRadius: "0.5rem",
        background: t.colors.backgroundSecondary,
        cursor: "pointer",
        outline: "none",
        ":hover": { background: t.colors.dialogBackground },
        ":focus-visible": { boxShadow: `0 0 0 0.2rem ${t.colors.primary}` },
        padding: "1rem 1.5rem",
        "@media (min-width: 600px)": {
          padding: "1.5rem 2rem",
        },
      })
    }
    {...props}
  >
    <div
      css={(t) =>
        css({ color: t.colors.textDimmed, fontSize: t.fontSizes.default })
      }
    >
      {name}
    </div>
    <div
      css={(t) =>
        css({
          color: t.colors.textNormal,
          fontSize: t.fontSizes.large,
          whiteSpace: "pre-line",
        })
      }
    >
      {value}
    </div>
  </button>
);

const MembersDirectoryTab = ({ channelId }) => {
  const inputRef = React.useRef();

  const [query, setQuery] = React.useState("");

  const { state } = useAppScope();
  const members = state.selectChannelMembers(channelId);

  const filteredMembers = React.useMemo(() => {
    if (query.trim() === "")
      return sort(userUtils.compareByOwnerOnlineStatusAndDisplayName, members);

    const q = query.trim().toLowerCase();
    const getSearchTokens = (m) =>
      [m.displayName, m.ensName, m.walletAddress].filter(Boolean);

    const unorderedFilteredMembers = members.filter((member) =>
      getSearchTokens(member).some((t) => t.toLowerCase().includes(q))
    );

    const orderedFilteredMembers = sort((m1, m2) => {
      const [i1, i2] = [m1, m2].map((m) =>
        Math.min(
          ...getSearchTokens(m)
            .map((t) => t.indexOf(q))
            .filter((index) => index !== -1)
        )
      );

      if (i1 < i2) return -1;
      if (i1 > i2) return 1;
      return 0;
    }, unorderedFilteredMembers);

    return orderedFilteredMembers;
  }, [members, query]);

  React.useEffect(() => {
    inputRef.current.focus();
  }, []);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        css={css({
          padding: "1.5rem 1.5rem 0",
          "@media (min-width: 600px)": {
            padding: "2rem 2rem 0",
          },
        })}
      >
        <Input
          ref={inputRef}
          size="large"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          placeholder="Find members"
        />
      </div>
      <div css={css({ flex: 1, overflow: "auto", padding: "1.3rem 0" })}>
        <ul>
          {filteredMembers.map((member) => {
            const truncatedAddress =
              member.walletAddress == null
                ? null
                : truncateAddress(member.walletAddress);

            const hasSubtitle =
              member.ensName != null || member.displayName !== truncatedAddress;
            return (
              <li key={member.id} css={css({ display: "block" })}>
                <button
                  css={(theme) =>
                    css({
                      width: "100%",
                      display: "grid",
                      gridTemplateColumns: "auto minmax(0,1fr)",
                      gridGap: "1rem",
                      alignItems: "center",
                      lineHeight: "1.4",
                      padding: "0.5rem 1.5rem",
                      outline: "none",
                      ":not(:first-of-type)": {
                        marginTop: "0.1rem",
                      },
                      ":hover": {
                        background: theme.colors.backgroundModifierSelected,
                      },
                      ":focus-visible": {
                        boxShadow: `0 0 0 0.2rem ${theme.colors.primary} inset`,
                      },
                      cursor: "pointer",
                      "@media (min-width: 600px)": {
                        gridGap: "1.5rem",
                        padding: "0.7rem 2rem",
                      },
                    })
                  }
                  onClick={() => {
                    navigator.clipboard
                      .writeText(member.walletAddress)
                      .then(() => {
                        alert(
                          "Close your eyes and imagine a beautiful profile dialog/popover appearing"
                        );
                      });
                  }}
                >
                  <Avatar
                    url={member.profilePicture?.small}
                    walletAddress={member.walletAddress}
                    size="3.6rem"
                    pixelSize={36}
                  />
                  <div>
                    <div css={css({ display: "flex", alignItems: "center" })}>
                      {member.displayName}
                      {member.isOwner && (
                        <span
                          css={(theme) =>
                            css({
                              fontSize: theme.fontSizes.tiny,
                              color: theme.colors.textMuted,
                              background: theme.colors.backgroundModifierHover,
                              padding: "0.1rem 0.3rem",
                              borderRadius: "0.3rem",
                              marginLeft: "0.7rem",
                            })
                          }
                        >
                          Channel owner
                        </span>
                      )}

                      {member.onlineStatus === "online" && (
                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <div
                              css={css({
                                display: "inline-flex",
                                padding: "0.5rem 0.2rem",
                                marginLeft: "0.6rem",
                                position: "relative",
                              })}
                            >
                              <div
                                css={(theme) =>
                                  css({
                                    width: "0.7rem",
                                    height: "0.7rem",
                                    borderRadius: "50%",
                                    background: theme.colors.onlineIndicator,
                                  })
                                }
                              />
                            </div>
                          </Tooltip.Trigger>
                          <Tooltip.Content
                            side="top"
                            align="center"
                            sideOffset={6}
                          >
                            User online
                          </Tooltip.Content>
                        </Tooltip.Root>
                      )}
                    </div>
                    {hasSubtitle && (
                      <div
                        css={(theme) =>
                          css({
                            fontSize: theme.fontSizes.small,
                            color: theme.colors.textDimmed,
                          })
                        }
                      >
                        {member.ensName == null
                          ? truncatedAddress
                          : `${member.ensName} (${truncatedAddress})`}
                      </div>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

const FormDialog = ({
  title,
  titleProps,
  dismiss,
  controls,
  submit,
  submitLabel,
}) => {
  const firstInputRef = React.useRef();

  const [hasPendingSubmit, setPendingSubmit] = React.useState(false);

  const [state, setState] = React.useState(() =>
    controls.reduce((acc, c) => {
      return { ...acc, [c.key]: c.initialValue ?? "" };
    }, {})
  );

  const hasRequiredInput = controls.every((c) => {
    if (!c.required) return true;
    return c.validate(state[c.key]);
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    setPendingSubmit(true);
    try {
      await submit(state);
    } catch (e) {
      console.error(e);
      // TODO
    } finally {
      setPendingSubmit(false);
    }
  };

  React.useEffect(() => {
    firstInputRef.current.focus();
  }, []);

  return (
    <div
      css={css({
        padding: "1.5rem",
        "@media (min-width: 600px)": {
          padding: "2rem",
        },
      })}
    >
      <header
        css={css({
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) auto",
          alignItems: "flex-end",
          margin: "0 0 1.5rem",
          "@media (min-width: 600px)": {
            margin: "0 0 2rem",
          },
        })}
      >
        <h1
          css={(t) =>
            css({
              fontSize: t.fontSizes.header,
              lineHeight: 1.2,
            })
          }
          {...titleProps}
        >
          {title}
        </h1>
        <Button
          onClick={() => {
            dismiss();
          }}
          css={css({ width: "2.8rem", padding: 0 })}
        >
          <CrossIcon style={{ width: "1.5rem", height: "auto" }} />
        </Button>
      </header>
      <main>
        <form id="dialog-form" onSubmit={handleSubmit}>
          {controls.map((c, i) => (
            <Input
              key={c.key}
              ref={i === 0 ? firstInputRef : undefined}
              size="large"
              multiline={c.type === "multiline-text"}
              value={state[c.key]}
              disabled={hasPendingSubmit}
              onChange={(e) => {
                setState((s) => ({ ...s, [c.key]: e.target.value }));
              }}
              placeholder={c.placeholder}
              hint={c.hint}
            />
          ))}
        </form>
      </main>
      <footer
        css={css({
          display: "flex",
          justifyContent: "flex-end",
          paddingTop: "2.5rem",
          "@media (min-width: 600px)": {
            paddingTop: "3rem",
          },
        })}
      >
        <div
          css={css({
            display: "grid",
            gridAutoFlow: "column",
            gridAutoColumns: "minmax(0,1fr)",
            gridGap: "1rem",
          })}
        >
          <Button size="medium" variant="transparent" onClick={dismiss}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="dialog-form"
            size="medium"
            variant="primary"
            isLoading={hasPendingSubmit}
            disabled={!hasRequiredInput || hasPendingSubmit}
            style={{ minWidth: "8rem" }}
          >
            {submitLabel}
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default ChannelInfoDialog;

import React from "react";
import { useTab, useTabList, useTabPanel } from "react-aria";
import { useNavigate } from "react-router-dom";
import { Item, useTabListState } from "react-stately";
import { css } from "@emotion/react";
import { useAppScope } from "@shades/common/app";
import {
  array as arrayUtils,
  ethereum as ethereumUtils,
  user as userUtils,
} from "@shades/common/utils";
import Button from "./button";
import Input from "./input";
import Avatar from "./avatar";
import Dialog from "./dialog";
import Select from "./select";
import * as Tooltip from "./tooltip";
import {
  Cross as CrossIcon,
  Star as StarIcon,
  StrokedStar as StrokedStarIcon,
  Bell as BellIcon,
  BellOff as BellOffIcon,
  AddUser as AddUserIcon,
  Globe as GlobeIcon,
  Lock as LockIcon,
  EyeOff as EyeOffIcon,
  AtSign as AtSignIcon,
} from "./icons";

const { sort } = arrayUtils;
const {
  search: searchUsers,
  createDefaultComparator: createUserDefaultComparator,
} = userUtils;
const { truncateAddress } = ethereumUtils;

const ChannelPermissionIcon = ({ channelId, ...props }) => {
  const { state } = useAppScope();

  const channel = state.selectChannel(channelId);
  const permissionType = state.selectChannelAccessLevel(channelId);

  const deriveComponent = () => {
    if (channel.kind === "dm") return AtSignIcon;
    return { open: GlobeIcon, closed: LockIcon, private: EyeOffIcon }[
      permissionType
    ];
  };

  const Component = deriveComponent();

  return <Component {...props} />;
};

const Tabs = (props) => {
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
  const dismissButtonRef = React.useRef();
  const { state, actions } = useAppScope();
  const me = state.selectMe();
  const channel = state.selectChannel(channelId);
  const channelName = state.selectChannelName(channelId);
  const isMember = me != null && channel.memberUserIds.includes(me.id);
  const isChannelStarred = state.selectIsChannelStarred(channelId);
  const channelPermissionType = state.selectChannelAccessLevel(channelId);
  const notificationSetting = state.selectChannelNotificationSetting(channelId);

  const memberCount = channel.memberUserIds.length;

  React.useEffect(() => {
    dismissButtonRef.current.focus();
  }, []);

  const showPermissionTypeBadge =
    channel.kind === "dm" ||
    (channelPermissionType != null && channelPermissionType !== "custom");

  return (
    <>
      <header
        css={css({
          padding: "1.5rem",
          "@media (min-width: 600px)": {
            padding: "2rem",
          },
        })}
      >
        <div
          css={css({
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) auto",
            gridGap: "1.5rem",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            margin: "0 0 1rem",
          })}
        >
          <div css={css({ display: "flex", alignItems: "center" })}>
            {channel.image != null && (
              <a
                href={channel.imageLarge}
                rel="noreferrer"
                target="_blank"
                css={(t) =>
                  css({
                    borderRadius: "50%",
                    outline: "none",
                    ":focus-visible": {
                      boxShadow: `0 0 0 0.2rem ${t.colors.primary}`,
                    },
                  })
                }
                style={{ marginRight: "1.1rem" }}
              >
                <Avatar
                  transparent
                  url={channel.image}
                  size="2.4rem"
                  pixelSize={24}
                />
              </a>
            )}
            <h1
              css={(theme) =>
                css({
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  alignItems: "flex-end",
                  flexWrap: "wrap",
                  fontSize: theme.fontSizes.header,
                  color: theme.colors.textHeader,
                  lineHeight: 1.2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  "@media (min-width: 600px)": {
                    flexWrap: "nowrap",
                  },
                })
              }
              {...titleProps}
            >
              <span
                css={css({
                  marginRight: "1rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                })}
              >
                {channelName}
              </span>
              {showPermissionTypeBadge && (
                <Tooltip.Root>
                  <Tooltip.Trigger
                    css={(t) =>
                      css({
                        color: t.colors.textDimmed,
                        fontSize: t.fontSizes.tiny,
                        fontWeight: "400",
                        marginTop: "0.5rem",
                        background: t.colors.backgroundModifierHover,
                        borderRadius: "0.2rem",
                        padding: "0.2rem 0.4rem",
                        position: "relative",
                        bottom: "0.2rem",
                        ":focus-visible": {
                          boxShadow: `0 0 0 0.2rem ${t.colors.primary}`,
                        },
                      })
                    }
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        position: "relative",
                        top: "0.2rem",
                        marginRight: "0.4rem",
                      }}
                    >
                      <ChannelPermissionIcon
                        channelId={channelId}
                        style={{ width: "1.2rem" }}
                      />
                    </span>

                    {channel.kind === "dm"
                      ? "DM channel"
                      : channelPermissionType != null && (
                          <>
                            {channelPermissionType.slice(0, 1).toUpperCase()}
                            {channelPermissionType.slice(1)} channel
                          </>
                        )}
                  </Tooltip.Trigger>
                  <Tooltip.Content side="top" align="center" sideOffset={6}>
                    {channel.kind === "dm" ? (
                      <>
                        DMs are reserved for private 1-to-1
                        <br />
                        messaging, and cannot be deleted.
                      </>
                    ) : channelPermissionType === "open" ? (
                      <>
                        Open channels can be seen
                        <br />
                        and joined by anyone.
                      </>
                    ) : channelPermissionType === "closed" ? (
                      <>
                        Closed channels have open read access,
                        <br />
                        but requires an invite to join.
                      </>
                    ) : channelPermissionType === "private" ? (
                      <>
                        Private channels are only
                        <br />
                        visible to members.
                      </>
                    ) : null}
                  </Tooltip.Content>
                </Tooltip.Root>
              )}
            </h1>
          </div>
          <div
            css={css({
              display: "grid",
              gridAutoColumns: "auto",
              gridAutoFlow: "column",
              gridGap: "1rem",
            })}
          >
            <Button
              ref={dismissButtonRef}
              size="small"
              variant="default"
              onClick={dismiss}
              css={css({ width: "2.8rem", padding: 0 })}
            >
              <CrossIcon style={{ margin: "auto" }} />
            </Button>
          </div>
        </div>

        <div
          css={css({
            display: "flex",
            justifyContent: "flex-start",
            paddingTop: "0.5rem",
          })}
        >
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
            <Button
              size="small"
              variant="default"
              icon={
                isChannelStarred ? (
                  <StarIcon style={{ color: "rgb(202, 152, 73)" }} />
                ) : (
                  <StrokedStarIcon />
                )
              }
              onClick={() => {
                if (isChannelStarred) {
                  actions.unstarChannel(channelId);
                  return;
                }

                actions.starChannel(channelId);
              }}
              css={css({ svg: { width: "1.6rem", height: "auto" } })}
            >
              {isChannelStarred ? "Unstar" : "Star"}
            </Button>
            {isMember ? (
              <Select
                aria-label="Channel notification settings"
                size="small"
                variant="default"
                align="left"
                icon={
                  notificationSetting === "off" ? (
                    <BellOffIcon css={css({ width: "1.6rem" })} />
                  ) : (
                    <BellIcon css={css({ width: "1.6rem" })} />
                  )
                }
                value={notificationSetting}
                onChange={(setting) => {
                  actions.setChannelNotificationSetting(channelId, setting);
                }}
                disabled={!isMember}
                width="max-content"
                renderTriggerContent={(selectedValue) => {
                  switch (selectedValue) {
                    case "all":
                      return "Get notifications for all messages";
                    case "mentions":
                      return "Only get notifications for @ mentions";
                    case "off":
                      return "Notifications off";
                    default:
                      throw new Error();
                  }
                }}
                options={[
                  {
                    value: "all",
                    label: "All messages",
                    description: "Get notifications for all messages",
                  },
                  {
                    value: "mentions",
                    label: "@ mentions",
                    description: "Only get notifications for @ mentions",
                  },
                  {
                    value: "off",
                    label: "Off",
                    description:
                      "Don’t get any notifications from this channel",
                  },
                ]}
              />
            ) : (
              <Button
                size="small"
                variant="default"
                onClick={() => {
                  actions.joinChannel(channelId);
                  dismiss();
                }}
                disabled={channelPermissionType !== "open"}
              >
                Join channel
              </Button>
            )}
          </div>
        </div>
      </header>
      <Tabs
        aria-label="Channel details"
        defaultSelectedKey={initialTab}
        css={css({ flex: 1 })}
      >
        <Item key="about" title="About">
          <AboutTab channelId={channelId} dismiss={dismiss} />
        </Item>
        <Item
          key="members"
          title={
            <>
              Members{" "}
              <span
                css={(t) =>
                  css({
                    fontSize: t.fontSizes.small,
                    fontWeight: "400",
                  })
                }
              >
                ({memberCount})
              </span>
            </>
          }
        >
          <MembersDirectoryTab
            channelId={channelId}
            addMember={showAddMemberDialog}
          />
        </Item>
      </Tabs>
    </>
  );
};
const AboutTab = ({ channelId, dismiss }) => {
  const navigate = useNavigate();
  const { state, actions } = useAppScope();
  const me = state.selectMe();
  const channel = state.selectChannel(channelId);
  const channelName = state.selectChannelName(channelId);
  const channelPermissionType = state.selectChannelAccessLevel(channelId);
  const isMember = me != null && channel.memberUserIds.includes(me.id);
  const isOwner = me != null && me.id === channel.ownerUserId;
  const isAdmin = isOwner;

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
                value={channelName}
                onClick={() => {
                  setEditDialogMode("name");
                }}
              />
            </li>
            <li>
              <ProperyButton
                name="Topic"
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
            <dd>{channelName}</dd>
            <dt>Topic</dt>
            <dd>{channel.description ?? "-"}</dd>
          </dl>
        )}

        {isMember && channel.kind === "topic" && (
          <>
            <div
              css={(t) =>
                css({
                  background: t.colors.borderLight,
                  height: "1px",
                  margin: "2rem 0",
                })
              }
            />

            <h3
              css={(t) =>
                css({
                  fontSize: t.fontSizes.default,
                  fontWeight: "400",
                  margin: "0 0 0.2rem",
                })
              }
            >
              Danger zone
            </h3>
            <div
              css={(t) =>
                css({
                  fontSize: t.fontSizes.small,
                  color: t.colors.textDimmed,
                  margin: "0 0 2rem",
                })
              }
            >
              {channelPermissionType === "open" ? (
                <>
                  Open channel are safe to leave, you can join again at any
                  time.
                </>
              ) : (
                <>
                  Note that after leaving a {channelPermissionType} channel, an
                  invite is required to join it again.
                </>
              )}
            </div>

            <div css={css({ display: "flex", justifyContent: "flex-start" })}>
              <div
                css={css({
                  display: "grid",
                  gridAutoFlow: "column",
                  gridAutoColumns: "minmax(0,1fr)",
                  gridGap: "1.5rem",
                })}
              >
                <Button
                  variant="default"
                  size="default"
                  disabled={isOwner || !isMember}
                  onClick={() => {
                    if (
                      !confirm("Are you sure you want to leave this channel?")
                    )
                      return;
                    actions.leaveChannel(channelId);
                    dismiss();
                  }}
                >
                  Leave channel
                </Button>
                <Button
                  variant="default"
                  danger
                  size="default"
                  disabled={!isAdmin}
                  onClick={() => {
                    if (
                      !confirm("Are you sure you want to delete this channel?")
                    )
                      return;
                    actions.deleteChannel(channelId);
                    navigate("/");
                  }}
                >
                  Delete channel
                </Button>
              </div>
            </div>
          </>
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
            description: "Edit channel topic",
          }[editingPropery];
          const placeholder = {
            name: "Add a clever title",
            description: "Add a fun topic",
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

const MembersDirectoryTab = ({ channelId, addMember }) => {
  const inputRef = React.useRef();

  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query);

  const { state } = useAppScope();
  const { selectIsUserBlocked } = state;
  const starredUserIds = state.selectStarredUserIds();
  const members = state.selectChannelMembers(channelId);
  const me = state.selectMe();

  const unfilteredMembers = React.useMemo(() => {
    return members.map((m) => {
      if (m.id === me.id)
        return { ...m, displayName: `${m.displayName} (you)` };

      if (selectIsUserBlocked(m.id)) return { ...m, isBlocked: true };
      if (starredUserIds.includes(m.id)) return { ...m, isStarred: true };

      return m;
    });
  }, [me, members, selectIsUserBlocked, starredUserIds]);

  const filteredMembers = React.useMemo(() => {
    if (deferredQuery.trim().length <= 1)
      return sort(createUserDefaultComparator(), unfilteredMembers);

    return searchUsers(unfilteredMembers, deferredQuery);
  }, [deferredQuery, unfilteredMembers]);

  React.useEffect(() => {
    inputRef.current.focus();
  }, []);

  const showAddMemberItem = addMember != null && query.trim() === "";

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
        <ul
          css={(t) =>
            css({
              "li > button": {
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
                  background: t.colors.backgroundModifierSelected,
                },
                ":focus-visible": {
                  boxShadow: `0 0 0 0.2rem ${t.colors.primary} inset`,
                },
                cursor: "pointer",
                "@media (min-width: 600px)": {
                  gridGap: "1.5rem",
                  padding: "0.7rem 2rem",
                },
              },
            })
          }
        >
          {showAddMemberItem && (
            <li key="add-member">
              <button
                onClick={() => {
                  addMember();
                }}
                css={(t) =>
                  css({
                    ":hover [data-icon]": {
                      borderColor: t.colors.textMuted,
                    },
                  })
                }
              >
                <div
                  data-icon
                  css={(t) =>
                    css({
                      width: "3.6rem",
                      height: "3.6rem",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: t.colors.textNormal,
                      border: "0.1rem solid",
                      borderColor: t.colors.borderLight,
                    })
                  }
                >
                  <AddUserIcon
                    style={{
                      width: "2rem",
                      height: "auto",
                      position: "relative",
                      left: "0.1rem",
                    }}
                  />
                </div>
                <div>Add member</div>
              </button>
            </li>
          )}

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
                    transparent
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
              color: t.colors.textHeader,
              lineHeight: 1.2,
            })
          }
          {...titleProps}
        >
          {title}
        </h1>
        <Button
          size="small"
          onClick={() => {
            dismiss();
          }}
          css={css({ width: "2.8rem", padding: 0 })}
        >
          <CrossIcon
            style={{ width: "1.5rem", height: "auto", margin: "auto" }}
          />
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

import { getAddress as checksumEncodeAddress } from "viem";
import React from "react";
import { useNavigate } from "react-router-dom";
import { css } from "@emotion/react";
import {
  useActions,
  useSelectors,
  useMe,
  useChannel,
  useChannelName,
  useChannelMembers,
  useIsChannelStarred,
  useChannelAccessLevel,
  useChannelNotificationSetting,
  useStarredUserIds,
} from "@shades/common/app";
import {
  array as arrayUtils,
  ethereum as ethereumUtils,
  user as userUtils,
} from "@shades/common/utils";
import Button from "@shades/ui-web/button";
import Dialog from "@shades/ui-web/dialog";
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
} from "@shades/ui-web/icons";
import { useDialog } from "../hooks/dialogs";
import Input from "./input";
import UserAvatar from "./user-avatar";
import ChannelAvatar from "./channel-avatar";
import Select from "./select";
import * as Tooltip from "./tooltip";
import * as Tabs from "./tabs";
import RichText from "./rich-text";
import FormDialog from "./form-dialog";

const { sort } = arrayUtils;
const {
  search: searchUsers,
  createDefaultComparator: createUserDefaultComparator,
} = userUtils;
const { truncateAddress } = ethereumUtils;

const ChannelPermissionIcon = ({ channelId, ...props }) => {
  const channel = useChannel(channelId);
  const permissionType = useChannelAccessLevel(channelId);

  const deriveComponent = () => {
    if (channel != null && channel.kind === "dm") return AtSignIcon;
    return { open: GlobeIcon, closed: LockIcon, private: EyeOffIcon }[
      permissionType
    ];
  };

  const Component = deriveComponent();

  return <Component {...props} />;
};

const ChannelInfoDialog = ({
  channelId,
  initialTab = "about",
  titleProps,
  dismiss,
  showAddMemberDialog,
}) => {
  const dismissButtonRef = React.useRef();
  const actions = useActions();
  const me = useMe();
  const channel = useChannel(channelId);
  const channelName = useChannelName(channelId);
  const isChannelStarred = useIsChannelStarred(channelId);
  const channelPermissionType = useChannelAccessLevel(channelId);
  const notificationSetting = useChannelNotificationSetting(channelId);

  React.useEffect(() => {
    if (channel == null) return;
    dismissButtonRef.current.focus();
  }, [channel]);

  if (channel == null) return null;

  const isMember = me != null && channel.memberUserIds.includes(me.id);
  const memberCount = channel.memberUserIds.length;

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
            {channel.imageLarge != null && (
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
                <ChannelAvatar id={channelId} size="2.4rem" />
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
                  fontSize: theme.fontSizes.headerLarge,
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
                      ? "DM"
                      : channelPermissionType != null && (
                          <>
                            {channelPermissionType.slice(0, 1).toUpperCase()}
                            {channelPermissionType.slice(1)} topic
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
                        Open topics can be seen
                        <br />
                        and joined by anyone.
                      </>
                    ) : channelPermissionType === "closed" ? (
                      <>
                        Closed topics have open read access,
                        <br />
                        but requires an invite to join.
                      </>
                    ) : channelPermissionType === "private" ? (
                      <>
                        Private topics are only
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
              {isChannelStarred ? "Unfollow" : "Follow"}
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
                    description: "Don’t get any notifications from this topic",
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
      <Tabs.Root
        aria-label="Topic details"
        defaultSelectedKey={initialTab}
        css={css({
          padding: "0 1.5rem",
          "@media (min-width: 600px)": {
            padding: "0 2rem",
          },
        })}
      >
        <Tabs.Item key="about" title="About">
          <AboutTab channelId={channelId} dismiss={dismiss} />
        </Tabs.Item>
        <Tabs.Item
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
            dismiss={dismiss}
          />
        </Tabs.Item>
      </Tabs.Root>
    </>
  );
};
const AboutTab = ({ channelId, dismiss }) => {
  const navigate = useNavigate();
  const actions = useActions();
  const me = useMe();
  const channel = useChannel(channelId, { name: true });
  const channelPermissionType = useChannelAccessLevel(channelId);
  const isMember =
    me != null && channel != null && channel.memberUserIds.includes(me.id);
  const isOwner =
    me != null && channel != null && me.id === channel.ownerUserId;
  const isAdmin = isOwner;

  const {
    isOpen: isEditDialogOpen,
    data: editDialogMode,
    open: setEditDialogMode,
    dismiss: dismissEditDialog,
  } = useDialog("edit-channel-property");

  if (channel == null) return null;

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
              <PropertyButton
                name="Name"
                value={channel.name}
                onClick={() => {
                  setEditDialogMode("name");
                }}
              />
            </li>
            <li>
              <PropertyButton
                name="Description"
                value={
                  channel.description == null ? (
                    "-"
                  ) : (
                    <RichText
                      blocks={channel.descriptionBlocks}
                      onClickInteractiveElement={(e) => {
                        // Prevent link clicks from opening dialog
                        e.stopPropagation();
                      }}
                    />
                  )
                }
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
            <dd>
              {channel.description == null ? (
                "-"
              ) : (
                <RichText blocks={channel.descriptionBlocks} />
              )}
            </dd>
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
                  Open topics are safe to leave, you can join again at any time.
                </>
              ) : (
                <>
                  Note that after leaving a {channelPermissionType} topic, an
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
                    if (!confirm("Are you sure you want to leave this topic?"))
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
                  onClick={async () => {
                    if (!confirm("Are you sure you want to delete this topic?"))
                      return;

                    actions.deleteChannel(channelId);
                    dismiss();
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
        isOpen={isEditDialogOpen}
        onRequestClose={dismissEditDialog}
        width="42rem"
      >
        {({ titleProps }) => {
          const editingPropery = editDialogMode;

          const title = {
            name: "Edit topic name",
            description: "Edit topic description",
          }[editingPropery];
          const placeholder = {
            name: "Add a clever title",
            description: "Add a fun description",
          }[editingPropery];
          const hint = {
            description: "Make sure to include a couple of emojis 🌸 🌈",
          }[editingPropery];

          return (
            <FormDialog
              titleProps={titleProps}
              dismiss={dismissEditDialog}
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
                  required: channel.kind !== "dm" && editingPropery === "name",
                  validate: (value) => {
                    switch (editingPropery) {
                      case "name":
                        return (
                          channel.kind === "dm" || value.trim().length !== 0
                        );
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
                dismissEditDialog();
              }}
            />
          );
        }}
      </Dialog>
    </>
  );
};

const PropertyButton = ({ name, value, ...props }) => (
  <button
    css={(t) =>
      css({
        width: "100%",
        borderRadius: "0.5rem",
        background: t.colors.backgroundModifierHover,
        outline: "none",
        padding: "1rem 1.5rem",
        ":focus-visible": { boxShadow: t.shadows.focus },
        "@media (min-width: 600px)": { padding: "1.5rem 2rem" },
        "@media (hover: hover)": {
          cursor: "pointer",
          ":hover": { background: t.colors.backgroundModifierHoverStrong },
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

const MembersDirectoryTab = ({ dismiss, channelId, addMember }) => {
  const navigate = useNavigate();
  const inputRef = React.useRef();

  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query);

  const selectors = useSelectors();
  const { selectIsUserBlocked } = selectors;
  const me = useMe();
  const starredUserIds = useStarredUserIds();
  const members = useChannelMembers(channelId);

  const unfilteredMembers = React.useMemo(() => {
    return members.map((m) => {
      if (me != null && me.id === m.id)
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
                  background: t.colors.backgroundModifierHover,
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
                : truncateAddress(checksumEncodeAddress(member.walletAddress));

            const hasSubtitle =
              member.ensName != null || member.displayName != null;
            return (
              <li key={member.id} css={css({ display: "block" })}>
                <button
                  onClick={() => {
                    const dmChannel = selectors.selectDmChannelFromUserId(
                      member.id
                    );

                    if (dmChannel != null) {
                      navigate(`/channels/${dmChannel.id}`);
                      dismiss();
                      return;
                    }

                    navigate(
                      `/new?account=${member.walletAddress.toLowerCase()}`
                    );
                  }}
                >
                  <UserAvatar
                    transparent
                    walletAddress={member.walletAddress}
                    size="3.6rem"
                  />
                  <div>
                    <div css={css({ display: "flex", alignItems: "center" })}>
                      {member.displayName ?? member.ensName ?? truncatedAddress}
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
                        {member.displayName != null &&
                        member.ensName != null ? (
                          <>
                            {member.ensName} ({truncatedAddress})
                          </>
                        ) : (
                          truncatedAddress
                        )}
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

export default ChannelInfoDialog;

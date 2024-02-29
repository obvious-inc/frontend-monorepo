import React from "react";
import { css, useTheme } from "@emotion/react";
import {
  array as arrayUtils,
  emoji as emojiUtils,
  ethereum as ethereumUtils,
  user as userUtils,
  channel as channelUtils,
} from "@shades/common/utils";
import { useLatestCallback } from "@shades/common/react";
import { useChannel, useAllChannels, useEmojis } from "@shades/common/app";
import Emoji from "./emoji.js";
import AccountAvatar from "./account-avatar.js";
import ChannelAvatar from "./channel-avatar.js";
import RichTextEditor from "./rich-text-editor.js";

const { sort } = arrayUtils;
const {
  search: searchUsers,
  createDefaultComparator: createUserDefaultComparator,
} = userUtils;
const {
  search: searchChannels,
  createDefaultComparator: createChannelDefaultComparator,
} = channelUtils;

const RichTextEditorWithAutoComplete = React.forwardRef(
  (
    {
      initialValue,
      onChange,
      placeholder,
      onKeyDown,
      disabled,
      commands,
      executeCommand: executeCommand_,
      inline = false,
      members = [],
      ...props
    },
    editorRef,
  ) => {
    const channels = useAllChannels({ name: true });

    const preventInputBlurRef = React.useRef();
    const mentionQueryRangeRef = React.useRef();
    const channelQueryRangeRef = React.useRef();
    const emojiQueryRangeRef = React.useRef();

    const [mentionQuery, setMentionQuery] = React.useState(null);
    const [channelQuery, setChannelQuery] = React.useState(null);
    const [emojiQuery, setEmojiQuery] = React.useState(null);
    const [commandQuery, setCommandQuery] = React.useState(null);
    const [commandArgumentsQuery, setCommandArgumentsQuery] =
      React.useState(null);
    const [selectedAutoCompleteIndex, setSelectedAutoCompleteIndex] =
      React.useState(-1);

    const autoCompleteMode = (() => {
      if (commandQuery != null) return "commands";
      if (mentionQuery != null) return "mentions";
      if (channelQuery != null) return "channels";
      if (emojiQuery != null) return "emojis";
      return null;
    })();

    const { allEntries: emojis, recentlyUsedEntries: recentEmojis } = useEmojis(
      { enabled: autoCompleteMode === "emojis" },
    );

    const isAutoCompleteMenuOpen = autoCompleteMode != null;

    const filteredMentionOptions = React.useMemo(() => {
      if (autoCompleteMode !== "mentions") return [];

      const filteredMembers =
        mentionQuery.trim() === ""
          ? sort(createUserDefaultComparator(), members)
          : searchUsers(members, mentionQuery);

      return filteredMembers.slice(0, 10).map((m) => {
        const label = m.displayName;
        const truncatedAddress = ethereumUtils.truncateAddress(m.walletAddress);
        const hasCustomDisplayName = label !== truncatedAddress;
        return {
          value: m.id,
          label,
          description: hasCustomDisplayName ? truncatedAddress : undefined,
          image: (
            <AccountAvatar
              transparent
              address={m.walletAddress}
              size="3.2rem"
            />
          ),
        };
      });
    }, [autoCompleteMode, mentionQuery, members]);

    const filteredChannelOptions = React.useMemo(() => {
      if (autoCompleteMode !== "channels") return [];

      const filteredChannels =
        channelQuery.trim() === ""
          ? sort(createChannelDefaultComparator(), channels)
          : searchChannels(channels, channelQuery);

      return filteredChannels.slice(0, 10).map((c) => {
        return {
          value: c.id,
          render: () => <ChannelAutoCompleteItem id={c.id} />,
        };
      });
    }, [autoCompleteMode, channelQuery, channels]);

    const filteredEmojiOptions = React.useMemo(() => {
      if (autoCompleteMode !== "emojis") return [];

      const query = emojiQuery ?? null;

      const lowerCaseQuery = emojiQuery?.trim().toLowerCase();

      const getDefaultSet = () =>
        recentEmojis.length === 0 ? emojis : recentEmojis;

      const orderedFilteredEmojis =
        emojiQuery.trim() === ""
          ? getDefaultSet()
          : emojiUtils.search(emojis, query);

      return orderedFilteredEmojis.slice(0, 10).map((e) => {
        const [firstAlias, ...otherAliases] = [...e.aliases, ...e.tags];
        const visibleAliases = [
          firstAlias,
          ...otherAliases.filter(
            (a) => lowerCaseQuery !== "" && a.includes(lowerCaseQuery),
          ),
        ];
        return {
          value: e.id ?? e.emoji,
          label: (
            <span>
              <Emoji
                emoji={e.id ?? e.emoji}
                css={css({ marginRight: "0.8rem" })}
              />
              {visibleAliases.map((a, i) => {
                const isMatch = a.includes(lowerCaseQuery);
                const matchStartIndex = isMatch && a.indexOf(lowerCaseQuery);
                const matchEndIndex =
                  isMatch && a.indexOf(lowerCaseQuery) + lowerCaseQuery.length;
                return (
                  <React.Fragment key={a}>
                    {i !== 0 && " "}:
                    {isMatch ? (
                      <>
                        {a.slice(0, matchStartIndex)}
                        <span data-matching-text="true">
                          {a.slice(matchStartIndex, matchEndIndex)}
                        </span>
                        {a.slice(matchEndIndex)}
                      </>
                    ) : (
                      a
                    )}
                    :
                  </React.Fragment>
                );
              })}
            </span>
          ),
        };
      });
    }, [emojis, recentEmojis, autoCompleteMode, emojiQuery]);

    const filteredCommandOptions = React.useMemo(() => {
      if (autoCompleteMode !== "commands") return [];

      const lowerCaseQuery = commandQuery?.toLowerCase() ?? null;

      const unorderedCommands = Object.keys(commands).filter(
        (command) => lowerCaseQuery != null && command.includes(lowerCaseQuery),
      );

      const orderedCommands = sort((o1, o2) => {
        const [i1, i2] = [o1, o2].map((command) =>
          command.toLowerCase().indexOf(lowerCaseQuery),
        );

        if (i1 < i2) return -1;
        if (i1 > i2) return 1;
        if (o1.length < o2.length) return -1;
        if (o1.length > o2.length) return 1;
        return 0;
      }, unorderedCommands);

      return orderedCommands.slice(0, 10).map((c) => {
        const command = commands[c];
        return {
          value: c,
          label: (
            <span>
              /{c}
              {command.arguments != null && (
                <>
                  {" "}
                  <span css={(t) => css({ color: t.colors.textMuted })}>
                    {command.arguments.map((a) => `<${a}>`).join(" ")}
                  </span>
                </>
              )}
            </span>
          ),
          description: command.description,
        };
      });
    }, [commands, autoCompleteMode, commandQuery]);

    const autoCompleteOptions = {
      commands: filteredCommandOptions,
      mentions: filteredMentionOptions,
      channels: filteredChannelOptions,
      emojis: filteredEmojiOptions,
    }[autoCompleteMode];

    const executeCommand = useLatestCallback(executeCommand_);

    const selectAutoCompleteOption = React.useCallback(
      (option) => {
        switch (autoCompleteMode) {
          case "mentions":
            editorRef.current.insertMention(option.value, {
              at: mentionQueryRangeRef.current,
            });
            setMentionQuery(null);
            break;

          case "channels":
            editorRef.current.insertChannelLink(option.value, {
              at: channelQueryRangeRef.current,
            });
            setChannelQuery(null);
            break;

          case "emojis":
            editorRef.current.insertEmoji(option.value, {
              at: emojiQueryRangeRef.current,
            });
            setEmojiQuery(null);
            break;

          case "commands": {
            if (commandQuery === option.value) {
              // if (commandArgumentsQuery == null) {
              //   editorRef.current.replaceAll(`/${option.value} `);
              //   break;
              // }

              executeCommand(
                commandQuery,
                commandArgumentsQuery?.split(" ") ?? [],
              );
              setCommandQuery(null);
              break;
            }

            editorRef.current.replaceFirstWord(`/${option.value} `);
            break;
          }

          default:
            throw new Error();
        }
      },
      [
        autoCompleteMode,
        editorRef,
        mentionQueryRangeRef,
        channelQueryRangeRef,
        commandQuery,
        commandArgumentsQuery,
        executeCommand,
      ],
    );

    const autoCompleteInputKeyDownHandler = React.useCallback(
      (event) => {
        if (!isAutoCompleteMenuOpen || autoCompleteOptions.length === 0) return;

        switch (event.key) {
          case "ArrowDown": {
            event.preventDefault();
            setSelectedAutoCompleteIndex((i) =>
              i >= autoCompleteOptions.length - 1 ? 0 : i + 1,
            );
            break;
          }
          case "ArrowUp": {
            event.preventDefault();
            setSelectedAutoCompleteIndex((i) =>
              i <= 0 ? autoCompleteOptions.length - 1 : i - 1,
            );
            break;
          }
          case "Tab":
          case "Enter": {
            const option = autoCompleteOptions[selectedAutoCompleteIndex];
            event.preventDefault();
            selectAutoCompleteOption(option);
            break;
          }
          case "Escape":
            event.preventDefault();
            setMentionQuery(null);
            setEmojiQuery(null);
            setCommandQuery(null);
            break;
        }
      },
      [
        isAutoCompleteMenuOpen,
        autoCompleteOptions,
        selectedAutoCompleteIndex,
        selectAutoCompleteOption,
      ],
    );

    const autoCompleteInputAccesibilityProps = {
      "aria-expanded": isAutoCompleteMenuOpen ? "true" : "false",
      "aria-haspopup": "listbox",
      "aria-autocomplete": "list",
      "aria-owns": "autocomplete-listbox",
      "aria-controls": "autocomplete-listbox",
      "aria-activedescendant": `autocomplete-listbox-option-${selectedAutoCompleteIndex}`,
    };

    return (
      <>
        <RichTextEditor
          ref={editorRef}
          {...autoCompleteInputAccesibilityProps}
          inline={inline}
          value={initialValue}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          triggers={[
            {
              type: "word",
              handler: (word, range) => {
                if (word.startsWith("@")) {
                  setMentionQuery(word.slice(1));
                  setSelectedAutoCompleteIndex(0);
                  mentionQueryRangeRef.current = range;
                  return;
                }

                setMentionQuery(null);
              },
            },
            {
              type: "word",
              handler: (word, range) => {
                if (word.startsWith("#")) {
                  setChannelQuery(word.slice(1));
                  setSelectedAutoCompleteIndex(0);
                  channelQueryRangeRef.current = range;
                  return;
                }

                setChannelQuery(null);
              },
            },
            {
              type: "word",
              handler: (word, range) => {
                if (word.startsWith(":")) {
                  setEmojiQuery(word.slice(1));
                  setSelectedAutoCompleteIndex(0);
                  emojiQueryRangeRef.current = range;
                  return;
                }

                setEmojiQuery(null);
              },
            },
            commands != null && {
              type: "command",
              handler: (command, args) => {
                if (command == null) {
                  setCommandQuery(null);
                  return;
                }

                setCommandQuery(command);
                setCommandArgumentsQuery(
                  args.length === 0 ? null : args.join(" "),
                );
                setSelectedAutoCompleteIndex(0);
              },
            },
          ].filter(Boolean)}
          onKeyDown={(e) => {
            autoCompleteInputKeyDownHandler(e);

            if (onKeyDown) onKeyDown(e);
          }}
          onBlur={() => {
            if (preventInputBlurRef.current) {
              preventInputBlurRef.current = false;
              editorRef.current.focus();
              return;
            }

            setMentionQuery(null);
            setEmojiQuery(null);
            setCommandQuery(null);
          }}
          {...props}
        />

        {isAutoCompleteMenuOpen && autoCompleteOptions.length !== 0 && (
          <AutoCompleteListbox
            items={autoCompleteOptions}
            selectedIndex={selectedAutoCompleteIndex}
            onItemClick={(item) => {
              selectAutoCompleteOption(item);
            }}
            onListboxMouseDown={() => {
              preventInputBlurRef.current = true;
            }}
          />
        )}
      </>
    );
  },
);

const AutoCompleteListbox = ({
  selectedIndex = -1,
  onItemClick,
  items = [],
  onListboxMouseDown,
}) => {
  return (
    <ul
      onMouseDown={onListboxMouseDown}
      id="autocomplete-listbox"
      role="listbox"
      css={(theme) =>
        css({
          position: "absolute",
          bottom: "calc(100% + 0.5rem)",
          left: 0,
          width: "100%",
          zIndex: 1,
          background: theme.colors.popoverBackground,
          borderRadius: "0.7rem",
          padding: "0.5rem 0",
          boxShadow: theme.shadows.elevationLow,
          "[role=option]": {
            display: "flex",
            alignItems: "center",
            width: "100%",
            padding: "0.8rem 1.2rem 0.6rem",
            lineHeight: 1.3,
            fontWeight: "400",
            cursor: "pointer",
            outline: "none",
            ".image": {
              width: "3.2rem",
              height: "3.2rem",
              borderRadius: "50%",
              overflow: "hidden",
              marginRight: "1rem",
            },
            ".label": {
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "flex-start",
              height: "1.8rem",
              color: theme.colors.textNormal,
            },
            ".description": {
              color: theme.colors.textDimmed,
              fontSize: "1.2rem",
              whiteSpace: "pre-line",
            },
            '[data-matching-text="true"]': {
              color: theme.colors.textHeader,
              background: theme.colors.textHighlightBackground,
            },
            '&:hover, &:focus, &[data-selected="true"]': {
              background: theme.colors.backgroundModifierHover,
              ".label": {
                color: theme.colors.textHeader,
              },
            },
          },
        })
      }
    >
      {items.map((item, i) => (
        <li
          key={item.value}
          role="option"
          id={`autocomplete-listbox-option-${selectedIndex}`}
          aria-selected={`${i === selectedIndex}`}
          data-selected={`${i === selectedIndex}`}
          onClick={() => {
            onItemClick(item, i);
          }}
        >
          {typeof item.render === "function" ? (
            item.render({})
          ) : (
            <>
              {item.image && <div className="image">{item.image}</div>}
              <div>
                <div className="label">{item.label}</div>
                {item.description && (
                  <div className="description">{item.description}</div>
                )}
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
};

const ChannelAutoCompleteItem = ({ id }) => {
  const channel = useChannel(id, { name: true });
  const theme = useTheme();

  return (
    <div
      css={css({
        display: "flex",
        alignItems: "center",
        ".image": {
          width: "3.2rem",
          height: "3.2rem",
          borderRadius: "50%",
          overflow: "hidden",
          marginRight: "1rem",
        },
      })}
    >
      <div css={css({ marginRight: "1rem" })}>
        <ChannelAvatar
          id={id}
          transparent
          size="2.2rem"
          borderRadius={theme.avatars.borderRadius}
          background={theme.colors.backgroundModifierHover}
        />
      </div>
      <div
        css={(t) =>
          css({
            flex: 1,
            minWidth: 0,
            color: t.colors.textNormal,
            fontSize: t.text.sizes.large,
            fontWeight: t.text.weights.default,
          })
        }
      >
        {channel.name}
      </div>
    </div>
  );
};

export default RichTextEditorWithAutoComplete;

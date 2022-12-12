import React from "react";
import { css } from "@emotion/react";
import {
  array as arrayUtils,
  emoji as emojiUtils,
  ethereum as ethereumUtils,
} from "@shades/common/utils";
import { useLatestCallback } from "@shades/common/react";
import RichTextInput from "./rich-text-input";
import Avatar from "./avatar";

const { sort } = arrayUtils;

let emojiModulePromise = null;

const fetchEmojis = () => {
  if (emojiModulePromise) return emojiModulePromise;
  emojiModulePromise = import("@shades/common/emoji").then(
    (module) => {
      emojiModulePromise = null;
      return module.default;
    },
    (error) => {
      emojiModulePromise = null;
      return Promise.reject(error);
    }
  );
  return emojiModulePromise;
};

const MessageInput = React.forwardRef(
  (
    {
      initialValue,
      onChange,
      placeholder,
      onKeyDown,
      disabled,
      commands,
      executeCommand: executeCommand_,
      disableCommands = false,
      members,
      getMember,
    },
    editorRef
  ) => {
    const [emojis, setEmojis] = React.useState([]);

    const preventInputBlurRef = React.useRef();
    const mentionQueryRangeRef = React.useRef();

    const [mentionQuery, setMentionQuery] = React.useState(null);
    const [emojiQuery, setEmojiQuery] = React.useState(null);
    const [commandQuery, setCommandQuery] = React.useState(null);
    const [commandArgumentsQuery, setCommandArgumentsQuery] =
      React.useState(null);
    const [selectedAutoCompleteIndex, setSelectedAutoCompleteIndex] =
      React.useState(-1);

    const autoCompleteMode = (() => {
      if (commandQuery != null) return "commands";
      if (mentionQuery != null) return "mentions";
      if (emojiQuery != null) return "emojis";
      return null;
    })();

    const isAutoCompleteMenuOpen = autoCompleteMode != null;

    const filteredMentionOptions = React.useMemo(() => {
      if (autoCompleteMode !== "mentions") return [];

      const lowerCaseQuery = mentionQuery?.toLowerCase() ?? null;

      const unorderedFilteredMembers = members.filter(
        (member) =>
          lowerCaseQuery != null &&
          member.displayName?.toLowerCase().includes(lowerCaseQuery)
      );

      const orderedFilteredMembers = sort((o1, o2) => {
        const [i1, i2] = [o1, o2].map((o) =>
          o.displayName.toLowerCase().indexOf(lowerCaseQuery)
        );

        if (i1 < i2) return -1;
        if (i1 > i2) return 1;
        return 0;
      }, unorderedFilteredMembers);

      return orderedFilteredMembers.slice(0, 10).map((m) => {
        const label = m.displayName;
        const truncatedAddress = ethereumUtils.truncateAddress(m.walletAddress);
        const hasCustomDisplayName = label !== truncatedAddress;
        return {
          value: m.id,
          label,
          description: hasCustomDisplayName ? truncatedAddress : undefined,
          image: (
            <Avatar
              transparent
              url={m.profilePicture?.small}
              walletAddress={m.walletAddress}
              size="3.2rem"
            />
          ),
        };
      });
    }, [autoCompleteMode, mentionQuery, members]);

    const filteredEmojiOptions = React.useMemo(() => {
      if (autoCompleteMode !== "emojis") return [];

      const query = emojiQuery ?? null;

      const orderedFilteredEmojis =
        query == null ? emojis : emojiUtils.search(emojis, query);

      return orderedFilteredEmojis.slice(0, 10).map((e) => ({
        value: e.emoji,
        label: (
          <span>
            <span
              css={css({
                display: "inline-flex",
                transform: "scale(1.35)",
                marginRight: "0.5rem",
              })}
            >
              {e.emoji}
            </span>{" "}
            :{e.aliases[0]}:
          </span>
        ),
      }));
    }, [emojis, autoCompleteMode, emojiQuery]);

    const filteredCommandOptions = React.useMemo(() => {
      if (autoCompleteMode !== "commands") return [];

      const lowerCaseQuery = commandQuery?.toLowerCase() ?? null;

      const unorderedCommands = Object.keys(commands).filter(
        (command) => lowerCaseQuery != null && command.includes(lowerCaseQuery)
      );

      const orderedCommands = sort((o1, o2) => {
        const [i1, i2] = [o1, o2].map((command) =>
          command.toLowerCase().indexOf(lowerCaseQuery)
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

          case "emojis":
            editorRef.current.replaceCurrentWord(option.value);
            editorRef.current.insertText(" ");
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
                commandArgumentsQuery?.split(" ") ?? []
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
        commandQuery,
        commandArgumentsQuery,
        executeCommand,
      ]
    );

    const autoCompleteInputKeyDownHandler = React.useCallback(
      (event) => {
        if (!isAutoCompleteMenuOpen || autoCompleteOptions.length === 0) return;

        switch (event.key) {
          case "ArrowDown": {
            event.preventDefault();
            setSelectedAutoCompleteIndex((i) =>
              i >= autoCompleteOptions.length - 1 ? 0 : i + 1
            );
            break;
          }
          case "ArrowUp": {
            event.preventDefault();
            setSelectedAutoCompleteIndex((i) =>
              i <= 0 ? autoCompleteOptions.length - 1 : i - 1
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
      ]
    );

    const autoCompleteInputAccesibilityProps = {
      "aria-expanded": isAutoCompleteMenuOpen ? "true" : "false",
      "aria-haspopup": "listbox",
      "aria-autocomplete": "list",
      "aria-owns": "autocomplete-listbox",
      "aria-controls": "autocomplete-listbox",
      "aria-activedescendant": `autocomplete-listbox-option-${selectedAutoCompleteIndex}`,
    };

    React.useEffect(() => {
      if (autoCompleteMode !== "emojis" || emojis.length !== 0) return;
      fetchEmojis().then((es) => {
        const filteredEmoji = es.filter(
          (e) => parseFloat(e.unicode_version) < 13
        );
        setEmojis(filteredEmoji);
      });
    }, [autoCompleteMode, emojis]);

    return (
      <>
        <RichTextInput
          ref={editorRef}
          {...autoCompleteInputAccesibilityProps}
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
              handler: (word) => {
                if (word.startsWith(":")) {
                  setEmojiQuery(word.slice(1));
                  setSelectedAutoCompleteIndex(0);
                  return;
                }

                setEmojiQuery(null);
              },
            },
            !disableCommands && {
              type: "command",
              handler: (command, args) => {
                if (command == null) {
                  setCommandQuery(null);
                  return;
                }

                setCommandQuery(command);
                setCommandArgumentsQuery(
                  args.length === 0 ? null : args.join(" ")
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
          getMember={getMember}
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
  }
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
          bottom: "100%",
          left: 0,
          width: "100%",
          zIndex: 1,
          background: theme.colors.dialogBackground,
          borderRadius: "0.7rem",
          padding: "0.5rem 0",
          boxShadow:
            "rgb(15 15 15 / 5%) 0px 0px 0px 1px, rgba(15, 15, 15, 0.1) 0px 3px 6px, rgba(15, 15, 15, 0.2) 0px 9px 24px",
          "[role=option]": {
            display: "flex",
            alignItems: "center",
            width: "100%",
            padding: "0.8rem 1.2rem 0.6rem",
            lineHeight: 1.3,
            fontWeight: "400",
            cursor: "pointer",
            outline: "none",
            "&:hover": {
              background: theme.colors.backgroundModifierHover,
            },
            '&:focus, &[data-selected="true"]': {
              background: theme.colors.backgroundModifierSelected,
            },
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
          {item.image && <div className="image">{item.image}</div>}
          <div>
            <div className="label">{item.label}</div>
            {item.description && (
              <div className="description">{item.description}</div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
};

export default MessageInput;

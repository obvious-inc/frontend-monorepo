import React from "react";
import { css } from "@emotion/react";
import { arrayUtils } from "@shades/common";
import RichTextInput from "./rich-text-input";

const { sort } = arrayUtils;

let emojiModulePromise = null;

const fetchEmojis = () => {
  if (emojiModulePromise) return emojiModulePromise;
  emojiModulePromise = import("../emojis.js").then(
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
      disableCommands = false,
      members,
      getUserMentionDisplayName,
    },
    editorRef
  ) => {
    const [emojis, setEmojis] = React.useState([]);

    const preventInputBlurRef = React.useRef();
    const mentionQueryRangeRef = React.useRef();

    const [mentionQuery, setMentionQuery] = React.useState(null);
    const [commandQuery, setCommandQuery] = React.useState(null);
    const [emojiQuery, setEmojiQuery] = React.useState(null);
    const [selectedAutoCompleteIndex, setSelectedAutoCompleteIndex] =
      React.useState(-1);

    const autoCompleteMode =
      mentionQuery != null
        ? "mentions"
        : commandQuery != null
        ? "commands"
        : emojiQuery != null
        ? "emojis"
        : null;

    const isAutoCompleteMenuOpen = autoCompleteMode != null;

    const filteredMentionOptions = React.useMemo(() => {
      if (autoCompleteMode !== "mentions") return [];

      const lowerCaseQuery = mentionQuery?.toLowerCase() ?? null;

      const unorderedFilteredServerMembers = members.filter(
        (member) =>
          lowerCaseQuery != null &&
          member.displayName.toLowerCase().includes(lowerCaseQuery)
      );

      const orderedFilteredServerMembers = sort((o1, o2) => {
        const [i1, i2] = [o1, o2].map((o) =>
          o.displayName.toLowerCase().indexOf(lowerCaseQuery)
        );

        if (i1 < i2) return -1;
        if (i1 > i2) return 1;
        return 0;
      }, unorderedFilteredServerMembers);

      return orderedFilteredServerMembers
        .slice(0, 10)
        .map((m) => ({ value: m.id, label: m.displayName }));
    }, [autoCompleteMode, mentionQuery, members]);

    const filteredEmojiOptions = React.useMemo(() => {
      if (autoCompleteMode !== "emojis") return [];

      const lowerCaseQuery = emojiQuery?.toLowerCase() ?? null;

      const unorderedFilteredEmojis = emojis.filter(
        (emoji) =>
          lowerCaseQuery != null && emoji.aliases[0].includes(lowerCaseQuery)
      );

      const orderedFilteredEmojis = sort((o1, o2) => {
        const [i1, i2] = [o1, o2].map((o) =>
          o.aliases[0].indexOf(lowerCaseQuery)
        );

        if (i1 < i2) return -1;
        if (i1 > i2) return 1;
        return 0;
      }, unorderedFilteredEmojis);

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
                  <span css={(theme) => css({ color: theme.colors.textMuted })}>
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
      mentions: filteredMentionOptions,
      commands: filteredCommandOptions,
      emojis: filteredEmojiOptions,
    }[autoCompleteMode];

    const selectAutoCompleteOption = React.useCallback(
      (option, event) => {
        switch (autoCompleteMode) {
          case "mentions":
            event.preventDefault();
            editorRef.current.insertMention(option.value, {
              at: mentionQueryRangeRef.current,
            });
            setMentionQuery(null);
            break;

          case "emojis":
            event.preventDefault();
            editorRef.current.replaceCurrentWord(option.value);
            editorRef.current.insertText(" ");
            setEmojiQuery(null);
            break;

          case "commands": {
            event.preventDefault();

            if (commandQuery === option.value) {
              setCommandQuery(null);
              break;
            }

            editorRef.current.replaceFirstWord(`/${option.value} `);
            setCommandQuery(null);
            break;
          }

          default:
            throw new Error();
        }
      },
      [autoCompleteMode, editorRef, mentionQueryRangeRef, commandQuery]
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
            selectAutoCompleteOption(option, event);
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
        setEmojis(es);
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
                if (command == null || args.length !== 0) {
                  setCommandQuery(null);
                  return;
                }

                if (command && editorRef.current.string().endsWith(" ")) {
                  setCommandQuery(null);
                  return;
                }

                setCommandQuery(command);
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
          getUserMentionDisplayName={getUserMentionDisplayName}
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
            display: "block",
            width: "100%",
            padding: "0.8rem 1.2rem 0.6rem",
            lineHeight: 1.3,
            fontWeight: "400",
            cursor: "pointer",
            '&:hover, &:focus, &[data-selected="true"]': {
              outline: "none",
            },
            "&:hover": {
              background: theme.colors.backgroundModifierHover,
            },
            '&:focus, &[data-selected="true"]': {
              background: theme.colors.backgroundModifierSelected,
            },
            ".label": {
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "flex-start",
              height: "1.8rem",
              color: theme.colors.textNormal,
            },
            ".description": {
              color: theme.colors.textMuted,
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
          <div className="label">{item.label}</div>
          {item.description && (
            <div className="description">{item.description}</div>
          )}
        </li>
      ))}
    </ul>
  );
};

export default MessageInput;

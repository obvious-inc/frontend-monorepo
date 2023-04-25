import React from "react";
import { useNavigate } from "react-router-dom";
import { css, useTheme } from "@emotion/react";
import { Item, useComboBoxState } from "react-stately";
import {
  useComboBox,
  useListBox,
  useOption,
  useFocusRing,
  mergeProps,
} from "react-aria";
import {
  useMe,
  useActions,
  useAllChannels,
  usePublicChannels,
} from "@shades/common/app";
import { channel as channelUtils } from "@shades/common/utils";
import { MagnificationGlass as SearchIcon } from "@shades/ui-web/icons";
import { useLatestCallback } from "@shades/common/react";
import Dialog from "@shades/ui-web/dialog";
import Input from "./input";
import ChannelAvatar from "./channel-avatar";

const MAX_CHANNEL_COUNT = 12;

const { search: searchChannels } = channelUtils;

const mapChannelToOption = (c) => ({
  value: c.id,
  label: c.name,
  description: c.description,
  channelId: c.id,
});

const useFilteredChannelOptions = (channels, query) =>
  React.useMemo(() => {
    const filteredChannels =
      query.length === 0 ? channels : searchChannels(channels, query);

    return filteredChannels.slice(0, MAX_CHANNEL_COUNT).map(mapChannelToOption);
  }, [channels, query]);

const CommandCenter = ({ mode, ...props }) => {
  const sharedProps = { ...props, onRequestClose: props.close };

  switch (mode) {
    case "discover":
      return <CommandCenterDiscoverMode {...sharedProps} />;
    default:
      return <CommandCenterChannelFilterMode {...sharedProps} />;
  }
};

const CommandCenterChannelFilterMode = ({ query, close, ...props }) => {
  const navigate = useNavigate();

  const deferredQuery = React.useDeferredValue(query.trim().toLowerCase());
  const channels = useAllChannels({ name: true, members: true });
  const filteredOptions = useFilteredChannelOptions(channels, deferredQuery);

  return (
    <AlwaysOpenComboboxInDialog
      aria-label="Find channels"
      placeholder="Find channel..."
      options={filteredOptions}
      onSelect={(value) => {
        close();
        navigate(`/channels/${value}`);
      }}
      {...props}
    />
  );
};

const CommandCenterDiscoverMode = ({ query, close, ...props }) => {
  const navigate = useNavigate();
  const me = useMe();
  const { fetchPubliclyReadableChannels } = useActions();

  const deferredQuery = React.useDeferredValue(query.trim().toLowerCase());
  const channels = usePublicChannels({ name: true, members: true });
  const channelsNotMember = channels.filter(
    (c) => !c.memberUserIds.includes(me.id)
  );
  const filteredOptions = useFilteredChannelOptions(
    channelsNotMember,
    deferredQuery
  );

  React.useEffect(() => {
    fetchPubliclyReadableChannels();
  }, [fetchPubliclyReadableChannels]);

  return (
    <AlwaysOpenComboboxInDialog
      aria-label="Discover channels"
      placeholder="Find public channel..."
      options={filteredOptions}
      onSelect={(value) => {
        close();
        navigate(`/channels/${value}`);
      }}
      {...props}
    />
  );
};

const AlwaysOpenComboboxInDialog = ({
  query,
  onQueryChange,
  onSelect,
  onRequestClose,
  ...props
}) => {
  const dialogRef = React.useRef(null);

  return (
    <Dialog
      dialogRef={dialogRef}
      width="66rem"
      isOpen
      onRequestClose={onRequestClose}
      css={(t) =>
        css({
          background: t.colors.backgroundSecondary,
          "@media (min-width: 600px)": {
            position: "relative",
            top: "9rem",
            maxHeight: "calc(100% - 16rem)",
          },
        })
      }
      underlayProps={{
        css: css({
          "@media (min-width: 600px)": {
            padding: "0 2.8rem",
            alignItems: "flex-start",
          },
        }),
      }}
    >
      <AlwaysOpenCombobox
        inputValue={query}
        onInputChange={onQueryChange}
        onSelectionChange={(value) => {
          if (value == null) return;
          onSelect(value);
        }}
        popoverRef={dialogRef}
        {...props}
      />
    </Dialog>
  );
};

const AlwaysOpenCombobox = ({ value, options = [], popoverRef, ...props_ }) => {
  const props = {
    allowsCustomValue: true,
    ...props_,
    menuTrigger: "focus",
    selectedKey: value,
    disabledKeys: options.filter((o) => o.disabled).map((o) => o.value),
    items: options.map((o) => ({ ...o, key: o.value })),
    children: (o) => <Item textValue={o.label} />,
    isDisabled: props_.disabled,
  };

  const state = useComboBoxState(props);

  // const openCombobox = useLatestCallback(() => state.open());

  // Setup refs and get props for child elements.
  // let buttonRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const listBoxRef = React.useRef(null);

  // React.useEffect(() => {
  //   openCombobox();
  // }, [options, openCombobox]);

  const {
    // buttonProps,
    inputProps,
    listBoxProps,
    // labelProps
  } = useComboBox(
    {
      ...props,
      inputRef,
      // buttonRef,
      listBoxRef,
      popoverRef,
    },
    state
  );

  const selectFirstKey = useLatestCallback(() => {
    const firstKey = state.collection.getFirstKey();
    state.selectionManager.setFocusedKey(firstKey);
  });

  React.useEffect(() => {
    if (options.length === 0) return;
    selectFirstKey();
  }, [options, selectFirstKey]);

  return (
    <>
      <div style={{ position: "relative" }}>
        <SearchIcon
          css={(t) =>
            css({
              color: t.colors.textMuted,
              width: "1.8rem",
              pointerEvents: "none",
              position: "absolute",
              top: "50%",
              transform: "translateY(-50%)",
              left: "1.5rem",
            })
          }
          aria-hidden="true"
        />
        <Input
          ref={inputRef}
          {...inputProps}
          css={(t) =>
            css({
              background: "none",
              fontSize: t.fontSizes.large,
              padding: "1rem 1.4rem 1rem 4.4rem",
              borderBottom: "0.1rem solid",
              borderColor: t.colors.borderLighter,
              borderRadius: 0,
              "&:focus": { boxShadow: "none" },
            })
          }
        />
      </div>
      <ListBox
        listBoxProps={listBoxProps}
        listBoxRef={listBoxRef}
        state={state}
        css={css({ flex: 1, overflow: "auto" })}
      />
    </>
  );
};

const ListBox = ({
  state,
  listBoxRef: ref,
  listBoxProps: listBoxPropsInput,
  ...props
}) => {
  const {
    listBoxProps,
    // labelProps
  } = useListBox(listBoxPropsInput, state, ref);

  return (
    <ul
      {...listBoxProps}
      ref={ref}
      css={(t) =>
        css({
          display: "block",
          padding: t.dropdownMenus.padding,
          listStyle: "none",
        })
      }
      {...props}
    >
      {[...state.collection].map((item) => (
        <Option key={item.key} item={item} state={state} />
      ))}
    </ul>
  );
};

const Option = ({ item, state }) => {
  const ref = React.useRef();
  const {
    optionProps,
    labelProps,
    descriptionProps,
    // isSelected,
    isFocused,
    isDisabled,
  } = useOption({ key: item.key }, state, ref);

  const theme = useTheme();

  const {
    // isFocusVisible,
    focusProps,
  } = useFocusRing();

  return (
    <li
      // {...optionProps}
      {...mergeProps(optionProps, focusProps)}
      ref={ref}
      css={(t) =>
        css({
          minHeight: t.dropdownMenus.itemHeight,
          padding: "0.7rem 1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          lineHeight: 1.4,
          fontWeight: "400",
          fontSize: t.fontSizes.large,
          color: isDisabled ? t.colors.textMuted : t.colors.textNormal,
          borderRadius: "0.3rem",
          outline: "none",
          cursor: isDisabled ? "not-allowed" : "pointer",
          whiteSpace: "nowrap",
          // ":focus": { background: t.colors.backgroundModifierHover },
        })
      }
      style={{
        // background: isFocusVisible ? "rgb(255 255 255 / 5%)" : undefined,
        background: isFocused
          ? theme.colors.backgroundModifierHover
          : undefined,
      }}
    >
      <div
        css={css({
          width: "2rem",
          marginRight: "1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        })}
      >
        <ChannelAvatar id={item.value.channelId} size="2rem" />
      </div>
      <div
        style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}
      >
        <div
          {...labelProps}
          style={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.value.label}
        </div>
        {item.value.description != null && (
          <div
            {...descriptionProps}
            css={(t) =>
              css({
                color: isDisabled ? t.colors.textMuted : t.colors.textDimmed,
                fontSize: t.fontSizes.default,
                flex: 1,
                minWidth: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                marginLeft: "1rem",
              })
            }
          >
            {item.value.description}
          </div>
        )}
      </div>
    </li>
  );
};

export default CommandCenter;

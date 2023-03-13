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
import { useAllChannels } from "@shades/common/app";
import { channel as channelUtils } from "@shades/common/utils";
import Dialog from "./dialog";
import Input from "./input";

const { search: searchChannels } = channelUtils;

const CommandCenter = ({ query, onQueryChange, close }) => {
  const navigate = useNavigate();

  const dialogRef = React.useRef(null);

  const deferredQuery = React.useDeferredValue(query.trim().toLowerCase());

  const allChannelsWithMembers = useAllChannels({ name: true, members: true });

  const filterChannels = React.useCallback(
    (query) => {
      if (query.length <= 1) return allChannelsWithMembers;
      return searchChannels(allChannelsWithMembers, query);
    },
    [allChannelsWithMembers]
  );

  const filteredOptions = React.useMemo(() => {
    return filterChannels(deferredQuery).map((c) => ({
      value: c.id,
      label: c.name,
      description: c.description,
    }));
  }, [filterChannels, deferredQuery]);

  return (
    <Dialog
      dialogRef={dialogRef}
      width="66rem"
      isOpen
      onRequestClose={() => {
        close();
      }}
      css={css({
        "@media (min-width: 600px)": {
          position: "relative",
          top: "9rem",
          maxHeight: "calc(100% - 16rem)",
        },
      })}
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
        aria-label="Find channels"
        placeholder="Find channel..."
        inputValue={query}
        options={filteredOptions}
        onInputChange={onQueryChange}
        onSelectionChange={(value) => {
          if (value == null) return;
          close();
          navigate(`/channels/${value}`);
        }}
        popoverRef={dialogRef}
      />
    </Dialog>
  );
};

const AlwaysOpenCombobox = ({ value, options = [], popoverRef, ...props_ }) => {
  const props = {
    allowsCustomValue: true,
    ...props_,
    selectedKey: value,
    disabledKeys: options.filter((o) => o.disabled).map((o) => o.value),
    items: options.map((o) => ({ ...o, key: o.value })),
    children: (o) => <Item textValue={o.label} />,
    isDisabled: props_.disabled,
  };

  const state = useComboBoxState(props);
  const { open: openCombobox } = state;

  // Setup refs and get props for child elements.
  // let buttonRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const listBoxRef = React.useRef(null);

  React.useEffect(() => {
    openCombobox();
  }, [openCombobox]);

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

  return (
    <>
      <Input
        ref={inputRef}
        {...inputProps}
        css={(t) =>
          css({
            background: "none",
            borderBottom: "0.1rem solid",
            borderColor: t.colors.borderLight,
            fontSize: t.fontSizes.large,
            borderRadius: 0,
            padding: "1rem 1.4rem",
            "&:focus": { boxShadow: "none" },
          })
        }
      />
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
          padding: "0.5rem 1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          lineHeight: 1.4,
          // fontSize: t.fontSizes.menus,
          fontWeight: "400",
          color: isDisabled ? t.colors.textMuted : t.colors.textNormal,
          borderRadius: "0.3rem",
          outline: "none",
          cursor: isDisabled ? "not-allowed" : "pointer",
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
      {/* {item.value.icon != null && ( */}
      {/*   <div */}
      {/*     css={css({ */}
      {/*       width: "3rem", */}
      {/*       marginRight: "1rem", */}
      {/*       display: "flex", */}
      {/*       alignItems: "center", */}
      {/*       justifyContent: "center", */}
      {/*     })} */}
      {/*   > */}
      {/*     {item.value.icon} */}
      {/*   </div> */}
      {/* )} */}
      <div css={css({ width: "100%", display: "flex", alignItems: "center" })}>
        <div {...labelProps}>{item.value.label}</div>
        {item.value.description != null && (
          <div
            {...descriptionProps}
            css={(t) =>
              css({
                color: isDisabled ? t.colors.textMuted : t.colors.textDimmed,
                fontSize: t.fontSizes.small,
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

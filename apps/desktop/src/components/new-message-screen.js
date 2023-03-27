import { utils as ethersUtils } from "ethers";
import React from "react";
import { css, useTheme } from "@emotion/react";
import { useEnsAddress } from "wagmi";
import {
  useListBox,
  useOption,
  useFocusRing,
  useKeyboard,
  mergeProps,
} from "react-aria";
import {
  useActions,
  useAllUsers,
  useUserWithWalletAddress,
} from "@shades/common/app";
import {
  user as userUtils,
  ethereum as ethereumUtils,
} from "@shades/common/utils";
import { useState as useSidebarState } from "@shades/ui-web/sidebar-layout";
import {
  CrossSmall as CrossSmallIcon,
  Checkmark as CheckmarkIcon,
} from "@shades/ui-web/icons";
import IconButton from "@shades/ui-web/icon-button";
import useCombobox from "../hooks/combobox";
import ChannelHeader from "./channel-header";
import UserAvatar from "./user-avatar";
import NewChannelMessageInput from "./new-channel-message-input";
import * as Popover from "./popover";

const { search: searchUsers } = userUtils;
const { truncateAddress } = ethereumUtils;

const useFilteredAccountOptions = (query, { selectedAccounts = [] } = {}) => {
  const users = useAllUsers();

  const deferredQuery = React.useDeferredValue(query.trim().toLowerCase());

  const { data: ensWalletAddress } = useEnsAddress({
    name: deferredQuery,
    enabled: /^.+\.eth$/.test(deferredQuery),
  });

  const filteredOptions = React.useMemo(() => {
    const mapUserToOption = (c) => ({
      value: c.walletAddress,
      label: c.displayName ?? c.walletAddress,
      description:
        c.displayName == null ? null : truncateAddress(c.walletAddress),
      icon:
        c.walletAddress == null
          ? null
          : () => <UserAvatar size="2.4rem" walletAddress={c.walletAddress} />,
      isSelected: selectedAccounts.includes(c.walletAddress),
    });

    const filteredUsers =
      deferredQuery.length <= 1 ? users : searchUsers(users, deferredQuery);

    const queryUser = ethersUtils.isAddress(deferredQuery)
      ? { walletAddress: deferredQuery }
      : ensWalletAddress != null
      ? {
          walletAddress: ensWalletAddress,
          displayName: deferredQuery,
        }
      : null;

    if (
      queryUser == null ||
      filteredUsers.some(
        (u) =>
          u.walletAddress.toLowerCase() ===
          queryUser.walletAddress.toLowerCase()
      )
    )
      return filteredUsers.map(mapUserToOption);

    return [queryUser, ...filteredUsers].map(mapUserToOption);
  }, [users, deferredQuery, ensWalletAddress, selectedAccounts]);

  return filteredOptions;
};

const NewMessageScreen = () => {
  const { isFloating: isSidebarFloating } = useSidebarState();
  const actions = useActions();

  const selectedAccountsState = useTagFieldComboboxState();

  return (
    <div
      css={(t) =>
        css({
          flex: 1,
          background: t.colors.backgroundPrimary,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          height: "100%",
        })
      }
    >
      <ChannelHeader>
        <div
          css={(t) =>
            css({
              fontSize: t.text.sizes.headerDefault,
              fontWeight: t.text.weights.header,
              color: t.colors.textHeader,
            })
          }
          style={{ paddingLeft: isSidebarFloating ? 0 : "1.6rem" }}
        >
          New Message
        </div>
      </ChannelHeader>
      <div
        css={css({
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "stretch",
          minHeight: 0,
          minWidth: 0,
        })}
      >
        <div css={css({ padding: "0 1.6rem" })}>
          <AccountsTagFieldCombobox
            label="To:"
            ariaLabel="Account search"
            placeholder="example.ens, or a wallet address 0x..."
            state={selectedAccountsState}
          />
        </div>
        <div style={{ flex: 1 }}></div>
        <div style={{ padding: "2rem 1.6rem" }}>
          <NewChannelMessageInput
            uploadImage={actions.uploadImage}
            submit={(message) => {
              console.log(
                "submit",
                selectedAccountsState.selectedKeys,
                message
              );
            }}
            placeholder="Type your message..."
            members={[]}
            // members={recipientUser == null ? [] : [recipientUser]}
            // submitDisabled={recipientWalletAddress == null}
          />
        </div>
      </div>
    </div>
  );
};

const useTagFieldComboboxState = () => {
  const [{ selectedKeys, focusedIndex }, setState] = React.useState({
    selectedKeys: [],
    focusedIndex: -1,
  });

  const select = React.useCallback(
    (key) =>
      setState((s) => ({ ...s, selectedKeys: [...s.selectedKeys, key] })),
    []
  );

  const deselect = React.useCallback(
    (key) =>
      setState((s) => {
        const indexToDeselect = s.selectedKeys.findIndex((k) => k === key);
        return {
          selectedKeys: s.selectedKeys.filter((_, i) => i !== indexToDeselect),
          focusedIndex: -1,
        };
      }),
    []
  );

  const clearFocus = React.useCallback(
    () => setState((s) => ({ ...s, focusedIndex: -1 })),
    []
  );

  const moveFocusLeft = React.useCallback(
    () =>
      setState(({ selectedKeys, focusedIndex }) => ({
        selectedKeys,
        focusedIndex:
          focusedIndex === -1
            ? selectedKeys.length - 1
            : Math.max(0, focusedIndex - 1),
      })),
    []
  );

  const moveFocusRight = React.useCallback(
    () =>
      setState(({ selectedKeys, focusedIndex }) => ({
        selectedKeys,
        focusedIndex:
          focusedIndex === -1 || focusedIndex === selectedKeys.length - 1
            ? -1
            : focusedIndex + 1,
      })),
    []
  );

  const focusIndex = React.useCallback(
    (i) => setState((s) => ({ ...s, focusedIndex: i })),
    []
  );

  const focusLast = React.useCallback(
    () =>
      setState(({ selectedKeys }) => ({
        selectedKeys,
        focusedIndex: selectedKeys.length - 1,
      })),
    []
  );

  const deselectFocusedKeyAndMoveFocusLeft = React.useCallback(
    () =>
      setState(({ selectedKeys, focusedIndex }) => ({
        selectedKeys: selectedKeys.filter((_, i) => i !== focusedIndex),
        focusedIndex: focusedIndex === 0 ? -1 : focusedIndex - 1,
      })),
    []
  );

  return {
    selectedKeys,
    focusedIndex,
    select,
    deselect,
    focusIndex,
    focusLast,
    clearFocus,
    moveFocusLeft,
    moveFocusRight,
    deselectFocusedKeyAndMoveFocusLeft,
  };
};

const useTagFieldCombobox = ({ inputRef }, state) => {
  const { keyboardProps } = useKeyboard({
    onKeyDown: (e) => {
      const hasSelection = e.target.selectionStart != null;

      if (hasSelection) {
        const { selectionStart, selectionEnd } = e.target;
        const selectionIsCollapsed = selectionStart === selectionEnd;
        if (
          !selectionIsCollapsed ||
          selectionStart !== 0 ||
          state.selectedKeys.length === 0
        ) {
          e.continuePropagation();
          return;
        }
      }

      if (e.key === "ArrowLeft") {
        inputRef.current.focus();
        state.moveFocusLeft();
      } else if (e.key === "ArrowRight") {
        inputRef.current.focus();
        state.moveFocusRight();
      } else if (e.key === "Backspace") {
        inputRef.current.focus();
        if (state.focusedIndex === -1) {
          state.focusLast();
        } else {
          state.deselectFocusedKeyAndMoveFocusLeft();
        }
      } else {
        e.continuePropagation();
      }
    },
  });

  return {
    inputProps: keyboardProps,
    tagButtonProps: keyboardProps,
  };
};

const AccountsTagFieldCombobox = ({ label, ariaLabel, placeholder, state }) => {
  const inputRef = React.useRef();
  const containerRef = React.useRef();

  const [query, setQuery] = React.useState("");
  const filteredOptions = useFilteredAccountOptions(query, {
    selectedAccounts: state.selectedKeys,
  });

  const { inputProps, tagButtonProps } = useTagFieldCombobox(
    { inputRef },
    state
  );

  return (
    <div
      ref={containerRef}
      css={(t) =>
        css({
          display: "flex",
          width: "100%",
          color: t.colors.inputPlaceholder,
          background: t.colors.backgroundTertiary,
          fontSize: t.text.sizes.channelMessages,
          borderRadius: "0.6rem",
          padding: "1.05rem 1.6rem",
        })
      }
    >
      {label && <div style={{ marginRight: "0.8rem" }}>{label}</div>}

      <FlexGrid gridGap="0.5rem" css={css({ flex: 1, minWidth: 0 })}>
        {state.selectedKeys.map((walletAddress, i) => (
          <FlexGridItem key={walletAddress}>
            <SelectedAccountTag
              walletAddress={walletAddress}
              isFocused={i === state.focusedIndex}
              focus={() => {
                inputRef.current.focus();
                state.focusIndex(i);
              }}
              deselect={() => {
                inputRef.current.focus();
                state.deselect(walletAddress);
              }}
              {...tagButtonProps}
            />
          </FlexGridItem>
        ))}

        <FlexGridItem css={css({ flex: 1 })}>
          <Combobox
            aria-label={ariaLabel}
            autoFocus
            placeholder={
              state.selectedKeys.length === 0 ? placeholder : undefined
            }
            allowsCustomValue={false}
            options={filteredOptions}
            value={null}
            onSelect={(walletAddress) => {
              if (walletAddress == null) return;
              setQuery("");
              state.select(walletAddress);
            }}
            inputValue={query}
            onInputChange={setQuery}
            disabledKeys={state.selectedKeys}
            targetRef={containerRef}
            inputRef={inputRef}
            inputProps={{
              ...mergeProps(inputProps, {
                onChange: () => {
                  state.clearFocus();
                },
                onClick: () => {
                  state.clearFocus();
                },
                onBlur: (e) => {
                  if (
                    e.relatedTarget != null &&
                    containerRef.current.contains(e.relatedTarget)
                  )
                    return;

                  state.clearFocus();
                },
              }),
              css: (t) =>
                css({
                  color: t.colors.textNormal,
                  background: "none",
                  border: 0,
                  padding: 0,
                  width: "100%",
                  minWidth: "12rem",
                  outline: "none",
                  "::placeholder": {
                    color: t.colors.inputPlaceholder,
                  },
                }),
            }}
            listBoxProps={{ css: css({ maxHeight: "36.5rem" }) }}
          />
        </FlexGridItem>
      </FlexGrid>
    </div>
  );
};

const SelectedAccountTag = ({
  walletAddress,
  isFocused,
  focus,
  deselect,
  ...props
}) => {
  const user = useUserWithWalletAddress(walletAddress);
  return (
    <button
      tabIndex={-1}
      data-focused={isFocused ? "true" : undefined}
      css={(t) =>
        css({
          display: "flex",
          alignItems: "center",
          border: 0,
          lineHeight: "inherit",
          borderRadius: "0.3rem",
          padding: "0 0.2rem",
          fontWeight: "500",
          outline: "none",
          cursor: "pointer",
          color: t.colors.mentionText,
          background: t.colors.mentionBackground,
          "&[data-focused]": {
            position: "relative",
            zIndex: 1,
            boxShadow: `0 0 0 0.2rem ${t.colors.mentionFocusBorder}`,
            textDecoration: "none",
            "[data-deselect-button]": {
              color: t.colors.textAccent,
              // backdropFilter: "brightness(1.5) saturate(1.25)",
              // svg: { transform: "scale(1.1)" },
            },
          },
          "@media (hover: hover)": {
            "&:hover": {
              color: t.colors.mentionTextModifierHover,
              background: t.colors.mentionBackgroundModifierHover,
              textDecoration: "none",
            },
          },
        })
      }
      onFocus={() => {
        focus();
      }}
      {...props}
    >
      {user?.displayName ?? truncateAddress(walletAddress)}
      <IconButton
        data-deselect-button
        component="div"
        role="button"
        size="1.8rem"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          deselect();
        }}
        style={{ marginLeft: "0.2rem" }}
        css={(t) =>
          css({
            color: "inherit",
            "@media (hover: hover)": {
              ":hover": {
                color: t.colors.textAccent,
                backdropFilter: "brightness(1.5) saturate(1.25)",
              },
            },
          })
        }
      >
        <CrossSmallIcon style={{ width: "0.9rem", height: "auto" }} />
      </IconButton>
    </button>
  );
};

const Combobox = ({
  targetRef,
  inputRef: inputRefExternal,
  inputProps: inputPropsExternal,
  listBoxProps: listBoxPropsExternal,
  ...props
}) => {
  const { state, popoverRef, inputRef, listBoxRef, listBoxProps, inputProps } =
    useCombobox({ ...props, inputRef: inputRefExternal });

  return (
    <>
      <input ref={inputRef} {...mergeProps(inputProps, inputPropsExternal)} />
      <Popover.Root
        placement="bottom left"
        offset={5}
        isOpen={state.isOpen}
        onOpenChange={state.setOpen}
        triggerRef={inputRef}
        targetRef={targetRef}
        isDialog={false}
      >
        <Popover.Content ref={popoverRef} widthFollowTrigger>
          <ListBox
            ref={listBoxRef}
            listBoxProps={listBoxProps}
            state={state}
            {...listBoxPropsExternal}
          />
        </Popover.Content>
      </Popover.Root>
    </>
  );
};

const ListBox = React.forwardRef(
  ({ state, listBoxProps: listBoxPropsInput, ...props }, ref) => {
    const {
      listBoxProps,
      // labelProps
    } = useListBox(listBoxPropsInput, state, ref);

    return (
      <ul
        ref={ref}
        css={(t) =>
          css({
            display: "block",
            padding: t.dropdownMenus.padding,
            listStyle: "none",
            "li:not(:last-of-type)": { marginBottom: "0.2rem" },
          })
        }
        {...mergeProps(props, listBoxProps)}
      >
        {[...state.collection].map((item) => (
          <Option key={item.key} item={item} state={state} />
        ))}
      </ul>
    );
  }
);

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
      {...mergeProps(optionProps, focusProps)}
      ref={ref}
      css={(t) =>
        css({
          minHeight: t.dropdownMenus.itemHeight,
          padding: "0.8rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          lineHeight: 1.4,
          fontWeight: "400",
          color: t.colors.textNormal,
          borderRadius: "0.3rem",
          outline: "none",
          cursor: isDisabled ? "default" : "pointer",
        })
      }
      style={{
        background: item.value.isSelected
          ? theme.colors.primaryTransparentDark
          : // ? // ? "rgb(34 130 226 / 17%)"
          isFocused
          ? theme.colors.backgroundModifierHover
          : undefined,
      }}
    >
      {item.value.icon != null && (
        <div
          css={css({
            marginRight: "1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          })}
        >
          {item.value.icon()}
        </div>
      )}
      <div
        css={css({
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
        })}
      >
        <div
          {...labelProps}
          css={(t) => css({ fontSize: t.text.sizes.channelMessages })}
          style={{ color: isFocused ? theme.colors.textAccent : undefined }}
        >
          {item.value.label}
        </div>
        {item.value.description != null && (
          <div
            {...descriptionProps}
            css={(t) =>
              css({
                color: t.colors.inputPlaceholder,
                fontSize: t.fontSizes.default,
                flex: 1,
                minWidth: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                marginLeft: "0.8rem",
              })
            }
          >
            {item.value.description}
          </div>
        )}
        {item.value.isSelected && (
          <div css={css({ padding: "0 0.5rem" })}>
            <CheckmarkIcon style={{ width: "1.2rem" }} />
          </div>
        )}
      </div>
    </li>
  );
};

const FlexGridContext = React.createContext();

const FlexGrid = ({ gridGap = 0, children, ...props }) => (
  <FlexGridContext.Provider value={{ gridGap }}>
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        margin: `calc(${gridGap} * -1) 0 0 calc(${gridGap} * -1)`,
        ...props.style,
      }}
      {...props}
    >
      {children}
    </div>
  </FlexGridContext.Provider>
);

const FlexGridItem = ({ children, ...props }) => {
  const { gridGap } = React.useContext(FlexGridContext);
  return (
    <div
      style={{ margin: `${gridGap} 0 0 ${gridGap}`, ...props.style }}
      {...props}
    >
      {children}
    </div>
  );
};

export default NewMessageScreen;

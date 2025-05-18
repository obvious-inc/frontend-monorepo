"use client";

import React, { useMemo, useState, createContext, useContext } from "react";
import {
  Autocomplete,
  Collection,
  Input,
  Menu,
  MenuSection,
  MenuItem,
  Header,
  useFilter,
  SearchField,
  Button,
} from "react-aria-components";
import { css, useTheme } from "@emotion/react";
import Dialog from "@shades/ui-web/dialog";
import { Cross as CrossIcon } from "@shades/ui-web/icons";
import {
  ethereum as ethereumUtils,
  array as arrayUtils,
} from "@shades/common/utils";
import useKeyboardShortcuts from "@/hooks/keyboard-shortcuts";
import { useNavigate } from "@/hooks/navigation";
import { useDialog } from "@/hooks/global-dialogs";
import { performSearch } from "@/utils/search";
import {
  useProposals,
  useProposalCandidates,
  useEnsCache,
  useDelegate,
  useProposal,
  useProposalCandidate,
} from "@/store";
import { useCollection as useDrafts } from "@/hooks/drafts";
import AccountAvatar from "@/components/account-avatar";
import useEnsName from "@/hooks/ens-name";
import useAccountDisplayName from "@/hooks/account-display-name";

export const CommandPaletteContext = createContext({});

export const useCommandPalette = () => {
  const { setOpen } = useContext(CommandPaletteContext);
  return { open: () => setOpen(true) };
};

const categoryBySearchResultType = {
  account: "accounts",
  draft: "drafts",
  proposal: "proposals",
  topic: "topics",
  candidate: "candidates",
};

const categoryNameByKey = {
  proposals: "Proposals",
  candidates: "Candidates",
  topics: "Topics",
  accounts: "Accounts",
  "connected-account": "Connected account",
  dao: "DAO",
  camp: "Camp",
};

const commands = [
  // Proposals section
  {
    id: "go-to-proposals",
    category: "proposals",
    label: "Browse proposals",
    keywords: ["proposals", "browse", "view", "search", "explore"],
    action: (navigate) => navigate("/proposals"),
  },
  {
    id: "go-to-candidates",
    category: "proposals",
    label: "Browse candidates",
    keywords: [
      "proposals",
      "candidates",
      "browse",
      "view",
      "search",
      "explore",
    ],
    action: (navigate) => navigate("/candidates"),
  },
  {
    id: "create-proposal",
    category: "proposals",
    label: "Create Proposal...",
    keywords: ["new", "proposal", "create", "start", "proposals"],
    action: (navigate) => navigate("/new"),
  },
  {
    id: "create-candidate",
    category: "proposals",
    label: "Create Candidate...",
    keywords: ["new", "candidate", "create", "proposals"],
    action: (navigate) => navigate("/new"),
  },
  // Topics section
  {
    id: "go-to-topics",
    category: "topics",
    label: "Browse Discussion Topics",
    keywords: [
      "topics",
      "discussion",
      "forum",
      "candidates",
      "browse",
      "view",
      "search",
      "explore",
    ],
    action: (navigate) => navigate("/topics"),
  },
  {
    id: "create-topic",
    category: "topics",
    label: "Create Discussion Topic...",
    keywords: [
      "topics",
      "discussion",
      "forum",
      "candidates",
      "new",
      "create",
      "topic",
    ],
    action: (navigate) => navigate("/new?topic=1"),
  },
  // DAO section
  {
    id: "go-to-auction",
    category: "dao",
    label: "Auction",
    keywords: ["dao", "auction", "bid", "current", "noun"],
    action: (navigate) => navigate("/auction"),
  },
  {
    id: "go-to-voters",
    category: "dao",
    label: "Voters",
    keywords: ["dao", "voters", "accounts", "delegates", "browse", "view"],
    action: (navigate) => navigate("/voters"),
  },
  {
    id: "open-treasury",
    category: "dao",
    label: "Treasury",
    keywords: ["dao", "treasury", "funds", "balance"],
    action: (_, { openTreasuryDialog: open }) => open(),
  },
  // Connected account section
  {
    id: "open-account-dialog",
    category: "connected-account",
    label: "View Account",
    keywords: ["account", "wallet", "me", "profile", "settings", "delegate"],
    action: (_, { openAccountDialog: open }) => open(),
  },
  {
    id: "open-drafts",
    category: "connected-account",
    label: "View Drafts",
    keywords: [
      "account",
      "wallet",
      "me",
      "profile",
      "drafts",
      "proposals",
      "candidates",
      "topics",
    ],
    action: (_, { openDraftsDialog: open }) => open(),
  },
  {
    id: "open-edit-profile-dialog",
    category: "connected-account",
    label: "Edit Public Profile...",
    keywords: ["account", "wallet", "me", "edit", "profile", "settings"],
    action: (_, { openEditProfileDialog: open }) => open(),
  },
  // Camp section
  {
    id: "open-settings",
    category: "camp",
    label: "Settings",
    keywords: ["camp", "settings", "light", "dark", "farcaster"],
    action: (_, { openSettingsDialog: open }) => open(),
  },
];

const CommandPalette = () => {
  const navigate = useNavigate();
  const theme = useTheme();

  const { isOpen, setOpen } = useContext(CommandPaletteContext);

  const { open: openTreasuryDialog } = useDialog("treasury");
  const { open: openAccountDialog } = useDialog("account");
  const { open: openEditProfileDialog } = useDialog("profile-edit");
  const { open: openSettingsDialog } = useDialog("settings");
  const { open: openDraftsDialog } = useDialog("drafts");

  const [eagerInputValue, setInputValue] = useState("");
  const inputValue = React.useDeferredValue(eagerInputValue);

  const isLoading = eagerInputValue !== inputValue;

  const { contains } = useFilter({ sensitivity: "base" });

  // Load data from store
  const proposals = useProposals({ state: true });
  const candidatesAndTopics = useProposalCandidates({
    includeCanceled: true,
    includePromoted: false,
    includeProposalUpdates: false,
  });
  const { items: proposalDrafts } = useDrafts();
  const { nameByAddress: primaryEnsNameByAddress } = useEnsCache();

  // Process candidates and topics
  const { candidates = [], topics = [] } = useMemo(
    () =>
      candidatesAndTopics.reduce(
        (acc, c) => {
          if (c.latestVersion == null) return acc;
          return c.latestVersion?.type === "topic"
            ? { ...acc, topics: [...acc.topics, c] }
            : { ...acc, candidates: [...acc.candidates, c] };
        },
        { candidates: [], topics: [] },
      ),
    [candidatesAndTopics],
  );

  // Handlers for keyboard shortcuts
  useKeyboardShortcuts(
    {
      "$mod+k": (e) => {
        e.preventDefault();
        setOpen((isOpen) => !isOpen);
      },
      Escape: (e) => {
        if (!isOpen) return;
        e.preventDefault();
        setOpen(false);
      },
    },
    { enabled: true, capture: true },
  );

  // Filter commands based on input value
  const filteredCommands = React.useMemo(() => {
    const query = inputValue.toLowerCase().trim();
    if (query === "") return commands;
    return commands.filter((cmd) => {
      // Check if command label matches input
      if (contains(cmd.label, query)) return true;

      // Check if any keyword matches input
      if (
        cmd.keywords &&
        cmd.keywords.some((keyword) => contains(keyword, query))
      )
        return true;

      return false;
    });
  }, [contains, inputValue]);

  const searchQuery = inputValue.trim().toLowerCase();

  const searchResults = React.useMemo(() => {
    if (searchQuery === "") return [];
    const dataset = {
      proposals,
      proposalDrafts,
      candidates,
      topics,
      primaryEnsNameByAddress,
    };
    return performSearch(dataset, searchQuery);
  }, [
    searchQuery,
    proposals,
    proposalDrafts,
    candidates,
    topics,
    primaryEnsNameByAddress,
  ]);

  const menuSections = useMemo(() => {
    const searchItems = searchResults.map((r) => {
      switch (r.type) {
        case "account":
        case "draft":
        case "proposal": {
          const type = r.type;
          const id = [type, r.data.id].join("-");
          return { id, type, label: r.data.title ?? r.data.name };
        }
        case "candidate": {
          const type =
            r.data.latestVersion?.type === "topic" ? "topic" : "candidate";
          const id = [type, r.data.id].join("-");
          return { id, type, label: r.data.latestVersion?.content.title };
        }
        default:
          throw new Error(`Unrecognized result type: ${r.type}`);
      }
    });

    const searchItemsByCategory = arrayUtils.groupBy(
      (i) => categoryBySearchResultType[i.type] || "other",
      searchItems,
    );

    const commandItemsByCategory = arrayUtils.groupBy(
      (i) => i.category,
      filteredCommands,
    );

    const orderedCategories =
      searchItems.length > 0
        ? [
            "accounts",
            "drafts",
            "proposals",
            "topics",
            "candidates",
            "connected-account",
            "dao",
            "camp",
            "other",
          ]
        : [
            "accounts",
            "drafts",
            "proposals",
            "topics",
            "candidates",
            "connected-account",
            "dao",
            "camp",
            "other",
          ];

    return orderedCategories.reduce((sections, category) => {
      const searchItems = searchItemsByCategory[category] ?? [];
      const commandItems = commandItemsByCategory[category] ?? [];
      const items = [...commandItems, ...searchItems.slice(0, 5)];
      if (items.length === 0) return sections;
      return [...sections, { id: category, children: items }];
    }, []);
  }, [searchResults, filteredCommands]);

  return (
    <Dialog
      isOpen={isOpen}
      height="min(80vh, 60rem)"
      onRequestClose={() => {
        setOpen(false);
        setInputValue("");
      }}
      background="transparent"
      trayBackground={theme.colors.dialogBackground}
    >
      <div
        data-loading={isLoading || undefined}
        css={(t) =>
          css({
            flex: 0,
            maxHeight: "100%",
            display: "flex",
            flexDirection: "column",
            background: t.colors.dialogBackground,
            borderRadius: "0.8rem",
            containerType: "inline-size",

            ".small": { fontSize: t.text.sizes.small },
            ".italic": { fontStyle: "italic" },
            ".dimmed": { color: t.colors.textDimmed },
            ".muted": { color: t.colors.textMuted },
            ".truncate": {
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            },
            ".wide-only": {
              display: "none",
              "@container (min-width: 56rem)": {
                display: "inline",
              },
            },

            ".search-field": {
              display: "grid",
              gridTemplateAreas: '"input clear-button"',
              gridTemplateColumns: "minmax(0,1fr) auto",
              borderBottom: "0.1rem solid",
              borderColor: t.colors.borderLighter,
              ".search-input": {
                gridArea: "input",
                display: "block",
                width: "100%",
                outline: "none",
                border: 0,
                background: "none",
                padding: "1.6rem 2rem",
                borderRadius: "0.6rem",
                fontSize: t.text.sizes.large,
                lineHeight: 1.25,
                "&::-webkit-search-cancel-button, &::-webkit-search-decoration":
                  {
                    WebkitAppearance: "none",
                  },
              },
              ".clear-button": {
                gridArea: "clear-button",
                aspectRatio: "1",
                textAlign: "center",
                color: t.colors.textDimmed,
                cursor: "pointer",
                transition: "0.2s opacity ease-out, 0.1s color",
                "@media(hover: hover)": {
                  ":hover": {
                    color: t.colors.textNormal,
                  },
                },
              },
              "&[data-empty] .clear-button": {
                opacity: 0,
              },
            },

            '[role="menu"]': {
              flex: 1,
              minHeight: 0,
              overflow: "auto",
              padding: "0.6rem",
              transition: "0.1s opacity",

              ".section-title": {
                fontSize: t.text.sizes.small,
                fontWeight: t.text.weights.normal,
                color: t.colors.textDimmed,
                padding: "1.6rem 1.4rem 1.2rem",
                lineHeight: 1.25,
                position: "sticky",
                top: "-1.2rem",
                background: `linear-gradient(180deg, ${t.colors.dialogBackground} 50%, transparent 100%)`,
              },

              '[role="menuitem"]': {
                padding: "1.1rem 1.4rem",
                outline: "none",
                borderRadius: "0.6rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",

                "&[data-focused],&[data-selected]": {
                  backgroundColor: t.colors.backgroundModifierNormal,
                },

                ".prop-tag": {
                  color: t.colors.textDimmed,
                  padding: "0 0.4rem",
                  fontSize: t.text.sizes.tiny,
                  display: "inline-block",
                  lineHeight: 1.65,
                  verticalAlign: "text-top",
                  background: t.colors.backgroundModifierNormal,
                  borderRadius: "0.4rem",
                  fontVariantNumeric: "tabular-nums",
                  marginRight: "0.6rem",
                },
              },

              ".empty-state": {
                textAlign: "center",
                padding: "3.2rem 1.6rem",
                color: t.colors.textDimmed,
              },
            },
            '[data-loading] [role="menu"]': {
              opacity: 0.6,
            },
          })
        }
      >
        <Autocomplete
          inputValue={eagerInputValue}
          onInputChange={(value) => {
            setInputValue(value);
          }}
        >
          <SearchField className="search-field" aria-label="Navigate Camp">
            <Input
              autoFocus
              placeholder="Navigate Camp…"
              className="search-input"
            />
            <Button className="clear-button">
              <CrossIcon
                style={{ width: "1.8rem", height: "auto", margin: "auto" }}
              />
            </Button>
          </SearchField>
          <Menu
            items={menuSections}
            onAction={(key) => {
              if (key.startsWith("proposal-")) {
                const id = key.split("proposal-")[1];
                navigate(`/proposals/${id}`);
              } else if (key.startsWith("draft-")) {
                const id = key.split("draft-")[1];
                navigate(`/new/proposal?draft=${id}`);
              } else if (key.startsWith("candidate-")) {
                const id = key.split("candidate-")[1];
                navigate(`/candidates/${id}`);
              } else if (key.startsWith("topic-")) {
                const id = key.split("topic-")[1];
                navigate(`/topics/${id}`);
              } else if (key.startsWith("account-")) {
                const id = key.split("account-")[1];
                navigate(`/voters/${id}`);
              } else {
                const selectedCommand = commands.find((cmd) => cmd.id === key);
                if (selectedCommand == null) return;
                selectedCommand.action(navigate, {
                  openTreasuryDialog,
                  openAccountDialog,
                  openEditProfileDialog,
                  openDraftsDialog,
                  openSettingsDialog,
                });
              }

              setOpen(false);
            }}
            renderEmptyState={() => (
              <div className="empty-state">No results</div>
            )}
          >
            {(section) => {
              const sectionName = categoryNameByKey[section.id];

              return (
                <MenuSection id={section.id}>
                  {sectionName != null && (
                    <Header className="section-title">{sectionName}</Header>
                  )}
                  <Collection items={section.children}>
                    {(item) => {
                      switch (item.type) {
                        case "account": {
                          const accountId = item.id.split("-")[1];
                          return (
                            <MenuItem id={item.id}>
                              <AccountMenuItem address={accountId} />
                            </MenuItem>
                          );
                        }
                        case "proposal": {
                          const proposalId = item.id.split("-")[1];
                          return (
                            <MenuItem id={item.id}>
                              <ProposalMenuItem proposalId={proposalId} />
                            </MenuItem>
                          );
                        }
                        case "candidate":
                        case "topic": {
                          const id = item.id.slice(item.id.indexOf("-") + 1);
                          return (
                            <MenuItem id={item.id}>
                              <CandidateOrTopicMenuItem candidateId={id} />
                            </MenuItem>
                          );
                        }
                        default:
                          return <MenuItem id={item.id}>{item.label}</MenuItem>;
                      }
                    }}
                  </Collection>
                </MenuSection>
              );
            }}
          </Menu>
        </Autocomplete>
      </div>
    </Dialog>
  );
};

const ProposalMenuItem = ({ proposalId }) => {
  const proposal = useProposal(proposalId);
  const proposerDisplayName = useAccountDisplayName(proposal.proposerId);
  return (
    <div
      css={css({
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) auto",
        gap: "0.8rem",
      })}
    >
      <div className="truncate">
        <span className="prop-tag">
          <span className="wide-only">Prop </span>
          {proposalId}
        </span>
        {/* <span className="muted">{" – "}</span> */}
        {proposal.title}
      </div>
      <div className="small dimmed">{proposerDisplayName}</div>
    </div>
  );
};

const CandidateOrTopicMenuItem = ({ candidateId }) => {
  const candidate = useProposalCandidate(candidateId);
  const proposerDisplayName = useAccountDisplayName(candidate.proposerId);
  // const isTopic = candidate?.latestVersion?.type === "topic";
  // const thisYear =
  //   getDateYear(candidate.createdTimestamp) === getDateYear(new Date());
  return (
    <div
      css={css({
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) auto",
        gap: "0.8rem",
      })}
    >
      <div className="truncate">{candidate.latestVersion?.content.title}</div>
      <div className="small dimmed">
        {/* <span className="italic muted wide-only">
          <FormattedDateWithTooltip
            relativeDayThreshold={5}
            value={candidate.createdTimestamp}
            day={thisYear ? "numeric" : undefined}
            month="short"
            year={thisYear ? undefined : "numeric"}
          />
          <span className="muted">{" – "}</span>
        </span> */}
        {proposerDisplayName}
      </div>
    </div>
  );
};

const AccountMenuItem = ({ address: accountAddress }) => {
  const delegate = useDelegate(accountAddress);
  const ensName = useEnsName(accountAddress);
  const truncatedAddress = ethereumUtils.truncateAddress(accountAddress);
  const displayName = ensName ?? truncatedAddress;
  const votingPower = delegate?.nounsRepresented.length;
  const hasDisplayName = displayName !== truncatedAddress;

  return (
    <div
      css={css({
        display: "grid",
        gridTemplateColumns: "auto minmax(0,1fr) auto",
        gap: "0.8rem",
      })}
    >
      <AccountAvatar address={accountAddress} size="2rem" />
      <div className="truncate">
        {displayName}
        {hasDisplayName && (
          <>
            <span className="muted">{" – "}</span>
            <span className="dimmed">{truncatedAddress}</span>
          </>
        )}
      </div>
      {votingPower > 0 && (
        <div className="small dimmed">
          Representing {votingPower} {votingPower === 1 ? "Noun" : "Nouns"}
        </div>
      )}
    </div>
  );
};

// Provider component that also renders the command palette content
export const CommandPaletteProvider = ({ children }) => {
  const [isOpen, setOpen] = useState(false);

  return (
    <CommandPaletteContext.Provider value={{ isOpen, setOpen }}>
      <CommandPalette />
      {children}
    </CommandPaletteContext.Provider>
  );
};

export default CommandPaletteProvider;

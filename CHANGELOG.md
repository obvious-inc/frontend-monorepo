# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0-alpha.3] - 2024-07-20

### 🚀 Features

- Migrate updates from upstream (#435)

### ⚙️ Miscellaneous Tasks

- *(package)* Modify `postbuild` script command

## [1.2.0-alpha.2] - 2024-07-14

### 🚀 Features

- Migrate updates from upstream (#423)

## [1.2.0-alpha.1] - 2024-07-07

### 🐛 Bug Fixes

- *(landing-screen)* Remove candidate-related filter options

## [1.2.0-alpha.0] - 2024-07-07

### 🚀 Features

- Migrate updates from upstream (#410)

## [1.1.2] - 2024-07-07

### 🐛 Bug Fixes

- Solve some minor issues and update dependencies

## [1.1.1] - 2024-07-03

### ⚙️ Miscellaneous Tasks

- *(dependabot)* Ignore major version updates for eslint
- *(dependabot)* Ignore major updates for @serwist/next
- *(dependabot)* Ignore major updates for @sentry/nextjs

### ◀️ Revert

- *(deps-dev)* Bump eslint from 8.57.0 to 9.6.0 in the eslint group (#393)
- *(deps)* Bump @sentry/nextjs from 7.111.0 to 8.13.0 (#396)
- *(deps)* Bump @serwist/next from 8.4.4 to 9.0.3 (#401)

## [1.1.0] - 2024-07-02

### 🐛 Bug Fixes

- Solve some minor issues and update dependencies

## [1.1.0-beta.47] - 2024-07-02

### 🚀 Features

- *(treasury-dialog)* Add oeth to treasury calculation

## [1.1.0-beta.46] - 2024-07-02

### 🚀 Features

- *(contracts)* Add oeth-token to token list
- *(treasury-dialog)* Add support for oeth token balance

## [1.1.0-beta.45] - 2024-07-01

### 🚀 Features

- Migrate updates from upstream (#390)

## [1.1.0-beta.44] - 2024-07-01

### 🚀 Features

- Migrate updates from upstream (#389)

## [1.1.0-beta.43] - 2024-06-29

### 🚀 Features

- Migrate updates from upstream (#388)

## [1.1.0-beta.42] - 2024-06-26

### 🚀 Features

- *(token-contract)* Add `useTotalSupply` hook

### 🐛 Bug Fixes

- *(dao-contract)* Update `ProposalCreatedWithRequirements` event inputs

### 🚜 Refactor

- Comment out `signers` and `updatePeriodEndBlock` from dao contract inputs
- *(dao-contract)* Replace `adjustedTotalSupply` function with `useTotalSupply` hook
- *(propose-screen)* Disable proposal candidate functionality

## [1.1.0-beta.41] - 2024-06-26

### 🚀 Features

- Migrate updates from upstream (#382)

### ⚙️ Miscellaneous Tasks

- *(nouns-camp)* Ignore local environment files

## [1.1.0-beta.40] - 2024-06-26

### ⚙️ Miscellaneous Tasks

- *(scripts)* Adjust pnpm commands for parallel execution
- *(nouns-camp)* Update start scripts for better compatibility

## [1.1.0-beta.39] - 2024-06-25

### 🚀 Features

- *(proposal-votes-dialog)* Add proposal fetch function
- *(browse-screen)* Add vote overview dialog

### 🚜 Refactor

- *(dao-contract)* Comment out unused variables and arguments

## [1.1.0-beta.38] - 2024-06-25

### 🚀 Features

- Migrate updates from upstream (#377)

### ⚙️ Miscellaneous Tasks

- Add log to fetch Etherscan request URL
- Add console log to contract-info route

### ◀️ Revert

- Add console log to contract-info route
- Add log to fetch Etherscan request URL

## [1.1.0-beta.37] - 2024-06-22

### 🐛 Bug Fixes

- *(store)* Uncomment and implement `fetchProposalsVersions` function
- *(store)* Activate `fetchCandidatesFeedbackPosts` function
- *(store)* Uncomment `proposalCandidates` query
- *(store)* Uncomment `proposalCandidates` query
- *(store)* Enable fetching of proposal candidates from subgraph
- *(store)* Enable fetching of proposal and candidate feedbacks
- *(store)* Include proposal and candidate feedbacks in Id arrays
- *(store)* Correct data fetching in browse screen
- *(store)* Ensure safe navigation for `proposalCandidateVersions`
- *(nouns-subgraph)* Remove server-side cache setting

### 🚜 Refactor

- *(store)* Simplify `candidateId` assignment
- *(store)* Simplify loops in `accountAddresses` generation
- *(store)* Streamline async function calls
- *(store)* Consolidate variable declaration in `fetchBrowseScreenData` method
- *(store)* Simplify array mapping in data fetch functions
- *(nouns-subgraph)* Simplify conditionals and add cache control

## [1.1.0-beta.36] - 2024-06-22

### 🐛 Bug Fixes

- *(store)* Handle null values for `proposalFeedbacks` and `sponsoredProposalCandidates`

## [1.1.0-beta.35] - 2024-06-22

### 🐛 Bug Fixes

- *(store)* Handle null `candidateFeedbacks` in `fetchProposalCandidates`

## [1.1.0-beta.33] - 2024-06-22

### 🐛 Bug Fixes

- *(store)* Handle potential null value in `candidateFeedbacks`

## [1.1.0-beta.32] - 2024-06-22

### 🐛 Bug Fixes

- *(store)* Ensure `proposalCandidates` are defined before mapping

## [1.1.0-beta.31] - 2024-06-22

### 🚜 Refactor

- *(store)* Comment out redundant code for `proposalCandidates`

## [1.1.0-beta.30] - 2024-06-22

### 🚜 Refactor

- *(store)* Simplify `fetchCandidatesFeedbackPosts` function

## [1.1.0-beta.29] - 2024-06-20

### ◀️ Revert

- Comment out fetch operations in store

## [1.1.0-beta.28] - 2024-06-20

### 🚀 Features

- Migrate updates from upstream (#368)

## [1.1.0-beta.27] - 2024-06-20

### 🚀 Features

- Migrate updates from upstream (#367)

### 🚜 Refactor

- Remove candidate submissions from propose screen
- Remove unused `clientId` from dao contract events
- Comment out `adjustedTotalSupply` in nouns-subgraph
- *(store)* Simplify `fetchProposalsVersions` function
- *(store)* Disable `proposalCandidateSignatures` fetch
- *(store)* Disable fetching `proposalCandidates`
- Simplify `fetchCandidatesFeedbackPosts` in store
- *(store)* Comment out `fetchProposalCandidate` function
- *(store)* Enable `fetchProposalCandidate` functionality
- *(store)* Enable `fetchCandidatesFeedbackPosts` function
- Comment out fetch operations in store

### 🎨 Styling

- Remove unused eslint directive

## [1.1.0-beta.26] - 2024-06-19

### 🚀 Features

- Migrate updates from upstream (#365)

### 🐛 Bug Fixes

- *(action-dialog)* Remove usdc from currency options

### 🚜 Refactor

- *(browse-screen)* Comment out candidate functionality
- Disable candidates and sponsored proposals in voter screen
- Disable candidate and propdates filtering options
- Comment out unused functions in action dialog

## [1.1.0-beta.25] - 2024-06-18

### 🚀 Features

- Migrate updates from upstream (#364)

## [1.1.0-beta.24] - 2024-06-18

### 🚀 Features

- Migrate updates from upstream (#362)

## [1.1.0-beta.23] - 2024-06-17

### 🚀 Features

- Migrate updates from upstream (#360)

### 🚜 Refactor

- Update early return condition in `fetchPropdates` functions
- Reorder import statements in address input component

### ⚙️ Miscellaneous Tasks

- Uncomment production environment check

## [1.1.0-beta.22] - 2024-06-11

### 🚀 Features

- Add farcaster accounts route
- Implement farcaster account key generation and management
- Add farcaster candidate casts route

### 🐛 Bug Fixes

- Add runtime for farcaster accounts route
- Add runtime export in farcaster-account-key route
- Add runtime constant to farcaster candidate casts route

### 🚜 Refactor

- Make `reverseResolveEnsAddresses` call async and comment out query execution
- Disable kv usage for account key validation
- Temporarily disable `fetchAccountsWithVerifiedAddress` in api route
- Comment out farcaster account key route code
- Temporary deactivate unused queries for proposal candidates and feedbacks
- Comment out unused code in farcaster candidate casts
- Enable data property in request json extraction

## [1.1.0-beta.21] - 2024-06-11

### 🚀 Features

- Migrate updates from upstream (#354)

## [1.1.0-beta.20] - 2024-06-09

### 🚀 Features

- Migrate updates from upstream (#353)

## [1.1.0-beta.19] - 2024-06-07

### ⚙️ Miscellaneous Tasks

- Create new `FUNDING.json` file (#351)

## [1.1.0-beta.18] - 2024-06-06

### 🐛 Bug Fixes

- Solve some minor issues and update dependencies

## [1.1.0-beta.17] - 2024-06-06

### ⚙️ Miscellaneous Tasks

- Disable `automaticVercelMonitors` in `next.config.js`
- Comment out tracking functionality in event route
- Disable vercel analytics in layout
- Comment out production environment check in layout

## [1.1.0-beta.16] - 2024-06-05

### 🚀 Features

- Add chain specific etherscan endpoint urls

### 🐛 Bug Fixes

- Disable fetching of proposal and candidate feedback

### ⚙️ Miscellaneous Tasks

- Remove `.env.example` file
- Remove `.licrc` configuration file

## [1.1.0-beta.15] - 2024-06-04

### 🚀 Features

- Add farcaster proposal casts route
- Add runtime export to route files

### 🐛 Bug Fixes

- Comment out most functionalities in farcaster proposal casts route

## [1.1.0-beta.14] - 2024-06-04

### 🐛 Bug Fixes

- Disable conditional return in `fetchPropdatesForProposal` function

## [1.1.0-beta.13] - 2024-06-04

### 🚀 Features

- Add route for fetching recent casts

### 🐛 Bug Fixes

- Comment out logics in farcaster casts route

## [1.1.0-beta.12] - 2024-06-04

### ⚙️ Miscellaneous Tasks

- Update packages to use exact versions
- Update package dependencies in pnpm lock file

## [1.1.0-beta.11] - 2024-06-03

### 🐛 Bug Fixes

- Change sorting criteria in proposals

## [1.1.0-beta.10] - 2024-06-03

### 🐛 Bug Fixes

- Modify item sorting method in browse screen

## [1.1.0-beta.9] - 2024-06-03

### 🐛 Bug Fixes

- Change sorting parameter in browse screen component

## [1.1.0-beta.8] - 2024-06-03

### ⚙️ Miscellaneous Tasks

- Add `save-exact` config in `.npmrc`
- Update packages to use exact versions

## [1.1.0-beta.7] - 2024-06-03

### 🐛 Bug Fixes

- Add null check before accessing signers in browse screen

## [1.1.0-beta.6] - 2024-06-03

### 🚜 Refactor

- Add `FarcasterSetupDialog` component
- Add farcaster setup to app provider
- Integrate farcaster state provider into layout
- Add hooks for farcaster usage in nouns camp
- Add farcaster utility functions
- Add farcaster utilities to API
- Add farcaster content filter in settings
- Add farcaster cast filter option in setting
- Add farcaster cast support and enhance UI in activity feed
- Add farcaster hooks and improve browsing experience
- Update `buildFeed` function to include casts and feedback options
- Add support for farcaster comments in proposal candidate screen
- Update proposal screen and remove proposal action form component

## [1.1.0-beta.5] - 2024-06-03

### 🐛 Bug Fixes

- Implement working changes from upstream

### 🚜 Refactor

- Simplify contract address definitions

## [1.1.0-beta.4] - 2024-06-03

### 🚀 Features

- Use constants for `chainId` and contract addresses

### 🐛 Bug Fixes

- Adjust `hasNouns` calculation in account dialog
- Update text color in activity feed component
- Handle null cases for signers in store
- Ensure valid array before assignment of `candidateId` in store
- Comment out delegator checks in store
- Disable chain ID condition in fetchPropdates function

### 🚜 Refactor

- Add erc-2400 utility for creating URIs
- Add `chainId` and `clientId` to `.env` and `env.js` in nouns camp
- Remove `goerli` network configurations in contracts
- Add chain support utils in nouns camp
- Update chain configuration in wagmi config
- Centralize chain ID in contracts module
- Revise the use of `chainId` throughout the code
- Remove unused import in action dialog
- Add `NativeSelect` component
- Replace span with `NativeSelect` for day count selection
- Update code to introduce `useEnsName` hook
- Introduce locally scoped `useAccountDisplayName` hook.
- Introduce `usePublicClient` hook for enhanced modularity
- Introduce `useBlockNumber` hook for localizing block fetches
- Update code to incorporate `useEnsAddress` hook
- Add `ProposalActionForm` component
- Add `fallbackImageUrl` to account avatar
- Update `lineHeight` calculation in activity feed component
- Reorder import statements in promote candidate dialog
- Update `AccountPreviewPopoverTrigger` component and enhance UI
- Add fallback display name and image url to account preview popover
- Update `useEnsAddress` function to `useCustomCacheEnsAddress`
- Remove `chainId` dependency from components
- Simplify account comparison in voters
- Add client incentives rewards proxy to contracts
- Add abi parameter formatting to action dialog
- Rearrange import order in noun preview popover trigger
- Simplify dao contract hooks and add clientId to proposals
- Refactor data contract hooks to use constant chainId
- Filter votes and enhance proposals feed
- Update transaction stringifying and parsing
- Update voter screen for search params and URL change
- Improve voters clarity and remove redundant code
- Simplify subgraph URL mapping in `next.config.js`
- Export graphql fragments in nouns subgraph
- Remove `chainId` parameter from nouns subgraph
- Clean up and simplify code of nouns subgraph
- Update propdates subgraph queries and chainId checks
- Improve merging of entities and required data fetching in store
- Comment out incompatible query blocks in store
- Update code comments in nouns subgraph

### 📚 Documentation

- Remove `README.md` for nouns camp app

### ⚙️ Miscellaneous Tasks

- Suppress source map uploading logs during build
- Add chain ID environment variable to build workflow
- Add camp client ID to workflow environment variables
- Simplify environment variables in GitHub actions
- Update reference for subgraph URLs in build workflow
- Change chain id source in build workflow
- Add sentry configuration to build workflow
- Add Sentry tokens to Github action config

## [1.1.0-beta.3] - 2024-06-01

### 🐛 Bug Fixes

- Improve common package components and hooks

### 🚜 Refactor

- Add qrcode to the web ui package
- Add farcaster gate to the web ui icons
- Add some utility functions to common package and improve fetch
- Add hint to form dialog on web ui package
- Improve avatar on web ui package

## [1.1.0-beta.2] - 2024-06-01

### 🐛 Bug Fixes

- Disable block timestamp fields on brows account screen query

### 🚜 Refactor

- Update `fetchConfig` function in `layout.js`

### ⚙️ Miscellaneous Tasks

- Add `.vercel` to `.gitignore` in nouns camp app
- Enable source map uploading logs in Sentry config

## [1.1.0-beta.1] - 2024-05-31

### 🐛 Bug Fixes

- Disable block timestamp fields on brows account screen query

## [1.1.0-beta.0] - 2024-05-31

### 🐛 Bug Fixes

- Solve some minor issues and update dependencies

## [1.1.0-alpha.6] - 2024-05-31

### 🐛 Bug Fixes

- Solve issue with cast votes (#324)

## [1.1.0-alpha.5] - 2024-05-31

### ◀️ Revert

- Add infura as wagmi fallback provider

## [1.1.0-alpha.4] - 2024-05-31

### 🐛 Bug Fixes

- Add infura as wagmi fallback provider

## [1.1.0-alpha.3] - 2024-05-31

### ◀️ Revert

- Migrate updates from upstream (#308)

## [1.1.0-alpha.2] - 2024-05-31

### ◀️ Revert

- Migrate updates from upstream (#308)

## [1.1.0-alpha.1] - 2024-05-30

### 🐛 Bug Fixes

- Solve some minor issues and update dependencies

## [1.1.0-alpha.0] - 2024-05-29

### 🚀 Features

- Migrate updates from upstream (#308)
- Add new native select component
- Add farcaster hooks and utils and components
- Add fallback image and display name for account
- Migrate updates from upstream (#314)

### 🐛 Bug Fixes

- Replace missing delegator id by noun owner id

### 🚜 Refactor

- Update workspace packages to the recent versions

## [1.0.0-alpha.51] - 2024-05-19

### 🐛 Bug Fixes

- Update general dependencies (#303)
- Update contracts on main net and test nets

## [1.0.0-alpha.50] - 2024-05-18

### 🚀 Features

- Migrate updates from upstream (#301)

## [1.0.0-alpha.49] - 2024-05-08

### ⚙️ Miscellaneous Tasks

- Solve build id issue on next configs

## [1.0.0-alpha.48] - 2024-05-08

### 🚀 Features

- Migrate updates from upstream (#298)

## [1.0.0-alpha.47] - 2024-05-02

### 🚀 Features

- Migrate updates from upstream (#294)

## [1.0.0-alpha.46] - 2024-04-29

### 🚀 Features

- Migrate updates from upstream (#292)

### ⚙️ Miscellaneous Tasks

- Add node version 22.x to the build workflow matrix
- Improve Git Cliff configs and update changelog

### ◀️ Revert

- Migrate camp ESLint config from old format to the latest
- Migrate root ESLint config from old format to the latest
- Bump eslint from 9.0.0 to 9.1.1 in the eslint group (#278)`
- Bump eslint from 8.57.0 to 9.0.0 in the eslint group (#247)
- Solve wallet hook issue with config

## [1.0.0-alpha.45] - 2024-04-27

### 🚜 Refactor

- Comment unavailable query fields on proposals page
- Solve wallet hook issue with config
- Comment unavailable query fields on subgraph

### ⚙️ Miscellaneous Tasks

- Cleanup useless settings from Next configs

## [1.0.0-alpha.44] - 2024-04-27

### 🚀 Features

- Migrate updates from upstream (#286)

## [1.0.0-alpha.43] - 2024-04-26

### ⚙️ Miscellaneous Tasks

- Add node version 21.x to the build workflow matrix
- Migrate camp ESLint config from old format to the latest
- Migrate root ESLint config from old format to the latest

## [1.0.0-alpha.42] - 2024-04-23

### ⚙️ Miscellaneous Tasks

- Add `preinstall` to prevent devs from using other package managers
- Change pnpm version from ^8 to ^9 on engines
- Move Sentry settings from Next.js to environmental variables

## [1.0.0-alpha.41] - 2024-04-23

### 🐛 Bug Fixes

- Solve some minor issues and update dependencies

## [1.0.0-alpha.40] - 2024-04-18

### 🐛 Bug Fixes

- Solve query issues for delegate and transfer events
- Solve query issues for votes on accounts screen
- Solve null check on undefined properties

## [1.0.0-alpha.39] - 2024-04-18

### 🚀 Features

- Migrate updates from upstream (#268)

## [1.0.0-alpha.38] - 2024-04-18

### 🐛 Bug Fixes

- Solve some minor issues and update dependencies

## [1.0.0-alpha.37] - 2024-04-03

### 🚀 Features

- Migrate updates from upstream (#241)

### 🐛 Bug Fixes

- Update open auction url on layout component

## [1.0.0-alpha.35] - 2024-03-22

### 🚀 Features

- Migrate updates from upstream (#219)

### ◀️ Revert

- Bump the next group with 2 updates (#216)

## [1.0.0-alpha.34] - 2024-03-11

### 🐛 Bug Fixes

- Solve missing null issue on proposer id on browser screen

### ⚙️ Miscellaneous Tasks

- Add `dev` and `start` scripts the root package

## [1.0.0-alpha.33] - 2024-03-11

### 🐛 Bug Fixes

- Solve some minor issues and update dependencies

## [1.0.0-alpha.32] - 2024-03-03

### 🚀 Features

- Migrate updates from upstream (#181)

## [1.0.0-alpha.31] - 2024-03-03

### 🐛 Bug Fixes

- Solve issue related to call `toLowerCase` on null account
- Solve proposal item rendering issues
- Solve proposal item rendering issues

### ⚙️ Miscellaneous Tasks

- Update git ignored files to include `.wrangler`

### ◀️ Revert

- Bump the next group with 2 updates (#178)

## [1.0.0-alpha.30] - 2024-03-02

### 🚀 Features

- Migrate updates from upstream (#179)

## [1.0.0-alpha.29] - 2024-02-28

### 🚀 Features

- Migrate updates from upstream (#173)

### 🐛 Bug Fixes

- Update links to the token pages over Lil Nouns site
- Update Agora links for Lil Nouns site

## [1.0.0-alpha.28] - 2024-02-24

### 🚀 Features

- Migrate updates from upstream (#169)

## [1.0.0-alpha.27] - 2024-02-22

### 🐛 Bug Fixes

- Solve some minor issues and update dependencies

## [1.0.0-alpha.26] - 2024-02-22

### 🚀 Features

- Migrate updates from upstream (#163)
- Migrate to lilnouns contracts (#145)

### 📚 Documentation

- Update `README.md` file to improve description and messages (#164)

## [1.0.0-alpha.25] - 2024-02-19

### 🚀 Features

- Refactor codebase based on upstream

## [1.0.0-alpha.24] - 2024-02-19

### 🚀 Features

- Migrate from webpack to nextjs (#118)

## [1.0.0-alpha.23] - 2024-02-19

### 🐛 Bug Fixes

- Solve some minor issues and update dependencies

## [1.0.0-alpha.22] - 2024-02-10

### 🚀 Features

- Refactor codebase based on upstream (#117)

## [1.0.0-alpha.21] - 2024-02-10

### 🚀 Features

- Refactor codebase based on upstream (#116)

## [1.0.0-alpha.20] - 2024-02-10

### 🚀 Features

- Refactor codebase based on upstream (#115)

## [1.0.0-alpha.19] - 2024-02-10

### 🚀 Features

- Refactor codebase based on upstream (#114)

## [1.0.0-alpha.18] - 2024-02-07

### 🐛 Bug Fixes

- Solve some minor issues and update dependencies

## [1.0.0-alpha.17] - 2024-02-04

### 🚀 Features

- Migrate updates from upstream (#102)

## [1.0.0-alpha.16] - 2024-02-04

### 🚀 Features

- Migrate updates from upstream (#94)

## [1.0.0-alpha.15] - 2024-01-26

### 🐛 Bug Fixes

- Solve some minor issues and update dependencies

## [1.0.0-alpha.14] - 2024-01-23

### 🚀 Features

- Implement recent changes from upstream (#85)

## [1.0.0-alpha.13] - 2024-01-19

### ⚙️ Miscellaneous Tasks

- Add group of dependencies to Dependabot configs

## [1.0.0-alpha.12] - 2024-01-13

### 🚀 Features

- Update upstream changes to develop (#64)

## [1.0.0-alpha.11] - 2024-01-13

### 🐛 Bug Fixes

- Solve some minor issues and update dependencies

## [1.0.0-alpha.10] - 2024-01-11

### 🐛 Bug Fixes

- Solve some minor issues and update dependencies

## [1.0.0-alpha.9] - 2024-01-10

### 🐛 Bug Fixes

- Solve some minor issues and update dependencies

## [1.0.0-alpha.8] - 2024-01-10

### 📚 Documentation

- Add a new badge for Wakatime to the `README.md`

### ⚙️ Miscellaneous Tasks

- Add missing `version` to `package.json`

## [1.0.0-alpha.7] - 2024-01-08

### 🚀 Features

- Implement upstream branch changes (#50)

## [1.0.0-alpha.6] - 2024-01-07

### ⚙️ Miscellaneous Tasks

- Create new workflow for handling git flow pull requests
- Update workflow files for better readability
- Add missing permissions for git flow pull requests

### ◀️ Revert

- Bump viem from 1.21.4 to 2.0.0 (#41)

## [1.0.0-alpha.5] - 2024-01-04

### 📚 Documentation

- Add new badge for Farcaster on project readme file

## [1.0.0-alpha.4] - 2024-01-02

### ⚙️ Miscellaneous Tasks

- Migrate to new major version of `tinykeys`

## [1.0.0-alpha.3] - 2024-01-02

### ⚙️ Miscellaneous Tasks

- Add new configuration file for Licensebot

## [1.0.0-alpha.2] - 2024-01-01

### 📚 Documentation

- Create a new `README.md` for the project

## [1.0.0-alpha.1] - 2024-01-01

### 📚 Documentation

- Add feature request and bug report templates and config
- Add GitHub sponsor configs for the project

### ⚙️ Miscellaneous Tasks

- Cleanup useless apps that not related to project
- Remove useless project readme file
- Remove useless packages from the project
- Add `dist` folders to project root `.gitignore` file
- Add Dependabot configuration file
- Add stale bot configuration for GitHub
- Replace `prepare-packages` by `build` script
- Add a new GitHib workflow for build project
- Add missing environmental variables to build workflow
- Add a new test script to project root package
- Add engines configuration to the root package
- Add a new example file for environmental variables

### ◀️ Revert

- Bump tinykeys from 1.4.0 to 2.1.0 (#16)

<!-- generated by git-cliff -->

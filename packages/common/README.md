# @shades/common

This is where we put JavaScript we want to share between clients.

## Development setup

Clone the repo and install dependencies with:

```sh
# You have to run this from the repo root folder
npm install -w @shades/common
```

Why the `-w @shades/common`? Read up on npm workspaces [here](https://docs.npmjs.com/cli/v8/using-npm/workspaces).

When developing you probably want to rebuild when source files change. There’a command for that:

```sh
npm start -w @shades/common
```

## Build setup

Build a bundle with:

```sh
npm run build -w @shades/common
```

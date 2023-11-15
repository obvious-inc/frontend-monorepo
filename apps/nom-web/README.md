# NOM web

This is the home of the NOM web and desktop client.

Some desktop builds can be found on [the release page](https://github.com/NewShadesDAO/front/releases), but until we get automatic updates going the easiest way to follow along is to access the regular web app on [app.nom.xyz](https://app.nom.xyz).

## Introduction

_NOM web_ is a [`React`](https://reactjs.org/) web app, using a thin [`Electron`](https://www.electronjs.org/) wrapper to build for desktop. The details might change quickly but at the time of writing we bundle our Javascript with [`webpack`](https://webpack.js.org/), transpile with [`SWC`](https://swc.rs/); and package, make distributals, and publish our desktop builds with [`Electron Forge`](https://www.electronforge.io/).

## Development setup

Make sure you have [`Node.js`](https://nodejs.org/en/) and [`NPM`](https://www.npmjs.com/) installed, preferrably through a version manager, like [`nvm`](https://github.com/nvm-sh/nvm), [`fnm`](https://github.com/Schniz/fnm), or [`n`](https://github.com/tj/n).

Clone the repo and install dependencies with:

```sh
# You have to run this from the repo root folder
npm install -w desktop
```

Why the `-w desktop`? Read up on npm workspaces [here](https://docs.npmjs.com/cli/v8/using-npm/workspaces).

Copy `.env.template` and tweak the config as you wish. By default the app is setup to talk to our staging API at [staging-api.newshades.xyz](https://staging-api.newshades.xyz/). For more info on how to run the API locally, check out the repo [NewShadesDAO/api](https://github.com/obvious-inc/api).

```sh
cp packages/desktop/.env.template packages/desktop/.env
```

Start a local dev server with:

```sh
npm run start-web -w desktop
```

By default this expects the [NOM API](https://github.com/obvious-inc/api) to be running on `localhost:5001`, but you can override that with an environment variable `API_ENDPOINT` if you like:

```sh
API_ENDPOINT=https://api.newshades.xyz npm run start-web
```

Start the desktop client with:

```sh
# This expects the dev server described above to be running
npm run start-desktop -w desktop
```

Note that you only have to run the desktop client when building Electron related features, in most cases just running the web client is enough.

## Deployment

`HEAD` of `main` is automatically deployed to [app.now.xyz](https://app.now.xyz) with [Vercel](https://vercel.com/).

Desktop builds are currently manual.

## Contributing

We’re just getting started and things are still rather messy, but we’d love your help if you’re up for it! Pull requests are welcome, but the best place to start right now is probably the [#development channel](https://discord.com/channels/913721755670040587/929759842682429490) on the [NewShades Discord](https://discord.com/invite/2jy5A5h63H).

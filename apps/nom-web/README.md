# NOM web

Project live at [app.nom.wtf](https://app.nom.wtf).

## Development setup

Make sure you have [`Node.js`](https://nodejs.org/en/) and [`PNPM`](https://pnpm.io/) installed, preferrably through a version manager, like [`nvm`](https://github.com/nvm-sh/nvm), [`fnm`](https://github.com/Schniz/fnm), or [`n`](https://github.com/tj/n).

Clone the repo and install dependencies with:

```sh
pnpm -F nom-web install
```

Copy `.env.template` and tweak the config as you wish.

```sh
cp packages/desktop/.env.template packages/desktop/.env
```

Start a local dev server with:

```sh
pnpm -F nom-web dev
```

By default this talks to our staging api, but you can override that with `API_ENDPOINT` in `.env`, or:

```sh
API_ENDPOINT=https://api.newshades.xyz/ pnpm -F nom-web dev
```

## Deployment

`HEAD` of `main` is automatically deployed to [app.nom.wtf](https://app.nom.wtf) with [Vercel](https://vercel.com/).

Desktop builds are currently manual.

## Contributing

We’re just getting started and things are still rather messy, but we’d love your help if you’re up for it! Pull requests are welcome, but the best place to start right now is probably the [#NOM build](https://app.nom.wtf/channels/62b804a4a1af5d8cf1732cb2) channel.

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
cp apps/nom-web/.env.template apps/nom-web/.env
```

Start a local dev server with:

```sh
pnpm -F nom-web dev
```

By default the app talks to the production api, but you can override that with `API_BASE_URL` in `.env`, or:

```sh
API_BASE_URL=http://localhost:3000 pnpm -F nom-web dev
```

## Deployment

`HEAD` of `main` is automatically deployed to [app.nom.wtf](https://app.nom.wtf) with [Vercel](https://vercel.com/).

## Contributing

Pull requests are welcome, but the best place to start is probably the [#NOM build](https://app.nom.wtf/channels/62b804a4a1af5d8cf1732cb2) channel.

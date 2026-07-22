# Jabulani Express · ReLife - Trade-In Calculator

Static single-page trade-in value calculator. The core component is
`jabulani-relife-tradein.jsx` (exported from a Claude artifact - kept unmodified
so it can be re-synced if the owner updates the artifact). The Vite + React +
Tailwind scaffold around it exists only to build the page for static hosting.

## Updating prices / FX rate

All supplier cost prices and the USD rate live at the top of
`jabulani-relife-tradein.jsx` (see the comment block for Afeez / Yasir).
Edit, commit, push - the site redeploys automatically.

## Local dev (Docker - nothing installs on the host)

```sh
docker compose up dev              # dev server at http://localhost:5173
docker compose run --rm build      # production build -> dist/
```

## Deploy - DigitalOcean App Platform (static site)

1. Push this directory to a GitHub repo (`main` branch).
2. DO dashboard -> Apps -> Create App -> connect the repo, or
   `doctl apps create --spec .do/app.yaml` (update the `repo:` field first).
3. Confirm resource type is **Static Site**, build command
   `npm install && npm run build`, output dir `dist`.
4. Static sites are free on the Starter tier (3 per account).
5. Add the custom domain under the app's Settings -> Domains.

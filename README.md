# Myadeen course watcher

A Cloudflare Worker (`worker/`) checks myadeen.com every 2 minutes for new
"Rami Aman" (رامي امن) courses and open seats, and sends a phone push through
ntfy. It has no public web address; it only runs on its schedule.

- `worker/src/check.js`: the comparison logic (tested in `worker/test/`)
- `worker/src/index.js`: the Worker: fetch, compare, push, save state in KV
- `.github/workflows/deploy.yml`: on changes to `worker/` on `main`, runs the
  tests, then deploys with Wrangler to the `production` environment

Secrets (GitHub): `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit only),
`CLOUDFLARE_ACCOUNT_ID`, `NTFY_TOPIC`.

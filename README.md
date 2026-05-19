# imgbed

A self-hosted image host on Cloudflare Workers + R2. Single Worker, KV-backed
state, optional Workers AI moderation. No build step, no external services.

[![Live demo](https://img.shields.io/badge/demo-imgbed.minis233.workers.dev-a78bfa)](https://imgbed.minis233.workers.dev/)
![License](https://img.shields.io/badge/license-MIT-22c55e)

## Features

- **Drag / paste / multi-file upload** — public page with copy-to-clipboard URLs (raw / Markdown / HTML / BBCode).
- **Modern glass UI** — mesh gradient background, dark-first with light-mode auto-switch.
- **HTTPS only** — `http://` is 308-redirected to `https://`, every HTML response sets HSTS preload.
- **Burn after read** — 10s ~ 600s window starting at the first real viewer's hit. Preview crawlers (Telegram, Discord, WhatsApp, Twitter, Slack, etc.) get a 1×1 placeholder so social-media unfurls don't trip the timer.
- **TTL expiry** — optional. Default is **permanent**; choose 1h / 1d / 7d / 30d / 90d / 1y when needed.
- **Workers AI moderation** — optional, runs async (~minute) after upload via `@cf/llava-hf/llava-1.5-7b-hf`. Violations auto-delete the object and (optionally) ban the uploader IP.
- **Admin dashboard** — at `/<META_KV_ID>/<ADMIN_TOKEN>` (URL-secret using your KV namespace id as the path prefix). Lists every object with uploader IP, manual recheck, manual ban/unban, settings toggle.
- **R2 + KV only** — no D1, no DO. Runs on Cloudflare's free tier.

## Deploy

### 1. Clone and install

```bash
git clone https://github.com/Minis233/imgbed
cd imgbed
npm install
```

### 2. Create the R2 bucket and KV namespace

```bash
npx wrangler r2 bucket create imgbed
npx wrangler kv namespace create META
```

Wrangler prints something like:

```
🌀 Creating namespace with title "META"
✨ Success!
[[kv_namespaces]]
binding = "META"
id      = "042c0ed735b84a4b87dddb6958d74b64"
```

Copy that `id` and paste it into **two** places in `wrangler.toml`:

```toml
[vars]
META_KV_ID = "042c0ed735b84a4b87dddb6958d74b64"   # ← paste here

[[kv_namespaces]]
binding = "META"
id      = "042c0ed735b84a4b87dddb6958d74b64"      # ← and here
```

(They have to match — the second is the actual binding, the first is what the
Worker reads at runtime to build the admin URL prefix, since KV bindings don't
expose their id.)

### 3. Set the secrets

These are **required** — without them the admin panel and (when `ALLOW_PUBLIC=false`) uploads will refuse to work:

```bash
# Required: a long random string used as the admin URL token.
# 32+ chars recommended. Generate one with: openssl rand -hex 24
npx wrangler secret put ADMIN_TOKEN

# Required only when [vars].ALLOW_PUBLIC = "false" — the bearer token uploaders must send.
npx wrangler secret put UPLOAD_TOKEN
```

> Tip: secrets aren't in `wrangler.toml`. Run `npx wrangler secret list` to confirm
> what's configured. To rotate the admin URL, run `wrangler secret put ADMIN_TOKEN`
> again — the path immediately changes on the next deploy.

### 4. Deploy

```bash
npx wrangler deploy
```

After deploy, browse:

- `https://<your-worker>.workers.dev/` — upload page
- `https://<your-worker>.workers.dev/<META_KV_ID>/<ADMIN_TOKEN>/` — admin dashboard

Custom domain: uncomment `[[routes]]` in `wrangler.toml` once your zone is on the same Cloudflare account, then redeploy.

## Configuration

Edit `wrangler.toml` `[vars]` (re-deploy applies changes):

| Variable | Default | Meaning |
| --- | --- | --- |
| `MAX_SIZE_MB` | `20` | Per-file size cap |
| `ALLOW_PUBLIC` | `true` | If `false`, uploads need `Authorization: Bearer $UPLOAD_TOKEN` |
| `ALLOWED_MIME` | `image/png,image/jpeg,image/webp,...` | Comma-separated MIME allow-list |
| `PUBLIC_BASE` | (empty) | Override URL base for `markdown`/`html` outputs |
| `META_KV_ID` | (paste your namespace id) | First segment of the admin URL — keep matched to `[[kv_namespaces]].id` |

| Secret | Required? | Meaning |
| --- | --- | --- |
| `ADMIN_TOKEN` | **yes** | Second segment of the admin URL. Without it the admin panel is disabled (responds 404). |
| `UPLOAD_TOKEN` | only when `ALLOW_PUBLIC="false"` | Bearer token clients send to `/api/upload`. |

AI moderation is toggled at runtime from the admin dashboard (Settings tab).

## Endpoints

### Public

| Method | Path | Purpose |
| --- | --- | --- |
| `GET`  | `/` | Upload page |
| `POST` | `/api/upload` | multipart/form-data; fields: `file`, optional `burn` (sec), `expiry` (sec) |
| `GET`/`HEAD` | `/i/<key>` | Serve image (Range, ETag/304, lazy-delete on burn/expiry) |
| `GET`  | `/api/status/<key>` | JSON status: moderation state + remaining burn seconds |
| `GET`  | `/healthz` | `ok` |

Curl example:

```bash
curl -F "file=@cat.jpg" -F "burn=60" https://<your>/api/upload
```

### Admin (`/<META_KV_ID>/<ADMIN_TOKEN>` prefix)

| Method | Path | Purpose |
| --- | --- | --- |
| `GET`    | `/api/list?cursor=&limit=` | Object list with IP, UA, moderation, burn/expiry |
| `DELETE` | `/api/object/<key>` | Force delete |
| `GET`/`POST`/`DELETE` | `/api/bans[...]` | List / add / remove IP ban |
| `GET`/`POST` | `/api/settings` | Toggle AI moderation, auto-ban-on-violation |
| `POST`   | `/api/recheck` | `{ "key": "..." }` — re-run moderation immediately |

## Design notes

- **Storage layout** — R2 keys are `YYYYMMDD/<8-byte-hex>.<ext>`. `customMetadata` stores `sha256`, `originalName`, `uploadedAt`, `ip`, `userAgent`, `burnSeconds`, `expiresAt`.
- **State (KV)** — `settings`, `ban:<ip>`, `burn:<key>` (first-view timestamp), `mod:<key>` (moderation result).
- **Burn semantics** — KV record is created on the *first* successful GET that isn't a preview crawler. Subsequent viewers see remaining time in `X-Burn-Seconds-Remaining`. After the window elapses, the next request 410s and lazy-deletes both the R2 object and the KV record.
- **Anti-preview** — burn images served to known unfurl/crawler/prefetch UAs (or requests with `Sec-Purpose: prefetch`) get a 1×1 placeholder PNG plus `X-Robots-Tag: noindex, nofollow, noarchive, noimageindex, nosnippet` and `Cache-Control: no-store`. The timer never starts. Real browsers see the real image.
- **HTTPS** — non-https requests are 308-redirected; all HTML responses set HSTS preload.
- **Moderation** — runs in `ctx.waitUntil(...)` so the upload responds immediately. The image is publicly viewable while pending. If Llava's first whitespace-trimmed token is `VIOLATION`, the worker deletes the R2 object and (if enabled) bans the uploader IP. Errors return `status: "error"` and leave the image alone.
- **Admin auth** — secret is in the URL path, not headers, so the dashboard is shareable as a single link. Pages get `X-Robots-Tag: noindex,nofollow` and `Cache-Control: no-store`.

## License

MIT. See [LICENSE](LICENSE).

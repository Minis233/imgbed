# imgbed

> 跑在 Cloudflare Workers + R2 上的极简自托管图床。零依赖、单 Worker、内置仪表盘。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Minis233/imgbed)

## 特性

- **一个 Worker 跑全部** — 静态 HTML 仪表盘 + 上传 / 列表 / 删除 API + 图片直链全在 `src/index.js`，没有数据库。
- **R2 直存** — 图片存进 Cloudflare R2，按 `YYYYMMDD/<random>.<ext>` 分目录，10% 冷热成本，免下行流量费。
- **拖拽 / 粘贴 / 多选上传** — 仪表盘支持拖拽、`Ctrl+V` 粘贴、多文件并发，自动复制 Markdown / HTML / BBCode。
- **强缓存** — 直链命中 Cloudflare 边缘，`Cache-Control: public, max-age=31536000, immutable`，并支持 Range 请求。
- **Token 鉴权** — `UPLOAD_TOKEN` 控制上传，`ADMIN_TOKEN` 控制图库管理；也可开匿名上传。
- **MIME 白名单 + 大小限制** — 默认拒绝非图片，单文件 ≤ 20 MB（可改）。
- **零依赖** — 纯 Web Crypto / Workers Runtime，没有任何 npm 运行时依赖。

## 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 仪表盘（HTML） |
| GET | `/i/<key>` | 图片直链（公开） |
| POST | `/api/upload` | 上传图片（multipart `file` 或裸 body） |
| GET | `/api/list?cursor=&prefix=&limit=` | 列表（admin） |
| DELETE | `/api/object/<key>` | 删除（admin） |
| GET | `/healthz` | 健康检查 |

## 部署

需要 Node 18+ 和已开通 R2 的 Cloudflare 账号。

```bash
git clone https://github.com/Minis233/imgbed.git
cd imgbed
npm install
npx wrangler login           # 第一次部署需要

# 创建 R2 bucket（名字与 wrangler.toml 一致）
npx wrangler r2 bucket create imgbed

# 设置 Token（管理员密码，自己选一个长一点的）
npx wrangler secret put UPLOAD_TOKEN
# 可选：单独的图库管理 token；不设则与 UPLOAD_TOKEN 相同
npx wrangler secret put ADMIN_TOKEN

# 部署
npx wrangler deploy
```

部署完成后会拿到 `https://imgbed.<your-subdomain>.workers.dev`，打开 → 设置页粘贴 token → 上传。

### 自定义域名

在 Cloudflare 同账号下解析任意域，把 `wrangler.toml` 里的 `[[routes]]` 段取消注释、改成你的域名，再 `wrangler deploy`，自动建 DNS + 签 SSL。

```toml
[[routes]]
pattern = "img.example.com"
custom_domain = true
```

## 配置

`wrangler.toml` 里 `[vars]` 节：

| 变量 | 默认 | 说明 |
|------|------|------|
| `MAX_SIZE_MB` | `20` | 单文件最大 MB |
| `ALLOW_PUBLIC` | `false` | `true` 时允许匿名上传 |
| `ALLOWED_MIME` | `image/png,...` | 上传 MIME 白名单（逗号分隔） |
| `PUBLIC_BASE` | 空 | 强制使用某个 base URL（CDN 直连场景） |

Secrets：

| 名字 | 必填 | 说明 |
|------|------|------|
| `UPLOAD_TOKEN` | `ALLOW_PUBLIC=false` 时必填 | 上传鉴权 |
| `ADMIN_TOKEN` | 选填 | 图库管理；不设则 = `UPLOAD_TOKEN` |

## 命令行用法

```bash
# 上传
curl -H "Authorization: Bearer $TOKEN" \
     -F "file=@photo.png" \
     https://imgbed.example.workers.dev/api/upload

# 裸 body 上传（也支持）
curl -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: image/png" \
     -H "X-Filename: photo.png" \
     --data-binary @photo.png \
     https://imgbed.example.workers.dev/api/upload

# 列表
curl -H "Authorization: Bearer $TOKEN" \
     https://imgbed.example.workers.dev/api/list

# 删除
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
     https://imgbed.example.workers.dev/api/object/20260519/abcdef.png
```

返回示例：

```json
{
  "ok": true,
  "key": "20260519/3a7f0c1d8e9f2a5b.png",
  "url": "https://img.example.com/i/20260519/3a7f0c1d8e9f2a5b.png",
  "markdown": "![](https://img.example.com/i/20260519/3a7f0c1d8e9f2a5b.png)",
  "html": "<img src=\"https://img.example.com/i/20260519/3a7f0c1d8e9f2a5b.png\" alt=\"\" />",
  "bbcode": "[img]https://img.example.com/i/20260519/3a7f0c1d8e9f2a5b.png[/img]",
  "size": 12345,
  "contentType": "image/png",
  "sha256": "..."
}
```

## 开发

```bash
npm run dev    # wrangler dev (本地 http://127.0.0.1:8787)
npm run deploy # wrangler deploy
```

## 成本

Workers free tier：100k requests/day。R2 free tier：10GB 存储 + 1M Class A + 10M Class B 每月。**R2 出站到公网零费用**，是当下最划算的图床后端。

## License

MIT — 见 [LICENSE](LICENSE)。

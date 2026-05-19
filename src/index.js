// imgbed — Cloudflare Workers + R2 image host with AI moderation, IP ban,
// burn-after-read, and TTL.
//
// Public routes:
//   GET    /                     -> upload UI (HTML)
//   POST   /api/upload           -> upload (multipart/form-data field "file")
//   GET|HEAD /i/<key>            -> serve image (handles burn/expiry/ban-of-image)
//   GET    /api/status/<key>     -> public moderation status (so uploader UI can poll)
//   GET    /healthz              -> ok
//
// Admin (gated by /<META_KV_ID>/<ADMIN_TOKEN> URL prefix; see isAdminPath):
//   GET    /<KV>/<T>/             -> admin dashboard HTML
//   GET    /<KV>/<T>/api/list     -> JSON list of objects + status + uploader ip
//   DELETE /<KV>/<T>/api/object/<key>
//   GET    /<KV>/<T>/api/bans
//   POST   /<KV>/<T>/api/bans     -> { ip, reason? }
//   DELETE /<KV>/<T>/api/bans/<ip>
//   GET    /<KV>/<T>/api/settings
//   POST   /<KV>/<T>/api/settings -> { aiModeration?, banAutoOnViolation? }

import { renderUploadPage } from "./ui.js";
import { renderAdminPage } from "./admin-ui.js";
import {
  getSettings, putSettings,
  isBanned, banIp, unbanIp, listBans,
  getBurnState, startBurn,
  getModeration,
} from "./store.js";
import { moderateImage } from "./moderation.js";

const TEXT = { "content-type": "text/plain; charset=utf-8" };
const JSON_H = { "content-type": "application/json; charset=utf-8" };

// 1x1 transparent PNG, served to preview crawlers so burn timers don't trip
// when a link is auto-unfurled by Telegram / Discord / WhatsApp / etc.
const PLACEHOLDER_PNG = Uint8Array.from([
  0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,
  0x00,0x00,0x00,0x0d,0x49,0x48,0x44,0x52,0x00,0x00,0x00,0x01,
  0x00,0x00,0x00,0x01,0x08,0x06,0x00,0x00,0x00,0x1f,0x15,0xc4,
  0x89,0x00,0x00,0x00,0x0d,0x49,0x44,0x41,0x54,0x78,0x9c,0x63,
  0x00,0x01,0x00,0x00,0x05,0x00,0x01,0x0d,0x0a,0x2d,0xb4,0x00,
  0x00,0x00,0x00,0x49,0x45,0x4e,0x44,0xae,0x42,0x60,0x82,
]);

// Match common link-preview / unfurl crawlers and prefetchers. Real browsers
// don't include any of these tokens in their UA.
const BOT_RE = /(bot|crawl|spider|fetch(er)?|preview|unfurl|scrape|monitor|check|index|archive|googlebot|bingbot|baiduspider|yandex|sogou|duckduckbot|telegrambot|whatsapp|skypeuripreview|facebookexternalhit|twitterbot|discordbot|slackbot|linkedinbot|embedly|iframely|outlookhostmail|microsoftpreview|applebot|pinterest|redditbot|qq\/?|qqbrowserbot|tencentbot|miuibrowser|wechat|weixin|line\/|node-?fetch|python-?requests|httpie|axios|go-http-client|okhttp|java\/)/i;

function looksLikePreviewBot(req) {
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  // RFC 9110 / Chrome speculative loads — any of these mean "not a real eyeball view".
  const purpose = (req.headers.get("sec-purpose") || req.headers.get("purpose") || "").toLowerCase();
  if (purpose.includes("prefetch") || purpose.includes("prerender")) return true;
  if (!ua) return true; // empty UA — probably a script
  return BOT_RE.test(ua);
}

const EXT_BY_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/bmp": "bmp",
};

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    "access-control-allow-headers": "authorization, content-type, x-filename",
    "access-control-max-age": "86400",
  };
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { ...JSON_H, ...corsHeaders(), ...(init.headers || {}) },
  });
}
const err = (s, m) => json({ ok: false, error: m }, { status: s });

function getClientIp(req) {
  return req.headers.get("cf-connecting-ip")
      || req.headers.get("x-real-ip")
      || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim()
      || "0.0.0.0";
}

function isAdminPath(env, pathname) {
  // Admin URL = /<META_KV_ID>/<ADMIN_TOKEN>/...
  // The KV namespace id is in wrangler.toml [[kv_namespaces]].id; mirror it via the
  // META_KV_ID var so the worker can read it (KV bindings don't expose .id).
  const kvId = (env.META_KV_ID || "").replace(/^\/+|\/+$/g, "");
  const adminToken = env.ADMIN_TOKEN || "";
  if (!kvId || !adminToken) return null;
  const prefix = `/${kvId}/${adminToken}`;
  if (pathname === prefix || pathname === prefix + "/" || pathname.startsWith(prefix + "/")) {
    return { prefix, sub: pathname.slice(prefix.length) || "/" };
  }
  return null;
}

function pickExt(contentType, name) {
  if (name && /\.[a-z0-9]{1,8}$/i.test(name)) return name.split(".").pop().toLowerCase();
  return EXT_BY_MIME[contentType] || "bin";
}

function randomKey(ext) {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  const id = Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${yyyy}${mm}${dd}/${id}.${ext}`;
}

async function sha256Hex(buf) {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("");
}

function publicBase(req, env) {
  if (env.PUBLIC_BASE) return env.PUBLIC_BASE.replace(/\/+$/, "");
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}

function buildUrls(req, env, key) {
  const base = publicBase(req, env);
  const url = `${base}/i/${key}`;
  return { key, url, markdown: `![](${url})`, html: `<img src="${url}" alt="" />`, bbcode: `[img]${url}[/img]` };
}

function safeKey(rawKey) {
  const k = decodeURIComponent(rawKey || "").replace(/^\/+/, "");
  if (!k || k.includes("..") || k.includes("\\") || k.length > 512) return null;
  return k;
}

// ---------- public upload ----------

async function handleUpload(req, env, ctx) {
  const ip = getClientIp(req);
  const banned = await isBanned(env, ip);
  if (banned) return err(403, `ip banned: ${banned.reason || "manual"}`);

  const settings = await getSettings(env);
  const allowPublic = env.ALLOW_PUBLIC === "true";
  if (!allowPublic) {
    // Still gated by Authorization if not public
    const auth = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
    if (!auth || !env.UPLOAD_TOKEN || auth[1].trim() !== env.UPLOAD_TOKEN) {
      return err(401, "unauthorized");
    }
  }

  const ct = req.headers.get("content-type") || "";
  const maxBytes = (parseInt(env.MAX_SIZE_MB || "20", 10) || 20) * 1024 * 1024;
  const allowed = (env.ALLOWED_MIME || "").split(",").map((s) => s.trim()).filter(Boolean);

  let body, fileType, originalName, burnSec = 0, expirySec = 0;

  if (ct.startsWith("multipart/form-data")) {
    const fd = await req.formData();
    const f = fd.get("file");
    if (!(f instanceof File)) return err(400, "missing 'file' field");
    fileType = f.type || "application/octet-stream";
    originalName = f.name || "";
    body = await f.arrayBuffer();
    burnSec = parseInt(fd.get("burn") || "0", 10) || 0;
    expirySec = parseInt(fd.get("expiry") || "0", 10) || 0;
  } else {
    fileType = ct || "application/octet-stream";
    originalName = req.headers.get("x-filename") || "";
    body = await req.arrayBuffer();
    burnSec = parseInt(req.headers.get("x-burn-seconds") || "0", 10) || 0;
    expirySec = parseInt(req.headers.get("x-expiry-seconds") || "0", 10) || 0;
  }

  if (!body || body.byteLength === 0) return err(400, "empty body");
  if (body.byteLength > maxBytes) return err(413, `file too large (max ${maxBytes} bytes)`);
  if (allowed.length && !allowed.includes(fileType)) return err(415, `unsupported type: ${fileType}`);

  // Clamp burn 10s..600s, expiry 1min..30d
  if (burnSec) burnSec = Math.max(10, Math.min(600, burnSec));
  if (expirySec) expirySec = Math.max(60, Math.min(60 * 60 * 24 * 30, expirySec));

  const ext = pickExt(fileType, originalName);
  const digest = await sha256Hex(body);
  const key = randomKey(ext);
  const expiresAt = expirySec ? Date.now() + expirySec * 1000 : 0;

  const customMetadata = {
    sha256: digest,
    originalName: originalName.slice(0, 200),
    uploadedAt: new Date().toISOString(),
    ip,
    userAgent: (req.headers.get("user-agent") || "").slice(0, 200),
    burnSeconds: String(burnSec),
    expiresAt: String(expiresAt),
  };

  await env.BUCKET.put(key, body, {
    httpMetadata: {
      contentType: fileType,
      cacheControl: burnSec ? "private, no-store, no-cache, must-revalidate" : "public, max-age=31536000, immutable",
    },
    customMetadata,
  });

  // Kick off async moderation in the background.
  if (settings.aiModeration) {
    ctx.waitUntil(moderateImage(env, key, body, ip));
  }

  return json({
    ok: true,
    size: body.byteLength,
    contentType: fileType,
    sha256: digest,
    moderation: settings.aiModeration ? "pending" : "disabled",
    burnSeconds: burnSec,
    expiresAt,
    ...buildUrls(req, env, key),
  });
}

// ---------- serve ----------

async function handleServe(req, env, ctx, rawKey) {
  const key = safeKey(rawKey);
  if (!key) return err(400, "bad key");
  const isHead = req.method === "HEAD";
  const isBot = looksLikePreviewBot(req);

  // Cheap head first to read metadata.
  const head = await env.BUCKET.head(key);
  if (!head) return new Response("not found", { status: 404, headers: TEXT });

  const meta = head.customMetadata || {};
  const expiresAt = parseInt(meta.expiresAt || "0", 10) || 0;
  const burnSec = parseInt(meta.burnSeconds || "0", 10) || 0;

  // TTL expiry — lazy delete then 410
  if (expiresAt && Date.now() >= expiresAt) {
    ctx.waitUntil(env.BUCKET.delete(key));
    return new Response("expired", { status: 410, headers: TEXT });
  }

  // Anti-preview: for burn images, refuse to serve real bytes to crawlers
  // and don't start the timer. Send a tiny placeholder PNG so the unfurl
  // doesn't error out, but with no-preview hints.
  if (burnSec > 0 && isBot && !isHead) {
    const headers = new Headers({
      "content-type": "image/png",
      "cache-control": "private, no-store, no-cache, must-revalidate",
      "x-robots-tag": "noindex, nofollow, noarchive, noimageindex, nosnippet",
      "referrer-policy": "no-referrer",
      "x-imgbed-burn": "preview-blocked",
      "content-length": String(PLACEHOLDER_PNG.byteLength),
    });
    return new Response(PLACEHOLDER_PNG, { status: 200, headers });
  }

  // Burn-after-read window — start the timer on first non-HEAD viewer.
  let burnState = null;
  if (burnSec > 0) {
    burnState = await getBurnState(env, key);
    if (!isHead && !isBot && !burnState) {
      burnState = await startBurn(env, key, burnSec);
    }
    if (burnState) {
      const elapsed = (Date.now() - burnState.firstSeenAt) / 1000;
      if (elapsed >= burnState.durationSec) {
        ctx.waitUntil(env.BUCKET.delete(key));
        ctx.waitUntil(env.META.delete(`burn:${key}`));
        return new Response("burned", { status: 410, headers: TEXT });
      }
    }
  }

  // Range
  const range = req.headers.get("range");
  let opts = {};
  if (range && !isHead) {
    const m = range.match(/bytes=(\d*)-(\d*)/);
    if (m) {
      const offset = m[1] ? parseInt(m[1], 10) : undefined;
      const end = m[2] ? parseInt(m[2], 10) : undefined;
      opts.range = { offset, length: end !== undefined && offset !== undefined ? end - offset + 1 : undefined };
    }
  }

  // ETag conditional GET
  const ifNoneMatch = req.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === head.httpEtag && !burnSec) {
    return new Response(null, { status: 304, headers: { etag: head.httpEtag } });
  }

  if (isHead) {
    const headers = new Headers();
    head.writeHttpMetadata(headers);
    headers.set("etag", head.httpEtag);
    headers.set("content-length", String(head.size));
    headers.set("accept-ranges", "bytes");
    return new Response(null, { status: 200, headers });
  }

  const obj = await env.BUCKET.get(key, opts);
  if (!obj) return new Response("not found", { status: 404, headers: TEXT });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("content-length", String(obj.range ? obj.range.length : obj.size));
  if (burnSec) {
    headers.set("cache-control", "private, no-store, no-cache, must-revalidate");
    headers.set("x-robots-tag", "noindex, nofollow, noarchive, noimageindex, nosnippet");
    headers.set("referrer-policy", "no-referrer");
    if (burnState) {
      const remaining = Math.max(0, burnState.durationSec - Math.floor((Date.now() - burnState.firstSeenAt) / 1000));
      headers.set("x-burn-seconds-remaining", String(remaining));
    } else {
      headers.set("x-burn-seconds-remaining", String(burnSec));
    }
  } else if (!headers.get("cache-control")) {
    headers.set("cache-control", "public, max-age=31536000, immutable");
  }
  if (obj.range) {
    headers.set("content-range", `bytes ${obj.range.offset}-${obj.range.offset + obj.range.length - 1}/${obj.size}`);
  }
  return new Response(obj.body, { status: range && obj.range ? 206 : 200, headers });
}

async function handleStatus(req, env, rawKey) {
  const key = safeKey(rawKey);
  if (!key) return err(400, "bad key");
  const head = await env.BUCKET.head(key);
  if (!head) {
    // Maybe deleted by moderation
    const mod = await getModeration(env, key);
    return json({ ok: true, exists: false, moderation: mod || null });
  }
  const mod = await getModeration(env, key);
  const meta = head.customMetadata || {};
  const burnSec = parseInt(meta.burnSeconds || "0", 10) || 0;
  const expiresAt = parseInt(meta.expiresAt || "0", 10) || 0;
  let burn = null;
  if (burnSec) {
    const b = await getBurnState(env, key);
    if (b) burn = { firstSeenAt: b.firstSeenAt, durationSec: b.durationSec, remaining: Math.max(0, b.durationSec - Math.floor((Date.now() - b.firstSeenAt) / 1000)) };
  }
  const settings = await getSettings(env);
  return json({
    ok: true,
    exists: true,
    moderation: mod || (settings.aiModeration ? { status: "pending" } : null),
    burnSeconds: burnSec,
    expiresAt,
    burn,
  });
}

// ---------- admin ----------

async function adminApi(req, env, sub) {
  const url = new URL(req.url);

  if (sub === "/api/list" && req.method === "GET") {
    const cursor = url.searchParams.get("cursor") || undefined;
    const prefix = url.searchParams.get("prefix") || undefined;
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "60", 10) || 60, 1000);
    const r = await env.BUCKET.list({ cursor, prefix, limit, include: ["customMetadata", "httpMetadata"] });
    const base = publicBase(req, env);
    const objects = await Promise.all(r.objects.map(async (o) => {
      const mod = await getModeration(env, o.key);
      const meta = o.customMetadata || {};
      const burnSec = parseInt(meta.burnSeconds || "0", 10) || 0;
      const expiresAt = parseInt(meta.expiresAt || "0", 10) || 0;
      let burn = null;
      if (burnSec) {
        const b = await getBurnState(env, o.key);
        if (b) burn = { firstSeenAt: b.firstSeenAt, durationSec: b.durationSec };
      }
      return {
        key: o.key,
        size: o.size,
        uploaded: o.uploaded,
        contentType: o.httpMetadata?.contentType || null,
        sha256: meta.sha256 || null,
        originalName: meta.originalName || null,
        ip: meta.ip || null,
        userAgent: meta.userAgent || null,
        burnSeconds: burnSec,
        expiresAt,
        burn,
        moderation: mod || null,
        url: `${base}/i/${o.key}`,
      };
    }));
    return json({ ok: true, truncated: r.truncated, cursor: r.truncated ? r.cursor : null, objects });
  }

  if (sub.startsWith("/api/object/") && req.method === "DELETE") {
    const key = safeKey(sub.slice("/api/object/".length));
    if (!key) return err(400, "bad key");
    await env.BUCKET.delete(key);
    await env.META.delete(`mod:${key}`);
    await env.META.delete(`burn:${key}`);
    return json({ ok: true, deleted: key });
  }

  if (sub === "/api/bans" && req.method === "GET") {
    return json({ ok: true, bans: await listBans(env) });
  }

  if (sub === "/api/bans" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    if (!body.ip) return err(400, "missing ip");
    await banIp(env, body.ip, { reason: body.reason || "manual" });
    return json({ ok: true });
  }

  if (sub.startsWith("/api/bans/") && req.method === "DELETE") {
    const ip = decodeURIComponent(sub.slice("/api/bans/".length));
    await unbanIp(env, ip);
    return json({ ok: true });
  }

  if (sub === "/api/settings" && req.method === "GET") {
    return json({ ok: true, settings: await getSettings(env) });
  }

  if (sub === "/api/settings" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const patch = {};
    if (typeof body.aiModeration === "boolean") patch.aiModeration = body.aiModeration;
    if (typeof body.banAutoOnViolation === "boolean") patch.banAutoOnViolation = body.banAutoOnViolation;
    return json({ ok: true, settings: await putSettings(env, patch) });
  }

  if (sub === "/api/recheck" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const key = safeKey(body.key || "");
    if (!key) return err(400, "bad key");
    const obj = await env.BUCKET.get(key);
    if (!obj) return err(404, "not found");
    const buf = await obj.arrayBuffer();
    const head = await env.BUCKET.head(key);
    const ip = head?.customMetadata?.ip || null;
    const info = await moderateImage(env, key, buf, ip);
    return json({ ok: true, moderation: info });
  }

  return err(404, "not found");
}

// ---------- entrypoint ----------

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const { pathname } = url;

    // Force HTTPS — Cloudflare puts the original scheme in cf-visitor; if a
    // client (or share-sheet) hits http://, send them to https:// before
    // anything else runs.
    let scheme = url.protocol.replace(":", "");
    const cfVisitor = req.headers.get("cf-visitor");
    if (cfVisitor) {
      const m = cfVisitor.match(/"scheme":"(https?)"/i);
      if (m) scheme = m[1].toLowerCase();
    } else if (req.headers.get("x-forwarded-proto")) {
      scheme = req.headers.get("x-forwarded-proto").toLowerCase();
    }
    if (scheme !== "https") {
      const target = "https://" + url.host + url.pathname + url.search;
      return new Response(null, {
        status: 308,
        headers: { location: target, "strict-transport-security": "max-age=63072000; includeSubDomains; preload" },
      });
    }

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // Admin gate (URL contains the secret token)
    const admin = isAdminPath(env, pathname);
    if (admin) {
      const sub = admin.sub;
      if ((req.method === "GET" || req.method === "HEAD") && (sub === "/" || sub === "")) {
        const html = renderAdminPage(env, admin.prefix);
        return new Response(req.method === "HEAD" ? null : html, {
          headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex, nofollow", "cache-control": "private, no-store" },
        });
      }
      if (sub.startsWith("/api/")) return adminApi(req, env, sub);
    }

    if (req.method === "GET" && pathname === "/healthz") {
      return new Response("ok", { headers: TEXT });
    }

    if ((req.method === "GET" || req.method === "HEAD") && (pathname === "/" || pathname === "/index.html")) {
      const html = renderUploadPage(env);
      return new Response(req.method === "HEAD" ? null : html, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
        },
      });
    }

    if ((req.method === "GET" || req.method === "HEAD") && pathname.startsWith("/i/")) {
      return handleServe(req, env, ctx, pathname.slice(3));
    }

    if (req.method === "GET" && pathname.startsWith("/api/status/")) {
      return handleStatus(req, env, pathname.slice("/api/status/".length));
    }

    if (req.method === "POST" && pathname === "/api/upload") {
      return handleUpload(req, env, ctx);
    }

    return err(404, "not found");
  },
};

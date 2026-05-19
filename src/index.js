// imgbed — Cloudflare Workers + R2 image host
// Routes:
//   GET  /                    -> dashboard (HTML)
//   POST /api/upload          -> upload image (multipart/form-data field "file" or raw body)
//   GET  /api/list?cursor=&prefix=  -> list objects (admin)
//   DELETE /api/object/<key>  -> delete (admin)
//   GET  /i/<key>             -> serve image (public, cached on edge)
//
// Secrets (set via `wrangler secret put`):
//   UPLOAD_TOKEN  — required to upload unless ALLOW_PUBLIC="true"
//   ADMIN_TOKEN   — required to list / delete (defaults to UPLOAD_TOKEN if unset)

import { renderDashboard } from "./ui.js";

const TEXT_HEADERS = { "content-type": "text/plain; charset=utf-8" };
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

const EXT_BY_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "image/x-icon": "ico",
};

function corsHeaders(origin) {
  return {
    "access-control-allow-origin": origin || "*",
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    "access-control-allow-headers": "authorization, content-type, x-filename",
    "access-control-max-age": "86400",
  };
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { ...JSON_HEADERS, ...corsHeaders(), ...(init.headers || {}) },
  });
}

function err(status, message) {
  return json({ ok: false, error: message }, { status });
}

function bearer(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function isUploadAllowed(req, env) {
  if (env.ALLOW_PUBLIC === "true") return true;
  const t = bearer(req);
  return !!(t && env.UPLOAD_TOKEN && t === env.UPLOAD_TOKEN);
}

function isAdmin(req, env) {
  const t = bearer(req);
  if (!t) return false;
  const admin = env.ADMIN_TOKEN || env.UPLOAD_TOKEN;
  return !!(admin && t === admin);
}

function pickExt(contentType, name) {
  if (name && /\.[a-z0-9]{1,8}$/i.test(name)) {
    return name.split(".").pop().toLowerCase();
  }
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

async function sha256Hex(arrBuf) {
  const h = await crypto.subtle.digest("SHA-256", arrBuf);
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
  return {
    key,
    url,
    markdown: `![](${url})`,
    html: `<img src="${url}" alt="" />`,
    bbcode: `[img]${url}[/img]`,
  };
}

function safeKey(rawKey) {
  // Normalize incoming keys: strip leading slashes, reject ".." segments.
  const k = decodeURIComponent(rawKey || "").replace(/^\/+/, "");
  if (!k || k.includes("..") || k.includes("\\")) return null;
  if (k.length > 512) return null;
  return k;
}

async function handleUpload(req, env) {
  if (!isUploadAllowed(req, env)) return err(401, "unauthorized");

  const ct = req.headers.get("content-type") || "";
  const maxBytes = (parseInt(env.MAX_SIZE_MB || "20", 10) || 20) * 1024 * 1024;
  const allowed = (env.ALLOWED_MIME || "").split(",").map((s) => s.trim()).filter(Boolean);

  let body;
  let fileType;
  let originalName;

  if (ct.startsWith("multipart/form-data")) {
    const fd = await req.formData();
    const f = fd.get("file");
    if (!(f instanceof File)) return err(400, "missing 'file' field");
    fileType = f.type || "application/octet-stream";
    originalName = f.name || "";
    body = await f.arrayBuffer();
  } else {
    fileType = ct || "application/octet-stream";
    originalName = req.headers.get("x-filename") || "";
    body = await req.arrayBuffer();
  }

  if (!body || body.byteLength === 0) return err(400, "empty body");
  if (body.byteLength > maxBytes) return err(413, `file too large (max ${maxBytes} bytes)`);

  // MIME allow-list
  if (allowed.length && !allowed.includes(fileType)) {
    return err(415, `unsupported type: ${fileType}`);
  }

  const ext = pickExt(fileType, originalName);
  const digest = await sha256Hex(body);
  const key = randomKey(ext);

  await env.BUCKET.put(key, body, {
    httpMetadata: {
      contentType: fileType,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      sha256: digest,
      originalName: originalName.slice(0, 200),
      uploadedAt: new Date().toISOString(),
    },
  });

  return json({
    ok: true,
    size: body.byteLength,
    contentType: fileType,
    sha256: digest,
    ...buildUrls(req, env, key),
  });
}

async function handleServe(req, env, rawKey) {
  const key = safeKey(rawKey);
  if (!key) return err(400, "bad key");

  // Range support
  const range = req.headers.get("range");
  let opts = {};
  if (range) {
    const m = range.match(/bytes=(\d*)-(\d*)/);
    if (m) {
      const offset = m[1] ? parseInt(m[1], 10) : undefined;
      const end = m[2] ? parseInt(m[2], 10) : undefined;
      opts.range = { offset, length: end !== undefined && offset !== undefined ? end - offset + 1 : undefined };
    }
  }

  const isHead = req.method === "HEAD";
  const obj = isHead
    ? await env.BUCKET.head(key)
    : await env.BUCKET.get(key, opts);
  if (!obj) return new Response("not found", { status: 404, headers: TEXT_HEADERS });

  // ETag conditional GET
  const ifNoneMatch = req.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === obj.httpEtag) {
    return new Response(null, { status: 304, headers: { etag: obj.httpEtag } });
  }

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  if (!headers.get("cache-control")) {
    headers.set("cache-control", "public, max-age=31536000, immutable");
  }
  headers.set("accept-ranges", "bytes");
  headers.set("content-length", String(obj.size));

  if (isHead) {
    return new Response(null, { status: 200, headers });
  }

  if (obj.range) {
    headers.set(
      "content-range",
      `bytes ${obj.range.offset}-${obj.range.offset + obj.range.length - 1}/${obj.size}`
    );
    headers.set("content-length", String(obj.range.length));
  }

  return new Response(obj.body, {
    status: range && obj.range ? 206 : 200,
    headers,
  });
}

async function handleList(req, env) {
  if (!isAdmin(req, env)) return err(401, "unauthorized");
  const u = new URL(req.url);
  const cursor = u.searchParams.get("cursor") || undefined;
  const prefix = u.searchParams.get("prefix") || undefined;
  const limit = Math.min(parseInt(u.searchParams.get("limit") || "50", 10) || 50, 1000);

  const res = await env.BUCKET.list({ cursor, prefix, limit, include: ["customMetadata", "httpMetadata"] });
  const base = publicBase(req, env);
  const objects = res.objects.map((o) => ({
    key: o.key,
    size: o.size,
    uploaded: o.uploaded,
    contentType: o.httpMetadata?.contentType || null,
    sha256: o.customMetadata?.sha256 || null,
    originalName: o.customMetadata?.originalName || null,
    url: `${base}/i/${o.key}`,
  }));
  return json({ ok: true, truncated: res.truncated, cursor: res.truncated ? res.cursor : null, objects });
}

async function handleDelete(req, env, rawKey) {
  if (!isAdmin(req, env)) return err(401, "unauthorized");
  const key = safeKey(rawKey);
  if (!key) return err(400, "bad key");
  await env.BUCKET.delete(key);
  return json({ ok: true, deleted: key });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const { pathname } = url;

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // public dashboard
    if ((req.method === "GET" || req.method === "HEAD") && (pathname === "/" || pathname === "/index.html")) {
      const body = renderDashboard(env);
      return new Response(req.method === "HEAD" ? null : body, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    // GET /i/<key>
    if ((req.method === "GET" || req.method === "HEAD") && pathname.startsWith("/i/")) {
      return handleServe(req, env, pathname.slice(3));
    }

    // POST /api/upload
    if (req.method === "POST" && pathname === "/api/upload") {
      return handleUpload(req, env);
    }

    // GET /api/list
    if (req.method === "GET" && pathname === "/api/list") {
      return handleList(req, env);
    }

    // DELETE /api/object/<key>
    if (req.method === "DELETE" && pathname.startsWith("/api/object/")) {
      return handleDelete(req, env, pathname.slice("/api/object/".length));
    }

    // health
    if (req.method === "GET" && pathname === "/healthz") {
      return new Response("ok", { headers: TEXT_HEADERS });
    }

    return err(404, "not found");
  },
};

// Single-file dashboard. Token entered by user is kept in localStorage.
export function renderDashboard(env) {
  const allowPublic = env.ALLOW_PUBLIC === "true";
  const maxMb = parseInt(env.MAX_SIZE_MB || "20", 10) || 20;
  const allowedMime = env.ALLOWED_MIME || "";
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>imgbed · Cloudflare R2 图床</title>
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="20" height="16" x="2" y="4" rx="3" fill="%23f38020"/><circle cx="9" cy="10" r="2" fill="%23fff"/><path d="M3 18l5-6 4 4 3-3 6 7H3z" fill="%23fff"/></svg>'
)}" />
<style>
  :root {
    --bg: #0f172a;
    --bg-soft: #1e293b;
    --surface: rgba(255,255,255,0.04);
    --border: rgba(255,255,255,0.08);
    --text: #e2e8f0;
    --muted: #94a3b8;
    --accent: #f38020;
    --accent-hover: #ff9a3c;
    --danger: #ef4444;
    --success: #22c55e;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: #f8fafc;
      --bg-soft: #ffffff;
      --surface: #ffffff;
      --border: #e2e8f0;
      --text: #0f172a;
      --muted: #475569;
    }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--text);
    font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    min-height: 100vh;
  }
  .wrap { max-width: 960px; margin: 0 auto; padding: 24px 20px 80px; }
  header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
  header .brand { font-size: 20px; font-weight: 700; }
  header .brand .accent { color: var(--accent); }
  header .grow { flex: 1; }
  .pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 10px; border-radius: 999px;
    background: var(--surface); border: 1px solid var(--border);
    font-size: 12px; color: var(--muted);
  }
  .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 14px; padding: 20px; margin-bottom: 16px;
  }
  h2 { margin: 0 0 12px; font-size: 16px; font-weight: 600; }
  label { display: block; font-size: 13px; color: var(--muted); margin-bottom: 6px; }
  input[type=text], input[type=password] {
    width: 100%; padding: 10px 12px; border-radius: 10px;
    background: var(--bg-soft); color: var(--text);
    border: 1px solid var(--border); outline: none;
    font: inherit;
  }
  input:focus { border-color: var(--accent); }
  .row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .row > * { flex: 1; min-width: 0; }
  button {
    appearance: none; border: 0; cursor: pointer;
    background: var(--accent); color: #fff;
    padding: 10px 16px; border-radius: 10px; font: inherit; font-weight: 600;
    transition: background .15s;
  }
  button:hover:not(:disabled) { background: var(--accent-hover); }
  button:disabled { opacity: .5; cursor: not-allowed; }
  button.ghost { background: transparent; color: var(--text); border: 1px solid var(--border); }
  button.danger { background: var(--danger); }
  .drop {
    border: 2px dashed var(--border); border-radius: 12px;
    padding: 36px 20px; text-align: center; color: var(--muted);
    transition: border-color .15s, background .15s; cursor: pointer;
  }
  .drop.hover { border-color: var(--accent); background: rgba(243,128,32,0.08); color: var(--text); }
  .drop p { margin: 6px 0; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
  .item {
    background: var(--bg-soft); border: 1px solid var(--border);
    border-radius: 10px; overflow: hidden; display: flex; flex-direction: column;
    position: relative;
  }
  .item img { width: 100%; height: 120px; object-fit: cover; background: #000; display: block; }
  .item .meta { padding: 6px 8px; font-size: 11px; color: var(--muted); display: flex; justify-content: space-between; gap: 4px; }
  .item .actions {
    position: absolute; top: 6px; right: 6px;
    display: flex; gap: 4px; opacity: 0; transition: opacity .15s;
  }
  .item:hover .actions { opacity: 1; }
  .item .actions button {
    padding: 4px 8px; font-size: 11px; border-radius: 6px;
    background: rgba(0,0,0,0.6); color: #fff; backdrop-filter: blur(4px);
  }
  .item .actions button.danger { background: rgba(239,68,68,0.9); }
  .results { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
  .result {
    background: var(--bg-soft); border: 1px solid var(--border);
    border-radius: 10px; padding: 10px; display: flex; gap: 10px; align-items: center;
  }
  .result img { width: 48px; height: 48px; object-fit: cover; border-radius: 6px; background: #000; }
  .result .urls { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .result code {
    background: var(--surface); padding: 4px 8px; border-radius: 6px;
    font-size: 12px; word-break: break-all; cursor: pointer;
    border: 1px solid var(--border);
  }
  .result code:hover { border-color: var(--accent); }
  .toast {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: var(--bg-soft); color: var(--text); border: 1px solid var(--border);
    padding: 10px 18px; border-radius: 10px; font-size: 13px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    opacity: 0; pointer-events: none; transition: opacity .2s, transform .2s;
  }
  .toast.show { opacity: 1; transform: translateX(-50%) translateY(-6px); }
  footer { margin-top: 32px; text-align: center; font-size: 12px; color: var(--muted); }
  footer a { color: inherit; }
  .tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border); margin-bottom: 16px; }
  .tab {
    padding: 8px 14px; cursor: pointer; border-bottom: 2px solid transparent;
    color: var(--muted); font-size: 14px; user-select: none;
  }
  .tab.active { color: var(--accent); border-bottom-color: var(--accent); }
  .empty { padding: 40px; text-align: center; color: var(--muted); }
  .progress { height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; margin-top: 8px; }
  .progress > div { height: 100%; background: var(--accent); transition: width .2s; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="brand">📸 <span class="accent">imgbed</span></div>
    <div class="grow"></div>
    <span class="pill">最大 ${maxMb} MB</span>
    <span class="pill">${allowPublic ? "🌐 匿名上传" : "🔒 需 Token"}</span>
  </header>

  <div class="tabs">
    <div class="tab active" data-tab="upload">上传</div>
    <div class="tab" data-tab="gallery">图库</div>
    <div class="tab" data-tab="settings">设置</div>
  </div>

  <section data-pane="upload">
    <div class="card">
      <h2>上传图片</h2>
      <div id="drop" class="drop">
        <p style="font-size:24px;margin:0 0 8px">⬆️</p>
        <p><strong>点击选择</strong> 或拖拽图片到这里 / 直接 <strong>粘贴</strong> (Ctrl+V)</p>
        <p style="font-size:12px">支持 ${allowedMime.split(",").map((s) => s.trim().replace(/^image\//, "")).filter(Boolean).join(" / ") || "image/*"}</p>
      </div>
      <input type="file" id="file" accept="image/*" multiple style="display:none" />
      <div class="results" id="results"></div>
    </div>
  </section>

  <section data-pane="gallery" hidden>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:10px;flex-wrap:wrap">
        <h2 style="margin:0">最近上传</h2>
        <button class="ghost" id="refresh">刷新</button>
      </div>
      <div id="gallery" class="grid"></div>
      <div id="gallery-empty" class="empty" hidden>暂无图片，先上传一张试试 ✨</div>
      <div id="gallery-auth" class="empty" hidden>填写 Token 后即可查看图库</div>
      <div style="text-align:center;margin-top:12px">
        <button class="ghost" id="loadmore" hidden>加载更多</button>
      </div>
    </div>
  </section>

  <section data-pane="settings" hidden>
    <div class="card">
      <h2>API Token</h2>
      <p style="color:var(--muted);font-size:13px;margin:0 0 12px">
        通过 <code>wrangler secret put UPLOAD_TOKEN</code> 设置上传 token，<code>ADMIN_TOKEN</code> 用于图库管理（不设则与 UPLOAD_TOKEN 相同）。
      </p>
      <label>Token（仅保存在本地浏览器）</label>
      <div class="row">
        <input type="password" id="token" placeholder="Bearer Token" />
        <button id="save-token" style="flex:0 0 auto">保存</button>
      </div>
    </div>
    <div class="card">
      <h2>命令行用法</h2>
      <p style="color:var(--muted);font-size:13px">curl 上传:</p>
      <pre style="background:var(--bg-soft);padding:10px;border-radius:8px;overflow:auto;font-size:12px"><code>curl -H "Authorization: Bearer $TOKEN" \\
     -F "file=@photo.png" \\
     <span id="curl-base"></span>/api/upload</code></pre>
    </div>
  </section>

  <footer>
    Powered by Cloudflare Workers + R2 · <a href="https://github.com/Minis233/imgbed" target="_blank" rel="noopener">GitHub</a>
  </footer>
</div>

<div class="toast" id="toast"></div>

<script>
  const $ = (s) => document.querySelector(s);
  const tabs = document.querySelectorAll(".tab");
  const panes = document.querySelectorAll("section[data-pane]");
  tabs.forEach((t) => t.addEventListener("click", () => {
    tabs.forEach((x) => x.classList.toggle("active", x === t));
    panes.forEach((p) => p.hidden = p.dataset.pane !== t.dataset.tab);
    if (t.dataset.tab === "gallery") loadGallery(true);
  }));

  $("#curl-base").textContent = location.origin;

  // token mgmt
  const tokenInput = $("#token");
  tokenInput.value = localStorage.getItem("imgbed.token") || "";
  $("#save-token").addEventListener("click", () => {
    localStorage.setItem("imgbed.token", tokenInput.value.trim());
    toast("已保存");
  });
  function getToken() { return localStorage.getItem("imgbed.token") || ""; }
  function authHeaders() {
    const t = getToken();
    return t ? { authorization: "Bearer " + t } : {};
  }

  // toast
  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  // upload
  const drop = $("#drop");
  const fileInput = $("#file");
  drop.addEventListener("click", () => fileInput.click());
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("hover"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("hover"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault(); drop.classList.remove("hover");
    if (e.dataTransfer?.files?.length) uploadFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener("change", () => {
    if (fileInput.files?.length) uploadFiles(fileInput.files);
    fileInput.value = "";
  });
  window.addEventListener("paste", (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files = [];
    for (const it of items) {
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f && f.type.startsWith("image/")) files.push(f);
      }
    }
    if (files.length) uploadFiles(files);
  });

  async function uploadFiles(files) {
    const results = $("#results");
    for (const f of files) {
      const row = document.createElement("div");
      row.className = "result";
      row.innerHTML = \`
        <img src="" alt="" />
        <div class="urls" style="flex:1">
          <div style="font-size:13px">\${escapeHtml(f.name)} · \${formatSize(f.size)}</div>
          <div class="progress"><div style="width:0%"></div></div>
        </div>
      \`;
      results.prepend(row);
      const img = row.querySelector("img");
      const reader = new FileReader();
      reader.onload = (e) => img.src = e.target.result;
      reader.readAsDataURL(f);
      try {
        const res = await uploadOne(f, (p) => row.querySelector(".progress > div").style.width = p + "%");
        renderResult(row, res);
      } catch (err) {
        row.querySelector(".urls").innerHTML = \`<div style="color:var(--danger);font-size:13px">\${escapeHtml(f.name)} 上传失败：\${escapeHtml(err.message)}</div>\`;
      }
    }
  }

  function uploadOne(file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload");
      const t = getToken();
      if (t) xhr.setRequestHeader("authorization", "Bearer " + t);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded / e.total * 100));
      };
      xhr.onload = () => {
        let body;
        try { body = JSON.parse(xhr.responseText); } catch { body = { error: xhr.responseText || "bad response" }; }
        if (xhr.status >= 200 && xhr.status < 300 && body.ok) resolve(body);
        else reject(new Error(body.error || ("HTTP " + xhr.status)));
      };
      xhr.onerror = () => reject(new Error("network error"));
      const fd = new FormData();
      fd.append("file", file);
      xhr.send(fd);
    });
  }

  function renderResult(row, res) {
    row.innerHTML = \`
      <img src="\${res.url}" alt="" />
      <div class="urls">
        <code data-copy="\${res.url}">\${res.url}</code>
        <code data-copy="\${res.markdown}">\${escapeHtml(res.markdown)}</code>
        <code data-copy="\${res.html}">\${escapeHtml(res.html)}</code>
      </div>
    \`;
    row.querySelectorAll("code").forEach((c) => {
      c.addEventListener("click", () => {
        navigator.clipboard.writeText(c.dataset.copy).then(() => toast("已复制"));
      });
    });
  }

  // gallery
  let galleryCursor = null;
  async function loadGallery(reset) {
    const wrap = $("#gallery");
    const empty = $("#gallery-empty");
    const noAuth = $("#gallery-auth");
    const loadmore = $("#loadmore");
    if (!getToken()) {
      wrap.innerHTML = ""; empty.hidden = true; noAuth.hidden = false; loadmore.hidden = true;
      return;
    }
    noAuth.hidden = true;
    if (reset) { wrap.innerHTML = ""; galleryCursor = null; }
    const u = new URL("/api/list", location.origin);
    if (galleryCursor) u.searchParams.set("cursor", galleryCursor);
    u.searchParams.set("limit", "60");
    const r = await fetch(u, { headers: authHeaders() });
    if (!r.ok) { toast("加载失败：" + r.status); return; }
    const body = await r.json();
    if (reset && body.objects.length === 0) { empty.hidden = false; loadmore.hidden = true; return; }
    empty.hidden = true;
    body.objects.forEach((o) => wrap.appendChild(galleryItem(o)));
    galleryCursor = body.cursor;
    loadmore.hidden = !body.truncated;
  }

  function galleryItem(o) {
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = \`
      <img src="\${o.url}" alt="" loading="lazy" />
      <div class="meta">
        <span>\${formatSize(o.size)}</span>
        <span>\${new Date(o.uploaded).toLocaleDateString()}</span>
      </div>
      <div class="actions">
        <button data-act="copy">复制</button>
        <button data-act="md">MD</button>
        <button class="danger" data-act="del">删</button>
      </div>
    \`;
    el.querySelector('[data-act="copy"]').onclick = () => {
      navigator.clipboard.writeText(o.url).then(() => toast("已复制 URL"));
    };
    el.querySelector('[data-act="md"]').onclick = () => {
      navigator.clipboard.writeText("![](" + o.url + ")").then(() => toast("已复制 Markdown"));
    };
    el.querySelector('[data-act="del"]').onclick = async () => {
      if (!confirm("确认删除 " + o.key + "?")) return;
      const r = await fetch("/api/object/" + encodeURIComponent(o.key), { method: "DELETE", headers: authHeaders() });
      if (r.ok) { el.remove(); toast("已删除"); }
      else toast("删除失败：" + r.status);
    };
    return el;
  }

  $("#refresh").addEventListener("click", () => loadGallery(true));
  $("#loadmore").addEventListener("click", () => loadGallery(false));

  function formatSize(n) {
    if (n < 1024) return n + " B";
    if (n < 1024*1024) return (n/1024).toFixed(1) + " KB";
    return (n/1024/1024).toFixed(2) + " MB";
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
</script>
</body>
</html>`;
}

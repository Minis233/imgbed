// Admin dashboard — gated by /<ADMIN_PATH>/<ADMIN_TOKEN> URL prefix.
// All admin API calls are issued relative to that prefix.

export function renderAdminPage(env, prefix) {
  const adminBase = prefix; // e.g. "/r2id/abc123"
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<title>imgbed · 管理后台</title>
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="20" height="16" x="2" y="4" rx="4" fill="%23ef4444"/><path d="M12 8v6m0 2v.01" stroke="%23fff" stroke-width="2" stroke-linecap="round"/></svg>'
)}" />
<style>
  :root {
    --bg: #0a0a0f;
    --surface: rgba(255,255,255,0.04);
    --surface-2: rgba(255,255,255,0.06);
    --border: rgba(255,255,255,0.08);
    --border-strong: rgba(255,255,255,0.16);
    --text: #f1f5f9;
    --muted: #94a3b8;
    --accent: #a78bfa;
    --accent-2: #f472b6;
    --danger: #ef4444;
    --success: #22c55e;
    --warn: #f59e0b;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: #fafafa;
      --surface: rgba(255,255,255,0.7);
      --surface-2: rgba(255,255,255,0.92);
      --border: rgba(15,23,42,0.08);
      --border-strong: rgba(15,23,42,0.16);
      --text: #0f172a;
      --muted: #64748b;
    }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; min-height: 100vh; }
  body {
    background: var(--bg); color: var(--text);
    font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
  }
  .mesh {
    position: fixed; inset: 0; z-index: -1; pointer-events: none;
    background:
      radial-gradient(900px 600px at 10% 0%, rgba(239,68,68,.15), transparent 50%),
      radial-gradient(800px 500px at 100% 30%, rgba(167,139,250,.12), transparent 50%);
  }
  .wrap { max-width: 1280px; margin: 0 auto; padding: 24px 20px 80px; }
  header.top {
    display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;
    background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
    padding: 14px 18px;
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  }
  header.top .brand { font-size: 18px; font-weight: 700; }
  header.top .brand .accent {
    background: linear-gradient(135deg, #ef4444, #f472b6);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  header.top .grow { flex: 1; }
  header.top a { color: var(--muted); text-decoration: none; font-size: 13px; }
  header.top a:hover { color: var(--text); }

  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px,1fr)); gap: 12px; margin-bottom: 20px; }
  .stat {
    background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
    padding: 14px 16px;
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  }
  .stat .label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
  .stat .value { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .stat .value.warn { color: var(--warn); }
  .stat .value.danger { color: var(--danger); }
  .stat .value.success { color: var(--success); }

  .tabs { display: flex; gap: 4px; margin-bottom: 16px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .tab {
    padding: 10px 16px; cursor: pointer; border-radius: 10px;
    color: var(--muted); font-size: 14px; font-weight: 500; user-select: none;
    white-space: nowrap; transition: all .15s;
  }
  .tab:hover { background: var(--surface); color: var(--text); }
  .tab.active {
    background: linear-gradient(135deg, rgba(167,139,250,.15), rgba(244,114,182,.15));
    color: var(--text); border: 1px solid rgba(167,139,250,.3);
  }

  .card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
    padding: 18px;
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  }
  .card h2 { margin: 0 0 12px; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
  .card h2 .desc { font-size: 12px; font-weight: 400; color: var(--muted); }
  .card + .card { margin-top: 12px; }

  /* Settings */
  .switch-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 0; gap: 16px;
  }
  .switch-row + .switch-row { border-top: 1px solid var(--border); }
  .switch-row .text strong { display: block; font-weight: 600; margin-bottom: 2px; }
  .switch-row .text small { color: var(--muted); }
  .switch {
    position: relative; width: 46px; height: 26px; flex-shrink: 0;
  }
  .switch input { opacity: 0; width: 0; height: 0; }
  .switch .slider {
    position: absolute; cursor: pointer; inset: 0;
    background: var(--surface-2); border: 1px solid var(--border);
    border-radius: 999px; transition: .25s;
  }
  .switch .slider::before {
    content: ""; position: absolute; height: 18px; width: 18px;
    left: 3px; top: 3px; background: var(--text); border-radius: 50%;
    transition: .25s;
  }
  .switch input:checked + .slider {
    background: linear-gradient(135deg, #a78bfa, #f472b6); border-color: transparent;
  }
  .switch input:checked + .slider::before { transform: translateX(20px); background: #fff; }

  /* Gallery */
  .grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px;
  }
  .item {
    background: var(--surface-2); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden;
    display: flex; flex-direction: column; position: relative;
    transition: transform .15s, border-color .15s;
  }
  .item:hover { transform: translateY(-2px); border-color: var(--border-strong); }
  .item .thumb {
    width: 100%; aspect-ratio: 4 / 3; object-fit: cover; background: #000;
    display: block; cursor: pointer;
  }
  .item .info {
    padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; font-size: 12px;
  }
  .item .info .row { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
  .item .info .ip {
    font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11px;
    color: var(--muted); cursor: pointer;
  }
  .item .info .ip:hover { color: var(--text); }
  .item .badges {
    position: absolute; top: 8px; left: 8px; right: 8px;
    display: flex; gap: 4px; flex-wrap: wrap; pointer-events: none;
  }
  .badge {
    display: inline-flex; align-items: center; gap: 3px;
    padding: 3px 7px; border-radius: 999px;
    font-size: 10px; font-weight: 600;
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  }
  .badge.pending { background: rgba(245,158,11,.85); color: #fff; }
  .badge.safe { background: rgba(34,197,94,.85); color: #fff; }
  .badge.violation { background: rgba(239,68,68,.9); color: #fff; }
  .badge.error { background: rgba(148,163,184,.85); color: #fff; }
  .badge.burn { background: rgba(244,114,182,.85); color: #fff; }
  .badge.expiry { background: rgba(99,102,241,.85); color: #fff; }
  .item .actions {
    position: absolute; top: 8px; right: 8px; display: flex; gap: 4px;
    opacity: 0; transition: opacity .15s;
  }
  .item:hover .actions { opacity: 1; }
  .item .actions button {
    padding: 4px 8px; font-size: 11px; border-radius: 6px;
    background: rgba(0,0,0,0.7); color: #fff; border: 0; cursor: pointer;
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  }
  .item .actions button.danger { background: rgba(239,68,68,0.9); }
  .item .actions button.warn { background: rgba(245,158,11,0.9); }

  /* Bans table */
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 10px 12px; text-align: left; }
  th {
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    color: var(--muted); letter-spacing: 0.04em;
    border-bottom: 1px solid var(--border);
  }
  tbody tr { border-bottom: 1px solid var(--border); }
  tbody tr:last-child { border-bottom: 0; }
  td .ip { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 13px; }
  td .reason { color: var(--muted); font-size: 12px; }

  /* Inputs/buttons */
  button {
    appearance: none; cursor: pointer; border: 0; font: inherit;
    padding: 8px 14px; border-radius: 8px;
    background: var(--surface-2); color: var(--text); border: 1px solid var(--border);
    transition: all .15s;
  }
  button:hover:not(:disabled) { background: var(--surface); border-color: var(--border-strong); }
  button.primary {
    background: linear-gradient(135deg, #a78bfa, #f472b6); color: #fff; border: 0;
  }
  button.danger { background: #ef4444; color: #fff; border: 0; }
  button.danger:hover { background: #dc2626; }
  input[type="text"] {
    padding: 8px 12px; border-radius: 8px; font: inherit;
    background: var(--surface-2); color: var(--text); border: 1px solid var(--border);
    outline: none;
  }
  input[type="text"]:focus { border-color: var(--accent); }

  .empty { padding: 60px 20px; text-align: center; color: var(--muted); }
  .empty .emoji { font-size: 40px; margin-bottom: 8px; }

  /* Lightbox */
  .lightbox {
    position: fixed; inset: 0; background: rgba(0,0,0,0.92); z-index: 200;
    display: none; align-items: center; justify-content: center; padding: 20px;
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    cursor: zoom-out;
  }
  .lightbox.show { display: flex; }
  .lightbox img { max-width: 100%; max-height: 100%; border-radius: 8px; }
  .lightbox .close {
    position: absolute; top: 20px; right: 20px;
    width: 40px; height: 40px; border-radius: 50%;
    background: rgba(255,255,255,0.1); color: #fff;
    border: 0; cursor: pointer; font-size: 24px; line-height: 1;
  }

  .toast {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(20px);
    background: rgba(15,23,42,0.95); color: #fff; border: 1px solid rgba(255,255,255,.1);
    padding: 10px 18px; border-radius: 10px; font-size: 13px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    opacity: 0; pointer-events: none; transition: all .25s;
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    z-index: 300;
  }
  .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
  .toolbar {
    display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 12px;
  }
</style>
</head>
<body>
<div class="mesh"></div>
<div class="wrap">
  <header class="top">
    <div class="brand">🛡️ <span class="accent">imgbed</span> 管理后台</div>
    <div class="grow"></div>
    <a href="/" target="_blank">↗ 上传页</a>
    <a href="https://github.com/Minis233/imgbed" target="_blank">↗ GitHub</a>
  </header>

  <div class="stats">
    <div class="stat"><div class="label">图片总数</div><div class="value" id="stat-total">—</div></div>
    <div class="stat"><div class="label">待审查</div><div class="value warn" id="stat-pending">—</div></div>
    <div class="stat"><div class="label">违规</div><div class="value danger" id="stat-violation">—</div></div>
    <div class="stat"><div class="label">封禁 IP</div><div class="value danger" id="stat-bans">—</div></div>
  </div>

  <div class="tabs">
    <div class="tab active" data-tab="gallery">📷 图库</div>
    <div class="tab" data-tab="bans">🚫 IP 封禁</div>
    <div class="tab" data-tab="settings">⚙ 设置</div>
  </div>

  <section data-pane="gallery">
    <div class="card">
      <div class="toolbar">
        <h2 style="margin:0">已上传图片</h2>
        <div style="flex:1"></div>
        <button id="g-refresh">🔄 刷新</button>
      </div>
      <div id="gallery" class="grid"></div>
      <div id="g-empty" class="empty" hidden><div class="emoji">📭</div>暂无图片</div>
      <div style="text-align:center;margin-top:14px">
        <button id="g-loadmore" hidden>加载更多</button>
      </div>
    </div>
  </section>

  <section data-pane="bans" hidden>
    <div class="card">
      <h2>手动封禁 <span class="desc">直接拉黑某个 IP，禁止它上传</span></h2>
      <div class="toolbar">
        <input id="ban-ip" type="text" placeholder="例如 1.2.3.4 或 2001:db8::/32" style="flex:1;min-width:200px" />
        <input id="ban-reason" type="text" placeholder="原因（可选）" style="flex:1;min-width:160px" />
        <button class="primary" id="ban-add">+ 封禁</button>
      </div>
    </div>
    <div class="card">
      <h2>封禁列表</h2>
      <table id="bans-table">
        <thead><tr><th>IP</th><th>原因</th><th>时间</th><th></th></tr></thead>
        <tbody></tbody>
      </table>
      <div id="bans-empty" class="empty" hidden><div class="emoji">🕊️</div>暂无封禁</div>
    </div>
  </section>

  <section data-pane="settings" hidden>
    <div class="card">
      <h2>AI 内容审查 <span class="desc">Workers AI · LLaVA</span></h2>
      <div class="switch-row">
        <div class="text">
          <strong>启用 AI 审查</strong>
          <small>每次上传后异步调用 Workers AI 对图片做 NSFW / 违规检测，1 分钟内出结果。</small>
        </div>
        <label class="switch"><input type="checkbox" id="set-ai" /><span class="slider"></span></label>
      </div>
      <div class="switch-row">
        <div class="text">
          <strong>违规自动封禁 IP</strong>
          <small>命中违规时自动删除图片并把上传者 IP 加入封禁列表。</small>
        </div>
        <label class="switch"><input type="checkbox" id="set-ban" /><span class="slider"></span></label>
      </div>
    </div>

    <div class="card">
      <h2>后台 URL</h2>
      <p style="color:var(--muted);font-size:13px;margin:0 0 8px">当前后台地址（请妥善保管）：</p>
      <code id="admin-url" style="display:block;background:var(--surface-2);padding:10px;border-radius:8px;border:1px solid var(--border);font-size:12px;word-break:break-all"></code>
      <p style="color:var(--muted);font-size:12px;margin-top:10px">
        路径来自 <code>ADMIN_PATH</code> 与 <code>ADMIN_TOKEN</code> 两个环境变量。修改 <code>ADMIN_TOKEN</code> 即可"轮换"后台地址。
      </p>
    </div>
  </section>
</div>

<div class="lightbox" id="lightbox">
  <button class="close">×</button>
  <img alt="" />
</div>
<div class="toast" id="toast"></div>

<script>
const ADMIN_BASE = ${JSON.stringify(adminBase)};
const $ = (s) => document.querySelector(s);

let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function fmtSize(n) { if (!n) return "—"; if (n < 1024) return n + " B"; if (n < 1048576) return (n/1024).toFixed(1) + " KB"; return (n/1048576).toFixed(2) + " MB"; }
function fmtDate(d) { if (!d) return "—"; const x = new Date(d); return x.toLocaleString(); }
function fmtRelative(d) {
  const ms = Date.now() - new Date(d);
  const s = ms / 1000;
  if (s < 60) return Math.floor(s) + "s 前";
  if (s < 3600) return Math.floor(s/60) + "m 前";
  if (s < 86400) return Math.floor(s/3600) + "h 前";
  return Math.floor(s/86400) + "d 前";
}

async function api(path, opts = {}) {
  const r = await fetch(ADMIN_BASE + path, opts);
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = { error: text }; }
  if (!r.ok || body.ok === false) throw new Error(body.error || ("HTTP " + r.status));
  return body;
}

// Tabs
const tabs = document.querySelectorAll(".tab");
const panes = document.querySelectorAll("section[data-pane]");
tabs.forEach((t) => t.addEventListener("click", () => {
  tabs.forEach((x) => x.classList.toggle("active", x === t));
  panes.forEach((p) => p.hidden = p.dataset.pane !== t.dataset.tab);
  if (t.dataset.tab === "gallery") loadGallery(true);
  else if (t.dataset.tab === "bans") loadBans();
  else if (t.dataset.tab === "settings") loadSettings();
}));

// Lightbox
const lb = $("#lightbox"), lbImg = lb.querySelector("img");
lb.addEventListener("click", () => lb.classList.remove("show"));

// Gallery
let gCursor = null;
async function loadGallery(reset) {
  if (reset) { $("#gallery").innerHTML = ""; gCursor = null; }
  const u = new URLSearchParams();
  if (gCursor) u.set("cursor", gCursor);
  u.set("limit", "60");
  let body;
  try { body = await api("/api/list?" + u); }
  catch (e) { toast("加载失败: " + e.message); return; }
  const grid = $("#gallery");
  if (reset && body.objects.length === 0) {
    $("#g-empty").hidden = false;
    $("#g-loadmore").hidden = true;
  } else {
    $("#g-empty").hidden = true;
  }
  body.objects.forEach((o) => grid.appendChild(galleryItem(o)));
  gCursor = body.cursor;
  $("#g-loadmore").hidden = !body.truncated;
  refreshStats();
}

function galleryItem(o) {
  const el = document.createElement("div");
  el.className = "item";
  const badges = [];
  const mod = o.moderation;
  if (mod) {
    if (mod.status === "pending") badges.push('<span class="badge pending">⏳ 审查中</span>');
    if (mod.status === "safe") badges.push('<span class="badge safe">✓ 通过</span>');
    if (mod.status === "violation") badges.push('<span class="badge violation">⛔ 违规</span>');
    if (mod.status === "error") badges.push('<span class="badge error">⚠ 错误</span>');
  }
  if (o.burnSeconds) badges.push(\`<span class="badge burn">🔥 \${o.burnSeconds}s</span>\`);
  if (o.expiresAt) badges.push(\`<span class="badge expiry">⏰ \${fmtDate(o.expiresAt)}</span>\`);

  el.innerHTML = \`
    <div class="badges">\${badges.join("")}</div>
    <div class="actions">
      <button data-act="copy">URL</button>
      <button class="warn" data-act="recheck">🔄</button>
      <button class="danger" data-act="del">删</button>
    </div>
    <img class="thumb" src="\${o.url}" loading="lazy" alt="" />
    <div class="info">
      <div class="row">
        <span style="font-family:ui-monospace,monospace;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">\${escapeHtml(o.key.split("/").pop())}</span>
        <span style="color:var(--muted)">\${fmtSize(o.size)}</span>
      </div>
      <div class="row">
        <span class="ip" data-ip="\${escapeHtml(o.ip || "")}" title="点击封禁">\${escapeHtml(o.ip || "未知")}</span>
        <span style="color:var(--muted);font-size:11px">\${fmtRelative(o.uploaded)}</span>
      </div>
    </div>
  \`;

  el.querySelector(".thumb").onclick = () => {
    lbImg.src = o.url; lb.classList.add("show");
  };
  el.querySelector('[data-act="copy"]').onclick = () => {
    navigator.clipboard.writeText(o.url).then(() => toast("已复制 URL"));
  };
  el.querySelector('[data-act="recheck"]').onclick = async () => {
    toast("重新审查中…");
    try {
      const r = await api("/api/recheck", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: o.key }),
      });
      toast("结果: " + r.moderation.status);
      loadGallery(true);
    } catch (e) { toast("失败: " + e.message); }
  };
  el.querySelector('[data-act="del"]').onclick = async () => {
    if (!confirm("删除 " + o.key + " ?")) return;
    try {
      await api("/api/object/" + encodeURIComponent(o.key), { method: "DELETE" });
      el.remove(); toast("已删除"); refreshStats();
    } catch (e) { toast("失败: " + e.message); }
  };
  el.querySelector(".ip").onclick = (e) => {
    const ip = e.target.dataset.ip;
    if (!ip) return;
    if (!confirm("封禁 " + ip + " ?")) return;
    api("/api/bans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ip, reason: "manual:from-gallery" }),
    }).then(() => { toast("已封禁 " + ip); refreshStats(); })
      .catch((e) => toast("失败: " + e.message));
  };
  return el;
}

$("#g-refresh").addEventListener("click", () => loadGallery(true));
$("#g-loadmore").addEventListener("click", () => loadGallery(false));

// Bans
async function loadBans() {
  let body;
  try { body = await api("/api/bans"); } catch (e) { toast("加载失败: " + e.message); return; }
  const tbody = $("#bans-table tbody");
  tbody.innerHTML = "";
  if (body.bans.length === 0) {
    $("#bans-empty").hidden = false;
    $("#bans-table").hidden = true;
  } else {
    $("#bans-empty").hidden = true;
    $("#bans-table").hidden = false;
    body.bans.forEach((b) => {
      const tr = document.createElement("tr");
      tr.innerHTML = \`
        <td><span class="ip">\${escapeHtml(b.ip)}</span></td>
        <td><span class="reason">\${escapeHtml(b.reason || "—")}</span></td>
        <td style="color:var(--muted);font-size:12px">\${b.ts ? fmtDate(b.ts) : "—"}</td>
        <td style="text-align:right"><button class="danger" data-ip="\${escapeHtml(b.ip)}">解除</button></td>
      \`;
      tr.querySelector("button").onclick = async () => {
        if (!confirm("解除封禁 " + b.ip + " ?")) return;
        try {
          await api("/api/bans/" + encodeURIComponent(b.ip), { method: "DELETE" });
          tr.remove(); toast("已解除"); refreshStats();
        } catch (e) { toast("失败: " + e.message); }
      };
      tbody.appendChild(tr);
    });
  }
  $("#stat-bans").textContent = body.bans.length;
}

$("#ban-add").addEventListener("click", async () => {
  const ip = $("#ban-ip").value.trim();
  const reason = $("#ban-reason").value.trim();
  if (!ip) { toast("请输入 IP"); return; }
  try {
    await api("/api/bans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ip, reason: reason || "manual" }),
    });
    $("#ban-ip").value = ""; $("#ban-reason").value = "";
    toast("已封禁"); loadBans();
  } catch (e) { toast("失败: " + e.message); }
});

// Settings
async function loadSettings() {
  let body;
  try { body = await api("/api/settings"); } catch (e) { toast("加载失败: " + e.message); return; }
  $("#set-ai").checked = !!body.settings.aiModeration;
  $("#set-ban").checked = !!body.settings.banAutoOnViolation;
  $("#admin-url").textContent = location.origin + ADMIN_BASE;
}

async function saveSettings(patch) {
  try {
    const r = await api("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    toast("已保存"); return r.settings;
  } catch (e) { toast("失败: " + e.message); }
}

$("#set-ai").addEventListener("change", (e) => saveSettings({ aiModeration: e.target.checked }));
$("#set-ban").addEventListener("change", (e) => saveSettings({ banAutoOnViolation: e.target.checked }));

// Stats
async function refreshStats() {
  try {
    const [g, b] = await Promise.all([api("/api/list?limit=1000"), api("/api/bans")]);
    $("#stat-total").textContent = g.objects.length + (g.truncated ? "+" : "");
    $("#stat-pending").textContent = g.objects.filter((o) => o.moderation?.status === "pending" || (!o.moderation)).filter((o) => o.moderation?.status !== "safe").filter((o) => !o.moderation || o.moderation.status === "pending").length;
    $("#stat-violation").textContent = g.objects.filter((o) => o.moderation?.status === "violation").length;
    $("#stat-bans").textContent = b.bans.length;
  } catch {}
}

// boot
loadGallery(true);
refreshStats();
</script>
</body>
</html>`;
}

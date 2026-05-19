// Admin dashboard — gated by /<META_KV_ID>/<ADMIN_TOKEN> URL prefix.
// All admin API calls are issued relative to that prefix.
//
// Design: mobile-first, touch-friendly, no hover-only affordances. Every action
// is a tappable button or row. Polls the API every 5s for live updates.

export function renderAdminPage(env, prefix) {
  const adminBase = prefix;
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<meta name="color-scheme" content="dark light" />
<meta name="robots" content="noindex,nofollow" />
<title>imgbed · 管理后台</title>
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="20" height="16" x="2" y="4" rx="4" fill="%23ef4444"/><path d="M12 8v6m0 2v.01" stroke="%23fff" stroke-width="2" stroke-linecap="round"/></svg>'
)}" />
<style>
  :root {
    color-scheme: dark light;
    --bg: #0a0a0f;
    --surface: rgba(255,255,255,0.05);
    --surface-2: rgba(255,255,255,0.08);
    --border: rgba(255,255,255,0.10);
    --border-strong: rgba(255,255,255,0.18);
    --text: #f1f5f9;
    --text-2: #cbd5e1;
    --muted: #94a3b8;
    --accent: #a78bfa;
    --accent-2: #f472b6;
    --danger: #ef4444;
    --warn: #f59e0b;
    --success: #22c55e;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: #f8fafc;
      --surface: rgba(255,255,255,0.85);
      --surface-2: rgba(255,255,255,0.95);
      --border: rgba(15,23,42,0.08);
      --border-strong: rgba(15,23,42,0.18);
      --text: #0f172a;
      --text-2: #334155;
      --muted: #64748b;
    }
  }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { margin: 0; padding: 0; min-height: 100vh; }
  body {
    background: var(--bg); color: var(--text);
    font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .mesh {
    position: fixed; inset: 0; z-index: -1; pointer-events: none;
    background:
      radial-gradient(900px 600px at 10% 0%, rgba(239,68,68,.12), transparent 50%),
      radial-gradient(800px 500px at 100% 30%, rgba(167,139,250,.10), transparent 50%);
  }
  @media (prefers-color-scheme: light) {
    .mesh { background:
      radial-gradient(900px 600px at 10% 0%, rgba(239,68,68,.18), transparent 50%),
      radial-gradient(800px 500px at 100% 30%, rgba(167,139,250,.15), transparent 50%);
    }
  }
  .wrap { max-width: 1200px; margin: 0 auto; padding: 16px 14px 80px; }

  /* Header */
  header.top {
    display: flex; align-items: center; gap: 10px; margin-bottom: 16px;
    background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
    padding: 12px 14px;
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  }
  header.top .brand { font-size: 16px; font-weight: 700; flex: 1; min-width: 0; }
  header.top .brand .accent {
    background: linear-gradient(135deg, #ef4444, #f472b6);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  header.top .live {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11px; color: var(--muted);
  }
  header.top .live .dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--success);
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse { 50% { opacity: 0.3; } }

  /* Stats */
  .stats {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px;
  }
  @media (max-width: 540px) { .stats { grid-template-columns: repeat(2, 1fr); } }
  .stat {
    background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
    padding: 12px 14px;
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  }
  .stat .label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 4px; }
  .stat .value { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .stat .value.warn { color: var(--warn); }
  .stat .value.danger { color: var(--danger); }
  .stat .value.success { color: var(--success); }

  /* Tabs */
  .tabs {
    display: flex; gap: 4px; margin-bottom: 16px; padding: 4px;
    background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    overflow-x: auto; -webkit-overflow-scrolling: touch;
  }
  .tab {
    padding: 9px 14px; cursor: pointer; border-radius: 8px;
    color: var(--muted); font-size: 14px; font-weight: 500; user-select: none;
    white-space: nowrap; transition: background .15s, color .15s;
    flex: 1; text-align: center;
  }
  .tab:active { background: var(--surface-2); }
  .tab.active {
    background: linear-gradient(135deg, rgba(167,139,250,.20), rgba(244,114,182,.20));
    color: var(--text);
  }

  /* Card */
  .card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
    padding: 16px;
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  }
  .card + .card { margin-top: 12px; }
  .card h2 {
    margin: 0 0 12px; font-size: 15px; font-weight: 600;
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
  }
  .card h2 .desc { font-size: 12px; font-weight: 400; color: var(--muted); }

  /* Switch */
  .switch-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 0; gap: 16px;
  }
  .switch-row + .switch-row { border-top: 1px solid var(--border); }
  .switch-row .text { flex: 1; min-width: 0; }
  .switch-row .text strong { display: block; font-weight: 600; margin-bottom: 3px; font-size: 14px; }
  .switch-row .text small { color: var(--muted); font-size: 12px; line-height: 1.45; }
  .switch {
    position: relative; width: 48px; height: 28px; flex-shrink: 0;
    cursor: pointer;
  }
  .switch input { opacity: 0; width: 0; height: 0; pointer-events: none; }
  .switch .slider {
    position: absolute; inset: 0;
    background: var(--surface-2); border: 1px solid var(--border);
    border-radius: 999px; transition: .25s;
  }
  .switch .slider::before {
    content: ""; position: absolute; height: 20px; width: 20px;
    left: 3px; top: 3px; background: var(--text); border-radius: 50%;
    transition: .25s;
  }
  .switch input:checked + .slider {
    background: linear-gradient(135deg, #a78bfa, #f472b6); border-color: transparent;
  }
  .switch input:checked + .slider::before { transform: translateX(20px); background: #fff; }

  /* Gallery */
  .grid {
    display: grid; gap: 12px;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  }
  @media (max-width: 380px) { .grid { grid-template-columns: 1fr 1fr; } }
  .item {
    background: var(--surface-2); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden; position: relative;
    display: flex; flex-direction: column;
  }
  .item .thumb-wrap {
    position: relative; width: 100%; aspect-ratio: 1 / 1;
    background: rgba(0,0,0,0.3); cursor: zoom-in; overflow: hidden;
  }
  .item .thumb-wrap img {
    position: absolute; inset: 0;
    width: 100%; height: 100%; object-fit: cover; display: block;
  }
  .item .badges {
    position: absolute; top: 6px; left: 6px; right: 6px;
    display: flex; gap: 4px; flex-wrap: wrap; pointer-events: none; z-index: 2;
  }
  .badge {
    display: inline-flex; align-items: center; gap: 3px;
    padding: 3px 7px; border-radius: 999px;
    font-size: 10px; font-weight: 600;
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    box-shadow: 0 2px 6px rgba(0,0,0,.2);
  }
  .badge.pending { background: rgba(245,158,11,.92); color: #fff; }
  .badge.safe { background: rgba(34,197,94,.92); color: #fff; }
  .badge.violation { background: rgba(239,68,68,.92); color: #fff; }
  .badge.error { background: rgba(148,163,184,.92); color: #fff; }
  .badge.burn { background: rgba(244,114,182,.92); color: #fff; }
  .badge.expiry { background: rgba(99,102,241,.92); color: #fff; }
  .item .info {
    padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; font-size: 12px;
  }
  .item .info .row {
    display: flex; justify-content: space-between; gap: 6px; align-items: center;
    min-width: 0;
  }
  .item .info .ip {
    font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11px;
    color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .item .info .meta { color: var(--muted); font-size: 11px; flex-shrink: 0; }
  .item .actions {
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1px;
    background: var(--border); border-top: 1px solid var(--border);
  }
  .item .actions button {
    appearance: none; cursor: pointer; border: 0;
    padding: 10px 4px; font: inherit; font-size: 12px; font-weight: 600;
    background: var(--surface); color: var(--text);
    transition: background .15s;
  }
  .item .actions button:active { background: var(--surface-2); }
  .item .actions button.recheck { color: var(--warn); }
  .item .actions button.ban { color: var(--danger); }
  .item .actions button.del { color: var(--danger); }

  /* Bans table */
  table { width: 100%; border-collapse: collapse; }
  thead th {
    padding: 10px 8px; text-align: left;
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    color: var(--muted); letter-spacing: .04em;
    border-bottom: 1px solid var(--border);
  }
  tbody td {
    padding: 12px 8px; border-bottom: 1px solid var(--border);
    vertical-align: middle;
  }
  tbody tr:last-child td { border-bottom: 0; }
  td .ip { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 13px; word-break: break-all; }
  td .reason { color: var(--muted); font-size: 11px; word-break: break-word; }
  /* Mobile bans table */
  @media (max-width: 540px) {
    table thead { display: none; }
    table, tbody, tr, td { display: block; width: 100%; }
    tbody tr {
      background: var(--surface-2); border: 1px solid var(--border);
      border-radius: 10px; padding: 10px; margin-bottom: 8px;
    }
    tbody td { border: 0 !important; padding: 4px 0; }
    tbody td::before { content: attr(data-label) ": "; color: var(--muted); font-size: 11px; }
    tbody td.actions::before { display: none; }
    tbody td.actions { padding-top: 8px; text-align: right; }
  }

  /* Inputs / buttons */
  button, .btn {
    appearance: none; cursor: pointer; border: 0; font: inherit;
    padding: 9px 14px; border-radius: 8px;
    background: var(--surface-2); color: var(--text);
    border: 1px solid var(--border);
    transition: background .15s;
    font-weight: 500;
  }
  button:active { background: var(--surface); }
  button.primary {
    background: linear-gradient(135deg, #a78bfa, #f472b6);
    color: #fff; border: 0; font-weight: 600;
  }
  button.danger { background: var(--danger); color: #fff; border: 0; }
  input[type="text"] {
    padding: 10px 12px; border-radius: 8px; font: inherit;
    background: var(--surface-2); color: var(--text); border: 1px solid var(--border);
    outline: none; -webkit-appearance: none;
  }
  input[type="text"]:focus { border-color: var(--accent); }

  .empty { padding: 50px 20px; text-align: center; color: var(--muted); }
  .empty .emoji { font-size: 36px; margin-bottom: 8px; }

  .toolbar {
    display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 12px;
  }
  .toolbar input { flex: 1; min-width: 160px; }

  /* Lightbox */
  .lightbox {
    position: fixed; inset: 0; background: rgba(0,0,0,0.95); z-index: 200;
    display: none; align-items: center; justify-content: center; padding: 20px;
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  }
  .lightbox.show { display: flex; }
  .lightbox img { max-width: 100%; max-height: 90vh; border-radius: 8px; }
  .lightbox .meta {
    position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
    background: rgba(15,23,42,0.85); color: #fff;
    padding: 8px 14px; border-radius: 8px; font-size: 12px;
    max-width: 90%;
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  }
  .lightbox .close {
    position: absolute; top: env(safe-area-inset-top, 0px) ; right: 16px;
    margin-top: 16px;
    width: 40px; height: 40px; border-radius: 50%;
    background: rgba(255,255,255,0.15); color: #fff;
    border: 0; cursor: pointer; font-size: 22px; line-height: 1; padding: 0;
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  }

  /* Detail sheet (mobile-friendly modal) */
  .sheet {
    position: fixed; inset: 0; z-index: 300; display: none;
    align-items: flex-end; justify-content: center;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
  }
  .sheet.show { display: flex; }
  .sheet .panel {
    width: 100%; max-width: 600px;
    background: var(--bg); color: var(--text);
    border: 1px solid var(--border);
    border-radius: 18px 18px 0 0;
    padding: 16px 16px max(16px, env(safe-area-inset-bottom));
    max-height: 86vh; overflow-y: auto;
    animation: slideup .25s cubic-bezier(.4,0,.2,1);
  }
  @keyframes slideup { from { transform: translateY(100%);} to {transform:none;} }
  @media (min-width: 600px) {
    .sheet { align-items: center; padding: 20px; }
    .sheet .panel { border-radius: 16px; max-height: 80vh; }
  }
  .sheet .handle {
    width: 36px; height: 4px; background: var(--border-strong);
    border-radius: 2px; margin: 0 auto 12px;
  }
  .sheet .row { display: flex; gap: 8px; padding: 8px 0; font-size: 13px; }
  .sheet .row .k { width: 90px; flex-shrink: 0; color: var(--muted); }
  .sheet .row .v { flex: 1; word-break: break-word; }
  .sheet .desc-block {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 10px; padding: 10px 12px; font-size: 13px; line-height: 1.55;
    color: var(--text-2); margin-top: 6px;
  }
  .sheet .actions {
    display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap;
  }
  .sheet .actions button { flex: 1; min-width: 100px; }

  /* Toast */
  .toast {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(20px);
    background: rgba(15,23,42,0.95); color: #fff; border: 1px solid rgba(255,255,255,.12);
    padding: 10px 16px; border-radius: 10px; font-size: 13px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    opacity: 0; pointer-events: none; transition: all .25s;
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    z-index: 400;
  }
  .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
</style>
</head>
<body>
<div class="mesh"></div>
<div class="wrap">
  <header class="top">
    <div class="brand">🛡️ <span class="accent">imgbed</span> 后台</div>
    <span class="live"><span class="dot"></span><span id="live-text">实时</span></span>
    <a href="/" target="_blank" style="color:var(--muted);font-size:13px;text-decoration:none">↗ 上传页</a>
  </header>

  <div class="stats">
    <div class="stat"><div class="label">总数</div><div class="value" id="stat-total">—</div></div>
    <div class="stat"><div class="label">待审查</div><div class="value warn" id="stat-pending">—</div></div>
    <div class="stat"><div class="label">违规</div><div class="value danger" id="stat-violation">—</div></div>
    <div class="stat"><div class="label">封禁 IP</div><div class="value danger" id="stat-bans">—</div></div>
  </div>

  <div class="tabs">
    <div class="tab active" data-tab="gallery">📷 图库</div>
    <div class="tab" data-tab="bans">🚫 封禁</div>
    <div class="tab" data-tab="settings">⚙ 设置</div>
  </div>

  <section data-pane="gallery">
    <div class="card">
      <h2>已上传图片
        <button id="g-refresh" style="font-size:13px;padding:6px 10px">🔄 刷新</button>
      </h2>
      <div id="gallery" class="grid"></div>
      <div id="g-empty" class="empty" hidden><div class="emoji">📭</div>暂无图片</div>
      <div style="text-align:center;margin-top:12px">
        <button id="g-loadmore" hidden>加载更多</button>
      </div>
    </div>
  </section>

  <section data-pane="bans" hidden>
    <div class="card">
      <h2>手动封禁 <span class="desc">阻止某个 IP 上传新图</span></h2>
      <div class="toolbar">
        <input id="ban-ip" type="text" placeholder="IP 地址" autocomplete="off" />
        <input id="ban-reason" type="text" placeholder="原因（可选）" autocomplete="off" />
        <button class="primary" id="ban-add">+ 封禁</button>
      </div>
      <small style="color:var(--muted);font-size:12px">封禁仅阻止此 IP 之后的上传，不会删除该 IP 已有的图片。</small>
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
          <small>每次上传后异步调用 Workers AI（描述 + 分类 双校验）。命中违规自动删除该图。</small>
        </div>
        <label class="switch"><input type="checkbox" id="set-ai" /><span class="slider"></span></label>
      </div>
      <div class="switch-row">
        <div class="text">
          <strong>违规自动封禁 IP</strong>
          <small>命中违规时把上传者 IP 加入封禁列表（仅阻止之后的上传，不会删该 IP 已有的合规图片）。</small>
        </div>
        <label class="switch"><input type="checkbox" id="set-ban" /><span class="slider"></span></label>
      </div>
    </div>
    <div class="card">
      <h2>实时刷新 <span class="desc">每 5 秒同步一次</span></h2>
      <div class="switch-row">
        <div class="text">
          <strong>开启实时刷新</strong>
          <small>自动同步图库、封禁、统计；切换 tab 时立即拉一次最新数据。</small>
        </div>
        <label class="switch"><input type="checkbox" id="set-live" checked /><span class="slider"></span></label>
      </div>
    </div>
  </section>
</div>

<!-- Lightbox -->
<div class="lightbox" id="lightbox">
  <button class="close" id="lb-close">×</button>
  <img alt="" />
</div>

<!-- Detail sheet -->
<div class="sheet" id="sheet">
  <div class="panel">
    <div class="handle"></div>
    <div id="sheet-content"></div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
const ADMIN_BASE = ${JSON.stringify(adminBase)};
const POLL_INTERVAL_MS = 5000;
const $ = (s) => document.querySelector(s);

// ---------- helpers ----------
let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}
function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function fmtSize(n) { if (!n && n !== 0) return "—"; if (n < 1024) return n + " B"; if (n < 1048576) return (n/1024).toFixed(1) + " KB"; return (n/1048576).toFixed(2) + " MB"; }
function fmtDate(d) { if (!d) return "—"; const x = new Date(d); return x.toLocaleString(); }
function fmtRel(d) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
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

// ---------- state ----------
const State = {
  activeTab: "gallery",
  livePolling: true,
  pollTimer: null,
  objectsCache: [],
};

// ---------- tabs ----------
document.querySelectorAll(".tab").forEach((t) => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
    document.querySelectorAll("section[data-pane]").forEach((p) => p.hidden = p.dataset.pane !== t.dataset.tab);
    State.activeTab = t.dataset.tab;
    refreshActive();
  });
});

// ---------- lightbox ----------
const lb = $("#lightbox"), lbImg = lb.querySelector("img");
$("#lb-close").addEventListener("click", () => lb.classList.remove("show"));
lb.addEventListener("click", (e) => { if (e.target === lb) lb.classList.remove("show"); });

// ---------- detail sheet ----------
const sheet = $("#sheet"), sheetContent = $("#sheet-content");
sheet.addEventListener("click", (e) => { if (e.target === sheet) sheet.classList.remove("show"); });

function openDetailSheet(o) {
  const mod = o.moderation || {};
  const burnSec = o.burnSeconds;
  const burnText = burnSec
    ? (o.burn ? \`\${o.burn.durationSec}s（已开始计时）\` : \`\${burnSec}s（首次访问后启动）\`)
    : "—";
  const expText = o.expiresAt ? fmtDate(o.expiresAt) : "永久";
  sheetContent.innerHTML = \`
    <h3 style="margin:0 0 14px;font-size:16px">图片详情</h3>
    <div class="row"><div class="k">文件名</div><div class="v">\${escapeHtml(o.originalName || o.key)}</div></div>
    <div class="row"><div class="k">大小</div><div class="v">\${fmtSize(o.size)}</div></div>
    <div class="row"><div class="k">类型</div><div class="v">\${escapeHtml(o.contentType || "—")}</div></div>
    <div class="row"><div class="k">上传 IP</div><div class="v" style="font-family:monospace">\${escapeHtml(o.ip || "—")}</div></div>
    <div class="row"><div class="k">UA</div><div class="v" style="font-size:12px;color:var(--muted)">\${escapeHtml(o.userAgent || "—")}</div></div>
    <div class="row"><div class="k">上传时间</div><div class="v">\${fmtDate(o.uploaded)}</div></div>
    <div class="row"><div class="k">阅后即焚</div><div class="v">\${burnText}</div></div>
    <div class="row"><div class="k">过期</div><div class="v">\${expText}</div></div>
    <div class="row"><div class="k">SHA-256</div><div class="v" style="font-family:monospace;font-size:11px">\${escapeHtml(o.sha256 || "—")}</div></div>
    \${mod.status ? \`
      <h4 style="margin:14px 0 6px;font-size:14px">AI 审查</h4>
      <div class="row"><div class="k">状态</div><div class="v">\${escapeHtml(mod.status)}</div></div>
      \${mod.verdict ? \`<div class="row"><div class="k">分类</div><div class="v">\${escapeHtml(mod.verdict)}</div></div>\` : ""}
      \${mod.reasons?.length ? \`<div class="row"><div class="k">命中</div><div class="v">\${escapeHtml(mod.reasons.join(", "))}</div></div>\` : ""}
      \${mod.description ? \`<div style="margin-top:6px"><div class="k" style="font-size:12px;color:var(--muted);margin-bottom:4px">描述</div><div class="desc-block">\${escapeHtml(mod.description)}</div></div>\` : ""}
      \${mod.error ? \`<div class="row"><div class="k">错误</div><div class="v" style="color:var(--danger)">\${escapeHtml(mod.error)}</div></div>\` : ""}
    \` : ""}
    <div class="actions">
      <button class="btn" id="sheet-copy">📋 复制 URL</button>
      <button class="btn" id="sheet-recheck">🔄 重新审查</button>
      <button class="btn danger" id="sheet-ban" \${o.ip ? "" : "disabled"}>🚫 封禁 IP</button>
      <button class="btn danger" id="sheet-del">🗑 删除</button>
    </div>
    <button class="btn" id="sheet-close" style="width:100%;margin-top:8px">关闭</button>
  \`;
  $("#sheet-copy").onclick = () => { navigator.clipboard.writeText(o.url).then(() => toast("已复制 URL")); };
  $("#sheet-recheck").onclick = async () => {
    toast("重新审查中…");
    try {
      const r = await api("/api/recheck", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: o.key }),
      });
      toast("结果: " + r.moderation.status);
      sheet.classList.remove("show");
      loadGallery(true);
    } catch (e) { toast("失败: " + e.message); }
  };
  $("#sheet-ban").onclick = async () => {
    if (!o.ip) return;
    if (!confirm("封禁 " + o.ip + "?\\n\\n仅阻止后续上传，不会删除该 IP 之前已经合规的图片。")) return;
    try {
      await api("/api/bans", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ip: o.ip, reason: "manual:from-detail" }),
      });
      toast("已封禁 " + o.ip);
      sheet.classList.remove("show");
      loadBans();
    } catch (e) { toast("失败: " + e.message); }
  };
  $("#sheet-del").onclick = async () => {
    if (!confirm("删除这张图？")) return;
    try {
      await api("/api/object/" + encodeURIComponent(o.key), { method: "DELETE" });
      toast("已删除");
      sheet.classList.remove("show");
      loadGallery(true);
    } catch (e) { toast("失败: " + e.message); }
  };
  $("#sheet-close").onclick = () => sheet.classList.remove("show");
  sheet.classList.add("show");
}

// ---------- gallery ----------
let gCursor = null;
async function loadGallery(reset) {
  if (reset) { gCursor = null; }
  const u = new URLSearchParams();
  if (gCursor) u.set("cursor", gCursor);
  u.set("limit", "60");
  let body;
  try { body = await api("/api/list?" + u); }
  catch (e) { if (reset) toast("加载失败: " + e.message); return; }

  if (reset) State.objectsCache = body.objects;
  else State.objectsCache = State.objectsCache.concat(body.objects);

  renderGallery();
  gCursor = body.cursor;
  $("#g-loadmore").hidden = !body.truncated;
  refreshStatsFromCache();
}

function renderGallery() {
  const grid = $("#gallery");
  if (State.objectsCache.length === 0) {
    grid.innerHTML = "";
    $("#g-empty").hidden = false;
    return;
  }
  $("#g-empty").hidden = true;
  // Diff render: keep DOM order, replace innerHTML in one shot (simpler + cheap for <100 items)
  grid.innerHTML = "";
  State.objectsCache.forEach((o) => grid.appendChild(galleryItem(o)));
}

function galleryItem(o) {
  const el = document.createElement("div");
  el.className = "item";
  el.dataset.key = o.key;
  const badges = [];
  const mod = o.moderation;
  if (mod) {
    if (mod.status === "pending") badges.push('<span class="badge pending">⏳ 审查中</span>');
    if (mod.status === "safe") badges.push('<span class="badge safe">✓ 通过</span>');
    if (mod.status === "violation") badges.push('<span class="badge violation">⛔ 违规</span>');
    if (mod.status === "error") badges.push('<span class="badge error">⚠ 错误</span>');
  }
  if (o.burnSeconds) badges.push(\`<span class="badge burn">🔥 \${o.burnSeconds}s</span>\`);
  if (o.expiresAt) badges.push(\`<span class="badge expiry">⏰</span>\`);

  el.innerHTML = \`
    <div class="thumb-wrap" data-action="open">
      <div class="badges">\${badges.join("")}</div>
      <img src="\${o.url}" loading="lazy" alt="" />
    </div>
    <div class="info">
      <div class="row">
        <span class="ip" title="\${escapeHtml(o.ip || "")}">\${escapeHtml(o.ip || "未知")}</span>
        <span class="meta">\${fmtSize(o.size)}</span>
      </div>
      <div class="row">
        <span class="meta">\${fmtRel(o.uploaded)}</span>
        <span class="meta">\${o.contentType?.replace("image/", "") || ""}</span>
      </div>
    </div>
    <div class="actions">
      <button data-action="copy">URL</button>
      <button class="recheck" data-action="recheck">🔄</button>
      <button class="del" data-action="del">删</button>
    </div>
  \`;

  el.addEventListener("click", async (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "open") {
      // Lightbox + detail sheet
      lbImg.src = o.url;
      lb.classList.add("show");
      lb.dataset.detailKey = o.key;
      lb.querySelector("img").onclick = (ev) => {
        ev.stopPropagation();
        lb.classList.remove("show");
        openDetailSheet(o);
      };
      return;
    }
    if (action === "copy") {
      e.stopPropagation();
      navigator.clipboard.writeText(o.url).then(() => toast("已复制 URL"));
      return;
    }
    if (action === "recheck") {
      e.stopPropagation();
      toast("重新审查中…");
      try {
        const r = await api("/api/recheck", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ key: o.key }),
        });
        toast("结果: " + r.moderation.status);
        loadGallery(true);
      } catch (err) { toast("失败: " + err.message); }
      return;
    }
    if (action === "del") {
      e.stopPropagation();
      if (!confirm("删除 " + (o.originalName || o.key) + "?")) return;
      try {
        await api("/api/object/" + encodeURIComponent(o.key), { method: "DELETE" });
        toast("已删除");
        loadGallery(true);
      } catch (err) { toast("失败: " + err.message); }
      return;
    }
  });
  return el;
}

$("#g-refresh").addEventListener("click", () => loadGallery(true));
$("#g-loadmore").addEventListener("click", () => loadGallery(false));

// ---------- bans ----------
async function loadBans() {
  let body;
  try { body = await api("/api/bans"); }
  catch (e) { toast("加载失败: " + e.message); return; }
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
        <td data-label="IP"><span class="ip">\${escapeHtml(b.ip)}</span></td>
        <td data-label="原因"><span class="reason">\${escapeHtml(b.reason || "—")}</span></td>
        <td data-label="时间" style="color:var(--muted);font-size:12px">\${b.ts ? fmtDate(b.ts) : "—"}</td>
        <td class="actions"><button class="danger" data-ip="\${escapeHtml(b.ip)}">解除</button></td>
      \`;
      tr.querySelector("button").onclick = async () => {
        if (!confirm("解除 " + b.ip + " 的封禁？")) return;
        try {
          await api("/api/bans/" + encodeURIComponent(b.ip), { method: "DELETE" });
          toast("已解除");
          loadBans();
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
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ip, reason: reason || "manual" }),
    });
    $("#ban-ip").value = ""; $("#ban-reason").value = "";
    toast("已封禁");
    loadBans();
  } catch (e) { toast("失败: " + e.message); }
});

// ---------- settings ----------
async function loadSettings() {
  let body;
  try { body = await api("/api/settings"); }
  catch (e) { toast("加载失败: " + e.message); return; }
  $("#set-ai").checked = !!body.settings.aiModeration;
  $("#set-ban").checked = !!body.settings.banAutoOnViolation;
}
async function saveSettings(patch) {
  try {
    await api("/api/settings", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    toast("已保存");
  } catch (e) { toast("失败: " + e.message); }
}
$("#set-ai").addEventListener("change", (e) => saveSettings({ aiModeration: e.target.checked }));
$("#set-ban").addEventListener("change", (e) => saveSettings({ banAutoOnViolation: e.target.checked }));
$("#set-live").addEventListener("change", (e) => {
  State.livePolling = e.target.checked;
  if (State.livePolling) startPolling();
  else stopPolling();
  $("#live-text").textContent = State.livePolling ? "实时" : "已暂停";
});

// ---------- stats ----------
function refreshStatsFromCache() {
  const objs = State.objectsCache;
  $("#stat-total").textContent = objs.length;
  $("#stat-pending").textContent = objs.filter((o) => !o.moderation || o.moderation.status === "pending").length;
  $("#stat-violation").textContent = objs.filter((o) => o.moderation?.status === "violation").length;
}

// ---------- polling ----------
function refreshActive() {
  if (State.activeTab === "gallery") loadGallery(true);
  else if (State.activeTab === "bans") loadBans();
  else if (State.activeTab === "settings") loadSettings();
}

function startPolling() {
  stopPolling();
  State.pollTimer = setInterval(() => {
    if (document.hidden) return;
    refreshActive();
  }, POLL_INTERVAL_MS);
}
function stopPolling() {
  if (State.pollTimer) clearInterval(State.pollTimer);
  State.pollTimer = null;
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && State.livePolling) refreshActive();
});

// ---------- boot ----------
loadGallery(true);
loadBans();
loadSettings();
startPolling();
</script>
</body>
</html>`;
}

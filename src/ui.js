// Public upload page — modern glass UI with mesh gradient.
export function renderUploadPage(env) {
  const allowPublic = env.ALLOW_PUBLIC === "true";
  const maxMb = parseInt(env.MAX_SIZE_MB || "20", 10) || 20;
  const allowed = (env.ALLOWED_MIME || "")
    .split(",").map((s) => s.trim().replace(/^image\//, "")).filter(Boolean).join(" · ") || "image/*";
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<meta name="color-scheme" content="dark light" />
<title>imgbed · 简洁的图床</title>
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="%23a78bfa"/><stop offset="1" stop-color="%23f472b6"/></linearGradient></defs><rect width="20" height="16" x="2" y="4" rx="4" fill="url(%23g)"/><circle cx="9" cy="10" r="2" fill="%23fff"/><path d="M3 18l5-6 4 4 3-3 6 7H3z" fill="%23fff"/></svg>'
)}" />
${BASE_CSS}
<style>
  /* upload-specific */
  .hero { text-align: center; padding: 32px 0 24px; }
  .hero h1 { font-size: clamp(28px, 5vw, 40px); margin: 0 0 8px; font-weight: 800; letter-spacing: -0.02em; }
  .hero h1 .gradient {
    background: linear-gradient(120deg, #a78bfa 0%, #f472b6 50%, #fb923c 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .hero p { margin: 0; color: var(--muted); font-size: 15px; }

  .drop {
    border: 2px dashed var(--border-strong);
    border-radius: 18px;
    padding: 56px 24px;
    text-align: center;
    transition: all .25s cubic-bezier(.4,0,.2,1);
    cursor: pointer;
    position: relative;
    background: var(--surface);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  }
  .drop:hover, .drop.hover {
    border-color: var(--accent);
    background: linear-gradient(135deg, rgba(167,139,250,.08), rgba(244,114,182,.08));
    transform: translateY(-2px);
  }
  .drop .icon {
    width: 64px; height: 64px; margin: 0 auto 16px;
    border-radius: 18px;
    background: linear-gradient(135deg, #a78bfa, #f472b6);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 8px 24px rgba(167,139,250,.3);
  }
  .drop .icon svg { width: 28px; height: 28px; color: #fff; }
  .drop h3 { margin: 0 0 6px; font-size: 18px; font-weight: 600; }
  .drop p { margin: 4px 0; color: var(--muted); font-size: 13px; }
  .drop .hint { margin-top: 14px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
  .drop .hint span {
    font-size: 11px; padding: 4px 10px;
    background: var(--surface-2); border: 1px solid var(--border);
    border-radius: 999px; color: var(--muted);
  }

  .opts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
  @media (max-width: 540px) { .opts { grid-template-columns: 1fr; } }
  .opt {
    background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
    padding: 14px; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  }
  .opt header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .opt header label { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; cursor: pointer; }
  .opt header label .emoji { font-size: 16px; }
  .opt .body { font-size: 12px; color: var(--muted); }
  .opt input[type=range] { width: 100%; accent-color: var(--accent); margin: 6px 0; }
  .opt .value { font-variant-numeric: tabular-nums; color: var(--text); font-weight: 600; }

  .results { margin-top: 16px; display: flex; flex-direction: column; gap: 10px; }
  .res {
    background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
    padding: 12px; display: flex; gap: 12px; align-items: center;
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    animation: slidein .25s ease;
  }
  @keyframes slidein { from { opacity: 0; transform: translateY(-4px);} to {opacity:1; transform:none;} }
  .res .thumb {
    width: 64px; height: 64px; border-radius: 10px; flex: 0 0 auto;
    background: var(--surface-2); object-fit: cover;
  }
  .res .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
  .res .title { font-size: 13px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .res .name { font-weight: 600; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .res code {
    background: var(--surface-2); border: 1px solid var(--border);
    padding: 5px 9px; border-radius: 7px; font-size: 11px;
    cursor: pointer; word-break: break-all;
    transition: all .15s; font-family: ui-monospace, "SF Mono", Menlo, monospace;
  }
  .res code:hover { border-color: var(--accent); color: var(--accent); }
  .res .progress {
    height: 4px; background: var(--surface-2); border-radius: 2px;
    overflow: hidden; margin-top: 4px;
  }
  .res .progress > div {
    height: 100%; width: 0;
    background: linear-gradient(90deg, #a78bfa, #f472b6);
    transition: width .2s;
  }
  .badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 8px; border-radius: 999px;
    font-size: 10px; font-weight: 600; letter-spacing: 0.02em;
    text-transform: uppercase;
  }
  .badge.pending { background: rgba(251,191,36,.15); color: #f59e0b; border: 1px solid rgba(251,191,36,.3); }
  .badge.safe { background: rgba(34,197,94,.15); color: #22c55e; border: 1px solid rgba(34,197,94,.3); }
  .badge.violation { background: rgba(239,68,68,.15); color: #ef4444; border: 1px solid rgba(239,68,68,.3); }
  .badge.burn { background: rgba(244,114,182,.15); color: #f472b6; border: 1px solid rgba(244,114,182,.3); }
  .badge.expiry { background: rgba(99,102,241,.15); color: #818cf8; border: 1px solid rgba(99,102,241,.3); }
  .badge.error { background: rgba(148,163,184,.15); color: var(--muted); border: 1px solid var(--border); }

  .token-bar {
    margin-bottom: 16px;
    background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
    padding: 12px 14px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  }
  .token-bar input {
    flex: 1; min-width: 160px; padding: 8px 12px; border-radius: 8px;
    background: var(--surface-2); color: var(--text);
    border: 1px solid var(--border); outline: none; font: inherit;
  }
  .token-bar input:focus { border-color: var(--accent); }
  .token-bar button {
    padding: 8px 14px; border-radius: 8px; border: 0;
    background: linear-gradient(135deg, #a78bfa, #f472b6); color: #fff;
    cursor: pointer; font: inherit; font-weight: 600;
  }

  .footer-info {
    text-align: center; margin-top: 32px;
    color: var(--muted); font-size: 12px;
  }
  .footer-info a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
</style>
</head>
<body>
<div class="mesh"></div>
<div class="wrap">
  <div class="hero">
    <h1><span class="gradient">imgbed</span> · 极简图床</h1>
    <p>Cloudflare Workers + R2 · ${maxMb}MB · ${allowPublic ? "无需注册" : "需 Token"}</p>
  </div>

  ${allowPublic ? "" : `
  <div class="token-bar">
    <span style="font-size: 12px; color: var(--muted);">🔑 上传 Token</span>
    <input id="token" type="password" placeholder="粘贴 UPLOAD_TOKEN" />
    <button id="save-token">保存</button>
  </div>`}

  <div class="drop" id="drop">
    <div class="icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v14m0-14l-5 5m5-5l5 5M5 21h14"/></svg>
    </div>
    <h3>点击 · 拖拽 · 粘贴</h3>
    <p>把图片放进来，或者直接 Ctrl+V</p>
    <div class="hint">
      <span>${allowed}</span>
      <span>≤ ${maxMb} MB</span>
      <span>多文件</span>
    </div>
  </div>
  <input type="file" id="file" accept="image/*" multiple style="display:none" />

  <div class="opts">
    <div class="opt">
      <header>
        <label><span class="emoji">🔥</span> 阅后即焚</label>
        <input type="checkbox" id="burn-on" />
      </header>
      <div class="body">
        首位访客打开后开始计时，到点自动销毁
        <div style="display:flex;gap:10px;align-items:center;margin-top:8px">
          <input type="range" id="burn-sec" min="10" max="600" step="10" value="60" disabled />
          <span class="value" id="burn-val">60s</span>
        </div>
      </div>
    </div>
    <div class="opt">
      <header>
        <label><span class="emoji">⏰</span> 链接过期</label>
        <input type="checkbox" id="exp-on" />
      </header>
      <div class="body">
        到时不再可访问，懒删除（默认永久保留）
        <div style="display:flex;gap:10px;align-items:center;margin-top:8px">
          <select id="exp-sec" disabled style="flex:1;padding:6px;border-radius:8px;background:var(--surface-2);color:var(--text);border:1px solid var(--border);font:inherit">
            <option value="3600">1 小时</option>
            <option value="86400">1 天</option>
            <option value="604800">7 天</option>
            <option value="2592000" selected>30 天</option>
            <option value="7776000">90 天</option>
            <option value="31536000">1 年</option>
          </select>
        </div>
      </div>
    </div>
  </div>

  <div class="results" id="results"></div>

  <div class="footer-info">
    <a href="https://github.com/Minis233/imgbed" target="_blank" rel="noopener">GitHub</a> ·
    Powered by Cloudflare Workers + R2
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
${COMMON_JS}

const allowPublic = ${allowPublic ? "true" : "false"};

// burn / expiry toggles
const burnOn = $("#burn-on"), burnSec = $("#burn-sec"), burnVal = $("#burn-val");
const expOn = $("#exp-on"), expSec = $("#exp-sec");
function updateBurnVal() {
  const v = +burnSec.value;
  burnVal.textContent = v < 60 ? v + "s" : (v / 60).toFixed(v % 60 ? 1 : 0) + "min";
}
updateBurnVal();
burnSec.addEventListener("input", updateBurnVal);
burnOn.addEventListener("change", () => { burnSec.disabled = !burnOn.checked; });
expOn.addEventListener("change", () => { expSec.disabled = !expOn.checked; });

// token (only for non-public mode)
const tokenInput = $("#token");
if (tokenInput) {
  tokenInput.value = localStorage.getItem("imgbed.token") || "";
  $("#save-token").addEventListener("click", () => {
    localStorage.setItem("imgbed.token", tokenInput.value.trim());
    toast("已保存");
  });
}
function getToken() { return localStorage.getItem("imgbed.token") || ""; }

// upload wiring
const drop = $("#drop"), fileInput = $("#file"), results = $("#results");
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
  const items = e.clipboardData?.items; if (!items) return;
  const files = [];
  for (const it of items) if (it.kind === "file") {
    const f = it.getAsFile();
    if (f && f.type.startsWith("image/")) files.push(f);
  }
  if (files.length) uploadFiles(files);
});

async function uploadFiles(files) {
  for (const f of files) {
    const row = document.createElement("div");
    row.className = "res";
    row.innerHTML = \`
      <img class="thumb" alt="" />
      <div class="body">
        <div class="title"><span class="name">\${escapeHtml(f.name)}</span><span style="color:var(--muted);font-size:11px">\${formatSize(f.size)}</span></div>
        <div class="progress"><div></div></div>
      </div>
    \`;
    results.prepend(row);
    const reader = new FileReader();
    reader.onload = (e) => row.querySelector(".thumb").src = e.target.result;
    reader.readAsDataURL(f);
    try {
      const res = await uploadOne(f, (p) => row.querySelector(".progress > div").style.width = p + "%");
      renderResult(row, res);
    } catch (err) {
      row.querySelector(".body").innerHTML = \`<div style="color:#ef4444;font-size:13px">\${escapeHtml(f.name)} · \${escapeHtml(err.message)}</div>\`;
    }
  }
}

function uploadOne(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    if (!allowPublic) {
      const t = getToken();
      if (t) xhr.setRequestHeader("authorization", "Bearer " + t);
    }
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
    if (burnOn.checked) fd.append("burn", String(burnSec.value));
    if (expOn.checked) fd.append("expiry", String(expSec.value));
    xhr.send(fd);
  });
}

function renderResult(row, res) {
  const badges = [];
  if (res.moderation === "pending") badges.push('<span class="badge pending">⏳ 审查中</span>');
  if (res.moderation === "disabled") {} // no badge
  if (res.burnSeconds) badges.push(\`<span class="badge burn">🔥 \${res.burnSeconds}s 阅后即焚</span>\`);
  if (res.expiresAt) {
    const d = new Date(res.expiresAt);
    badges.push(\`<span class="badge expiry">⏰ \${d.toLocaleString()}</span>\`);
  }
  row.innerHTML = \`
    <img class="thumb" src="\${res.url}" alt="" />
    <div class="body">
      <div class="title">
        <span class="name">已上传 · \${formatSize(res.size)}</span>
        \${badges.join("")}
      </div>
      <code data-copy="\${res.url}">\${res.url}</code>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <code data-copy="\${escapeAttr(res.markdown)}">Markdown</code>
        <code data-copy="\${escapeAttr(res.html)}">HTML</code>
        <code data-copy="\${escapeAttr(res.bbcode)}">BBCode</code>
      </div>
    </div>
  \`;
  row.querySelectorAll("code[data-copy]").forEach((c) => {
    c.addEventListener("click", () => navigator.clipboard.writeText(c.dataset.copy).then(() => toast("已复制")));
  });

  // Poll moderation status if pending
  if (res.moderation === "pending") {
    pollModeration(row, res.key);
  }
}

function pollModeration(row, key) {
  let attempts = 0;
  const tick = async () => {
    attempts++;
    try {
      const r = await fetch("/api/status/" + encodeURIComponent(key));
      const j = await r.json();
      const status = j.moderation?.status;
      const badge = row.querySelector(".badge.pending");
      if (status === "safe") {
        if (badge) { badge.className = "badge safe"; badge.textContent = "✅ 已通过"; }
        return;
      }
      if (status === "violation") {
        if (badge) { badge.className = "badge violation"; badge.textContent = "⛔ 已违规·删除"; }
        return;
      }
      if (status === "error") {
        if (badge) { badge.className = "badge error"; badge.textContent = "⚠ 审查失败"; }
        return;
      }
    } catch {}
    if (attempts < 30) setTimeout(tick, 2500);
  };
  setTimeout(tick, 3000);
}

function escapeAttr(s) { return escapeHtml(s).replace(/"/g, "&quot;"); }
</script>
</body>
</html>`;
}

const BASE_CSS = `<style>
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
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: #fafafa;
      --surface: rgba(255,255,255,0.7);
      --surface-2: rgba(255,255,255,0.85);
      --border: rgba(15,23,42,0.06);
      --border-strong: rgba(15,23,42,0.14);
      --text: #0f172a;
      --muted: #64748b;
    }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; min-height: 100vh; }
  body {
    background: var(--bg); color: var(--text);
    font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
    overflow-x: hidden;
  }
  .mesh {
    position: fixed; inset: 0; z-index: -1; pointer-events: none;
    background:
      radial-gradient(900px 600px at 10% 0%, rgba(167,139,250,.18), transparent 50%),
      radial-gradient(800px 500px at 100% 30%, rgba(244,114,182,.15), transparent 50%),
      radial-gradient(600px 400px at 50% 100%, rgba(251,146,60,.12), transparent 50%);
  }
  @media (prefers-color-scheme: light) {
    .mesh {
      background:
        radial-gradient(900px 600px at 10% 0%, rgba(167,139,250,.20), transparent 50%),
        radial-gradient(800px 500px at 100% 30%, rgba(244,114,182,.18), transparent 50%),
        radial-gradient(600px 400px at 50% 100%, rgba(251,146,60,.15), transparent 50%);
    }
  }
  .wrap { max-width: 720px; margin: 0 auto; padding: 24px 20px 80px; position: relative; }
  .toast {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(20px);
    background: rgba(15,23,42,0.95); color: #fff; border: 1px solid rgba(255,255,255,.1);
    padding: 10px 18px; border-radius: 10px; font-size: 13px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    opacity: 0; pointer-events: none; transition: all .25s cubic-bezier(.4,0,.2,1);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    z-index: 100;
  }
  .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
</style>`;

const COMMON_JS = `
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

function formatSize(n) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n/1024).toFixed(1) + " KB";
  return (n / 1024 / 1024).toFixed(2) + " MB";
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function fmtDate(d) {
  const x = new Date(d);
  if (isNaN(x)) return "-";
  return x.toLocaleString();
}
`;

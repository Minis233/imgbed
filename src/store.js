// Storage helpers — KV-backed metadata, ban list, settings, burn state.
//
// Keys:
//   settings              -> { aiModeration: bool, banAutoOnViolation: bool }
//   ban:<ip>              -> { reason, ts, key? }
//   burn:<key>            -> { firstSeenAt, durationSec }   (single-shot, written on first view)
//   mod:<key>             -> { status: "pending"|"safe"|"violation"|"error", scores?, ts, model? }
//   ip-keys:<ip>          -> appended via list-key listing (we just rely on R2 customMetadata.ip)

const SETTINGS_KEY = "settings";

const DEFAULT_SETTINGS = {
  aiModeration: false,
  banAutoOnViolation: true,
  moderationModel: "@cf/llava-hf/llava-1.5-7b-hf",
};

export async function getSettings(env) {
  const raw = await env.META.get(SETTINGS_KEY, "json");
  return { ...DEFAULT_SETTINGS, ...(raw || {}) };
}

export async function putSettings(env, patch) {
  const cur = await getSettings(env);
  const next = { ...cur, ...patch };
  await env.META.put(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export async function isBanned(env, ip) {
  if (!ip) return null;
  return env.META.get(`ban:${ip}`, "json");
}

export async function banIp(env, ip, info = {}) {
  if (!ip) return;
  await env.META.put(`ban:${ip}`, JSON.stringify({ ts: Date.now(), ...info }));
}

export async function unbanIp(env, ip) {
  if (!ip) return;
  await env.META.delete(`ban:${ip}`);
}

export async function listBans(env) {
  const list = await env.META.list({ prefix: "ban:" });
  const out = [];
  for (const k of list.keys) {
    const ip = k.name.slice("ban:".length);
    const info = await env.META.get(k.name, "json");
    if (!info) continue; // KV list is eventually consistent — skip stale tombstones
    out.push({ ip, ...info });
  }
  return out;
}

export async function getBurnState(env, key) {
  return env.META.get(`burn:${key}`, "json");
}

export async function startBurn(env, key, durationSec) {
  // Set if not already set; KV has no atomic CAS so race is mostly harmless here:
  // worst case 2 readers race, both see no record, both write — values diverge by ms.
  const existing = await getBurnState(env, key);
  if (existing) return existing;
  const state = { firstSeenAt: Date.now(), durationSec };
  await env.META.put(`burn:${key}`, JSON.stringify(state), { expirationTtl: Math.max(60, durationSec * 2 + 3600) });
  return state;
}

export async function getModeration(env, key) {
  return env.META.get(`mod:${key}`, "json");
}

export async function putModeration(env, key, info) {
  await env.META.put(`mod:${key}`, JSON.stringify(info));
}

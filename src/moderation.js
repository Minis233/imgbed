// AI moderation. Uses Workers AI to score whether an image is NSFW / disallowed.
//
// Llava chat-style: pass image bytes + a yes/no question; we then look at output
// for a structured verdict. Llava is not perfect — we keep the prompt strict and
// require the word "yes" to be the first non-whitespace token of the answer.

import { getSettings, putModeration, banIp } from "./store.js";

const PROMPT = `You are a strict content moderation classifier.

Look at the image and answer with EXACTLY ONE WORD on the first line:
- "VIOLATION" if the image contains any of: explicit sexual content, child sexual abuse material, graphic gore or torture, real-world weapons of mass destruction instructions, or extremist hate symbols inciting violence.
- "SAFE" otherwise.

After that single word, you may give a one-line reason.`;

export async function moderateImage(env, key, imageBytes, uploaderIp) {
  const settings = await getSettings(env);
  if (!settings.aiModeration) return { skipped: true };

  const model = settings.moderationModel || "@cf/llava-hf/llava-1.5-7b-hf";
  const arr = imageBytes instanceof ArrayBuffer ? new Uint8Array(imageBytes) : imageBytes;
  const imageArr = Array.from(arr);

  let result;
  try {
    result = await env.AI.run(model, {
      image: imageArr,
      prompt: PROMPT,
      max_tokens: 64,
    });
  } catch (e) {
    const info = { status: "error", ts: Date.now(), error: String(e?.message || e), model };
    await putModeration(env, key, info);
    return info;
  }

  const text = String(result?.description || result?.response || result?.output || "").trim();
  const firstWord = text.split(/\s+/)[0]?.toUpperCase() || "";
  const violation = firstWord === "VIOLATION";

  const info = {
    status: violation ? "violation" : "safe",
    ts: Date.now(),
    model,
    raw: text.slice(0, 500),
  };
  await putModeration(env, key, info);

  if (violation) {
    // Auto-cleanup: remove from bucket + ban uploader IP if enabled.
    try { await env.BUCKET.delete(key); } catch {}
    if (settings.banAutoOnViolation && uploaderIp) {
      await banIp(env, uploaderIp, { reason: "ai-moderation:violation", key });
    }
  }

  return info;
}

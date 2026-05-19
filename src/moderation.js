// AI moderation via Workers AI (Llava-1.5-7B). Strategy:
//
// Llava-1.5 is a general-purpose VLM, not a dedicated NSFW classifier. Asking
// it "is this safe?" gets soft / hedged answers most of the time. So we use
// TWO passes and OR them together:
//
//   1) describe — let Llava describe the image freely, then scan the
//      description for explicit terms (nude / naked / penis / vagina /
//      blood / gore / etc.). Llava is honest when describing.
//
//   2) classify — direct yes/no for explicit categories. Picks up cases
//      where the description was vague.
//
// If EITHER pass flags it, we treat it as a violation. This is fail-loud
// rather than fail-soft. Admins can manually un-ban / re-upload anything
// that's a false positive.

import { getSettings, putModeration, banIp } from "./store.js";

// Tokens that, if Llava puts them in its description, indicate the image
// should be removed. Tuned conservatively — any one match triggers.
const VIOLATION_TERMS = [
  // explicit / sexual
  "nude", "naked", "nudity", "topless", "bottomless",
  "penis", "vagina", "vulva", "genital", "genitalia", "scrotum",
  "breast", "breasts", "nipple", "nipples", "areola",
  "intercourse", "sexual act", "having sex", "blowjob", "fellatio", "cunnilingus",
  "ejaculat", "semen", "cum shot", "masturbat", "orgasm",
  "porn", "pornograph", "nsfw", "explicit",
  "erection", "erect penis", "underwear visible",
  // child safety — extra strict
  "child", "minor", "underage", "young girl", "young boy", "loli",
  // gore / violence
  "gore", "graphic violence", "decapitat", "dismember",
  "blood splatter", "bloodied corpse", "mutilat",
  // hate symbols
  "swastika", "nazi flag", "kkk hood",
  // drugs explicit imagery
  "drug paraphernalia",
];

// Words that, while sometimes innocent ("blood test"), need to be checked
// in the context of negative qualifiers.
const SOFT_TERMS = ["blood", "wound", "injury", "corpse", "dead body"];
const NEGATIVE_QUALIFIERS = ["graphic", "explicit", "severe", "horrific", "disturbing"];

function scanDescription(text) {
  const lower = (text || "").toLowerCase();
  for (const term of VIOLATION_TERMS) {
    if (lower.includes(term)) return { hit: true, term };
  }
  // Soft terms only count if a negative qualifier is also present
  for (const t of SOFT_TERMS) {
    if (!lower.includes(t)) continue;
    for (const q of NEGATIVE_QUALIFIERS) {
      if (lower.includes(q)) return { hit: true, term: `${q}+${t}` };
    }
  }
  return { hit: false };
}

const DESCRIBE_PROMPT =
  "Describe this image in detail. List every person, body part, clothing item, action, and notable object you can see. Be explicit and clinical — do not omit nudity, sexual content, gore, or other sensitive elements if present. One paragraph.";

const CLASSIFY_PROMPT =
  "Answer with ONE WORD on the first line, then optional reason on the next.\n" +
  "Reply UNSAFE if this image contains ANY of:\n" +
  "- Visible genitals, anus, female breast nipples, or sexual acts\n" +
  "- A person who is fully or partially nude in a sexual / suggestive pose\n" +
  "- Anyone who appears to be a minor in any sexual context (always UNSAFE, regardless of pose)\n" +
  "- Graphic gore, torture, mutilation, or fresh corpses\n" +
  "- Extremist hate symbols (swastika, KKK regalia) being celebrated\n" +
  "Otherwise reply SAFE.";

async function callLlava(env, model, imageArr, prompt, maxTokens) {
  const result = await env.AI.run(model, {
    image: imageArr,
    prompt,
    max_tokens: maxTokens,
  });
  const text = String(
    result?.description ?? result?.response ?? result?.output ?? result?.result ?? ""
  ).trim();
  return text;
}

export async function moderateImage(env, key, imageBytes, uploaderIp) {
  const settings = await getSettings(env);
  if (!settings.aiModeration) return { skipped: true };

  const model = settings.moderationModel || "@cf/llava-hf/llava-1.5-7b-hf";
  const arr = imageBytes instanceof ArrayBuffer ? new Uint8Array(imageBytes) : imageBytes;
  const imageArr = Array.from(arr);

  let description = "", verdict = "", error = null;

  try {
    description = await callLlava(env, model, imageArr, DESCRIBE_PROMPT, 220);
  } catch (e) {
    error = String(e?.message || e);
  }

  try {
    verdict = await callLlava(env, model, imageArr, CLASSIFY_PROMPT, 32);
  } catch (e) {
    if (!error) error = String(e?.message || e);
  }

  // First non-empty word of the verdict, normalized.
  const verdictWord = verdict.split(/\s+/).filter(Boolean)[0]?.toUpperCase() || "";

  const scan = scanDescription(description);
  const verdictUnsafe = ["UNSAFE", "VIOLATION", "NSFW", "EXPLICIT"].includes(verdictWord);

  let status;
  let reason = [];
  if (scan.hit) { reason.push(`description-keyword: ${scan.term}`); }
  if (verdictUnsafe) { reason.push(`classifier-verdict: ${verdictWord}`); }

  if (scan.hit || verdictUnsafe) {
    status = "violation";
  } else if (description || verdict) {
    status = "safe";
  } else {
    status = "error";
  }

  const info = {
    status,
    ts: Date.now(),
    model,
    description: description.slice(0, 800),
    verdict: verdict.slice(0, 200),
    reasons: reason,
    error,
  };
  await putModeration(env, key, info);

  if (status === "violation") {
    // Only the current violating object is deleted. Existing safe uploads from
    // the same IP are left intact; banning is forward-only (blocks new uploads).
    try { await env.BUCKET.delete(key); } catch {}
    if (settings.banAutoOnViolation && uploaderIp) {
      await banIp(env, uploaderIp, { reason: "ai-moderation: " + reason.join(", "), key });
    }
  }

  return info;
}

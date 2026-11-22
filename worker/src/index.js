// Cloudflare Worker: runs on a cron trigger (see wrangler.toml), checks
// myadeen.com for Rami Aman courses and pushes to the phone via ntfy.
// State (what the last check saw) lives in Workers KV under the key "state".
import { API, summarize, compare } from "./check.js";

async function fetchCourses() {
  const out = [];
  for (let page = 1; ; page++) {
    const r = await fetch(API + page, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    out.push(...d.data);
    if (page >= (d.meta?.last_page ?? 1)) return out;
  }
}

async function pushPhone(env, { title, text, url }) {
  if (!env.NTFY_TOPIC) {
    console.log("NTFY_TOPIC not set; no push sent");
    return;
  }
  try {
    await fetch(`https://ntfy.sh/${env.NTFY_TOPIC}`, {
      method: "POST",
      body: `${text}\nTap to open the booking page.`,
      headers: { Title: title, Click: url, Priority: "urgent", Tags: "dart" },
    });
  } catch (e) {
    console.log(`phone push failed: ${e}`);
  }
}

async function check(env) {
  let courses;
  try {
    courses = await fetchCourses();
  } catch (e) {
    console.log(`fetch failed: ${e}`); // try again next run
    return;
  }
  const raw = await env.STATE.get("state");
  const prev = raw === null ? null : JSON.parse(raw);
  const now = summarize(courses);
  const { alerts, log } = compare(prev, now);

  log.forEach((l) => console.log(l));
  for (const a of alerts) await pushPhone(env, a);
  console.log(
    "checked: " +
      (Object.values(now).map((c) => `${c.name} ${c.dates} ${c.left}/${c.seats} left`).join("; ") ||
        "no Rami Aman course listed"),
  );

  // Write only when something changed: KV's free plan allows 1,000 writes a day.
  const next = JSON.stringify(now);
  if (next !== raw) await env.STATE.put("state", next);
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(check(env));
  },
};

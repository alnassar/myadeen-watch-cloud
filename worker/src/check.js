// Pure logic for the Myadeen course watcher: no network, no storage, so it can
// be tested on its own. The Worker (index.js) feeds it data and acts on the result.

export const API = "https://myadeen.com/api/products?category_id=5&limit=100&page=";
export const MATCH = "رامي امن"; // course name to watch, normalized

// Treat أ إ آ as ا and collapse spaces, so spelling variations still match.
export function norm(s) {
  return String(s ?? "").replace(/[أإآ]/g, "ا").split(/\s+/).filter(Boolean).join(" ");
}

// Turn the site's course list into { id: {name, left, seats, dates, url} }
// for the Rami Aman courses only.
export function summarize(courses) {
  const out = {};
  for (const p of courses) {
    if (!norm(p.name).includes(MATCH)) continue;
    const b = p.booking || {};
    const seats = parseInt(p.seats ?? b.seats ?? 0, 10) || 0;
    const ordered = parseInt(p.ordered_seats ?? b.ordered_seats ?? 0, 10) || 0;
    out[String(p.id)] = {
      name: p.name,
      left: Math.max(seats - ordered, 0), // the site sometimes oversells
      seats,
      dates: (b.multiple_dates || []).map((d) => String(d).slice(0, 10)).join(", "),
      url: "https://myadeen.com/" + encodeURIComponent(p.url_key),
    };
  }
  return out;
}

// Compare this check with the last one.
// prev = null means first run ever: remember what is there, alert only on open seats.
// Returns the alerts to send and log lines.
export function compare(prev, now) {
  const firstRun = prev === null;
  const before = prev || {};
  const alerts = [];
  const log = [];
  for (const [id, c] of Object.entries(now)) {
    const old = before[id];
    const info = `${c.name} | ${c.dates} | ${c.left}/${c.seats} seats left`;
    if (!old && !firstRun) {
      alerts.push({ title: "New Rami Aman course!", text: info, url: c.url });
      log.push(`NEW COURSE: ${info}`);
    } else if (c.left > 0 && (!old || old.left === 0)) {
      alerts.push({ title: "Seats available!", text: info, url: c.url });
      log.push(`SEATS OPEN: ${info}`);
    } else if (!old || old.left !== c.left) {
      log.push(`update: ${info}`);
    }
  }
  for (const id of Object.keys(before)) {
    if (!(id in now)) log.push(`removed from site: ${before[id].name}`);
  }
  return { alerts, log };
}

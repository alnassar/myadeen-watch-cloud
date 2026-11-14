#!/usr/bin/env python3
"""Watch myadeen.com for new "Rami Aman" (رامي امن) courses and open seats.

Cloud copy run by GitHub Actions every 5 minutes. Sends an ntfy phone push
when a new matching course appears, or when a course goes from full to having
seats. State is kept in state.json, committed back to the repo.
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(HERE, "state.json")
LOG = os.path.join(HERE, "watch.log")
API = "https://myadeen.com/api/products?category_id=5&limit=100&page={}"
MATCH = "رامي امن"  # course name to watch, normalized


def norm(s):
    for a in "أإآ":
        s = s.replace(a, "ا")
    return " ".join(s.split())


def log(msg):
    print(f"{datetime.now():%Y-%m-%d %H:%M:%S} {msg}")


def fetch_courses():
    out, page = [], 1
    while True:
        req = urllib.request.Request(
            API.format(page),
            headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            d = json.load(r)
        out += d["data"]
        if page >= d.get("meta", {}).get("last_page", 1):
            return out
        page += 1


def alert(title, text, url):
    push_phone(title, text, url)


def push_phone(title, text, url):
    """Phone push via ntfy; topic comes from the NTFY_TOPIC secret."""
    topic = os.environ.get("NTFY_TOPIC", "").strip()
    if not topic:
        log("NTFY_TOPIC not set; no push sent")
        return
    req = urllib.request.Request(
        f"https://ntfy.sh/{topic}",
        data=f"{text}\nTap to open the booking page.".encode("utf-8"),
        headers={"Title": title, "Click": url, "Priority": "urgent", "Tags": "dart"},
        method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=20).read()
    except Exception as e:
        log(f"phone push failed: {e}")


def main():
    state = {}
    if os.path.exists(STATE):
        with open(STATE, encoding="utf-8") as f:
            state = json.load(f)
    first_run = not state

    try:
        courses = fetch_courses()
    except Exception as e:  # network hiccup: try again next run
        log(f"fetch failed: {e}")
        return

    new_state = {}
    for p in courses:
        if MATCH not in norm(p.get("name", "")):
            continue
        b = p.get("booking") or {}
        seats = int(p.get("seats") or b.get("seats") or 0)
        ordered = int(p.get("ordered_seats") or b.get("ordered_seats") or 0)
        left = max(seats - ordered, 0)
        dates = ", ".join(d[:10] for d in (b.get("multiple_dates") or []))
        url = "https://myadeen.com/" + urllib.parse.quote(p["url_key"])
        pid = str(p["id"])
        new_state[pid] = {"name": p["name"], "left": left, "seats": seats, "dates": dates}

        prev = state.get(pid)
        info = f"{p['name']} | {dates} | {left}/{seats} seats left"
        if prev is None and not first_run:
            log(f"NEW COURSE: {info}")
            alert("New Rami Aman course!", f"{info}", url)
        elif left > 0 and (prev is None or prev["left"] == 0):
            log(f"SEATS OPEN: {info}")
            alert("Seats available!", info, url)
        elif prev is None or prev["left"] != left:
            log(f"update: {info}")

    log("checked: " + ("; ".join(f"{v['name']} {v['dates']} {v['left']}/{v['seats']} left" for v in new_state.values()) or "no Rami Aman course listed"))

    for pid in set(state) - set(new_state):
        log(f"removed from site: {state[pid]['name']}")

    with open(STATE, "w", encoding="utf-8") as f:
        json.dump(new_state, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    if "--test-alert" in sys.argv:
        alert("Myadeen watcher test", "Notifications are working.", "https://myadeen.com/training")
    else:
        main()

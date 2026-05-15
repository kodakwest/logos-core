#!/usr/bin/env python3
"""Upload ALL New Testament books to bible-ai-api, chapter by chapter."""
import json, os, sys, re, glob, urllib.request, urllib.error, time
from pathlib import Path

# All NT books with their BTB book numbers
NT_BOOKS = [
    (40, "Matthew"), (41, "Mark"), (42, "Luke"), (43, "John"),
    (44, "Acts"), (45, "Romans"), (46, "1 Corinthians"), (47, "2 Corinthians"),
    (48, "Galatians"), (49, "Ephesians"), (50, "Philippians"), (51, "Colossians"),
    (52, "1 Thessalonians"), (53, "2 Thessalonians"), (54, "1 Timothy"),
    (55, "2 Timothy"), (56, "Titus"), (57, "Philemon"), (58, "Hebrews"),
    (59, "James"), (60, "1 Peter"), (61, "2 Peter"), (62, "1 John"),
    (63, "2 John"), (64, "3 John"), (65, "Jude"), (66, "Revelation")
]

BASE = Path("/home/tsrwest/BTB/interlinear")
YAML_RE = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)
BATCH_SIZE = 10
API = "https://bible-ai-api.kodakwest.workers.dev/api/upload/chapter"

def parse_verse(fpath):
    text = open(fpath).read()
    m = YAML_RE.search(text)
    if not m: return None
    yaml = {k.strip(): v.strip().strip('"').strip("'")
            for k, v in re.findall(r"^(\w+):\s*(.+?)$", m.group(1), re.MULTILINE)}
    # Get verse number from filename (Book.ch.verse.md)
    base = os.path.basename(fpath).replace(".md", "")
    parts = base.split(".")
    if len(parts) < 3: return None
    return {
        "book": yaml.get("book", parts[0]),
        "bookNumber": int(yaml.get("book_number", parts[1])),
        "chapter": int(parts[1]),
        "verse": int(parts[2]),
        "kjv": yaml.get("kjv", ""),
        "bsb": yaml.get("bsb", ""),
        "greek": yaml.get("greek", ""),
        "topics": [],
        "pericope": yaml.get("pericope", "").replace("[[", "").replace("]]", "")
    }

def upload_batch(verses, retries=3):
    for attempt in range(retries):
        try:
            payload = json.dumps({"verses": verses}).encode()
            req = urllib.request.Request(API, data=payload,
                headers={"Content-Type": "application/json", "User-Agent": "bible-ai-uploader/1.0"},
                method="POST")
            resp = urllib.request.urlopen(req, timeout=120)
            return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            if attempt < retries - 1:
                time.sleep(5 * (attempt + 1))
                continue
            return {"error": f"HTTP {e.code}: {body[:100]}"}
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(5 * (attempt + 1))
                continue
            return {"error": str(e)[:100]}

total_all = 0
errors_all = 0

for book_num, book_name in NT_BOOKS:
    dirs = [d for d in BASE.iterdir() if d.name.startswith(f"{book_num} - ")]
    if not dirs:
        print(f"SKIP {book_name}: directory not found")
        continue
    book_dir = dirs[0]
    chapters = sorted([int(d.name) for d in book_dir.iterdir() if d.is_dir() and d.name.isdigit()])
    if not chapters:
        print(f"SKIP {book_name}: no chapters found")
        continue
    print(f"\n{book_name} ({book_num}): {len(chapters)} chapters")
    book_ok = 0
    book_errors = 0
    for ch in chapters:
        chap_dir = book_dir / str(ch)
        files = sorted(chap_dir.glob("*.md"),
                       key=lambda f: int(f.stem.rsplit(".", 2)[-1]))
        verses = [parse_verse(f) for f in files]
        verses = [v for v in verses if v]
        if not verses:
            continue
        # Upload in batches
        for i in range(0, len(verses), BATCH_SIZE):
            batch = verses[i:i+BATCH_SIZE]
            result = upload_batch(batch)
            if "error" in result:
                book_errors += len(batch)
                print(f"  Ch {ch}: ERROR ({result['error']})")
            else:
                ok = result.get("versesInserted", 0)
                errs = len(result.get("errors", []))
                book_ok += ok
                book_errors += errs
                if errs:
                    print(f"  Ch {ch}: {ok} ok, {errs} errors (first: {result['errors'][0][:60]})")
        print(f"  Ch {ch}: {book_ok} verses total so far")
    print(f"  DONE: {book_ok} ok, {book_errors} errors")
    total_all += book_ok
    errors_all += book_errors

print(f"\n{'='*40}")
print(f"NT COMPLETE: {total_all} total verses, {errors_all} errors")

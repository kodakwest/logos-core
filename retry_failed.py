#!/usr/bin/env python3
"""Retry only the chapters that failed with 503 errors."""
import json, os, re, urllib.request, urllib.error, time, sys
from pathlib import Path

BASE = Path("/home/tsrwest/BTB/interlinear")
YAML_RE = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)
BATCH_SIZE = 3
API = "https://logos-core.kodakwest.workers.dev/api/upload/chapter"

# Chapters that failed with 503
FAILED = [
    (60, "1 Peter", [1, 2, 3]),
    (61, "2 Peter", [1]),
    (64, "3 John", [1]),
    (66, "Revelation", [8]),
]

def parse_verse(fpath):
    text = open(fpath).read()
    m = YAML_RE.search(text)
    if not m: return None
    yaml = {k.strip(): v.strip().strip('"').strip("'")
            for k, v in re.findall(r"^(\w+):\s*(.+?)$", m.group(1), re.MULTILINE)}
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

def upload_batch(verses, retries=5):
    for attempt in range(retries):
        try:
            payload = json.dumps({"verses": verses}).encode()
            req = urllib.request.Request(API, data=payload,
                headers={"Content-Type": "application/json", "User-Agent": "bible-ai-uploader/1.0"},
                method="POST")
            resp = urllib.request.urlopen(req, timeout=90)
            return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            if e.code == 503 and attempt < retries - 1:
                wait = 15 * (attempt + 1)
                print(f"      503, retry in {wait}s...", flush=True)
                time.sleep(wait)
                continue
            return {"error": f"HTTP {e.code}: {body[:200]}"}
        except Exception as e:
            if attempt < retries - 1:
                wait = 10 * (attempt + 1)
                print(f"      {type(e).__name__}, retry in {wait}s...", flush=True)
                time.sleep(wait)
                continue
            return {"error": str(e)[:200]}

total_ok = 0
total_errors = 0

for book_num, book_name, chapters in FAILED:
    dirs = [d for d in BASE.iterdir() if d.name.startswith(f"{book_num} - ")]
    if not dirs:
        print(f"SKIP {book_name}: directory not found", flush=True)
        continue
    book_dir = dirs[0]
    print(f"\n{'='*40}", flush=True)
    print(f"{book_name} — retrying {len(chapters)} chapters", flush=True)
    book_ok = 0
    book_errors = 0

    for ch in chapters:
        chap_dir = book_dir / str(ch)
        if not chap_dir.exists():
            print(f"  Ch {ch}: directory not found", flush=True)
            continue
        files = sorted(chap_dir.glob("*.md"),
                      key=lambda f: int(f.stem.rsplit(".", 2)[-1]))
        verses = [parse_verse(f) for f in files if parse_verse(f)]
        print(f"  Ch {ch}: {len(verses)} verses in {len(verses)//BATCH_SIZE + 1} batches", flush=True)

        for i in range(0, len(verses), BATCH_SIZE):
            batch = verses[i:i+BATCH_SIZE]
            result = upload_batch(batch)
            if "error" in result:
                book_errors += len(batch)
                print(f"    Batch v{batch[0]['verse']}-{batch[-1]['verse']}: FAILED ({result['error']})", flush=True)
            else:
                ok = result.get("versesInserted", 0)
                errs = len(result.get("errors", []))
                book_ok += ok
                book_errors += errs
                if not ok:
                    print(f"    Batch v{batch[0]['verse']}: 0 inserted ({errs} errs)", flush=True)
            time.sleep(0.5)  # rate limit buffer

        print(f"  Ch {ch} done: {len(verses)} verses", flush=True)

    print(f"  {book_name}: {book_ok} ok, {book_errors} errors", flush=True)
    total_ok += book_ok
    total_errors += book_errors

print(f"\n{'='*40}", flush=True)
print(f"RETRY COMPLETE: {total_ok} verses inserted, {total_errors} errors", flush=True)

#!/usr/bin/env python3
"""Resume NT upload with timeouts, retries, and progress tracking."""
import json, os, sys, re, glob, urllib.request, urllib.error, time
from pathlib import Path

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
BATCH_SIZE = 3  # smaller batches = fewer timeouts
API = "https://logos-core.kodakwest.workers.dev/api/upload/chapter"
PROGRESS = Path("/home/tsrwest/.hermes/nt-upload-progress.json")

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

def upload_batch(verses, retries=3):
    for attempt in range(retries):
        try:
            payload = json.dumps({"verses": verses}).encode()
            req = urllib.request.Request(API, data=payload,
                headers={"Content-Type": "application/json", "User-Agent": "bible-ai-uploader/1.0"},
                method="POST")
            resp = urllib.request.urlopen(req, timeout=60)
            return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            if attempt < retries - 1:
                wait = 10 * (attempt + 1)
                print(f"    HTTP {e.code}, retry in {wait}s...", flush=True)
                time.sleep(wait)
                continue
            return {"error": f"HTTP {e.code}: {body[:200]}"}
        except Exception as e:
            if attempt < retries - 1:
                wait = 10 * (attempt + 1)
                print(f"    {type(e).__name__}: {str(e)[:80]}, retry in {wait}s...", flush=True)
                time.sleep(wait)
                continue
            return {"error": str(e)[:200]}

# Load progress if exists
progress = {}
if PROGRESS.exists():
    try:
        progress = json.loads(open(PROGRESS).read())
        print(f"Loaded progress: {progress.get('total_ok', 0)} verses done", flush=True)
    except: pass

total_all = progress.get("total_ok", 0)
errors_all = progress.get("total_errors", 0)
skip_to_book = progress.get("current_book", "")
skip_to_ch = progress.get("current_chapter", 0)
skip_to_verse = progress.get("current_verse", 0)
resuming = bool(skip_to_book)

for book_num, book_name in NT_BOOKS:
    dirs = [d for d in BASE.iterdir() if d.name.startswith(f"{book_num} - ")]
    if not dirs:
        print(f"SKIP {book_name}: directory not found", flush=True)
        continue
    book_dir = dirs[0]
    chapters = sorted([int(d.name) for d in book_dir.iterdir() if d.is_dir() and d.name.isdigit()])
    if not chapters:
        print(f"SKIP {book_name}: no chapters found", flush=True)
        continue

    # Skip if we haven't reached the resume point
    if resuming:
        if book_name < skip_to_book:
            print(f"SKIP {book_name} (already done)", flush=True)
            continue
        if book_name == skip_to_book:
            # Skip chapters before resume point
            chapters = [c for c in chapters if c >= skip_to_ch]
            if not chapters:
                continue

    print(f"\n{'='*50}", flush=True)
    print(f"{book_name} ({book_num}): {len(chapters)} chapters remaining", flush=True)
    book_ok = 0
    book_errors = 0

    for ch in chapters:
        # Check progress tracking for skip within chapter
        if resuming and book_name == skip_to_book and ch == skip_to_ch and skip_to_verse > 0:
            chap_dir = book_dir / str(ch)
            files = sorted(chap_dir.glob("*.md"),
                          key=lambda f: int(f.stem.rsplit(".", 2)[-1]))
            verses = [parse_verse(f) for f in files if parse_verse(f)]
            # Skip verses before the resume point
            verses = [v for v in verses if v["verse"] > skip_to_verse]
            if not verses:
                print(f"  Ch {ch}: skipped (already done)", flush=True)
                continue
            resuming = False  # Only skip once
        else:
            chap_dir = book_dir / str(ch)
            files = sorted(chap_dir.glob("*.md"),
                          key=lambda f: int(f.stem.rsplit(".", 2)[-1]))
            verses = [parse_verse(f) for f in files if parse_verse(f)]

        if not verses:
            continue

        for i in range(0, len(verses), BATCH_SIZE):
            batch = verses[i:i+BATCH_SIZE]
            result = upload_batch(batch)
            if "error" in result:
                book_errors += len(batch)
                print(f"  Ch {ch}: ERROR ({result['error']})", flush=True)
                # Save progress and bail on persistent errors
                with open(PROGRESS, "w") as f:
                    json.dump({
                        "total_ok": total_all + book_ok,
                        "total_errors": errors_all + book_errors,
                        "current_book": book_name,
                        "current_chapter": ch,
                        "current_verse": batch[0]["verse"],
                        "last_error": result["error"]
                    }, f)
                print(f"  \n*** ERROR on {book_name} ch {ch}, verse {batch[0]['verse']} ***", flush=True)
                print(f"  *** Saved progress, bailing out ***", flush=True)
                sys.exit(1)
            else:
                ok = result.get("versesInserted", 0)
                errs = len(result.get("errors", []))
                book_ok += ok
                book_errors += errs
                v_start = batch[0]["verse"]
                v_end = batch[-1]["verse"]
                if errs:
                    print(f"  Ch {ch} v{v_start}-{v_end}: {ok} ok, {errs} errs", flush=True)
                # Print progress every 3 batches
                if (i // BATCH_SIZE) % 3 == 0:
                    print(f"  Ch {ch} v{v_start}: {book_ok} verses done so far", flush=True)

        print(f"  Ch {ch} done: {sum(1 for v in verses if True)} verses", flush=True)

        # Save progress after each chapter
        with open(PROGRESS, "w") as f:
            json.dump({
                "total_ok": total_all + book_ok,
                "total_errors": errors_all + book_errors,
                "current_book": book_name,
                "current_chapter": ch,
                "current_verse": 0
            }, f)

    print(f"  DONE: {book_ok} ok, {book_errors} errors", flush=True)
    total_all += book_ok
    errors_all += book_errors

# Clean progress on completion
with open(PROGRESS, "w") as f:
    json.dump({"total_ok": total_all, "total_errors": errors_all, "complete": True}, f)

print(f"\n{'='*50}", flush=True)
print(f"NT COMPLETE: {total_all} total verses, {errors_all} errors", flush=True)

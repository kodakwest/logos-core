#!/usr/bin/env python3
"""Find and upload only missing NT verses by checking DB chapter by chapter."""
import json, os, re, urllib.request, urllib.error, time, sys
from pathlib import Path

BASE = Path("/home/tsrwest/BTB/interlinear")
YAML_RE = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)
BATCH_SIZE = 10
API_BASE = "https://logos-core.kodakwest.workers.dev"
UPLOAD_API = f"{API_BASE}/api/upload/chapter"

NT_BOOKS = [
    (40, "Matthew"), (41, "Mark"), (42, "Luke"), (43, "John"),
    (44, "Acts"), (45, "Romans"), (46, "1 Corinthians"), (47, "2 Corinthians"),
    (48, "Galatians"), (49, "Ephesians"), (50, "Philippians"), (51, "Colossians"),
    (52, "1 Thessalonians"), (53, "2 Thessalonians"), (54, "1 Timothy"),
    (55, "2 Timothy"), (56, "Titus"), (57, "Philemon"), (58, "Hebrews"),
    (59, "James"), (60, "1 Peter"), (61, "2 Peter"), (62, "1 John"),
    (63, "2 John"), (64, "3 John"), (65, "Jude"), (66, "Revelation")
]

def url_encode_book(name):
    return name.replace(" ", "%20")

def get_db_verses(book, chapter):
    """Get verse numbers that exist in DB for a given book/chapter."""
    bname = url_encode_book(book)
    url = f"{API_BASE}/api/verses/search?book={bname}&chapter={chapter}&limit=200"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "bible-ai-uploader/1.0"})
        resp = urllib.request.urlopen(req, timeout=30)
        data = json.loads(resp.read())
        return {v["verse"] for v in data.get("results", [])}
    except:
        return set()

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
            req = urllib.request.Request(UPLOAD_API, data=payload,
                headers={"Content-Type": "application/json", "User-Agent": "bible-ai-uploader/1.0"},
                method="POST")
            resp = urllib.request.urlopen(req, timeout=60)
            return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            if e.code == 503 and attempt < retries - 1:
                time.sleep(10 * (attempt + 1))
                continue
            return {"error": f"HTTP {e.code}: {body[:200]}"}
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(10 * (attempt + 1))
                continue
            return {"error": str(e)[:200]}

total_missing = 0
total_uploaded = 0
total_errors = 0

for book_num, book_name in NT_BOOKS:
    dirs = [d for d in BASE.iterdir() if d.name.startswith(f"{book_num} - ")]
    if not dirs: continue
    book_dir = dirs[0]
    chapters = sorted([int(d.name) for d in book_dir.iterdir() if d.is_dir() and d.name.isdigit()])
    if not chapters: continue

    print(f"\n--- {book_name} ---", flush=True)
    book_missing = 0
    book_uploaded = 0

    for ch in chapters:
        # Get DB verses for this chapter
        db_verses = get_db_verses(book_name, ch)
        
        # Read BTB verses for this chapter
        chap_dir = book_dir / str(ch)
        files = sorted(chap_dir.glob("*.md"),
                      key=lambda f: int(f.stem.rsplit(".", 2)[-1]))
        btb_verses = {}
        for f in files:
            v = parse_verse(f)
            if v:
                btb_verses[v["verse"]] = v
        
        missing = [bv for vnum, bv in sorted(btb_verses.items()) if vnum not in db_verses]
        
        if not missing:
            if ch == chapters[-1] or ch % 10 == 0:
                print(f"  Ch {ch}: ✓ ({len(btb_verses)} vs {len(db_verses)} in DB)", flush=True)
            continue
        
        print(f"  Ch {ch}: {len(missing)} missing of {len(btb_verses)} total", flush=True)
        book_missing += len(missing)
        
        # Upload missing verses in batches
        for i in range(0, len(missing), BATCH_SIZE):
            batch = missing[i:i+BATCH_SIZE]
            result = upload_batch(batch)
            if "error" in result:
                total_errors += len(batch)
                print(f"    Batch v{batch[0]['verse']}-{batch[-1]['verse']}: FAILED ({result['error']})", flush=True)
            else:
                ok = result.get("versesInserted", 0)
                total_uploaded += ok
                book_uploaded += ok
    
    if book_missing:
        print(f"  {book_name}: {book_uploaded}/{book_missing} uploaded, {book_missing - book_uploaded} failed", flush=True)
    total_missing += book_missing

print(f"\n{'='*50}", flush=True)
print(f"SUMMARY: {total_missing} missing verses found, {total_uploaded} uploaded, {total_errors} errors", flush=True)

# Final status
try:
    req = urllib.request.Request(f"{API_BASE}/api/status", headers={"User-Agent": "bible-ai-uploader/1.0"})
    resp = urllib.request.urlopen(req, timeout=10)
    status = json.loads(resp.read())
    print(f"DB Status: {status}", flush=True)
except:
    pass

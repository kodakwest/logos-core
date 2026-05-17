#!/usr/bin/env python3
"""Upload BTB chapter in batches of 25 to stay under Worker subrequest limit."""
import json, os, sys, re, glob, urllib.request, urllib.error

if len(sys.argv) < 3:
    print("Usage: python upload_chapter.py <book_number> <chapter>")
    sys.exit(1)

book_num = int(sys.argv[1])
chapter = int(sys.argv[2])
base = "/home/tsrwest/BTB/interlinear"
dirs = [d for d in os.listdir(base) if d.startswith(f"{book_num} - ")]
if not dirs:
    print(f"Book {book_num} not found")
    sys.exit(1)

book_name = dirs[0].split(" - ", 1)[1]
chap_dir = f"{base}/{dirs[0]}/{chapter}"
if not os.path.isdir(chap_dir):
    print(f"Chapter {chapter} not found")
    sys.exit(1)

YAML_RE = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)
all_verses = []
files = sorted(glob.glob(f"{chap_dir}/{book_name}.{chapter}.*.md"),
              key=lambda f: int(f.split(".")[-2]))

for f in files:
    text = open(f).read()
    m = YAML_RE.search(text)
    if not m: continue
    yaml = {k.strip(): v.strip().strip('"').strip("'") 
            for k, v in re.findall(r"^(\w+):\s*(.+?)$", m.group(1), re.MULTILINE)}
    verse_num = int(f.split(".")[-2])
    all_verses.append({
        "book": book_name, "bookNumber": book_num, "chapter": chapter,
        "verse": verse_num,
        "kjv": yaml.get("kjv", ""), "bsb": yaml.get("bsb", ""),
        "greek": yaml.get("greek", ""),
        "topics": [], "pericope": yaml.get("pericope", "").replace("[[", "").replace("]]", "")
    })

print(f"Read {len(all_verses)} verses from {book_name} {chapter}")

# Upload in batches of 25
BATCH = 25
total_ok = 0
total_errors = 0

for i in range(0, len(all_verses), BATCH):
    batch = all_verses[i:i+BATCH]
    payload = json.dumps({"verses": batch}).encode()
    req = urllib.request.Request(
        "https://logos-core.kodakwest.workers.dev/api/upload/chapter",
        data=payload,
        headers={"Content-Type": "application/json", "User-Agent": "bible-ai-uploader/1.0"},
        method="POST"
    )
    try:
        resp = urllib.request.urlopen(req, timeout=120)
        result = json.loads(resp.read())
        ok = result.get("versesInserted", 0)
        errs = result.get("errors", [])
        total_ok += ok
        total_errors += len(errs)
        print(f"  Batch {i//BATCH + 1}: {ok} inserted, {len(errs)} errors")
        if errs:
            print(f"    First error: {errs[0]}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  Batch {i//BATCH + 1}: HTTP {e.code}: {body[:200]}")

print(f"\nDone: {total_ok} total inserted, {total_errors} errors")

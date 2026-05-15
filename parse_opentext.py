#!/usr/bin/env python3
"""Parse OpenText NA28 XML and upload word morphology to bible-ai-api."""
import argparse
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

XML_DIR = Path("/mnt/s/Resources/Bible/OpenText NA28")
API = "https://bible-ai-api.kodakwest.workers.dev"
XML_ID = "{http://www.w3.org/XML/1998/namespace}id"
WORD_ID_RE = re.compile(r"\.(\d+)\.(\d+)\.w(\d+)(?:\D|$)")

BOOK_MAP = {
    "01_matthew_full.xml": "Matthew",
    "02_mark_full.xml": "Mark",
    "03_luke_full.xml": "Luke",
    "04_john_full.xml": "John",
    "05_acts_full.xml": "Acts",
    "06_romans_full.xml": "Romans",
    "07_1corinthians_full.xml": "1 Corinthians",
    "08_2corinthians_full.xml": "2 Corinthians",
    "09_galatians_full.xml": "Galatians",
    "10_ephesians_full.xml": "Ephesians",
    "11_philippians_full.xml": "Philippians",
    "12_colossians_full.xml": "Colossians",
    "13_1thessalonians_full.xml": "1 Thessalonians",
    "14_2thessalonians_full.xml": "2 Thessalonians",
    "15_1timothy_full.xml": "1 Timothy",
    "16_2timothy_full.xml": "2 Timothy",
    "17_titus_full.xml": "Titus",
    "18_philemon_full.xml": "Philemon",
    "19_hebrews_full.xml": "Hebrews",
    "20_james_full.xml": "James",
    "21_1peter_full.xml": "1 Peter",
    "22_2peter_full.xml": "2 Peter",
    "23_1john_full.xml": "1 John",
    "24_2john_full.xml": "2 John",
    "25_3john_full.xml": "3 John",
    "26_jude_full.xml": "Jude",
    "27_revelation_full.xml": "Revelation",
}


def local_name(tag):
    return tag.rsplit("}", 1)[-1]


def attr(elem, name):
    value = elem.attrib.get(name)
    return value.strip() if isinstance(value, str) and value.strip() else None


def parse_reference(xml_id):
    match = WORD_ID_RE.search(xml_id or "")
    if not match:
        return None
    return int(match.group(1)), int(match.group(2)), int(match.group(3))


def parse_book(filepath):
    """Parse one OpenText XML file, returning verse morphology dictionaries."""
    book = BOOK_MAP[filepath.name]
    root = ET.parse(filepath).getroot()
    verses = {}
    fallback_positions = {}
    current_chapter = None
    current_verse = None

    def add_word(elem, inherited_function):
        nonlocal current_chapter, current_verse
        xml_id = elem.attrib.get(XML_ID)
        parsed = parse_reference(xml_id)
        if parsed:
            chapter, verse, position = parsed
        else:
            if current_chapter is None or current_verse is None:
                return
            chapter, verse = current_chapter, current_verse
            key = (chapter, verse)
            fallback_positions[key] = fallback_positions.get(key, 0) + 1
            position = fallback_positions[key]

        key = (chapter, verse)
        verse_data = verses.setdefault(
            key,
            {"book": book, "chapter": chapter, "verse": verse, "words": []},
        )
        verse_data["words"].append(
            {
                "position": position,
                "lemma": attr(elem, "lemma"),
                "pos": attr(elem, "pos"),
                "gender": attr(elem, "gender"),
                "case": attr(elem, "case"),
                "number": attr(elem, "number"),
                "domains": attr(elem, "domains"),
                "subdomains": attr(elem, "subdomains"),
                "clauseFunction": attr(elem, "function") or inherited_function,
            }
        )

    def walk(elem, inherited_function=None):
        nonlocal current_chapter, current_verse
        tag = local_name(elem.tag)
        if tag == "milestone":
            unit = elem.attrib.get("unit")
            if unit == "chapter":
                n = elem.attrib.get("n")
                current_chapter = int(n) if n and n.isdigit() else current_chapter
            elif unit == "verse":
                n = elem.attrib.get("n")
                current_verse = int(n) if n and n.isdigit() else current_verse
            return

        next_function = inherited_function
        if tag == "seg":
            next_function = attr(elem, "function") or inherited_function
        elif tag == "w":
            add_word(elem, inherited_function)

        for child in elem:
            walk(child, next_function)

    walk(root)
    for verse in verses.values():
        verse["words"].sort(key=lambda word: word["position"])
    return [verses[key] for key in sorted(verses)]


def request_json(url, payload=None, method=None, retries=3):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"User-Agent": "bible-ai-morphology-uploader/1.0"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            if attempt == retries - 1:
                raise RuntimeError(f"HTTP {exc.code}: {body[:300]}") from exc
        except Exception:
            if attempt == retries - 1:
                raise
        time.sleep(2 * (attempt + 1))


def fetch_verse_ids(api, book, chapter):
    params = urllib.parse.urlencode({"book": book, "chapter": chapter, "limit": 100})
    response = request_json(f"{api}/api/verses/search?{params}")
    return {int(row["verse"]): int(row["id"]) for row in response.get("results", [])}


def upload_morphology(api, verse_id, words):
    return request_json(
        f"{api}/api/upload/morphology",
        {"verseId": verse_id, "words": words},
        method="POST",
    )


def selected_files(book_filter):
    files = sorted(XML_DIR.glob("*_full.xml"))
    if not book_filter:
        return files
    wanted = book_filter.casefold()
    return [path for path in files if BOOK_MAP.get(path.name, "").casefold() == wanted]


def main():
    parser = argparse.ArgumentParser(description="Upload OpenText NA28 morphology to bible-ai-api.")
    parser.add_argument("--api", default=API, help=f"Worker base URL (default: {API})")
    parser.add_argument("--book", help="Upload one book by DB book name, e.g. 'Matthew'")
    parser.add_argument("--dry-run", action="store_true", help="Parse and summarize without uploading")
    parser.add_argument("--delay", type=float, default=0.05, help="Delay between verse uploads")
    args = parser.parse_args()

    files = selected_files(args.book)
    if not files:
        raise SystemExit(f"No OpenText XML files matched book={args.book!r}")

    total_verses = 0
    total_words = 0
    total_errors = 0
    verse_id_cache = {}

    for filepath in files:
        book = BOOK_MAP[filepath.name]
        verses = parse_book(filepath)
        word_count = sum(len(verse["words"]) for verse in verses)
        print(f"{book}: parsed {len(verses)} verses, {word_count} words", flush=True)

        if args.dry_run:
            sample = verses[0] if verses else None
            if sample:
                print(json.dumps(sample, ensure_ascii=False, indent=2)[:1200], flush=True)
            total_verses += len(verses)
            total_words += word_count
            continue

        for verse in verses:
            chapter_key = (book, verse["chapter"])
            if chapter_key not in verse_id_cache:
                verse_id_cache[chapter_key] = fetch_verse_ids(args.api, book, verse["chapter"])

            verse_id = verse_id_cache[chapter_key].get(verse["verse"])
            if not verse_id:
                print(f"  ERROR {book} {verse['chapter']}:{verse['verse']} not found in D1", flush=True)
                total_errors += 1
                continue

            try:
                upload_morphology(args.api, verse_id, verse["words"])
                total_verses += 1
                total_words += len(verse["words"])
            except Exception as exc:
                print(f"  ERROR {book} {verse['chapter']}:{verse['verse']} - {exc}", flush=True)
                total_errors += 1
            time.sleep(args.delay)

    print(
        f"Done: {total_verses} verses, {total_words} words"
        + (f", {total_errors} errors" if total_errors else ""),
        flush=True,
    )


if __name__ == "__main__":
    main()

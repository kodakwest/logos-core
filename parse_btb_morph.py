#!/usr/bin/env python3
"""Parse BTB interlinear markdown tables and upload morphology to bible-ai-api.

Extracts per-word: Greek text, Strong's number, morphology code (N-NSF, V-PAI-3S, etc.)
from the interlinear table in each NT verse file.
Breaks down morphology codes into POS, gender, case, number fields.

Usage:
  python3 parse_btb_morph.py                          # all NT books
  python3 parse_btb_morph.py --book "Matthew"         # one book
  python3 parse_btb_morph.py --dry-run                # preview without uploading
  python3 parse_btb_morph.py --delay 0.1              # slow down uploads
"""
import argparse, json, os, re, sys, time, urllib.request, urllib.error
from pathlib import Path

BTB_DIR = Path("/mnt/s/Resources/Bible/BTB/interlinear")
API = "https://bible-ai-api.kodakwest.workers.dev"

# NT books: (directory_number, book_name)
NT_BOOKS = [
    ("40", "Matthew"), ("41", "Mark"), ("42", "Luke"), ("43", "John"),
    ("44", "Acts"), ("45", "Romans"), ("46", "1 Corinthians"), ("47", "2 Corinthians"),
    ("48", "Galatians"), ("49", "Ephesians"), ("50", "Philippians"), ("51", "Colossians"),
    ("52", "1 Thessalonians"), ("53", "2 Thessalonians"), ("54", "1 Timothy"),
    ("55", "2 Timothy"), ("56", "Titus"), ("57", "Philemon"), ("58", "Hebrews"),
    ("59", "James"), ("60", "1 Peter"), ("61", "2 Peter"), ("62", "1 John"),
    ("63", "2 John"), ("64", "3 John"), ("65", "Jude"), ("66", "Revelation"),
]

# Regex to parse interlinear table rows
# Format: | English |**<big>[[GXXXX\\|Greek]]</big>** |translit <small><sup>[[MORPH]]</sup></small> | Edition |
ROW_RE = re.compile(
    r"\|\s*[^|]*\|\s*\*{0,2}<big>\s*\[\[G(\d+)[A-Z]?\\\|([^\]]+)\]\].*?</big>\s*\*{0,2}"
    r"\s*\|?\s*[^|]*?\s*<small><sup>\[\[([A-Z][A-Z0-9-]+)\]\]</sup></small>"
    r"\s*\|?\s*[^|]*\|"
)

def parse_morph_code(code):
    """Parse BTB morphology code into structured fields.

    Noun patterns: N-NSF, N-GSM, N-GSM-P, N-NPF, N-DPF, N-GSN, N-GSM-T
    Verb patterns: V-PAI-3S, V-AAI-3S, V-PAN, V-PMP-NSM, V-AAP-NSM
    Adj patterns: A-NSF, A-APF-C, A-NSM, A-NPM
    Other: P (prep), C (conj), D (adv), T (article), R (pron), X (particle)
    """
    if not code:
        return {"pos": None, "gender": None, "case": None, "number": None}

    parts = code.split("-")
    pos_code = parts[0] if parts else ""

    pos_map = {
        "N": "noun", "V": "verb", "A": "adjective", "D": "adverb",
        "C": "conjunction", "P": "preposition", "R": "pronoun",
        "T": "article", "I": "interjection", "X": "particle",
        "CONJ": "conjunction", "PREP": "preposition", "PRT": "particle",
        "ADV": "adverb", "PRON": "pronoun", "COND": "conjunction",
        "INJ": "interjection", "ARAM": "noun",
    }
    pos = pos_map.get(pos_code, pos_code)

    gender = None
    case = None
    number = None

    if pos_code == "V" and len(parts) >= 3:
        # Verb: V-PAI-3S → V-AMM-3P
        # parts = ['V', 'PAI', '3S']
        tense_moods = parts[1] if len(parts) > 1 else ""
        person_number = parts[2] if len(parts) > 2 else (parts[1] if len(parts) == 2 else "")

        # Extract number from person-number code
        if person_number.endswith("S"):
            number = "singular"
        elif person_number.endswith("P"):
            number = "plural"

        # POS is already "verb"
        # No case/gender for finite verbs (participles have them in different format)

    elif len(parts) >= 3:
        # Noun/Adj: N-NSF, N-GSM, A-NSF-C
        case_code = parts[1] if len(parts) > 1 else ""
        num_gen = parts[2] if len(parts) > 2 else ""

        case_map = {"N": "nominative", "G": "genitive", "D": "dative",
                     "A": "accusative", "V": "vocative"}
        case = case_map.get(case_code, case_code)

        # Number is first letter of num_gen
        if num_gen and num_gen[0] == "S":
            number = "singular"
        elif num_gen and num_gen[0] == "P":
            number = "plural"

        # Gender is second letter of num_gen (after possible extra codes)
        gender_code = num_gen[1] if len(num_gen) > 1 else ""
        gender_map = {"M": "masculine", "F": "feminine", "N": "neuter"}
        if gender_code:
            gender = gender_map.get(gender_code, gender_code)

    elif pos_code in ("P", "C", "D", "X", "CONJ", "PREP", "ADV", "COND", "INJ", "PRT"):
        # Particles, prepositions, conjunctions - no inflected forms
        gender = None
        case = None
        number = None

    return {"pos": pos, "gender": gender, "case": case, "number": number}


def parse_btb_file(filepath):
    """Parse a BTB interlinear .md file and return list of word dicts."""
    text = filepath.read_text(encoding="utf-8")
    words = []
    for match in ROW_RE.finditer(text):
        strongs = match.group(1)
        greek = match.group(2).strip().rstrip(".,;:")
        morph_code = match.group(3).strip()
        morph = parse_morph_code(morph_code)

        # Remove punctuation from the end for cleaner storage
        clean_greek = greek.rstrip(".,;:¶")
        words.append({
            "strongs": strongs,
            "greek": clean_greek,
            "morph_code": morph_code,
        })
    return words


def chapter_dirs(book_num, book_name):
    """Get chapter directories for a given book."""
    pattern = f"{book_num} - {book_name}"
    book_dir = BTB_DIR / pattern
    if not book_dir.exists():
        return []
    return sorted(
        [d for d in book_dir.iterdir() if d.is_dir() and d.name.isdigit()],
        key=lambda d: int(d.name)
    )


def verse_file(book_name, chapter, i):
    """Get verse file path (format: Book.ab.ch.v.md where a=abbreviation, b=chapter, v=verse)"""
    # Files are named like Matt.1.1.md — use glob to handle abbreviation variability
    # Actually, they follow: first 4 chars of book name abbreviation
    abbrev_map = {
        "Matthew": "Matt", "Mark": "Mark", "Luke": "Luke", "John": "John",
        "Acts": "Acts", "Romans": "Rom", "1 Corinthians": "1Cor",
        "2 Corinthians": "2Cor", "Galatians": "Gal", "Ephesians": "Eph",
        "Philippians": "Phil", "Colossians": "Col", "1 Thessalonians": "1Thess",
        "2 Thessalonians": "2Thess", "1 Timothy": "1Tim", "2 Timothy": "2Tim",
        "Titus": "Titus", "Philemon": "Phlm", "Hebrews": "Heb", "James": "Jas",
        "1 Peter": "1Pet", "2 Peter": "2Pet", "1 John": "1John",
        "2 John": "2John", "3 John": "3John", "Jude": "Jude", "Revelation": "Rev",
    }
    abbrev = abbrev_map.get(book_name, book_name[:4])
    return f"{abbrev}.{chapter}.{i}.md"


def request(url, data=None, method=None):
    """Make HTTP request with proper User-Agent to avoid Cloudflare 403."""
    headers = {"User-Agent": "Mozilla/5.0 (compatible; TARS-BibleAI/1.0)"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    return urllib.request.urlopen(req, timeout=30)

def fetch_verse_id(api, book, chapter, verse):
    """Get verse ID from the API by exact reference."""
    params = urllib.parse.urlencode({"book": book, "chapter": chapter, "q": "", "limit": 100})
    url = f"{api}/api/verses/search?{params}"
    try:
        resp = request(url)
        data = json.loads(resp.read())
        for v in data.get("results", []):
            if v["verse"] == verse:
                return v["id"]
    except Exception:
        pass
    return None


def upload_morphology(api, verse_id, words):
    """Upload morphology data for one verse (reuses /api/upload/morphology endpoint)."""
    payload = {
        "verseId": verse_id,
        "words": []
    }
    for i, w in enumerate(words):
        morph = parse_morph_code(w.get("morph_code", ""))
        payload["words"].append({
            "position": i + 1,
            "lemma": f"G{w['strongs']}",  # Use Strong's as lemma identifier
            "pos": morph["pos"],
            "gender": morph["gender"],
            "case": morph["case"],
            "number": morph["number"],
            "domains": None,
            "subdomains": None,
            "clauseFunction": None
        })

    data = json.dumps(payload).encode("utf-8")
    resp = request(f"{api}/api/upload/morphology", data=data, method="POST")
    return json.loads(resp.read())


def main():
    parser = argparse.ArgumentParser(description="Parse BTB interlinear morphology and upload to bible-ai-api.")
    parser.add_argument("--api", default=API)
    parser.add_argument("--book", help="Upload one book by name, e.g. 'Matthew'")
    parser.add_argument("--dry-run", action="store_true", help="Parse and summarize without uploading")
    parser.add_argument("--delay", type=float, default=0.05, help="Delay between verse uploads (seconds)")
    args = parser.parse_args()

    books = [(n, b) for n, b in NT_BOOKS if not args.book or b.lower() == args.book.lower()]
    if not books:
        raise SystemExit(f"No NT book matched: {args.book!r}")

    total_verses = 0
    total_words = 0
    total_errors = 0
    verse_id_cache = {}

    for book_num, book_name in books:
        print(f"\n{book_name} ({book_num})...", flush=True)

        for ch_dir in chapter_dirs(book_num, book_name):
            chapter = int(ch_dir.name)

            # Find all verse files in this chapter
            vfiles = sorted(ch_dir.iterdir()) if ch_dir.exists() else []

            for vf in vfiles:
                if not vf.name.endswith(".md"):
                    continue
                try:
                    verse_num = int(vf.stem.split(".")[2])
                except (IndexError, ValueError):
                    continue

                words = parse_btb_file(vf)
                if not words:
                    continue

                total_words += len(words)
                total_verses += 1

                if args.dry_run:
                    if total_verses <= 2:
                        print(f"  {book_name} {chapter}:{verse_num} — {len(words)} words")
                    continue

                # Get verse ID (cache by book/chapter)
                cache_key = (book_name, chapter)
                if cache_key not in verse_id_cache:
                    verse_id_cache[cache_key] = {}

                verse_id = verse_id_cache[cache_key].get(verse_num)
                if verse_id is None:
                    verse_id = fetch_verse_id(args.api, book_name, chapter, verse_num)
                    if verse_id:
                        verse_id_cache[cache_key][verse_num] = verse_id

                if not verse_id:
                    total_errors += 1
                    continue

                try:
                    upload_morphology(args.api, verse_id, words)
                except Exception as e:
                    total_errors += 1

                time.sleep(args.delay)

            if not args.dry_run:
                print(f"  Chapter {chapter} done", flush=True)

    print(f"\nDone: {total_verses} verses, {total_words} words"
          f"{', ' + str(total_errors) + ' errors' if total_errors else ''}", flush=True)


if __name__ == "__main__":
    main()

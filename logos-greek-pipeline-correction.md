# Spec Correction: Greek Parsing Pipeline — NOT 100% AI

## Correction Needed

The LogOS Ecosystem Feature Roadmap doc currently describes the Greek parser as "AI-powered Greek parsing." This is **inaccurate**. The actual pipeline is **data-first with AI fallback**.

## Actual Architecture

### Three-Tier Pipeline

```
User enters Greek text
        │
        ▼
┌─────────────────────────────────┐
│ Tier 1: D1 Morphology Lookup    │
│                                 │
│ 1. Normalize input (NFD → strip │
│    diacritics → NFC → lowercase)│
│ 2. LIKE search on verses.greek  │
│    column                       │
│ 3. If no match → consonant-     │
│    pattern fallback (replace    │
│    vowels with _ wildcard)      │
│ 4. Score results by percentage  │
│    of words matching (≥60%)     │
│ 5. If match found → return      │
│    stored morphology from       │
│    word_morphology table        │
│    (139,476 records)            │
│ 6. Source: "morphology"         │
└──────────────┬──────────────────┘
               │ match?
        ┌──────┴──────┐
        │ YES         │ NO
        ▼             ▼
   Return data  ┌─────────────────┐
   (no AI)      │ Tier 2: Cache   │
                │                  │
                │ Check greek_cache│
                │ table for prev.  │
                │ LLM result       │
                └────────┬─────────┘
                         │ cached?
                   ┌─────┴─────┐
                   │ YES       │ NO
                   ▼           ▼
              Return     ┌─────────────────┐
              cached     │ Tier 3: AI       │
              result     │ Workers AI       │
                         │ (Llama 4 Scout)  │
                         │                  │
                         │ Parse text,      │
                         │ cache result in  │
                         │ greek_cache      │
                         │ Return AI result │
                         └─────────────────┘
```

### Key Facts

| Fact | Value |
|------|-------|
| Stored morphology records | 139,476 |
| Verses in D1 | 7,959 (NT only) |
| AI model | Llama 4 Scout (only fallback) |
| Data fields stored | Lemma (Strong's #), POS, gender, case, number, domains, subdomains |
| Matching method | LIKE + consonant wildcard + word scoring (≥60% threshold) |
| Cache table | `greek_cache` — prevents repeat AI calls |
| Priority | Data → Cache → AI (in that order) |

### Source Files

- `src/greek.ts` — Greek normalization and word alignment utilities
- `src/db.ts` — `searchVerseByGreekText()` — D1 query with LIKE/consonant fallback/scoring
- `src/db.ts` — `getMorphology()` — loads stored morphology by verse ID
- `src/ai.ts` — `parseGreekWithAi()` — Workers AI fallback (only called if data + cache miss)
- `src/index.ts` — `handleGreekParse()` — orchestrates the pipeline

## How to Reflect This in Designs

When designing UI for the Greek Parser in LogOS Core:

1. **Show confidence indicators** — badge showing whether result came from "Morphology Database" vs "AI Analysis"
2. **Morphology view** — table with columns: Word, Lemma (Strong's), POS, Parsing, Gloss
3. **AI view** — same table but sourced from Llama 4, with a "Cached" badge if re-used
4. **"View in Context" action** — click a parsed word → jump to the verse it came from in the Bible reader
5. **No "AI-generated" label** on morphology-sourced results — they're curated data

## Why This Matters for the Roadmap

The Rumndtable Sermon Graph can reference **database-backed morphology** for Scripture Nodes — not just AI output. This means:
- Greek parsing in Roundtable's "Expand Context" is fast (D1 query, no AI latency)
- Morphology data is deterministic and auditable
- AI generation can focus on higher-value tasks (guide gen, contextual analysis)
- The graph can link Scripture Nodes directly to morphology records in Core's D1

## Files to Update in Future Roundtable Specs

When referencing Greek parsing capabilities in Roundtable specs:
- Refer to it as "morphology-backed parsing with AI fallback"
- Cite the three-tier pipeline
- Note that Scripture Nodes can pull morphology data synchronously from Core

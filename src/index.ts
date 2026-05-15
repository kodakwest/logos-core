import { askAi, generateEmbedding, parseGreekWithAi, upsertVerseVector } from "./ai";
import { readBtbChapter } from "./btbutils";
import {
  getGreekCache,
  getMorphology,
  getStatus,
  getVerseByReference,
  getVersesByIds,
  searchVerseByGreekText,
  searchVerses,
  setGreekCache,
  setVerseEmbeddingId,
  upsertMorphology,
  upsertVerse
} from "./db";
import { alignGreekWordsWithMorphology, normalizeGreekForComparison } from "./greek";
import type {
  AskRequest,
  Env,
  ExplainRequest,
  GreekWordParsing,
  MorphologyRequest,
  MorphologyWordRecord,
  MorphologyWordInput,
  SemanticSearchRequest,
  UploadChapterRequest,
  UploadMorphologyRequest,
  VerseInput,
  VerseRecord
} from "./types";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/status" && request.method === "GET") return json(await getStatus(env.DB));
      if (url.pathname === "/api/upload/chapter" && request.method === "POST") return handleUpload(request, env);
      if (url.pathname === "/api/upload/morphology" && request.method === "POST") return handleUploadMorphology(request, env);
      if (url.pathname === "/api/verses/search" && request.method === "GET") return handleKeywordSearch(url, env);
      if (url.pathname === "/api/verses/morphology" && request.method === "POST") return handleVerseMorphology(request, env);
      if (url.pathname === "/api/verses/semantic" && request.method === "POST") return handleSemanticSearch(request, env);
      if (url.pathname === "/api/parse/greek" && request.method === "POST") return handleGreekParse(request, env);
      if (url.pathname === "/api/ask" && request.method === "POST") return handleAsk(request, env);
      if (url.pathname === "/api/explain" && request.method === "POST") return handleExplain(request, env);
      if (url.pathname.startsWith("/api/")) return json({ error: "Not found" }, 404);
      return env.ASSETS.fetch(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      return json({ error: message }, 500);
    }
  }
};

async function handleUpload(request: Request, env: Env): Promise<Response> {
  const body = await readJson<UploadChapterRequest>(request);

  // Accept raw verse data directly, or read from BTB files
  let verses: VerseInput[];
  if (body.verses && Array.isArray(body.verses)) {
    verses = body.verses;
  } else {
    if (!body.book || !Number.isFinite(body.bookNumber) || !Number.isFinite(body.chapter)) {
      return json({ error: "book, bookNumber, and chapter are required" }, 400);
    }
    try {
      verses = await readBtbChapter(body.book, body.bookNumber, body.chapter);
    } catch {
      return json({ error: "Chapter data not found in BTB export" }, 404);
    }
  }

  const errors: string[] = [];
  const inserted: VerseRecord[] = [];

  for (const verse of verses) {
    try {
      const saved = await upsertVerse(env.DB, verse);
      const textForEmbedding = [saved.book, `${saved.chapter}:${saved.verse}`, saved.bsb, saved.kjv, saved.greek].filter(Boolean).join(" ");
      if (textForEmbedding) {
        const embedding = await generateEmbedding(env.AI, textForEmbedding);
        await upsertVerseVector(env.VECTORIZE, saved, embedding);
        await setVerseEmbeddingId(env.DB, saved.id, saved.id);
        saved.embeddingId = saved.id;
      }
      inserted.push(saved);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      errors.push(`${verse.book} ${verse.chapter}:${verse.verse} - ${message}`);
    }
  }

  return json({ versesInserted: inserted.length, errors, verses: inserted });
}

async function handleUploadMorphology(request: Request, env: Env): Promise<Response> {
  const body = await readJson<UploadMorphologyRequest>(request);
  if (!Number.isFinite(body.verseId) || body.verseId <= 0) {
    return json({ error: "verseId is required" }, 400);
  }
  if (!Array.isArray(body.words)) {
    return json({ error: "words must be an array" }, 400);
  }

  const words: MorphologyWordInput[] = [];
  for (const word of body.words) {
    if (!Number.isFinite(word.position) || word.position <= 0) {
      return json({ error: "Each word requires a positive position" }, 400);
    }
    words.push({
      position: Math.trunc(word.position),
      lemma: nullableString(word.lemma),
      pos: nullableString(word.pos),
      gender: nullableString(word.gender),
      case: nullableString(word.case),
      number: nullableString(word.number),
      domains: nullableString(word.domains),
      subdomains: nullableString(word.subdomains),
      clauseFunction: nullableString(word.clauseFunction)
    });
  }

  const count = await upsertMorphology(env.DB, Math.trunc(body.verseId), words);
  return json({ verseId: Math.trunc(body.verseId), wordsInserted: count });
}

async function handleVerseMorphology(request: Request, env: Env): Promise<Response> {
  const body = await readJson<MorphologyRequest>(request);
  if (!body.book || !Number.isFinite(body.chapter) || !Number.isFinite(body.verse)) {
    return json({ error: "book, chapter, and verse are required" }, 400);
  }

  const verse = await getVerseByReference(env.DB, {
    book: body.book,
    chapter: Math.trunc(body.chapter),
    verse: Math.trunc(body.verse)
  });
  if (!verse) return json({ error: "Verse not found" }, 404);

  const morphology = await getMorphology(env.DB, verse.id);
  return json({ verse, morphology });
}

async function handleKeywordSearch(url: URL, env: Env): Promise<Response> {
  const limit = clampLimit(url.searchParams.get("limit"), 20);
  const chapterParam = url.searchParams.get("chapter");
  const results = await searchVerses(env.DB, {
    q: url.searchParams.get("q")?.trim() || undefined,
    book: url.searchParams.get("book")?.trim() || undefined,
    chapter: chapterParam ? Number(chapterParam) : undefined,
    limit
  });
  return json({ results: results.map((verse) => ({ ...verse, score: verse.score ?? 1 })), total: results.length });
}

async function handleSemanticSearch(request: Request, env: Env): Promise<Response> {
  const body = await readJson<SemanticSearchRequest>(request);
  if (!body.query?.trim()) return json({ error: "query is required" }, 400);

  const limit = Math.min(Math.max(body.limit ?? 5, 1), 50);
  const embedding = await generateEmbedding(env.AI, body.query);
  const vectorResults = await env.VECTORIZE.query(embedding, { topK: limit });
  const matches = vectorResults.matches ?? [];
  const ids = matches.map((match) => Number(match.id)).filter(Number.isFinite);
  const verses = await getVersesByIds(env.DB, ids);
  const scores = new Map(matches.map((match) => [Number(match.id), match.score ?? 0]));

  return json({
    results: verses.map((verse) => ({ ...verse, score: scores.get(verse.id) ?? 0 })),
    total: verses.length
  });
}

async function handleGreekParse(request: Request, env: Env): Promise<Response> {
  try {
    const body = await readJson<{ greek?: string }>(request);
    const greek = body.greek?.trim();
    if (!greek) return json({ error: "greek is required" }, 400);

    let match: { verse: VerseRecord; morphology: MorphologyWordRecord[] } | null = null;
    try {
      const normalized = normalizeGreekForComparison(greek);
      match = await searchVerseByGreekText(env.DB, normalized);
    } catch {
      match = null;
    }

    if (match) {
      const words = alignGreekWordsWithMorphology(greek, match.morphology);
      return json({ words, cached: true, source: "morphology" });
    }

    try {
      const cached = await getGreekCache(env.DB, greek);
      if (cached) return json(cached);

      const parsing = await parseGreekWithAi(env.AI, greek);
      await setGreekCache(env.DB, greek, parsing);
      return json({ ...parsing, cached: false });
    } catch (llmError) {
      const message = llmError instanceof Error ? llmError.message : "LLM unavailable";
      return json({ error: `AI parsing failed: ${message}`, words: fallbackWordSplit(greek) });
    }
  } catch (outerError) {
    const message = outerError instanceof Error ? outerError.message : "Parse failed";
    return json({ error: message }, 500);
  }
}

function fallbackWordSplit(greek: string): GreekWordParsing[] {
  return greek
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ({ word, lemma: "", pos: "", parsing: "", gloss: "" }));
}

async function handleAsk(request: Request, env: Env): Promise<Response> {
  const body = await readJson<AskRequest>(request);
  if (!body.query?.trim()) return json({ error: "query is required" }, 400);

  const limit = Math.min(Math.max(body.limit ?? 5, 1), 20);
  const embedding = await generateEmbedding(env.AI, body.query);
  const vectorResults = await env.VECTORIZE.query(embedding, { topK: limit, returnMetadata: true });
  const matches = vectorResults.matches ?? [];
  const ids = matches.map((m) => Number(m.id)).filter(Number.isFinite);
  const verses = await getVersesByIds(env.DB, ids);
  const sorted = matches.map(m => ({
    id: Number(m.id), score: m.score ?? 0,
    verse: verses.find(v => v.id === Number(m.id))
  })).filter(v => v.verse);

  const answer = await askAi(
    env.AI, body.query,
    sorted.map(s => ({
      book: s.verse!.book, chapter: s.verse!.chapter, verse: s.verse!.verse,
      text: s.verse!.bsb || s.verse!.kjv || "", greek: s.verse!.greek
    })),
    body.deep ?? false
  );

  return json({ answer, sources: { verses: sorted.map(s => ({ ...s.verse!, score: s.score })) } });
}

async function handleExplain(request: Request, env: Env): Promise<Response> {
  const body = await readJson<ExplainRequest>(request);
  if (!body.book || !body.chapter || !body.verse) {
    return json({ error: "book, chapter, and verse are required" }, 400);
  }
  const verses = await searchVerses(env.DB, { book: body.book, chapter: body.chapter, limit: 100 });
  const current = verses.find(v => v.verse === body.verse);
  if (!current) return json({ error: "Verse not found" }, 404);
  const idx = verses.findIndex(v => v.verse === body.verse);
  const prev = idx > 0 ? verses[idx - 1] : null;
  const next = idx < verses.length - 1 ? verses[idx + 1] : null;

  const contextVerses = [
    ...(prev ? [{ book: prev.book, chapter: prev.chapter, verse: prev.verse, text: prev.bsb || prev.kjv || "", greek: prev.greek }] : []),
    { book: current.book, chapter: current.chapter, verse: current.verse, text: current.bsb || current.kjv || "", greek: current.greek },
    ...(next ? [{ book: next.book, chapter: next.chapter, verse: next.verse, text: next.bsb || next.kjv || "", greek: next.greek }] : [])
  ];

  const analysis = await askAi(env.AI, `Analyze ${body.book} ${body.chapter}:${body.verse}`, contextVerses, true);
  const morphology = await getMorphology(env.DB, current.id);
  return json({ verse: current, context: { prev, next }, morphology, analysis });
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders });
}

function clampLimit(value: string | null, fallback: number): number {
  const parsed = value ? Number(value) : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), 100);
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

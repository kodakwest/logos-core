import type { GreekParsingResponse, GreekWordParsing, VerseRecord } from "./types";

const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";
const GREEK_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

interface EmbeddingResponse {
  data?: number[][];
  shape?: number[];
}

interface ChatResponse {
  response?: string;
  result?: { response?: string };
}

export async function generateEmbedding(ai: Ai, text: string): Promise<number[]> {
  const response = (await ai.run(EMBEDDING_MODEL, { text: [text] })) as EmbeddingResponse;
  const vector = response.data?.[0];
  if (!vector) throw new Error("Workers AI did not return an embedding");
  return vector;
}

export async function upsertVerseVector(vectorize: VectorizeIndex, verse: VerseRecord, values: number[]): Promise<void> {
  await vectorize.upsert([
    {
      id: String(verse.id),
      values,
      metadata: {
        book: verse.book,
        chapter: verse.chapter,
        verse: verse.verse
      }
    }
  ]);
}

export async function parseGreekWithAi(ai: Ai, greek: string): Promise<Omit<GreekParsingResponse, "cached">> {
  const prompt = `Parse this Greek NT text word-by-word. For each word provide:
- Lemma (dictionary form)
- Part of speech
- Parsing (tense, voice, mood for verbs; case, number, gender for nouns)
- A brief gloss

Return only JSON in this shape:
{"words":[{"word":"...","lemma":"...","pos":"...","parsing":"...","gloss":"..."}]}

Text: ${greek}`;

  const output = (await ai.run(GREEK_MODEL, {
    messages: [{ role: "user", content: prompt }],
    max_tokens: 2048
  })) as ChatResponse;
  const text = output.response ?? output.result?.response ?? "";
  const parsed = parseGreekJson(text);
  if (parsed.length > 0) return { words: parsed, raw: text };
  return { words: fallbackWords(greek), raw: text };
}

const CHAT_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

const ASK_SYSTEM_PROMPT = `You are a Bible scholar assistant. Answer questions based on the provided scripture passages.
Cite your sources by book, chapter, and verse. If the passages don't answer the question, say so.
Keep answers concise unless asked for deep analysis. Use the original Greek where it adds clarity.`;

export async function askAi(
  ai: Ai,
  query: string,
  verses: { book: string; chapter: number; verse: number; text: string; greek: string | null }[],
  deep: boolean
): Promise<string> {
  const passages = verses.map(v =>
    `${v.book} ${v.chapter}:${v.verse} — ${v.text}${v.greek ? ` (Gk: ${v.greek})` : ""}`
  ).join("\n\n");

  const userPrompt = deep
    ? `Question: ${query}\n\nPassages for analysis:\n${passages}\n\nProvide a thorough analysis referencing the Greek text where helpful.`
    : `Question: ${query}\n\nRelevant passages:\n${passages}\n\nAnswer concisely with citations.`;

  const response = await ai.run(CHAT_MODEL, {
    messages: [
      { role: "system", content: ASK_SYSTEM_PROMPT },
      { role: "user", content: userPrompt }
    ],
    max_tokens: deep ? 2048 : 1024
  }) as ChatResponse;

  return response.response ?? response.result?.response ?? "No answer generated.";
}

function parseGreekJson(text: string): GreekWordParsing[] {
  // Strip markdown code fences
  const cleaned = text.replace(/```(?:json)?\s*/gi, '').trim();
  // Find outermost JSON object  
  let start = cleaned.indexOf('{');
  if (start === -1) return [];
  let depth = 0, end = -1;
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === '{') depth++;
    else if (cleaned[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end === -1) return [];
  try {
    const sliced = cleaned.slice(start, end);
    const parsed = JSON.parse(sliced) as { words?: GreekWordParsing[] };
    if (!Array.isArray(parsed.words)) return [];
    return parsed.words.map((word) => ({
      word: String(word.word ?? ""),
      lemma: String(word.lemma ?? ""),
      pos: String(word.pos ?? ""),
      parsing: String(word.parsing ?? ""),
      gloss: String(word.gloss ?? "")
    }));
  } catch (e) {
    return [{ word: `PARSE_ERROR: ${(e as Error).message}`, lemma: "", pos: "", parsing: "", gloss: "" }];
  }
}

function fallbackWords(greek: string): GreekWordParsing[] {
  return greek
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ({ word, lemma: "", pos: "", parsing: "", gloss: "" }));
}

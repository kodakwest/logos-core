export interface Env {
  DB: D1Database;
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  ASSETS: Fetcher;
}

export interface UploadChapterRequest {
  book: string;
  bookNumber: number;
  chapter: number;
  verses?: VerseInput[];
}

export interface VerseInput {
  book: string;
  bookNumber: number;
  chapter: number;
  verse: number;
  kjv: string | null;
  bsb: string | null;
  greek: string | null;
  topics: string[];
  pericope: string | null;
}

export interface VerseRecord extends VerseInput {
  id: number;
  embeddingId: number | null;
  score?: number;
}

export interface GreekWordParsing {
  word: string;
  lemma: string;
  pos: string;
  parsing: string;
  gloss: string;
}

export interface GreekParsingResponse {
  words: GreekWordParsing[];
  cached: boolean;
  raw?: string;
}

export interface SemanticSearchRequest {
  query: string;
  limit?: number;
}

export interface AskRequest {
  query: string;
  deep?: boolean;
  limit?: number;
}

export interface ExplainRequest {
  book: string;
  chapter: number;
  verse: number;
}

export interface MorphologyWordInput {
  position: number;
  lemma: string | null;
  pos: string | null;
  gender: string | null;
  case: string | null;
  number: string | null;
  domains: string | null;
  subdomains: string | null;
  clauseFunction: string | null;
}

export interface UploadMorphologyRequest {
  verseId: number;
  words: MorphologyWordInput[];
}

export interface MorphologyRequest {
  book: string;
  chapter: number;
  verse: number;
}

export interface MorphologyWordRecord extends MorphologyWordInput {
  id: number;
  verseId: number;
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

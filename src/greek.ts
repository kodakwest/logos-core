import type { GreekWordParsing, MorphologyWordRecord } from "./types";

const GREEK_PUNCTUATION = /[.,;:·'"«»‿()[\]{}\u037E\u00B7]/g;
const EDGE_GREEK_PUNCTUATION = /^[.,;:·'"«»‿()[\]{}\u037E\u00B7]+|[.,;:·'"«»‿()[\]{}\u037E\u00B7]+$/g;

export function normalizeGreekForComparison(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036F]/g, "")
    .normalize("NFC")
    .replace(GREEK_PUNCTUATION, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function alignGreekWordsWithMorphology(
  greekText: string,
  morphology: MorphologyWordRecord[]
): GreekWordParsing[] {
  const words = greekText
    .split(/\s+/)
    .map((word) => word.replace(EDGE_GREEK_PUNCTUATION, ""))
    .filter(Boolean);
  const limit = Math.min(words.length, morphology.length);
  const result: GreekWordParsing[] = [];

  for (let i = 0; i < limit; i++) {
    const morph = morphology[i];
    result.push({
      word: words[i],
      lemma: morph.lemma ?? "",
      pos: morph.pos ?? "",
      parsing: buildParsingString(morph),
      gloss: ""
    });
  }

  return result;
}

function buildParsingString(morph: MorphologyWordRecord): string {
  return [morph.case, morph.number, morph.gender].filter((part): part is string => Boolean(part)).join(", ");
}

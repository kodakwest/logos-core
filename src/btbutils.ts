import type { VerseInput } from "./types";

const BTB_ROOT = "/home/tsrwest/BTB/interlinear";

interface ParsedFrontmatter {
  [key: string]: string | string[] | undefined;
}

export function getChapterPath(bookNumber: number, book: string, chapter: number): string {
  return `${BTB_ROOT}/${bookNumber} - ${book}/${chapter}`;
}

export async function readBtbChapter(book: string, bookNumber: number, chapter: number): Promise<VerseInput[]> {
  const { readdir, readFile } = await import("node:fs/promises");
  const chapterPath = getChapterPath(bookNumber, book, chapter);
  let entries: string[];

  try {
    entries = await readdir(chapterPath);
  } catch {
    throw new Error("Chapter data not found in BTB export");
  }

  const verseFiles = entries
    .filter((name) => name.endsWith(".md"))
    .map((name) => ({ name, verse: verseNumberFromFilename(name) }))
    .filter((item): item is { name: string; verse: number } => Number.isFinite(item.verse))
    .sort((a, b) => a.verse - b.verse);

  const verses: VerseInput[] = [];
  for (const file of verseFiles) {
    const content = await readFile(`${chapterPath}/${file.name}`, "utf8");
    const frontmatter = parseFrontmatter(content);
    verses.push({
      book,
      bookNumber,
      chapter,
      verse: file.verse,
      kjv: scalar(frontmatter.kjv),
      bsb: scalar(frontmatter.bsb),
      greek: scalar(frontmatter.greek),
      topics: list(frontmatter.topics),
      pericope: scalar(frontmatter.pericope)
    });
  }

  return verses;
}

export function parseFrontmatter(markdown: string): ParsedFrontmatter {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  if (!match) return {};

  const lines = match[1].split(/\r?\n/);
  const result: ParsedFrontmatter = {};
  let currentListKey: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const listItem = /^\s*-\s*(.*)$/.exec(line);

    if (listItem && currentListKey) {
      const existing = result[currentListKey];
      const values = Array.isArray(existing) ? existing : [];
      values.push(cleanYamlValue(listItem[1]));
      result[currentListKey] = values;
      continue;
    }

    const keyValue = /^([A-Za-z0-9_/-]+):(?:\s*(.*))?$/.exec(line);
    if (!keyValue) continue;

    const [, key, rawValue = ""] = keyValue;
    if (rawValue === "") {
      result[key] = [];
      currentListKey = key;
    } else {
      result[key] = cleanYamlValue(rawValue);
      currentListKey = null;
    }
  }

  return result;
}

function verseNumberFromFilename(filename: string): number {
  const match = /\.(\d+)\.md$/.exec(filename);
  return match ? Number(match[1]) : Number.NaN;
}

function cleanYamlValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "null" || trimmed === "~") return "";
  const quoted = /^(['"])([\s\S]*)\1$/.exec(trimmed);
  if (!quoted) return trimmed;
  return quoted[2].replace(/\\"/g, '"').replace(/\\'/g, "'");
}

function scalar(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value.join(", ");
  return value && value.length > 0 ? value : null;
}

function list(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

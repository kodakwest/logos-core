import { ChevronDown, ChevronUp, Search as SearchIcon } from "lucide-react";
import { FormEvent, useState } from "react";

interface VerseResult {
  id: number;
  book: string;
  chapter: number;
  verse: number;
  bsb: string | null;
  kjv: string | null;
  greek: string | null;
  score?: number;
}

export function SearchView() {
  const [query, setQuery] = useState("");
  const [book, setBook] = useState("");
  const [chapter, setChapter] = useState("");
  const [semantic, setSemantic] = useState(false);
  const [results, setResults] = useState<VerseResult[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Enter a query or filter by book and chapter.");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("Searching");
    try {
      const data = semantic
        ? await postSemantic(query)
        : await getKeywordSearch({ query, book, chapter });
      setResults(data.results);
      setMessage(`${data.total} result${data.total === 1 ? "" : "s"}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function toggleGreek(id: number) {
    setExpanded((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="view-stack">
      <header className="view-header">
        <p>Search</p>
        <h1>Find passages by wording or meaning.</h1>
      </header>

      <form className="tool-panel" onSubmit={submit}>
        <label className="field wide">
          <span>Query</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="shepherds watching their flocks" />
        </label>
        <label className="field">
          <span>Book</span>
          <input value={book} onChange={(event) => setBook(event.target.value)} placeholder="Luke" disabled={semantic} />
        </label>
        <label className="field small">
          <span>Chapter</span>
          <input value={chapter} onChange={(event) => setChapter(event.target.value)} inputMode="numeric" placeholder="2" disabled={semantic} />
        </label>
        <label className="toggle-row">
          <input type="checkbox" checked={semantic} onChange={(event) => setSemantic(event.target.checked)} />
          <span>Semantic</span>
        </label>
        <button className="primary-button" type="submit" disabled={loading || (semantic && !query.trim())}>
          <SearchIcon size={18} />
          <span>{loading ? "Searching" : "Search"}</span>
        </button>
      </form>

      <div className="results-meta">{message}</div>
      <div className="result-list">
        {results.map((result) => (
          <article className="verse-card" key={result.id}>
            <div className="verse-heading">
              <div>
                <h2>
                  {result.book} {result.chapter}:{result.verse}
                </h2>
                {typeof result.score === "number" ? <span>{Math.round(result.score * 100)}% match</span> : null}
              </div>
              {result.greek ? (
                <button className="icon-button greek-toggle" type="button" onClick={() => toggleGreek(result.id)} aria-label="Toggle Greek text">
                  <span>Greek</span>
                  {expanded.has(result.id) ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
              ) : null}
            </div>
            {result.bsb ? <p className="translation">{result.bsb}</p> : null}
            {result.kjv ? <p className="secondary-text">{result.kjv}</p> : null}
            {expanded.has(result.id) && result.greek ? <p className="greek-text">{result.greek}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}

async function getKeywordSearch(filters: { query: string; book: string; chapter: string }): Promise<{ results: VerseResult[]; total: number }> {
  const params = new URLSearchParams({ limit: "20" });
  if (filters.query.trim()) params.set("q", filters.query.trim());
  if (filters.book.trim()) params.set("book", filters.book.trim());
  if (filters.chapter.trim()) params.set("chapter", filters.chapter.trim());
  const response = await fetch(`/api/verses/search?${params.toString()}`);
  if (!response.ok) throw new Error("Keyword search failed");
  return response.json();
}

async function postSemantic(query: string): Promise<{ results: VerseResult[]; total: number }> {
  const response = await fetch("/api/verses/semantic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit: 8 })
  });
  if (!response.ok) throw new Error("Semantic search failed");
  return response.json();
}

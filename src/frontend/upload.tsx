import { CloudUpload } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

const books = [
  ["Matthew", 40],
  ["Mark", 41],
  ["Luke", 42],
  ["John", 43],
  ["Acts", 44],
  ["Romans", 45],
  ["1 Corinthians", 46],
  ["2 Corinthians", 47],
  ["Galatians", 48],
  ["Ephesians", 49],
  ["Philippians", 50],
  ["Colossians", 51],
  ["1 Thessalonians", 52],
  ["2 Thessalonians", 53],
  ["1 Timothy", 54],
  ["2 Timothy", 55],
  ["Titus", 56],
  ["Philemon", 57],
  ["Hebrews", 58],
  ["James", 59],
  ["1 Peter", 60],
  ["2 Peter", 61],
  ["1 John", 62],
  ["2 John", 63],
  ["3 John", 64],
  ["Jude", 65],
  ["Revelation", 66]
] as const;

interface UploadResponse {
  versesInserted: number;
  errors: string[];
  verses?: Array<{ id: number; book: string; chapter: number; verse: number; bsb: string | null; greek: string | null }>;
  error?: string;
}

export function UploadView() {
  const [book, setBook] = useState("Luke");
  const [chapter, setChapter] = useState("1");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<UploadResponse | null>(null);

  const bookNumber = useMemo(() => books.find(([name]) => name === book)?.[1] ?? 42, [book]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setResponse(null);
    try {
      const result = await fetch("/api/upload/chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ book, bookNumber, chapter: Number(chapter) })
      });
      const data = (await result.json()) as UploadResponse;
      setResponse(data);
    } catch {
      setResponse({ versesInserted: 0, errors: ["Upload failed"] });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="view-stack">
      <header className="view-header">
        <p>Upload</p>
        <h1>Ingest a chapter from the BTB interlinear export.</h1>
      </header>

      <form className="tool-panel upload-grid" onSubmit={submit}>
        <label className="field">
          <span>Book</span>
          <select value={book} onChange={(event) => setBook(event.target.value)}>
            {books.map(([name, number]) => (
              <option key={name} value={name}>
                {number} - {name}
              </option>
            ))}
          </select>
        </label>
        <label className="field small">
          <span>Chapter</span>
          <input value={chapter} onChange={(event) => setChapter(event.target.value)} inputMode="numeric" min="1" />
        </label>
        <button className="primary-button" type="submit" disabled={loading || Number(chapter) < 1}>
          <CloudUpload size={18} />
          <span>{loading ? "Uploading" : "Upload"}</span>
        </button>
      </form>

      {response ? (
        <section className="response-panel">
          <h2>{response.error ?? `${response.versesInserted} verses indexed`}</h2>
          {response.errors.length ? <p className="error-text">{response.errors.join("\n")}</p> : null}
          {response.verses?.slice(0, 8).map((verse) => (
            <article className="mini-verse" key={verse.id}>
              <strong>
                {verse.book} {verse.chapter}:{verse.verse}
              </strong>
              <span>{verse.bsb}</span>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}

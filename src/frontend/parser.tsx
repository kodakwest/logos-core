import { WandSparkles } from "lucide-react";
import { FormEvent, useState } from "react";

interface GreekWord {
  word: string;
  lemma: string;
  pos: string;
  parsing: string;
  gloss: string;
}

export function ParserView() {
  const [greek, setGreek] = useState("Ἐγένετο ἐν ταῖς ἡμέραις Ἡρῴδου");
  const [words, setWords] = useState<GreekWord[]>([]);
  const [message, setMessage] = useState("Ready");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("Parsing");
    try {
      const response = await fetch("/api/parse/greek", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ greek })
      });
      const data = (await response.json()) as { words?: GreekWord[]; cached?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Greek parsing failed");
      setWords(data.words ?? []);
      setMessage(data.cached ? "Loaded from cache" : "Parsed with Workers AI");
    } catch (error) {
      setWords([]);
      setMessage(error instanceof Error ? error.message : "Greek parsing failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="view-stack">
      <header className="view-header">
        <p>Greek Parser</p>
        <h1>Parse Greek New Testament text word by word.</h1>
      </header>

      <form className="parser-form" onSubmit={submit}>
        <label className="field">
          <span>Greek text</span>
          <textarea value={greek} onChange={(event) => setGreek(event.target.value)} rows={6} />
        </label>
        <div className="form-actions">
          <span>{message}</span>
          <button className="primary-button" type="submit" disabled={loading || !greek.trim()}>
            <WandSparkles size={18} />
            <span>{loading ? "Parsing" : "Parse"}</span>
          </button>
        </div>
      </form>

      {words.length ? (
        <>
          <div className="table-wrap parser-table">
            <table>
              <thead>
                <tr>
                  <th>Word</th>
                  <th>Lemma</th>
                  <th>POS</th>
                  <th>Parsing</th>
                  <th>Gloss</th>
                </tr>
              </thead>
              <tbody>
                {words.map((word, index) => (
                  <tr key={`${word.word}-${index}`}>
                    <td className="greek-cell">{word.word}</td>
                    <td>{word.lemma}</td>
                    <td>{word.pos}</td>
                    <td>{word.parsing}</td>
                    <td>{word.gloss}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="parser-card-list">
            {words.map((word, index) => (
              <article className="parser-card" key={`${word.word}-card-${index}`}>
                <h2>{word.word}</h2>
                <dl>
                  <div>
                    <dt>Lemma</dt>
                    <dd>{word.lemma}</dd>
                  </div>
                  <div>
                    <dt>POS</dt>
                    <dd>{word.pos}</dd>
                  </div>
                  <div>
                    <dt>Parsing</dt>
                    <dd>{word.parsing}</dd>
                  </div>
                  <div>
                    <dt>Gloss</dt>
                    <dd>{word.gloss}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

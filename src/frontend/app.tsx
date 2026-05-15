import { BookOpen, Search, TextCursorInput } from "lucide-react";
import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useState } from "react";
import { ParserView } from "./parser";
import { SearchView } from "./search";
import { UploadView } from "./upload";
import "./style.css";

export type Route = "search" | "upload" | "parse";

const navItems: Array<{ route: Route; label: string; icon: typeof Search }> = [
  { route: "search", label: "Search", icon: Search },
  { route: "parse", label: "Greek Parser", icon: TextCursorInput }
];

function App() {
  const [route, setRoute] = useState<Route>(readRoute());
  const [status, setStatus] = useState<string>("Checking status");

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    fetch("/api/status")
      .then((response) => (response.ok ? (response.json() as Promise<{ verses: number; greekCacheEntries: number }>) : Promise.reject()))
      .then((data: { verses: number; greekCacheEntries: number }) => {
        setStatus(`${data.verses.toLocaleString()} verses indexed · ${data.greekCacheEntries.toLocaleString()} parses cached`);
      })
      .catch(() => setStatus("API not initialized"));
  }, []);

  const View = useMemo(() => {
    if (route === "upload") return UploadView;
    if (route === "parse") return ParserView;
    return SearchView;
  }, [route]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#search" aria-label="Bible AI Search">
          <BookOpen size={26} />
          <span>Bible AI Search</span>
        </a>
        <nav className="nav-list" aria-label="Primary">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <a key={item.route} className={route === item.route ? "active" : ""} href={`#${item.route}`}>
                <Icon size={18} />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>
        <p className="status-pill">{status}</p>
      </aside>
      <section className="workspace">
        <View />
      </section>
    </main>
  );
}

function readRoute(): Route {
  const route = window.location.hash.replace("#", "");
  return route === "upload" || route === "parse" ? route : "search";
}

createRoot(document.getElementById("root")!).render(<App />);

import { Menu, Search, TextCursorInput } from "lucide-react";
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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onHash = () => {
      setRoute(readRoute());
      setMenuOpen(false);
    };
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
        <a className="brand" href="#search" aria-label="LogOS Core">
          <OpenPathLogo />
          <span className="brand-copy">
            <span className="brand-name">LogOS Core</span>
            <span className="brand-tagline">The Operating System for Truth</span>
          </span>
        </a>
        <button className="hamburger" type="button" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
          <Menu size={22} />
        </button>
        <LogoLoadingCycle />
        <nav className={`nav-list${menuOpen ? " open" : ""}`} aria-label="Primary">
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

function OpenPathLogo() {
  return (
    <svg className="open-path-logo" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20,80 Q50,40 50,20 Q50,40 80,80" />
      <path d="M50,20 L50,80" strokeDasharray="8 8" />
      <path d="M10,20 Q30,10 50,20 Q70,10 90,20 L90,80 Q70,70 50,80 Q30,70 10,80 Z" strokeWidth="3" />
    </svg>
  );
}

function LogoLoadingCycle() {
  return (
    <div className="logo-cycle" aria-label="LogOS identity cycle">
      <span className="logo-fade">
        <strong>LógOS</strong>
        <span>The Illuminated Word</span>
      </span>
      <span className="logo-fade">
        <strong>ΛogOS</strong>
        <span>The Upward Path</span>
      </span>
      <span className="logo-fade">
        <strong>LogOΣ</strong>
        <span>The Foundational System</span>
      </span>
    </div>
  );
}

function readRoute(): Route {
  const route = window.location.hash.replace("#", "");
  return route === "upload" || route === "parse" ? route : "search";
}

createRoot(document.getElementById("root")!).render(<App />);

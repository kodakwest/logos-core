import type { ReactElement } from "react";

export type EcosystemApp = "core" | "shepherd" | "roundtable";

type EcosystemNavProps = {
  activeApp?: EcosystemApp;
};

const apps: Array<{
  id: EcosystemApp;
  label: string;
  href: string;
  className: string;
  icon: ReactElement;
}> = [
  {
    id: "core",
    label: "LogOS Core",
    href: "https://logos-core.com/",
    className: "core",
    icon: (
      <>
        <path d="M20,80 Q50,40 50,20 Q50,40 80,80" />
        <path d="M50,20 L50,80" strokeDasharray="8 8" />
        <path d="M10,20 Q30,10 50,20 Q70,10 90,20 L90,80 Q70,70 50,80 Q30,70 10,80 Z" strokeWidth="3" />
      </>
    )
  },
  {
    id: "shepherd",
    label: "Shepherd",
    href: "https://shepherd.logos-core.com/",
    className: "shepherd",
    icon: (
      <>
        <path d="M20,90 Q50,60 40,40 T60,20" />
        <circle cx="65" cy="15" r="8" fill="currentColor" />
        <circle cx="35" cy="75" r="4" fill="currentColor" stroke="none" />
        <circle cx="48" cy="65" r="4" fill="currentColor" stroke="none" />
        <circle cx="42" cy="50" r="4" fill="currentColor" stroke="none" />
      </>
    )
  },
  {
    id: "roundtable",
    label: "Roundtable",
    href: "https://roundtable.logos-core.com/",
    className: "roundtable",
    icon: (
      <>
        <circle cx="50" cy="50" r="10" />
        <circle cx="50" cy="20" r="6" fill="currentColor" stroke="none" />
        <circle cx="50" cy="80" r="6" fill="currentColor" stroke="none" />
        <circle cx="20" cy="50" r="6" fill="currentColor" stroke="none" />
        <circle cx="80" cy="50" r="6" fill="currentColor" stroke="none" />
        <line x1="50" y1="30" x2="50" y2="40" />
        <line x1="50" y1="60" x2="50" y2="70" />
        <line x1="30" y1="50" x2="40" y2="50" />
        <line x1="60" y1="50" x2="70" y2="50" />
        <circle cx="50" cy="50" r="35" strokeDasharray="6 6" strokeWidth="2" />
      </>
    )
  }
];

export function EcosystemNav({ activeApp = detectActiveApp() }: EcosystemNavProps) {
  return (
    <nav className="ecosystem-nav" aria-label="LogOS ecosystem">
      {apps.map((app) => {
        const isActive = activeApp === app.id;

        return (
          <a
            key={app.id}
            className={`ecosystem-nav-link ${app.className}${isActive ? " active" : ""}`}
            href={isActive ? "/" : app.href}
            aria-label={app.label}
            aria-current={isActive ? "page" : undefined}
            title={app.label}
          >
            <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {app.icon}
            </svg>
          </a>
        );
      })}
    </nav>
  );
}

function detectActiveApp(): EcosystemApp {
  if (typeof window === "undefined") return "core";

  const hostname = window.location.hostname.toLowerCase();
  if (hostname.startsWith("shepherd.")) return "shepherd";
  if (hostname.startsWith("roundtable.")) return "roundtable";
  return "core";
}

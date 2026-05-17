---
title: "LogOS Brand Identity & Design System — Detailed Spec"
artifact_type: Design_Spec
source_context: Consolidated from Jules UI concepts (logos-ui-concept.html), brand media kit (rebrand-moodboard.html), product blueprints (logos-product-blueprints.html), and LogOS loading animation — May 16-17, 2026
domain: Brand identity; UI/UX design; design systems
systems: LogOS Core; LogOS Shepherd; LogOS Roundtable; Cloudflare Workers; Vite React
primary_entities: LogOS; LogOS Core; LogOS Shepherd; LogOS Roundtable; The Open Path; Brand Design System
last_updated: 2026-05-17
status: active
---

# LogOS Brand Identity & Design System — Detailed Spec

> Unified look and feel across all three LogOS products, based on Jules UI concepts.

---

## 1. Shared Design Foundation

Every LogOS product uses the same base layer. Only the accent color and a few layout patterns differ per app.

### 1.1 Color System

#### Base Palette (Shared Across ALL Apps)

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-base` | `#0b0d0e` | Page background |
| `--bg-panel` | `#131618` | Card, sidebar, panel backgrounds |
| `--bg-elevated` | `#1a1d21` | Hover states, elevated surfaces |
| `--ink-primary` | `#e8e6e1` | Primary text, headings |
| `--ink-secondary` | `#a0a0a5` | Secondary text, metadata, labels |
| `--ink-tertiary` | `#6e6e73` | Placeholder text, disabled states |
| `--border-subtle` | `#2a2d31` | Dividers, card borders, input borders |
| `--border-focus` | `#3d4148` | Focus ring, active border |
| `--font-serif` | `'Playfair Display', serif` | Headings, logotypes, verse text |
| `--font-sans` | `'Inter', sans-serif` | Body text, UI labels, inputs |

#### Per-App Accent Colors

Each app gets ONE distinct accent color from the brand family, applied consistently across all interactive elements:

| App | Accent Token | Hex | Usage |
|-----|-------------|-----|-------|
| **LogOS Core** | `--brand-primary` | `#d4af37` (Gold) | Headlines, links, active states, icons, borders on focus, AI panel highlights |
| **LogOS Shepherd** | `--brand-primary` | `#a3e635` (Lime Green) | Headlines, progress indicators, buttons, journey markers, warm accent |
| **LogOS Roundtable** | `--brand-primary` | `#4da8da` (Tech Blue) | Headlines, node borders, connector lines, toolbar accents, graph elements |

Each accent has a dim variant for backgrounds and hover states:
```css
--brand-dim: rgba(<accent-rgb>, 0.2);
```
Example: Gold → `rgba(212, 175, 55, 0.2)`

### 1.2 Typography

| Element | Font | Weight | Size | Color |
|---------|------|--------|------|-------|
| App name / logotype | Playfair Display | 600 | 1.5-1.8rem | Per-app accent |
| Page headings (h1) | Playfair Display | 600 | 1.5-2rem | `--ink-primary` |
| Section headings (h2) | Playfair Display | 600 | 1.2-1.5rem | `--ink-primary` |
| Verse text (display) | Playfair Display | 400 | 2-2.5rem (Core) | `--ink-primary` |
| Body text | Inter | 400 | 0.9-1rem | `--ink-primary` |
| Labels / metadata | Inter | 500 | 0.75-0.85rem | `--ink-secondary` |
| Code / Greek text | Inter (or serif for polytonic) | 400 | 0.9-1rem | `--ink-primary` |

### 1.3 Spacing Grid

Use a 4px baseline grid. Common spacing values:

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | 4px | Internal padding, gaps |
| `--space-sm` | 8px | Tight gaps |
| `--space-md` | 16px | Button padding, card padding |
| `--space-lg` | 24px | Section padding, header padding |
| `--space-xl` | 32px | Large gaps, content padding |
| `--space-2xl` | 48px | Hero spacing, major sections |

### 1.4 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 4px | Inputs, small controls |
| `--radius-md` | 8px | Cards, panels, search input |
| `--radius-lg` | 12px | Modals, navigation icons |
| `--radius-xl` | 16px | Journey cards (Shepherd) |
| `--radius-full` | 999px | Pills, badges, avatars |

---

## 2. Ecosystem Navigation (Shared Across All Apps)

A unified 72px sidebar navigation allows switching between all three LogOS apps from anywhere in the ecosystem.

### 2.1 App Switcher Nav Bar

```
┌──────────┐
│  [Logo]  │  ← The Open Path icon at top
│          │
│  [Core]  │  ← Gold icon, active state has left indicator
│          │
│ [Shep. ] │  ← Green icon
│          │
│ [Round.] │  ← Blue icon
│          │
└──────────┘
```

- **Width:** 72px fixed
- **Background:** `--bg-panel` (`#131618`)
- **Right border:** `--border-subtle`
- **Icons:** 48x48px, 12px border-radius
- **Active indicator:** 4px-wide left bar in the app's accent color
- **Hover:** `scale(1.05)` transform, dim background on hover
- **Icon SVGs:**
  - **Core:** The Open Path mark (book + path, gold)
  - **Shepherd:** Path with flock dots (green) — shepherd crook + sheep icons
  - **Roundtable:** Connected circles graph (blue) — network nodes

### 2.2 Per-App Icon Specifications

#### Core App Icon (The Open Path)
```svg
<path d="M20,80 Q50,40 50,20 Q50,40 80,80" />         <!-- open book pages -->
<path d="M50,20 L50,80" stroke-dasharray="8 8"/>        <!-- dashed spine -->
<path d="M10,20 Q30,10 50,20 Q70,10 90,20 L90,80 Q70,70 50,80 Q30,70 10,80 Z"/> <!-- outer book -->
```
Color: `--brand-gold` (#d4af37)

#### Shepherd App Icon
```svg
<path d="M20,90 Q50,60 40,40 T60,20" />                 <!-- shepherd crook -->
<circle cx="65" cy="15" r="8"/>                          <!-- head -->
<circle cx="35" cy="75" r="4"/>                          <!-- flock dot -->
<circle cx="48" cy="65" r="4"/>                          <!-- flock dot -->
<circle cx="42" cy="50" r="4"/>                          <!-- flock dot -->
```
Color: `--brand-green` (#a3e635)

#### Roundtable App Icon
```svg
<circle cx="50" cy="50" r="10"/>                          <!-- center node -->
<circle cx="50" cy="20" r="6"/>                          <!-- top node -->
<circle cx="50" cy="80" r="6"/>                          <!-- bottom node -->
<circle cx="20" cy="50" r="6"/>                          <!-- left node -->
<circle cx="80" cy="50" r="6"/>                          <!-- right node -->
<circle cx="50" cy="50" r="35" stroke-dasharray="6 6"/>  <!-- orbit ring -->
```
Color: `--brand-blue` (#4da8da)

---

## 3. LogOS Core — Design Specifications

### 3.1 Layout

**3-panel layout:**

```
┌─────────────┬───────────────────────────────┬────────────────┐
│  Search /   │    Main Reading Area           │  AI Analysis   │
│  History    │                                │  Panel         │
│  Sidebar    │  ┌─ LogOS Core ────────────┐  │                │
│  320px      │  │  The Operating System   │  │  400px         │
│             │  │  for Truth              │  │                │
│  ┌────────┐ │  ├─────────────────────────┤  │ ┌───┐          │
│  │Search  │ │  │  John 1:1 (BSB)        │  │ │Deep│         │
│  │input   │ │  │                         │  │ │Dive│         │
│  ├────────┤ │  │  "In the beginning      │  │ ├───┤          │
│  │History │ │  │   was the Word..."      │  │ │Morph│         │
│  │items   │ │  │                         │  │ │table│         │
│  │👇      │ │  │  Click words for        │  │ ├───┤          │
│  │        │ │  │  morphology detail      │  │ │AI   │         │
│  │        │ │  │                         │  │ │Chat │         │
│  └────────┘ │  └─────────────────────────┘  │ └───┘          │
└─────────────┴───────────────────────────────┴────────────────┘
```

- **Left panel (320px):** Search input + history list
- **Center (flex: 1):** Verse display with clickable words, header bar
- **Right panel (400px):** AI analysis panel with morphology cards + AI chat

### 3.2 Components

#### Header Bar
- **Height:** 64px (with padding)
- **Content:** "LogOS Core" (Playfair, 1.5rem, gold) on left, tagline "The Operating System for Truth" (Inter, 0.9rem, `--ink-tertiary`) on right
- **Border bottom:** 1px solid `--border-subtle`

#### Search Sidebar
- **Search input:** Full width, `--bg-elevated` background, 8px border-radius, gold border on focus
- **Padding:** 24px around search, 16px for history
- **History items:** 12px padding X/Y, 2px gold left border on active, `--bg-elevated` on hover
- **History title:** 0.95rem, medium weight
- **History meta:** 0.8rem, `--ink-secondary`

#### Verse Display
- **Max width:** 800px, centered
- **Verse reference label:** 0.9rem, uppercase, gold, letter-spaced, above verse text
- **Verse text:** 2.5rem Playfair Display, 1.4 line-height, `--ink-primary`
- **Clickable words:** `border-bottom: 1px dotted transparent` → gold dotted on hover, gold background + padding on selected

#### AI Analysis Panel
- **Header:** "Deep Dive" with gold coin icon, `--ink-primary` text
- **Morphology cards:** `--bg-elevated`, 8px radius, 20px padding, gold Greek lemma at 1.8rem Playfair, italic lemma name, key-value table
- **AI Analysis bubble:** 2px gold left border, gold tinted background, 0.95rem body text
- **AI input:** Pill-shaped (20px radius), `--bg-base` background, send icon on right

### 3.3 States

| Element | Default | Hover | Active / Focus | Disabled |
|---------|---------|-------|---------------|----------|
| Search input | `--bg-elevated`, `--border-subtle` | — | Gold border | `--ink-tertiary` |
| History item | Transparent left border | `--bg-elevated` | Gold left border + `--bg-elevated` | — |
| Clickable verse word | Bottom border transparent | Gold dotted bottom border | Gold bg + rounded padding | — |
| AI input | `--bg-base`, `--border-focus` | — | Gold border | — |

---

## 4. LogOS Shepherd — Design Specifications

### 4.1 Layout

**Centered hero layout with warm radial gradient:**

```
┌─────────────────────────────────────────────────┐
│  ┌───────────────────────────────────────────┐  │
│  │  Header                                   │  │
│  │  [Shepherd icon] LogOS Shepherd    [badge]│  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│            Warm radiant gradient                 │
│         (green-tinted, center-top)               │
│                                                  │
│      ┌────────────────────────────────┐          │
│      │       [★ Star icon]            │          │
│      │                                │          │
│      │  "Start children off on the    │          │
│      │   way they should go..."       │          │
│      │        — Proverbs 22:6         │          │
│      │                                │          │
│      │  ┌──────────────────────────┐  │          │
│      │  │ Parent-friendly          │  │          │
│      │  │ explanation card         │  │          │
│      │  └──────────────────────────┘  │          │
│      │                                │          │
│      │  [Topic 1] [Topic 2] [Topic 3]│          │
│      │   ← stepping stone buttons →  │          │
│      └────────────────────────────────┘          │
│                                                  │
└─────────────────────────────────────────────────┘
```

- **Single column, vertically centered**
- **Background:** `--bg-base` with `radial-gradient(circle at 50% 0%, rgba(163, 230, 53, 0.05) 0%, transparent 50%)`
- **Content:** Centered vertically and horizontally (flexbox)
- **Max content width:** 600px

### 4.2 Components

#### Shepherd Header
- **Layout:** Flex, space-between, 24px padding X, 48px padding top
- **Logo:** Shepherd icon SVG (green, 32px) + "LogOS Shepherd" (Playfair, 1.8rem, green)
- **Mode badge:** "Parent Companion Mode" — pill-shaped (20px radius), `--bg-panel` background, 0.9rem

#### Journey Card (Hero)
- **Background:** `--bg-panel`
- **Border:** 2px solid `--brand-green-dim`
- **Border radius:** 24px (rounded corners)
- **Padding:** 48px
- **Max width:** 600px
- **Text-align:** Center

#### Star / Badge
- **Position:** Absolute, top -30px, centered
- **Size:** 60x60px circle
- **Background:** `--bg-base`
- **Color:** `#fde047` (bright yellow star)
- **Border:** 2px solid `--brand-green-dim`

#### Verse Display (Shepherd)
- **Font:** Inter (not Playfair — more readable for parents)
- **Size:** 1.5rem, 1.5 line-height
- **Color:** `--ink-primary`
- **Weight:** 500

#### Explanation Card
- **Background:** `--brand-green-dim`
- **Padding:** 24px
- **Border radius:** 16px
- **Font:** 1.1rem, left-aligned
- **Color:** `--ink-primary`

#### Stepping Stone Navigation
- **Layout:** Flex row, centered, 16px gap, 32px margin-top
- **Buttons:** Pill-shaped (30px radius), `--bg-elevated`, 2px `--border-subtle`, 12px 24px padding
- **Hover:** Green border + green tinted background
- **Purpose:** Topic progression / age-tier navigation

### 4.3 States

| Element | Default | Hover | Active |
|---------|---------|-------|--------|
| Nav icon | Transparent bg, `--brand-green` icon | `--brand-green-dim` bg | `--brand-green-dim` bg |
| Stone button | `--bg-elevated`, `--border-subtle` | Green border + green tint bg | Filled green bg |
| Topic card | `--bg-panel`, `--brand-green-dim` border | Scale up slightly | — |

---

## 5. LogOS Roundtable — Design Specifications

### 5.1 Layout

**2-panel layout with blueprint grid canvas:**

```
┌────────────────────────────────────────────────────────┐
│  ┌──────────────┬─────────────────────────────────────┐│
│  │  Series       │  Toolbar                           ││
│  │  Sidebar      │  [Filter] [Search] [Sort]          ││
│  │  280px        ├─────────────────────────────────────┤│
│  │               │                                     ││
│  │  ┌─ Series ─┐ │       Blueprint Grid Canvas         ││
│  │  │ Series A │ │    (40px grid background)           ││
│  │  │ Series B │ │                                     ││
│  │  │ Series C │ │   ┌──────────────────────┐          ││
│  │  └──────────┘ │   │  Sermon Node Card    │          ││
│  │               │   │  Title, date, verses │          ││
│  │  ┌ Filter ──┐ │   └──────────────────────┘          ││
│  │  │ Book     │ │                                     ││
│  │  │ Date     │ │          ┌────────────┐             ││
│  │  │ Series   │ │          │ Guide Node │             ││
│  │  └──────────┘ │          └────────────┘             ││
│  │               │                                     ││
│  └──────────────┴─────────────────────────────────────┘│
└────────────────────────────────────────────────────────┘
```

- **Left sidebar (280px):** Series list + filters
- **Right (flex: 1):** Toolbar bar (64px) + scrollable canvas area with grid background

### 5.2 Components

#### Roundtable Sidebar
- **Background:** `--bg-panel`
- **Right border:** `--border-subtle`
- **Padding:** 24px
- **Header:** "Roundtable" with connected-circles icon (blue, Playfair, 1.5rem)
- **Series list items:** 12px padding, blue left border on active, `--bg-elevated` on hover
- **Filter section:** Below series list, same padding

#### Toolbar
- **Height:** 64px
- **Border bottom:** 1px solid `--border-subtle`
- **Padding:** 0 24px
- **Content:** Filter buttons, search, sort controls — flex row, 16px gap

#### Canvas (Main Content Area)
- **Background:** 40px grid pattern (both X and Y lines at `--border-subtle`)
- **Position:** Relative (for absolute-positioned node cards)
- **Overflow:** Hidden or scroll

#### Node Cards
- **Background:** `--bg-elevated`
- **Border:** 1px solid `--brand-blue-dim`
- **Border radius:** 12px
- **Padding:** 20px
- **Width:** 300px
- **Shadow:** `0 8px 32px rgba(0,0,0,0.4)`
- **Top accent bar:** 4px colored top border varies by card type:
  - Primary sermon: Blue (`--brand-blue`)
  - Related/guide: Gold (`--brand-gold`)
  - AI suggestion: Dashed gray (`--ink-tertiary`)

#### Connector Lines
- **Background:** `--brand-blue-dim`
- **Height:** 2px
- **Z-index:** Below cards
- **Origin:** Transform-origin at top-left for angled lines

#### Node Content
- **Title:** Flex row, space-between, 600 weight, 1rem
- **Metadata:** 0.9rem, `--ink-secondary`, 1.5 line-height

### 5.3 States

| Element | Default | Hover | Active |
|---------|---------|-------|--------|
| Sidebar series item | Transparent left border | `--bg-elevated` | Blue left border |
| Node card | Normal shadow | Slightly elevated shadow | — |
| Toolbar button | `--border-subtle` | Blue border | Blue bg |

---

## 6. Reusable Component Library (Shared)

These components work identically across all apps, inheriting the per-app accent color.

### 6.1 Callout Cards
- **Background:** `--bg-panel`
- **Top border:** 3px solid accent color
- **Padding:** 1.5rem
- **Border radius:** 8px

### 6.2 Pill Badges
- **Padding:** 4px 14px
- **Border radius:** 20px
- **Background:** accent color at 10% opacity
- **Border:** 1px solid accent at 30%
- **Text:** accent color, 0.75rem, 500 weight

### 6.3 Data Tables
- **Background:** `--bg-panel`
- **Header row:** accent at 10% opacity background
- **Header text:** accent color
- **Cell border:** `--border-subtle`
- **Border radius:** 8px (overflow hidden)

### 6.4 Search Inputs
- **Background:** `--bg-elevated`
- **Border:** 1px solid `--border-subtle`
- **Border radius:** 8px
- **Padding:** 12px 16px
- **Focus:** Accent color border, no outline
- **Placeholder:** `--ink-tertiary`

### 6.5 Primary Buttons
- **Background:** accent color at 15% opacity
- **Border:** 1px solid accent color
- **Color:** accent color
- **Border radius:** 8px
- **Padding:** 10px 20px
- **Hover:** accent color at 25% opacity

### 6.6 Loading States
- **3-variant fade cycle** (reuse from `logos-loading-animation.html`)
- Variants cycle: LógOS → ΛogOS → LogOΣ (2.5s each, 7.5s loop)
- Display during: verse lookup, AI analysis, search, page transitions

---

## 7. Dark Theme Code (CSS Custom Properties — Reference)

```css
:root {
  /* Base */
  --bg-base: #0b0d0e;
  --bg-panel: #131618;
  --bg-elevated: #1a1d21;
  
  /* Ink */
  --ink-primary: #e8e6e1;
  --ink-secondary: #a0a0a5;
  --ink-tertiary: #6e6e73;
  
  /* Borders */
  --border-subtle: #2a2d31;
  --border-focus: #3d4148;
  
  /* Typography */
  --font-serif: 'Playfair Display', serif;
  --font-sans: 'Inter', sans-serif;
  
  /* Radii */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 999px;
  
  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
}

/* Per-app accent — set on .app-core, .app-shepherd, .app-roundtable */
.app-core {
  --brand-primary: #d4af37;
  --brand-dim: rgba(212, 175, 55, 0.2);
}

.app-shepherd {
  --brand-primary: #a3e635;
  --brand-dim: rgba(163, 230, 53, 0.2);
}

.app-roundtable {
  --brand-primary: #4da8da;
  --brand-dim: rgba(77, 168, 218, 0.2);
}
```

---

## 8. Checklist for Implementation

### LogOS Core
- [ ] Apply 3-panel layout (sidebar / reading / AI panel)
- [ ] Gold accent throughout
- [ ] Search sidebar with history items
- [ ] Clickable verse words with morphology popup
- [ ] AI analysis panel with morphology cards + chat
- [ ] Header with tagline
- [ ] Loading animation on search/AI calls

### LogOS Shepherd
- [ ] Apply centered card layout with radial gradient background
- [ ] Green accent throughout
- [ ] Journey card with star badge
- [ ] Verse display at 1.5rem (Inter, not Playfair)
- [ ] Explanation card with green tint
- [ ] Stepping stone navigation for topics
- [ ] Mode badge in header

### LogOS Roundtable
- [ ] Apply 2-panel layout (sidebar + canvas)
- [ ] Blue accent throughout
- [ ] Blueprint grid background on canvas
- [ ] Series sidebar with filters
- [ ] Node cards with color-coded top borders
- [ ] Connector lines between nodes
- [ ] Toolbar with filter/search/sort

### Shared
- [ ] Ecosystem app switcher nav bar (72px, left side)
- [ ] All three app icons as SVGs
- [ ] Loading animation (3-variant fade cycle)
- [ ] Dark theme CSS custom properties
- [ ] Responsive: collapse sidebar on mobile (<768px)
- [ ] Google Fonts: Playfair Display + Inter

---

## Graph Seed: Entity Relationships

logos -> has -> design-system
logos-core -> uses -> gold-accent
logos-core -> has -> 3-panel-layout
logos-core -> uses -> playfair-verse-text
logos-shepherd -> uses -> green-accent
logos-shepherd -> has -> centered-card-layout
logos-shepherd -> uses -> radial-gradient-background
logos-roundtable -> uses -> blue-accent
logos-roundtable -> has -> 2-panel-layout
logos-roundtable -> uses -> blueprint-grid-canvas
logos-design-system -> defines -> shared-colors
logos-design-system -> defines -> typography
logos-design-system -> defines -> spacing
logos-design-system -> defines -> component-library
app-switcher -> connects -> all-logos-apps
the-open-path -> is -> core-app-icon
loading-animation -> displays -> 3-logo-variants

## Retrieval Keywords
logos brand identity, design system, ui spec, gold accent, green accent, blue accent, jules ui concept, the open path, three panel layout, centered card layout, blueprint grid, ecosystem navigation, app switcher, dark theme, playfair display, inter font, design tokens, component library, loading animation, logos core, logos shepherd, logos roundtable

## Boundary Notes
This doc covers the visual design system and UI specifications for all three LogOS products. It does NOT cover: implementation code, API contracts, database schemas, deployment config, or branding strategy (see logos-roadmap-and-features.md for those). The per-app accent colors differ from the earlier teal/cyan accent used before the LogOS rebrand — all new work should use gold/green/blue per this spec.

# CSV Builder

A client-side tool for uploading, mapping, merging, and cleaning multiple CSV/Excel files into one. All processing happens in the browser — no data leaves your machine.

**Live:** https://ljorgens.github.io/csvBuilder/

## Features

- **Multi-file upload** — Drag and drop CSV or Excel (.xlsx) files
- **Smart column mapping** — Auto-matches similar column names with manual override
- **Mapping templates** — Save and reuse column mappings across sessions
- **Bad data detection** — Flags invalid emails, placeholder values, gibberish names, internal domains, and more
- **Duplicate detection** — Select key columns to find and remove duplicate rows
- **Pattern finder** — Mark known-bad rows as seeds, then find similar rows matching the same patterns
- **Search & navigate** — Filter by text or jump to a row with `#123`
- **Export flagged report** — Download an audit trail of all flagged rows

## Getting Started

```bash
npm install
npm run dev
```

## Deployment

Pushes to `main` auto-deploy to GitHub Pages via Actions.

To build manually:

```bash
npm run build
```

## Tech

- React + Vite
- PapaParse (CSV parsing/export)
- SheetJS (Excel support)

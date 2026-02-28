# CLAUDE.md — tab-bookmark-manager

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**Tab & Bookmark Manager** — AI-powered browser tab and bookmark management system. Chrome/Edge MV3 extension captures URLs; a Node.js backend orchestrates persistence, semantic search, and automation; a Python Flask ML service handles NLP (summarization via BART, NER via spaCy, embeddings via MiniLM). PostgreSQL with pgvector for vector similarity search. Redis for caching and job queues. Puppeteer for full-page archival.

## Commands

```bash
# Start all services (recommended)
docker-compose up -d          # PostgreSQL + Redis + backend + ml-service

# Backend (standalone)
cd backend
npm install
npm run dev                   # nodemon src/index.js (dev)
npm start                     # node src/index.js (prod)
npm test                      # jest --coverage
npm run test:auth             # jest auth tests only (needs JWT_SECRET=testsecret)
npm run test:bulk             # jest bulk tests only
npm run lint                  # eslint src/**/*.js

# ML service (standalone)
cd ml-service
pip install -r requirements.txt
python src/app.py             # Flask on port 5000

# Extension: load dist/ as unpacked in chrome://extensions (no build step in repo)
```

## Architecture

**Three coordinated services:**

- **`extension/`** — Chrome MV3 extension. `background/` (service worker), `content/` (content script), `popup/` (UI). No build step; load directly in browser.
- **`backend/`** — Node.js/Express REST API (port 3000). `src/controllers/`, `src/routes/`, `src/services/`, `src/middleware/`, `src/config/`. JWT auth. Calls ML service for analysis.
- **`ml-service/`** — Python Flask service (port 5000). Summarization (BART), classification, NER (spaCy), embeddings (sentence-transformers/MiniLM-L6), keyword extraction.

**Data stores** (via Docker Compose):
- PostgreSQL 15 with pgvector extension — tab/bookmark storage + 384-dim vector similarity search
- Redis 7 — caching and job queues for background analysis

**Key features**: Automatic AI analysis of every captured URL, duplicate detection (content-level via vector similarity), stale tab detection, semantic search, Puppeteer-based full-page archival (HTML + screenshot + PDF).

<!-- ORGANVM:AUTO:START -->
## System Context (auto-generated — do not edit)

**Organ:** ORGAN-III (Commerce) | **Tier:** standard | **Status:** CANDIDATE
**Org:** `unknown` | **Repo:** `tab-bookmark-manager`

### Edges
- *No inter-repo edges declared in seed.yaml*

### Siblings in Commerce
`classroom-rpg-aetheria`, `gamified-coach-interface`, `trade-perpetual-future`, `fetch-familiar-friends`, `sovereign-ecosystem--real-estate-luxury`, `public-record-data-scrapper`, `search-local--happy-hour`, `multi-camera--livestream--framework`, `universal-mail--automation`, `mirror-mirror`, `the-invisible-ledger`, `enterprise-plugin`, `virgil-training-overlay`, `a-i-chat--exporter`, `.github` ... and 11 more

### Governance
- Strictly unidirectional flow: I→II→III. No dependencies on Theory (I).

*Last synced: 2026-02-24T12:41:28Z*
<!-- ORGANVM:AUTO:END -->

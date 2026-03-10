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

**Organ:** ORGAN-III (Commerce) | **Tier:** standard | **Status:** PUBLIC_PROCESS
**Org:** `organvm-iii-ergon` | **Repo:** `tab-bookmark-manager`

### Edges
- **Produces** → `organvm-vi-koinonia/community-hub`: community_signal
- **Produces** → `organvm-vii-kerygma/social-automation`: distribution_signal

### Siblings in Commerce
`classroom-rpg-aetheria`, `gamified-coach-interface`, `trade-perpetual-future`, `fetch-familiar-friends`, `sovereign-ecosystem--real-estate-luxury`, `public-record-data-scrapper`, `search-local--happy-hour`, `multi-camera--livestream--framework`, `universal-mail--automation`, `mirror-mirror`, `the-invisible-ledger`, `enterprise-plugin`, `virgil-training-overlay`, `a-i-chat--exporter`, `.github` ... and 12 more

### Governance
- Strictly unidirectional flow: I→II→III. No dependencies on Theory (I).

*Last synced: 2026-03-08T20:11:34Z*

## Session Review Protocol

At the end of each session that produces or modifies files:
1. Run `organvm session review --latest` to get a session summary
2. Check for unimplemented plans: `organvm session plans --project .`
3. Export significant sessions: `organvm session export <id> --slug <slug>`
4. Run `organvm prompts distill --dry-run` to detect uncovered operational patterns

Transcripts are on-demand (never committed):
- `organvm session transcript <id>` — conversation summary
- `organvm session transcript <id> --unabridged` — full audit trail
- `organvm session prompts <id>` — human prompts only


## Active Directives

| Scope | Phase | Name | Description |
|-------|-------|------|-------------|
| system | any | prompting-standards | Prompting Standards |
| system | any | research-standards-bibliography | APPENDIX: Research Standards Bibliography |
| system | any | research-standards | METADOC: Architectural Typology & Research Standards |
| system | any | sop-ecosystem | METADOC: SOP Ecosystem — Taxonomy, Inventory & Coverage |
| system | any | autopoietic-systems-diagnostics | SOP: Autopoietic Systems Diagnostics (The Mirror of Eternity) |
| system | any | cicd-resilience-and-recovery | SOP: CI/CD Pipeline Resilience & Recovery |
| system | any | cross-agent-handoff | SOP: Cross-Agent Session Handoff |
| system | any | document-audit-feature-extraction | SOP: Document Audit & Feature Extraction |
| system | any | essay-publishing-and-distribution | SOP: Essay Publishing & Distribution |
| system | any | market-gap-analysis | SOP: Full-Breath Market-Gap Analysis & Defensive Parrying |
| system | any | pitch-deck-rollout | SOP: Pitch Deck Generation & Rollout |
| system | any | promotion-and-state-transitions | SOP: Promotion & State Transitions |
| system | any | repo-onboarding-and-habitat-creation | SOP: Repo Onboarding & Habitat Creation |
| system | any | research-to-implementation-pipeline | SOP: Research-to-Implementation Pipeline (The Gold Path) |
| system | any | security-and-accessibility-audit | SOP: Security & Accessibility Audit |
| system | any | session-self-critique | session-self-critique |
| system | any | source-evaluation-and-bibliography | SOP: Source Evaluation & Annotated Bibliography (The Refinery) |
| system | any | stranger-test-protocol | SOP: Stranger Test Protocol |
| system | any | strategic-foresight-and-futures | SOP: Strategic Foresight & Futures (The Telescope) |
| system | any | typological-hermeneutic-analysis | SOP: Typological & Hermeneutic Analysis (The Archaeology) |
| unknown | any | gpt-to-os | SOP_GPT_TO_OS.md |
| unknown | any | index | SOP_INDEX.md |
| unknown | any | obsidian-sync | SOP_OBSIDIAN_SYNC.md |

Linked skills: evaluation-to-growth


**Prompting (Anthropic)**: context 200K tokens, format: XML tags, thinking: extended thinking (budget_tokens)

<!-- ORGANVM:AUTO:END -->


## ⚡ Conductor OS Integration
This repository is a managed component of the ORGANVM meta-workspace.
- **Orchestration:** Use `conductor patch` for system status and work queue.
- **Lifecycle:** Follow the `FRAME -> SHAPE -> BUILD -> PROVE` workflow.
- **Governance:** Promotions are managed via `conductor wip promote`.
- **Intelligence:** Conductor MCP tools are available for routing and mission synthesis.

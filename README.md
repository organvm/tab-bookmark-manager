[![ORGAN-III: Commerce](https://img.shields.io/badge/ORGAN--III-Commerce-1b5e20?style=flat-square)](https://github.com/a-organvm)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white)](docker-compose.yml)

# Tab & Bookmark Manager

[![CI](https://github.com/a-organvm/tab-bookmark-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/a-organvm/tab-bookmark-manager/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-pending-lightgrey)](https://github.com/a-organvm/tab-bookmark-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/a-organvm/tab-bookmark-manager/blob/main/LICENSE)
[![Organ III](https://img.shields.io/badge/Organ-III%20Commerce-F59E0B)](https://github.com/a-organvm)
[![Status](https://img.shields.io/badge/status-active-brightgreen)](https://github.com/a-organvm/tab-bookmark-manager)
[![TypeScript](https://img.shields.io/badge/lang-TypeScript-informational)](https://github.com/a-organvm/tab-bookmark-manager)


**An intelligent tab and bookmark management system with AI-powered content analysis, semantic search, smart suggestions, and automated archival.**

Tab & Bookmark Manager is a full-stack productivity tool that transforms how users interact with their browser tabs and bookmarks. Rather than treating tabs and bookmarks as flat, unstructured lists, this system applies machine learning to understand the *content* behind each URL: summarizing pages, classifying them into categories, detecting duplicates, identifying stale tabs, and surfacing related content through semantic similarity. The result is a self-organizing knowledge layer on top of everyday browsing behavior.

The system ships as three coordinated services — a Chrome/Edge browser extension for capture, a Node.js REST API for orchestration and persistence, and a Python Flask ML service for natural language processing — backed by PostgreSQL with pgvector for vector similarity search, Redis for caching and job queues, and Puppeteer for full-page archival. Everything runs containerized via Docker Compose for reproducible local development and production deployment.

This repository belongs to **ORGAN-III (Commerce)** in the [organvm](https://github.com/a-organvm) ecosystem, which houses SaaS products, B2B/B2C tools, and developer utilities that generate practical value.

---

## Table of Contents

- [What It Is](#what-it-is)
- [Who Pays](#who-pays)
- [Why This Exists](#why-this-exists)
- [Technical Architecture](#technical-architecture)
- [Install](#install)
- [Browser Extension](#browser-extension)
- [Usage](#usage)
- [Pricing and Monetization](#pricing-and-monetization)
- [Core Features](#core-features)
- [API Reference](#api-reference)
- [ML Service](#ml-service)
- [Configuration](#configuration)
- [Testing](#testing)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Cross-Organ Context](#cross-organ-context)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Author](#author)

---

## What It Is

Tab & Bookmark Manager addresses a universal problem: browser tab overload and bookmark rot. Most users accumulate dozens of open tabs and hundreds of unsorted bookmarks with no way to search by meaning, detect redundancies, or automatically archive content before it disappears. Existing browser bookmark managers are purely mechanical — they store URLs and titles, nothing more.

This system goes further by treating every captured URL as a *document* that can be analyzed, classified, embedded into a vector space, and cross-referenced against everything else in the user's collection.

In practical terms, it is:

- **A browser extension** for Chrome and Edge that captures tabs, bookmarks, and page text.
- **A personal knowledge index** that stores tabs/bookmarks with metadata and, for Pro-enriched items, summaries, categories, keywords, entities, and embeddings.
- **A cleanup assistant** that identifies duplicate content, stale tabs, and related resources.
- **A local archive tool** that can preserve page HTML, screenshots, and PDFs before links rot.

The core value proposition is threefold:

1. **Automatic intelligence.** Pro accounts get background ML enrichment for captured tabs and bookmarks: summaries, one of ten content categories, extracted entities and keywords, and 384-dimensional embeddings for similarity search. The user does nothing; the system does the thinking.

2. **Proactive suggestions.** The Pro suggestion engine scans the collection for duplicates (content-level, not just URL-level), identifies tabs that have gone stale (open but unvisited for configurable periods), and surfaces related content the user may have forgotten about. Each suggestion carries a confidence score and supports an accept/reject workflow.

3. **Permanent archival.** Web pages are ephemeral — links rot, content changes, sites go offline. The archive system uses Puppeteer to capture full HTML content, screenshots (PNG), and PDF renderings of any page, preserving a permanent local copy independent of the live web.

### Who It Is For

- **Knowledge workers** who maintain large research collections across dozens of tabs and bookmark folders.
- **Developers** who accumulate documentation, Stack Overflow answers, and GitHub repos faster than they can organize them.
- **Students and researchers** who need to build topical collections and discover connections between saved resources.
- **Anyone** who has ever lost a critical bookmark or forgotten what was in an open tab from three days ago.

---

## Who Pays

The free product is meant for evaluation and light personal use. The paid buyer is someone whose saved web content has become valuable enough that search, cleanup, and cross-device continuity are worth paying for.

Likely Pro users include:

- **Developers and technical operators** who keep reference material, GitHub issues, API docs, and troubleshooting tabs open across machines.
- **Researchers, students, and analysts** who build large topic collections and need semantic retrieval instead of folder maintenance.
- **Founders, creators, and consultants** who use the browser as a working memory for clients, products, writing, sourcing, or market research.
- **Power users with multiple devices** who need unlimited bookmarks, sync, and ML-assisted organization.

Team billing, shared workspaces, and admin controls are not part of the current tier model. The implemented monetization path is individual Free-to-Pro conversion.

---

## Why This Exists

The browser is the most-used application on most computers, yet its built-in organizational tools have barely evolved in twenty years. Bookmark folders are hierarchical (forcing single-category classification), search is keyword-only (missing semantic relationships), and there is no concept of "this tab is stale" or "these three bookmarks are about the same topic." Tab & Bookmark Manager fills that gap by layering AI-powered content understanding on top of the browser's native primitives.

This project also serves as a technical demonstration of how to integrate a browser extension frontend, a Node.js orchestration backend, and a Python ML microservice into a cohesive product with real-time background processing, vector search, and scheduled automation — patterns that apply broadly to any content-intelligence application.

---

## Technical Architecture

The system follows a microservices architecture with four main components communicating over HTTP and backed by shared data stores.

```
┌──────────────────────────┐
│    Browser Extension     │
│    (Chrome/Edge MV3)     │
│    Capture + UI          │
└────────────┬─────────────┘
             │ HTTP/REST
             ▼
┌──────────────────────────┐         ┌──────────────────────────┐
│    Backend API           │◄────────┤    ML Service            │
│    Node.js / Express     │  HTTP   │    Python / Flask        │
│                          │         │                          │
│  - Auth (JWT)            │         │  - Summarization (BART)  │
│  - CRUD (tabs/bookmarks) │         │  - Classification        │
│  - Search (text+vector)  │         │  - NER (spaCy)           │
│  - Suggestions           │         │  - Embeddings (MiniLM)   │
│  - Archive orchestration │         │  - Keyword extraction    │
│  - Automation scheduler  │         └──────────────────────────┘
└─────┬──────┬──────┬──────┘
      │      │      │
      ▼      ▼      ▼
┌─────────┐ ┌─────┐ ┌───────────┐
│PostgreSQL│ │Redis│ │ Puppeteer │
│(pgvector)│ │     │ │ (archive) │
│          │ │Cache│ │ HTML/PNG/ │
│ Tabs     │ │Queue│ │ PDF       │
│ Bookmarks│ │Bull │ └───────────┘
│ Archives │ └─────┘
│ Vectors  │
└──────────┘
```

### Component Responsibilities

**Browser Extension (Manifest V3).** Runs as a Chrome/Edge extension using the Manifest V3 service worker model. Captures tab events (creation, update, close) and bookmark events automatically. Provides a popup UI with search, suggestion display, and usage statistics. Content scripts extract page text for eligible analysis workflows.

**Backend API (Node.js/Express).** The central orchestration layer. Receives data from the extension, persists it in PostgreSQL, dispatches analysis jobs to the ML service via Redis-backed Bull queues, manages the suggestion lifecycle, and coordinates archival via Puppeteer. Exposes a full REST API with Swagger/OpenAPI documentation. Implements JWT authentication, rate limiting (100 requests per 15 minutes), Helmet security headers, CORS, Joi input validation, and Winston structured logging.

**ML Service (Python/Flask).** A dedicated NLP microservice that runs five analysis pipelines: text summarization using Facebook's BART-large-CNN model, content classification across ten categories (Technology, News, Education, Entertainment, Business, Social, Shopping, Health, Science, Other), named entity recognition using spaCy's en_core_web_sm model, 384-dimensional semantic embeddings using Sentence Transformers' all-MiniLM-L6-v2 model, and keyword extraction using TF-IDF via scikit-learn. Each pipeline is available as an individual endpoint or through a single comprehensive analysis endpoint.

**Data Stores.** PostgreSQL 15 with the pgvector extension stores tab and bookmark metadata alongside vector embeddings when ML enrichment is enabled, enabling efficient cosine-similarity queries for semantic search and duplicate detection. Redis 7 serves as both a cache layer and the backing store for Bull job queues that handle content analysis, archival, and suggestion generation asynchronously.

### Data Flow Patterns

**Capture flow:** Browser event triggers extension listener, which POSTs tab/bookmark data to the Backend API. The API persists the record in PostgreSQL. For users with the Pro ML entitlement, content is queued for analysis; a queue worker sends page text to the ML Service, receives analysis results (summary, category, entities, keywords, embedding), and updates the database record with enriched metadata and the vector embedding.

**Search flow:** User enters a query in the extension popup. Text search runs against stored metadata for all authenticated users. Pro semantic search sends the query text to the ML Service to generate an embedding vector, then performs a pgvector cosine-similarity search against stored embeddings. Results are ranked by similarity score and returned to the extension for display.

**Suggestion flow:** For Pro workflows, a node-cron scheduled job runs every 6 hours, triggering the suggestion service. The service queries PostgreSQL for potential duplicates (high cosine similarity between different records), stale tabs (open but unaccessed beyond a threshold), and related content clusters. Generated suggestions are stored with confidence scores and presented to the user for accept/reject decisions.

**Archive flow:** User triggers archival for a specific tab or bookmark (or the automation engine triggers it for old tabs weekly). The Backend API launches Puppeteer in a headless browser, navigates to the URL, and captures three artifacts: full HTML content, a PNG screenshot, and a PDF rendering. These files are stored on the local filesystem, and the archive metadata is persisted in PostgreSQL.

---

## Install

### Prerequisites

- **Docker and Docker Compose** (recommended for quick start)
- **Node.js 18+** (for local backend development)
- **Python 3.10+** (for local ML service development)
- **Chrome or Edge** (for the browser extension)

### Docker Quick Start (Recommended)

The fastest way to get all services running.

```bash
# Clone the repository
git clone https://github.com/a-organvm/tab-bookmark-manager.git
cd tab-bookmark-manager

# Optional: create local environment files from the checked-in examples
cp .env.example .env
cp backend/.env.example backend/.env
cp ml-service/.env.example ml-service/.env

# Run the setup script (starts all containers)
./scripts/setup.sh
```

This starts all four services:

| Service    | URL                    | Purpose              |
|------------|------------------------|----------------------|
| Backend API | http://localhost:3000  | REST API + Swagger   |
| ML Service  | http://localhost:5000  | NLP analysis         |
| PostgreSQL  | localhost:5432         | Database             |
| Redis       | localhost:6379         | Cache + job queue    |

The ML service will download pretrained models on first startup (BART-large-CNN, all-MiniLM-L6-v2, spaCy en_core_web_sm). This may take several minutes depending on your connection.

### Local Development Setup

For active development, run services individually.

```bash
# Run the development setup script
./scripts/dev-setup.sh

# Start PostgreSQL and Redis via Docker
docker compose up -d postgres redis

# Start the backend (in one terminal)
cd backend
npm install
npm run dev          # Runs on http://localhost:3000

# Start the ML service (in another terminal)
cd ml-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
python src/app.py    # Runs on http://localhost:5000
```

### Database Initialization

After first launch, run the migration script to set up the PostgreSQL schema and pgvector extension:

```bash
./scripts/migrate-db.sh
```

### Verify Services

Check that all services are healthy:

```bash
# Backend health
curl http://localhost:3000/health

# ML service health
curl http://localhost:5000/health
```

Expected response:

```json
{
  "status": "ok",
  "services": {
    "api": "healthy",
    "mlService": "healthy"
  }
}
```

---

## Browser Extension

The browser extension is a Manifest V3 Chrome/Edge extension that serves as the primary user interface. Load it after the backend is running so the popup and background service worker can reach `http://localhost:3000`.

### Installation

1. Open Chrome or Edge and navigate to `chrome://extensions/` (or `edge://extensions/`).
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the `extension/` directory from this repository.

### Capabilities

- **Automatic tab capture.** Every new tab and tab update is automatically sent to the backend for storage and analysis. No manual action required.
- **Bookmark synchronization.** Bookmark creation events are intercepted and forwarded to the backend, keeping the system in sync with the browser's native bookmark bar.
- **Content extraction.** A content script runs on every page at document idle, extracting page text for capture and Pro NLP analysis.
- **Popup interface.** Click the extension icon to sign in, view plan usage, run text search, access Pro semantic search and suggestions, see collection statistics, trigger Pro sync operations, and open the Pro checkout flow.
- **Permissions.** The extension requires `tabs`, `bookmarks`, `storage`, `activeTab`, and `scripting` permissions. Host permissions cover `localhost:3000` for API communication and `<all_urls>` for content extraction.

---

## Usage

### First Run

1. Start the backend, ML service, PostgreSQL, and Redis with `./scripts/setup.sh` or the local development commands above.
2. Run `./scripts/migrate-db.sh` once to create the database schema and enable pgvector-backed storage.
3. Load the browser extension from the `extension/` directory.
4. Open the extension popup, register an account, and sign in.
5. Browse normally. The extension sends tab and bookmark events to the backend, and the backend stores each item under the signed-in user.

### Daily Workflow

- **Capture the current tab:** Use the popup action to save the active tab immediately.
- **Search saved items:** Free users can use text search across captured tab and bookmark metadata. Pro users can also run semantic search against ML embeddings.
- **Review suggestions:** Pro users can fetch AI-generated duplicate, stale-tab, and related-content suggestions from the popup.
- **Sync in bulk:** Pro users can bulk-sync all open tabs or all browser bookmarks from the popup.
- **Track usage:** The popup shows the current plan, bookmark usage, device usage, and upgrade state returned by `/api/billing/plan`.
- **Archive pages:** Use the archive API to preserve page HTML, screenshot, and PDF artifacts for a tab or bookmark.

### API Usage

The browser extension is the main product interface, but the REST API is useful for testing, integrations, and self-hosted automation.

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","email":"demo@example.com","password":"securePass123"}'

# Login and copy the returned token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"securePass123"}'

# Check plan, limits, and usage
curl http://localhost:3000/api/billing/plan \
  -H "Authorization: Bearer <token>" \
  -H "X-Device-Id: local-device"

# Run text search
curl "http://localhost:3000/api/search/text?query=postgres" \
  -H "Authorization: Bearer <token>" \
  -H "X-Device-Id: local-device"
```

Interactive Swagger/OpenAPI documentation is available at `http://localhost:3000/api-docs`.

---

## Pricing and Monetization

Tab & Bookmark Manager uses a freemium SaaS model implemented in `backend/src/config/plans.js`, `backend/src/services/entitlementService.js`, and `backend/src/middleware/entitlementMiddleware.js`.

| Tier | Price | Limits | Included |
|------|-------|--------|----------|
| Free | $0/mo | 1 device, `FREE_BOOKMARK_LIMIT` bookmarks (default 100) | Basic tab/bookmark capture, account auth, stored metadata, text search |
| Pro | $4.99/mo | Unlimited devices and bookmarks | Everything in Free plus bulk tab/bookmark sync, semantic search, similar-item search, AI suggestions, and background ML enrichment |

### What Converts a User to Pro

Free users hit an upgrade path when they need one of the paid capabilities:

- **More than one device.** The extension stores a per-install device ID and sends it as `X-Device-Id`; Free accounts are limited by `FREE_DEVICE_LIMIT` (default 1).
- **More bookmarks.** Free bookmark saves are capped by `FREE_BOOKMARK_LIMIT` (default 100).
- **AI and semantic workflows.** Semantic search, similar-item search, AI suggestions, and ML enrichment require the Pro `ml` entitlement.
- **Bulk sync.** Bulk tab and bookmark sync require the Pro `sync` entitlement.

When a Free user crosses a gate, the API returns HTTP 402 with `error: "upgrade_required"`, usage data, limits, and Pro upgrade metadata. The extension displays the upgrade state and opens checkout through `POST /api/billing/checkout`.

### Billing Providers

Checkout is provider-agnostic. Configure one hosted checkout URL:

```bash
PRO_CHECKOUT_PROVIDER=stripe
PRO_CHECKOUT_URL=https://your-provider-checkout-link.example
# Or use one provider-specific URL instead:
LEMON_SQUEEZY_CHECKOUT_URL=
STRIPE_CHECKOUT_URL=
```

Stripe checkout links receive `client_reference_id` and `prefilled_email` query parameters. Lemon Squeezy links receive `checkout[custom][user_id]` and `checkout[email]`. Webhooks update `plan_tier`, `subscription_status`, provider IDs, and renewal period metadata via `POST /api/billing/webhook`.

---

## Core Features

### AI-Powered Content Analysis

For Pro users, captured page content can be analyzed by the ML service pipeline:

- **Summarization:** BART-large-CNN generates a concise 50-150 word summary of the page content, giving users a quick preview without opening the tab.
- **Classification:** Content is categorized into one of ten categories (Technology, News, Education, Entertainment, Business, Social, Shopping, Health, Science, Other) using keyword-based heuristics.
- **Entity extraction:** spaCy's NER model identifies people, organizations, locations, dates, and other named entities, making bookmarks searchable by the entities they mention.
- **Keyword extraction:** TF-IDF analysis surfaces the top keywords from each page, providing tag-like metadata without manual tagging.
- **Embedding generation:** Sentence Transformers' all-MiniLM-L6-v2 produces a 384-dimensional vector embedding that captures the semantic meaning of the content, enabling similarity-based search and duplicate detection.

### Semantic Search

Go beyond keyword matching. The Pro semantic search endpoint embeds your query into the same vector space as your stored content, then uses pgvector's cosine-similarity operator to find the most semantically relevant results. Searching for "machine learning tutorials" will surface bookmarks about "deep learning courses" and "neural network guides" even if those exact words never appear in the query.

### Smart Suggestions

The Pro suggestion engine runs on a configurable schedule (default: every 6 hours) and generates three types of actionable suggestions:

- **Duplicate detection.** Identifies bookmarks and tabs with high semantic similarity that likely point to the same or overlapping content. Each duplicate pair includes a confidence score.
- **Stale tab identification.** Flags tabs that have been open but unvisited for a configurable period, helping users close or archive forgotten tabs.
- **Related content discovery.** Surfaces connections between saved items that the user may not have noticed — for instance, two bookmarks saved weeks apart that discuss the same topic from different angles.

Each suggestion supports an accept/reject workflow. Accepted suggestions can trigger automated actions (merge duplicates, close stale tabs, create bookmark groups). Rejected suggestions train the system to avoid similar false positives.

### Automated Archival

Web content is ephemeral. The archive system preserves pages permanently using Puppeteer headless browser rendering:

- **HTML capture.** Full DOM content saved to disk.
- **Screenshot capture.** PNG rendering of the page as it appeared at archive time.
- **PDF generation.** Print-quality PDF for offline reading and reference.
- **Scheduled archival.** The automation engine archives old tabs weekly, ensuring long-lived tabs are preserved before they go stale.

### Background Job Processing

All heavy operations run asynchronously through Redis-backed Bull queues:

- **content-analysis queue.** Dispatches Pro-entitled page content to the ML service for NLP processing.
- **archival queue.** Manages Puppeteer page captures without blocking the API.
- **suggestion queue.** Generates batch suggestions for Pro suggestion workflows.

Jobs include automatic retry logic, error handling, and dead-letter queuing for failed operations.

### Automation Engine

The node-cron-powered automation engine runs five scheduled tasks:

| Task                    | Schedule       | Description                              |
|-------------------------|----------------|------------------------------------------|
| Suggestion generation   | Every 6 hours  | Generate Pro AI suggestions              |
| Suggestion cleanup      | Daily          | Remove expired or stale suggestions      |
| Old tab archival        | Weekly         | Archive tabs open longer than threshold  |
| Statistics update       | Hourly         | Refresh collection analytics             |
| Duplicate check         | Every 12 hours | Scan for new content-level duplicates    |

---

## API Reference

Interactive Swagger/OpenAPI documentation is available at `http://localhost:3000/api-docs` when the backend is running.

### Authentication

The API uses JWT-based authentication. Register a user, login to receive a token, and include it in subsequent requests:

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","email":"demo@example.com","password":"securePass123"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"securePass123"}'
# Returns: {"token": "eyJhbG..."}

# Use token in subsequent requests
curl http://localhost:3000/api/tabs \
  -H "Authorization: Bearer eyJhbG..."
```

### Endpoint Summary

| Group        | Method | Endpoint                        | Description                      |
|--------------|--------|---------------------------------|----------------------------------|
| Auth         | POST   | `/api/auth/register`            | Register new user                |
| Auth         | POST   | `/api/auth/login`               | Login, receive JWT               |
| Auth         | POST   | `/api/auth/logout`              | Logout, revoke token             |
| Billing      | GET    | `/api/billing/plan`             | Current tier, limits, usage      |
| Billing      | POST   | `/api/billing/checkout`         | Create/open Pro checkout URL     |
| Billing      | POST   | `/api/billing/webhook`          | Apply provider subscription event |
| User         | GET    | `/api/user/profile`             | Get profile                      |
| User         | PUT    | `/api/user/profile`             | Update username                  |
| User         | PUT    | `/api/user/email`               | Update email                     |
| User         | PUT    | `/api/user/password`            | Change password                  |
| User         | DELETE | `/api/user/account`             | Delete account                   |
| Tabs         | POST   | `/api/tabs`                     | Create tab                       |
| Tabs         | POST   | `/api/tabs/bulk`                | Bulk create tabs                 |
| Tabs         | GET    | `/api/tabs`                     | List all tabs                    |
| Tabs         | GET    | `/api/tabs/:id`                 | Get specific tab                 |
| Tabs         | PUT    | `/api/tabs/:id`                 | Update tab                       |
| Tabs         | DELETE | `/api/tabs/:id`                 | Delete tab                       |
| Tabs         | POST   | `/api/tabs/:id/archive`         | Archive tab                      |
| Tabs         | GET    | `/api/tabs/stale/detect`        | Detect stale tabs                |
| Bookmarks    | POST   | `/api/bookmarks`                | Create bookmark                  |
| Bookmarks    | POST   | `/api/bookmarks/bulk`           | Bulk create bookmarks            |
| Bookmarks    | GET    | `/api/bookmarks`                | List all bookmarks               |
| Bookmarks    | GET    | `/api/bookmarks/:id`            | Get specific bookmark            |
| Bookmarks    | PUT    | `/api/bookmarks/:id`            | Update bookmark                  |
| Bookmarks    | DELETE | `/api/bookmarks/:id`            | Delete bookmark                  |
| Bookmarks    | POST   | `/api/bookmarks/:id/archive`    | Archive bookmark                 |
| Search       | POST   | `/api/search/semantic`          | Semantic vector search           |
| Search       | GET    | `/api/search/text`              | Text-based search                |
| Search       | GET    | `/api/search/similar/:id`       | Find similar items               |
| Suggestions  | GET    | `/api/suggestions`              | List all suggestions             |
| Suggestions  | GET    | `/api/suggestions/duplicates`   | Duplicate suggestions            |
| Suggestions  | GET    | `/api/suggestions/stale`        | Stale tab suggestions            |
| Suggestions  | GET    | `/api/suggestions/related/:id`  | Related content                  |
| Suggestions  | POST   | `/api/suggestions/generate`     | Trigger suggestion generation    |
| Suggestions  | PUT    | `/api/suggestions/:id/accept`   | Accept suggestion                |
| Suggestions  | PUT    | `/api/suggestions/:id/reject`   | Reject suggestion                |
| Archive      | POST   | `/api/archive`                  | Archive a page                   |
| Archive      | GET    | `/api/archive/:id`              | Retrieve archived page           |
| Archive      | GET    | `/api/archive`                  | List all archives                |
| Health       | GET    | `/health`                       | Service health check             |

### Rate Limiting

The API enforces a rate limit of **100 requests per 15-minute window** per IP address. Exceeding this limit returns HTTP 429 (Too Many Requests).

---

## ML Service

The ML service is a standalone Python/Flask microservice responsible for all natural language processing. It loads models once at startup and serves inference requests over HTTP.

### Models

| Capability         | Model                          | Output                    |
|--------------------|--------------------------------|---------------------------|
| Summarization      | facebook/bart-large-cnn        | 50-150 word summary       |
| Embeddings         | all-MiniLM-L6-v2               | 384-dim float vector      |
| Named entities     | spaCy en_core_web_sm           | Entity type/value pairs   |
| Classification     | Keyword-based heuristics       | One of 10 categories      |
| Keywords           | TF-IDF (scikit-learn)          | Top N keywords            |

### ML Endpoints

```bash
# Comprehensive analysis (runs all pipelines)
curl -X POST http://localhost:5000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text":"Your page content here","url":"https://example.com"}'

# Individual endpoints
POST /api/summarize    # Text summarization
POST /api/classify     # Content classification
POST /api/entities     # Named entity extraction
POST /api/embed        # Embedding generation
POST /api/keywords     # Keyword extraction
```

### Performance Notes

- Models are loaded into memory once at startup. First request latency is minimal after initialization.
- BART-large-CNN is the heaviest model (~1.6 GB). Ensure the host has sufficient RAM.
- GPU support is optional. Models default to CPU inference but can be configured for CUDA-enabled GPUs for faster throughput.
- Input text is automatically truncated to model-specific limits (1024 tokens for BART, 512 characters for embeddings).

---

## Configuration

### Backend Environment Variables

Create `backend/.env` from the provided example:

```bash
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=1h
API_KEY_PREFIX=tbm_

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tab_bookmark_manager
DB_USER=postgres
DB_PASSWORD=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379

# Services
ML_SERVICE_URL=http://localhost:5000
ARCHIVE_DIR=./archives
LOG_LEVEL=info

# Freemium and billing
FREE_BOOKMARK_LIMIT=100
FREE_DEVICE_LIMIT=1
PRO_CHECKOUT_PROVIDER=stripe
PRO_CHECKOUT_URL=https://your-provider-checkout-link.example
# Or set one of these instead of PRO_CHECKOUT_URL:
LEMON_SQUEEZY_CHECKOUT_URL=
STRIPE_CHECKOUT_URL=

# Optional webhook verification
LEMON_SQUEEZY_WEBHOOK_SECRET=
STRIPE_WEBHOOK_SECRET=
BILLING_WEBHOOK_SECRET=
```

Authentication configuration lives in `backend/.env`. `JWT_SECRET` must be a strong, private value in production, `JWT_EXPIRES_IN` controls login token lifetime, and `API_KEY_PREFIX` optionally changes the prefix used for generated API keys. Issued API keys are shown once, stored only as SHA-256 hashes, and can be sent to protected endpoints with `X-API-Key: <key>` or `Authorization: Bearer <key>`. API key management endpoints require a JWT session.

### ML Service Environment Variables

Create `ml-service/.env` from the provided example:

```bash
PORT=5000
DEBUG=False
LOG_LEVEL=INFO
```

---

## Testing

### Backend Tests

The backend includes Jest test suites covering authentication, bulk operations, and core API functionality.

```bash
cd backend

# Run all tests with coverage
npm test

# Run specific test suites
npm run test:auth    # Authentication tests
npm run test:bulk    # Bulk operation tests

# Lint
npm run lint
```

Tests use SQLite as an in-memory database substitute and ioredis-mock for Redis, ensuring fast execution without external service dependencies.

### ML Service Tests

```bash
cd ml-service
source venv/bin/activate
pytest
```

---

## Deployment

### Docker Compose (Production)

```bash
# Update environment variables for production
# backend/.env: NODE_ENV=production, strong passwords, real JWT secret
# ml-service/.env: DEBUG=False

# Start all services
docker compose up -d

# Verify
docker compose ps
docker compose logs -f
```

### Cloud Deployment Options

The containerized architecture supports deployment to any Docker-compatible platform:

- **AWS:** ECS/Fargate for containers, RDS for PostgreSQL, ElastiCache for Redis, S3 for archive storage.
- **GCP:** Cloud Run for containers, Cloud SQL for PostgreSQL, Memorystore for Redis, Cloud Storage for archives.
- **VPS:** Any Linux server with Docker Compose. Add nginx for SSL termination with Let's Encrypt.

### Scaling

- **Backend API:** Stateless; scale horizontally with multiple container replicas behind a load balancer.
- **ML Service:** CPU-bound; scale with additional replicas or add GPU instances for throughput.
- **PostgreSQL:** Add read replicas for heavy read loads. pgvector indexes accelerate similarity queries.
- **Redis:** Use Redis cluster mode for distributed queue processing.

---

## Project Structure

```
tab-bookmark-manager/
├── backend/                    # Node.js/Express REST API
│   ├── src/
│   │   ├── config/             # Database, Redis, queue, Swagger config
│   │   ├── controllers/        # Route handlers (auth, tabs, bookmarks, search, etc.)
│   │   ├── middleware/         # Auth middleware, error handler
│   │   ├── routes/             # Express route definitions
│   │   ├── services/           # Business logic (archive, automation, suggestions)
│   │   ├── utils/              # Logger, error classes, ML client
│   │   ├── __tests__/          # Jest test suites
│   │   └── index.js            # Application entry point
│   ├── Dockerfile
│   └── package.json
├── ml-service/                 # Python/Flask NLP microservice
│   ├── src/
│   │   ├── services/           # Classification, embeddings, NLP pipelines
│   │   └── app.py              # Flask application entry point
│   ├── Dockerfile
│   └── requirements.txt
├── extension/                  # Chrome/Edge browser extension (MV3)
│   ├── background/             # Service worker for event capture
│   ├── content/                # Content script for page extraction
│   ├── popup/                  # Extension popup UI (HTML/CSS/JS)
│   ├── icons/                  # Extension icons
│   └── manifest.json
├── infrastructure/
│   └── docker/                 # Production Docker Compose
├── scripts/                    # Setup, migration, and dev scripts
├── docs/                       # Architecture, API, ML, deployment docs
├── docker-compose.yml          # Development Docker Compose
├── CONTRIBUTING.md
├── LICENSE                     # MIT
└── README.md
```

---

## Cross-Organ Context

This repository is part of [ORGAN-III (Commerce)](https://github.com/a-organvm), which houses the commerce and product layer of the organvm ecosystem. Tab & Bookmark Manager sits at the intersection of developer productivity tooling and applied machine learning.

### Connections Within the Organ System

- **ORGAN-I (Theoria)** provides the epistemological and recursive-systems thinking that informs how knowledge is modeled and cross-referenced in this tool. The semantic embedding approach — treating every piece of saved content as a point in a high-dimensional meaning space — reflects ORGAN-I's interest in latent structure and recursive knowledge systems.
- **ORGAN-II (Poiesis)** explores generative and experiential art. The content classification and entity extraction pipelines could be extended to analyze creative works, connecting art practice to the same semantic infrastructure.
- **ORGAN-IV (Taxis)** handles orchestration and governance. The microservices architecture, job queue patterns, and scheduled automation in this repo share architectural DNA with ORGAN-IV's agentic orchestration tools.
- **ORGAN-V (Logos)** documents the public process of building these systems. The design decisions behind this project — why vector search over keyword search, why separate ML service over embedded inference — are candidates for ORGAN-V essays.

### Related ORGAN-III Repositories

- [`public-record-data-scrapper`](https://github.com/a-organvm/public-record-data-scrapper) — Data collection and scraping infrastructure that shares patterns with this project's content extraction pipeline.
- [`a-i-chat--exporter`](https://github.com/a-organvm/a-i-chat--exporter) — AI conversation export tooling, another knowledge-management utility in the Commerce portfolio.

---

## Roadmap

The following enhancements are planned for future development:

- **Chrome Web Store publication.** Package and publish the extension for public distribution.
- **Multi-user support.** Full JWT authentication with user isolation and shared collections.
- **GPU-accelerated inference.** CUDA support for the ML service to reduce analysis latency on large collections.
- **Mobile companion app.** Read-only access to bookmarks, search, and archived content from iOS/Android.
- **Real-time cross-device sync.** WebSocket-based synchronization across multiple browser instances.
- **Custom model fine-tuning.** Train classification models on the user's own bookmark categories for higher accuracy.
- **Advanced analytics dashboard.** Browsing pattern visualization, topic trend analysis, and collection health metrics.
- **Browser history integration.** Extend capture beyond tabs and bookmarks to include full browsing history analysis.

---

## Contributing

Contributions are welcome. Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:

- Setting up the development environment
- Code style and linting rules
- Pull request process
- Issue reporting

For substantial changes, open an issue first to discuss the approach.

---

## License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for the full text.

---

## Author

**[@4444j99](https://github.com/4444j99)**

Built as part of the [organvm](https://github.com/a-organvm) ecosystem — an eight-organ creative-institutional system spanning theory, art, commerce, orchestration, public process, community, and distribution.

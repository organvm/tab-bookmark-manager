# Tab & Bookmark Manager API Guide

This guide documents the customer-facing REST API for Tab & Bookmark Manager. It covers authentication, plan entitlements, request and response formats, endpoint behavior, and copy-paste examples for common integration flows.

Interactive Swagger UI is available when the backend is running:

```text
http://localhost:3000/api-docs
```

## Quick Start

The local API base URL is:

```text
http://localhost:3000
```

All request and response bodies are JSON unless noted otherwise.

```bash
# 1. Register a user.
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "acme_admin",
    "email": "admin@example.com",
    "password": "securePass123"
  }'

# 2. Login and store the JWT.
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "securePass123"
  }' | jq -r .token)

# 3. Check plan, limits, feature flags, and usage.
curl http://localhost:3000/api/billing/plan \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Device-Id: acme-laptop-001" \
  -H "X-Device-Label: ACME laptop"

# 4. Save a tab.
curl -X POST http://localhost:3000/api/tabs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: acme-laptop-001" \
  -d '{
    "url": "https://docs.example.com/api",
    "title": "Example API docs",
    "favicon": "https://docs.example.com/favicon.ico",
    "content": "Full page text extracted by the browser extension."
  }'

# 5. Search saved tabs and bookmarks.
curl "http://localhost:3000/api/search/text?query=api&type=both&limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Device-Id: acme-laptop-001"
```

## Authentication

The API uses JWT bearer authentication.

1. Create an account with `POST /api/auth/register`.
2. Exchange email and password for a JWT with `POST /api/auth/login`.
3. Send the token on protected requests:

```http
Authorization: Bearer <jwt>
```

The token expiration is controlled by the backend `JWT_EXPIRES_IN` environment variable and defaults to `1h`. There is no refresh-token endpoint in the current API; clients should send the user through login again after token expiration.

Logout revokes the current token:

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

### Device Headers

Device headers are optional for raw API calls but recommended for browser extension installs and customer integrations that represent a persistent device.

| Header | Required | Description |
|--------|----------|-------------|
| `X-Device-Id` | No | Stable opaque device identifier. Free accounts are limited to one registered device. |
| `X-Device-Label` | No | Human-readable device name stored with the device record. |

When a second device is registered on a Free account, eligible endpoints return `402 upgrade_required`.

## Plans and Entitlements

Plan limits are returned by `GET /api/billing/plan`.

| Tier | Price | Limits | Features |
|------|-------|--------|----------|
| Free | `$0/mo` | 1 device and `FREE_BOOKMARK_LIMIT` bookmarks, default 100 | Tab capture, bookmark capture, metadata storage, text search, archive requests |
| Pro | `$4.99/mo` | Unlimited devices and bookmarks | Everything in Free plus bulk sync, ML enrichment, semantic search, similar-item search, stale-tab detection, and AI suggestions |

Feature gates use HTTP `402 Payment Required` and this response shape:

```json
{
  "error": "upgrade_required",
  "message": "AI suggestions, semantic search, and similarity features require Pro.",
  "feature": "ml",
  "upgrade": {
    "tier": "pro",
    "priceDisplay": "$4.99/mo"
  },
  "limits": {
    "bookmarks": 100,
    "devices": 1
  },
  "usage": {
    "bookmarks": 42,
    "tabs": 18,
    "devices": 1
  }
}
```

Pro-only features:

| Feature | Endpoints |
|---------|-----------|
| `sync` | `POST /api/tabs/bulk`, `POST /api/bookmarks/bulk` |
| `ml` | `POST /api/search/semantic`, `GET /api/search/similar/:id`, `GET /api/tabs/stale/detect`, all `/api/suggestions/*` endpoints |

## Common Conventions

### Pagination

Tabs, bookmarks, and archives use offset pagination. Suggestions use status filtering with a limit.

| Query parameter | Default | Applies to |
|-----------------|---------|------------|
| `limit` | `100` for tabs/bookmarks, `50` for archives and suggestions | List endpoints that support limits |
| `offset` | `0` | Tabs, bookmarks, archives |

### Archived Items

Tabs and bookmarks archived through `/api/tabs/:id/archive` or `/api/bookmarks/:id/archive` are marked with `is_archived = true`. Default list calls only return non-archived records.

```bash
curl "http://localhost:3000/api/tabs?archived=true" \
  -H "Authorization: Bearer $TOKEN"
```

### Background Jobs

Several operations enqueue work and return before the work is complete:

| Operation | Response |
|-----------|----------|
| Bulk tab/bookmark import | `202` with an import-started message |
| Standalone page archive | `200` with `jobId` |
| Tab/bookmark archive | `200` with queued message |
| Suggestion generation | `200` with `jobId` |
| Pro ML enrichment on create | Record is returned immediately; enrichment is applied asynchronously when content is supplied |

### Error Shapes

Most errors return either a `message` or `error` field:

```json
{ "message": "Authorization token is required" }
```

```json
{ "error": "Failed to fetch bookmarks" }
```

Unexpected errors handled by the global error handler use this shape:

```json
{
  "status": "error",
  "message": "Internal server error",
  "timestamp": "2026-06-20T12:00:00.000Z"
}
```

In development, stack traces may also be included.

### Rate Limiting

The API allows 100 requests per 15-minute window per IP address. Exceeding the limit returns HTTP `429 Too Many Requests`.

## Resource Schemas

### Tab

```json
{
  "id": 123,
  "url": "https://example.com/article",
  "title": "Example article",
  "favicon": "https://example.com/favicon.ico",
  "content": "Extracted page text",
  "summary": "AI-generated summary for Pro-enriched content",
  "category": "Technology",
  "tags": ["api", "docs"],
  "entities": { "ORG": ["Example"] },
  "created_at": "2026-06-20T12:00:00.000Z",
  "updated_at": "2026-06-20T12:00:00.000Z",
  "last_accessed": null,
  "access_count": 0,
  "is_archived": false,
  "user_id": 1
}
```

### Bookmark

```json
{
  "id": 456,
  "url": "https://example.com/reference",
  "title": "Reference",
  "favicon": "https://example.com/favicon.ico",
  "folder": "Research",
  "content": "Extracted page text",
  "summary": "AI-generated summary for Pro-enriched content",
  "category": "Education",
  "tags": ["research"],
  "entities": {},
  "created_at": "2026-06-20T12:00:00.000Z",
  "updated_at": "2026-06-20T12:00:00.000Z",
  "is_archived": false,
  "user_id": 1
}
```

### Suggestion

```json
{
  "id": 789,
  "type": "duplicate",
  "item_ids": [123, 456],
  "reason": "These saved items appear to describe the same content.",
  "confidence": 0.94,
  "status": "pending",
  "created_at": "2026-06-20T12:00:00.000Z",
  "user_id": 1
}
```

### Archive

```json
{
  "id": 321,
  "url": "https://example.com/article",
  "html_content": "<html>...</html>",
  "screenshot_path": "/archives/321.png",
  "pdf_path": "/archives/321.pdf",
  "created_at": "2026-06-20T12:00:00.000Z",
  "user_id": 1
}
```

## Endpoint Reference

### Authentication

#### Register

```http
POST /api/auth/register
```

Request:

```json
{
  "username": "acme_admin",
  "email": "admin@example.com",
  "password": "securePass123"
}
```

Response `201`:

```json
{
  "message": "User registered successfully",
  "userId": 1
}
```

Common errors:

| Status | Meaning |
|--------|---------|
| `400` | Missing username, email, or password |
| `409` | Username or email already exists |

#### Login

```http
POST /api/auth/login
```

Request:

```json
{
  "email": "admin@example.com",
  "password": "securePass123"
}
```

Response `200`:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Logout

```http
POST /api/auth/logout
Authorization: Bearer <jwt>
```

Response `200`:

```json
{
  "message": "Logged out successfully"
}
```

### Billing

#### Get Current Plan

```http
GET /api/billing/plan
Authorization: Bearer <jwt>
X-Device-Id: acme-laptop-001
```

Response `200`:

```json
{
  "plan": {
    "tier": "free",
    "name": "Free",
    "priceCents": 0,
    "priceDisplay": "$0/mo"
  },
  "subscription": {
    "status": "inactive",
    "provider": null,
    "currentPeriodEnd": null
  },
  "limits": {
    "bookmarks": 100,
    "devices": 1
  },
  "features": {
    "ml": false,
    "sync": false
  },
  "usage": {
    "bookmarks": 0,
    "tabs": 0,
    "devices": 1
  },
  "upgrade": {
    "tier": "pro",
    "priceDisplay": "$4.99/mo"
  }
}
```

#### Create Checkout URL

```http
POST /api/billing/checkout
Authorization: Bearer <jwt>
```

Response `200` for Free users:

```json
{
  "provider": "stripe",
  "url": "https://checkout.example/pro?client_reference_id=1&prefilled_email=admin%40example.com",
  "plan": {
    "tier": "pro",
    "priceDisplay": "$4.99/mo"
  }
}
```

Response `200` for existing Pro users:

```json
{
  "alreadyPro": true,
  "plan": {
    "tier": "pro",
    "name": "Pro",
    "priceCents": 499,
    "priceDisplay": "$4.99/mo"
  }
}
```

If checkout is not configured, the endpoint returns `503 checkout_unavailable` with the required environment variables.

#### Billing Webhook

```http
POST /api/billing/webhook
```

This endpoint is intended for billing providers, not browser clients. It accepts Stripe and Lemon Squeezy subscription events, verifies the configured signature or shared secret, and updates the user's subscription state.

Supported verification inputs:

| Provider | Header |
|----------|--------|
| Stripe | `Stripe-Signature` with `STRIPE_WEBHOOK_SECRET` |
| Lemon Squeezy | `X-Signature` with `LEMON_SQUEEZY_WEBHOOK_SECRET` |
| Shared secret | `X-Billing-Webhook-Secret` with `BILLING_WEBHOOK_SECRET` |

Response `200` when applied:

```json
{
  "ignored": false,
  "userId": 1,
  "status": "active",
  "provider": "stripe"
}
```

Response `200` for unsupported events:

```json
{
  "ignored": true
}
```

### User Profile

All user profile endpoints require `Authorization: Bearer <jwt>`.

| Method | Endpoint | Request body | Success response |
|--------|----------|--------------|------------------|
| `GET` | `/api/user/profile` | None | User profile without password hash |
| `PUT` | `/api/user/profile` | `{ "username": "new_name" }` | `{ "message": "Profile updated successfully", "username": "new_name" }` |
| `PUT` | `/api/user/email` | `{ "email": "new@example.com" }` | `{ "message": "Email updated successfully", "email": "new@example.com" }` |
| `PUT` | `/api/user/password` | `{ "currentPassword": "...", "newPassword": "..." }` | `{ "message": "Password updated successfully" }` |
| `DELETE` | `/api/user/account` | None | `{ "message": "Account deleted successfully" }` |

`GET /api/user/profile` also includes plan and subscription fields:

```json
{
  "id": 1,
  "username": "acme_admin",
  "email": "admin@example.com",
  "plan_tier": "pro",
  "subscription_status": "active",
  "subscription_provider": "stripe",
  "subscription_current_period_end": "2026-07-20T12:00:00.000Z",
  "created_at": "2026-06-20T12:00:00.000Z"
}
```

Deleting an account deletes the user's tabs, bookmarks, suggestions, archived pages, and user record.

### Tabs

All tab endpoints require `Authorization: Bearer <jwt>`. Send `X-Device-Id` when the client represents a persistent device.

#### Create Tab

```http
POST /api/tabs
```

Request:

```json
{
  "url": "https://example.com/article",
  "title": "Example article",
  "favicon": "https://example.com/favicon.ico",
  "content": "Extracted page text"
}
```

Response `201`: the created tab record.

If the user has the Pro `ml` feature and `content` is supplied, the API queues ML enrichment for the tab.

#### Bulk Import Tabs

```http
POST /api/tabs/bulk
```

Pro-only `sync` feature.

Request:

```json
{
  "tabs": [
    {
      "url": "https://example.com/one",
      "title": "First tab"
    },
    {
      "url": "https://example.com/two",
      "title": "Second tab"
    }
  ]
}
```

Response `202`:

```json
{
  "message": "Tab import process started"
}
```

#### List Tabs

```http
GET /api/tabs?limit=100&offset=0&archived=false
```

Response `200`: array of tab records ordered by newest first.

#### Get Tab

```http
GET /api/tabs/:id
```

Returns the tab owned by the authenticated user. This endpoint increments `access_count` and updates `last_accessed`.

#### Update Tab

```http
PUT /api/tabs/:id
```

Request fields are optional and update only supplied values:

```json
{
  "title": "Updated title",
  "content": "Updated extracted content",
  "tags": ["reference", "api"],
  "category": "Technology"
}
```

Response `200`: updated tab record.

#### Delete Tab

```http
DELETE /api/tabs/:id
```

Response `200`:

```json
{
  "message": "Tab deleted successfully"
}
```

#### Archive Tab

```http
POST /api/tabs/:id/archive
```

Queues a page archive job for the tab URL and marks the tab archived.

Response `200`:

```json
{
  "message": "Tab queued for archival"
}
```

#### Detect Stale Tabs

```http
GET /api/tabs/stale/detect?days=30
```

Pro-only `ml` feature.

Returns tabs whose `last_accessed` timestamp is older than `days`, or whose `created_at` timestamp is older than `days` when `last_accessed` is missing.

### Bookmarks

All bookmark endpoints require `Authorization: Bearer <jwt>`. Send `X-Device-Id` when the client represents a persistent device.

#### Create Bookmark

```http
POST /api/bookmarks
```

Request:

```json
{
  "url": "https://example.com/reference",
  "title": "Reference",
  "favicon": "https://example.com/favicon.ico",
  "folder": "Research",
  "content": "Extracted page text"
}
```

Response `201`: the created bookmark record.

Free accounts are limited by the configured bookmark limit. Pro users with supplied `content` get asynchronous ML enrichment.

#### Bulk Import Bookmarks

```http
POST /api/bookmarks/bulk
```

Pro-only `sync` feature.

Request:

```json
{
  "bookmarks": [
    {
      "url": "https://example.com/one",
      "title": "First bookmark",
      "folder": "Research"
    },
    {
      "url": "https://example.com/two",
      "title": "Second bookmark",
      "folder": "Research"
    }
  ]
}
```

Response `202`:

```json
{
  "message": "Bookmark import process started"
}
```

#### List Bookmarks

```http
GET /api/bookmarks?limit=100&offset=0&folder=Research&archived=false
```

Response `200`: array of bookmark records ordered by newest first. Omit `folder` to list all folders.

#### Get, Update, Delete, and Archive Bookmark

| Method | Endpoint | Behavior |
|--------|----------|----------|
| `GET` | `/api/bookmarks/:id` | Returns a bookmark owned by the authenticated user |
| `PUT` | `/api/bookmarks/:id` | Updates `title`, `folder`, `content`, `tags`, or `category` |
| `DELETE` | `/api/bookmarks/:id` | Deletes the bookmark |
| `POST` | `/api/bookmarks/:id/archive` | Queues archive job and marks bookmark archived |

Update request:

```json
{
  "title": "Updated reference",
  "folder": "Engineering",
  "content": "Updated extracted text",
  "tags": ["engineering", "docs"],
  "category": "Technology"
}
```

Archive response:

```json
{
  "message": "Bookmark queued for archival"
}
```

### Search

All search endpoints require `Authorization: Bearer <jwt>`.

#### Text Search

```http
GET /api/search/text?query=postgres&type=both&limit=10
```

Query parameters:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `query` | None | Text matched against title, content, and summary |
| `type` | `both` | `tabs`, `bookmarks`, or `both` |
| `limit` | `10` | Maximum results per type before final response assembly |

Response `200`:

```json
[
  {
    "id": 123,
    "url": "https://example.com/postgres",
    "title": "Postgres notes",
    "summary": null,
    "category": "Technology",
    "tags": ["database"],
    "type": "tab"
  }
]
```

#### Semantic Search

```http
POST /api/search/semantic
```

Pro-only `ml` feature. Requires the ML service to be available and saved items to have embeddings.

Request:

```json
{
  "query": "database indexing and query plans",
  "limit": 10,
  "type": "both"
}
```

Response `200`:

```json
[
  {
    "id": 123,
    "url": "https://example.com/postgres",
    "title": "Postgres notes",
    "summary": "Notes about query planning.",
    "category": "Technology",
    "tags": ["database"],
    "distance": 0.1823,
    "type": "bookmark"
  }
]
```

Lower `distance` means a closer semantic match.

#### Find Similar Items

```http
GET /api/search/similar/:id?type=tab&limit=10
```

Pro-only `ml` feature. `type` selects whether `:id` belongs to `tabs` or `bookmarks`.

Common errors:

| Status | Meaning |
|--------|---------|
| `400` | Source item has no embedding |
| `404` | Source item was not found for the authenticated user |

### Suggestions

All suggestion endpoints are Pro-only and require the `ml` feature.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/suggestions?status=pending&limit=50` | List suggestions by status |
| `GET` | `/api/suggestions/duplicates` | List pending duplicate suggestions ordered by confidence |
| `GET` | `/api/suggestions/stale` | List pending stale-tab suggestions |
| `GET` | `/api/suggestions/related/:id` | List pending related-content suggestions containing the item ID |
| `POST` | `/api/suggestions/generate` | Queue suggestion generation for the authenticated user |
| `PUT` | `/api/suggestions/:id/accept` | Mark a suggestion accepted |
| `PUT` | `/api/suggestions/:id/reject` | Mark a suggestion rejected |

Generate response:

```json
{
  "message": "Suggestion generation queued",
  "jobId": "suggestion-job-1"
}
```

Accept or reject response:

```json
{
  "id": 789,
  "type": "duplicate",
  "item_ids": [123, 456],
  "reason": "duplicate reason",
  "confidence": 0.95,
  "status": "accepted",
  "created_at": "2026-06-20T12:00:00.000Z",
  "user_id": 1
}
```

### Archive

All archive endpoints require `Authorization: Bearer <jwt>`.

#### Archive Any Page

```http
POST /api/archive
```

Request:

```json
{
  "url": "https://example.com/article"
}
```

Response `200`:

```json
{
  "message": "Page queued for archival",
  "jobId": "archive-job-1"
}
```

The archive worker captures HTML, a screenshot path, and a PDF path when processing succeeds.

#### List Archives

```http
GET /api/archive?limit=50&offset=0
```

Response `200`: array of archive records owned by the authenticated user.

#### Get Archive

```http
GET /api/archive/:id
```

Response `200`: one archive record, including `html_content`, `screenshot_path`, and `pdf_path`.

### Health

```http
GET /health
```

Response `200`:

```json
{
  "status": "ok",
  "timestamp": "2026-06-20T12:00:00.000Z",
  "services": {
    "api": "healthy",
    "mlService": "healthy",
    "mlServiceLastCheck": "2026-06-20T11:59:00.000Z"
  }
}
```

When the ML service is unavailable, non-ML API features continue to operate and this endpoint reports `mlService: "unhealthy"`.

## Customer Integration Recipes

### Import a Browser Session

Use this for a signed-in Pro customer syncing all open browser tabs.

```bash
curl -X POST http://localhost:3000/api/tabs/bulk \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: chrome-profile-001" \
  -d '{
    "tabs": [
      { "url": "https://example.com/a", "title": "A" },
      { "url": "https://example.com/b", "title": "B" }
    ]
  }'
```

If the customer is on Free, the response is `402 upgrade_required` with `feature: "sync"`.

### Enrich Customer Content with ML

For Pro accounts, include extracted page `content` when creating tabs or bookmarks. The API returns the record immediately, then queues background analysis. Poll the item later to read `summary`, `category`, `tags`, `entities`, and embedding-backed search results after enrichment completes.

```bash
curl -X POST http://localhost:3000/api/bookmarks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/ml",
    "title": "ML article",
    "folder": "AI",
    "content": "Long article text extracted from the page..."
  }'
```

### Build an Upgrade Flow

1. Call `GET /api/billing/plan` on app startup and after sign-in.
2. Hide or disable Pro-only UI when `features.ml` or `features.sync` is false.
3. If an API call returns `402 upgrade_required`, show the returned `message` and `upgrade.priceDisplay`.
4. Send the customer to `POST /api/billing/checkout` and open the returned `url`.
5. After provider checkout completes, the billing webhook updates the account and `GET /api/billing/plan` reflects the Pro plan.

## Production Notes

- Serve the API over HTTPS in production.
- Store JWTs in secure storage appropriate for the client. Browser apps should avoid exposing tokens to third-party scripts.
- Configure `JWT_SECRET` to a strong secret before starting the backend.
- Configure at least one billing webhook secret in production: `STRIPE_WEBHOOK_SECRET`, `LEMON_SQUEEZY_WEBHOOK_SECRET`, or `BILLING_WEBHOOK_SECRET`.
- Keep `X-Device-Id` opaque. Do not use email addresses or hardware serial numbers as device IDs.
- Treat archive output paths as server-side artifacts unless your deployment explicitly exposes them.
- The API enforces per-user ownership on tabs, bookmarks, suggestions, and archives. A record ID from another account returns `404`.

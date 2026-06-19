# API Documentation

## Overview

The Tab & Bookmark Manager provides a comprehensive RESTful API with OpenAPI/Swagger documentation. All API endpoints require authentication except for registration and login.

## Interactive Documentation

Access the interactive Swagger UI at: `http://localhost:3000/api-docs`

## Authentication

The API uses JWT (JSON Web Token) based authentication. After logging in, include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## API Endpoints

### Authentication
- **POST** `/api/auth/register` - Register a new user
- **POST** `/api/auth/login` - Login and receive JWT token
- **POST** `/api/auth/logout` - Logout and revoke token

### Billing and Entitlements
- **GET** `/api/billing/plan` - Get current tier, free limits, feature flags, and usage
- **POST** `/api/billing/checkout` - Create a hosted Pro checkout URL for $4.99/mo
- **POST** `/api/billing/webhook` - Apply Lemon Squeezy or Stripe subscription events

### User Profile Management
- **GET** `/api/user/profile` - Get user profile information
- **PUT** `/api/user/profile` - Update username
- **PUT** `/api/user/email` - Update email address
- **PUT** `/api/user/password` - Change password (requires current password)
- **DELETE** `/api/user/account` - Delete user account and all associated data

### Tabs
- **POST** `/api/tabs` - Create a new tab
- **POST** `/api/tabs/bulk` - Create multiple tabs at once
- **GET** `/api/tabs` - List all tabs
- **GET** `/api/tabs/:id` - Get specific tab
- **PUT** `/api/tabs/:id` - Update tab
- **DELETE** `/api/tabs/:id` - Delete tab
- **POST** `/api/tabs/:id/archive` - Archive tab
- **GET** `/api/tabs/stale/detect` - Detect stale tabs

### Bookmarks
- **POST** `/api/bookmarks` - Create a new bookmark
- **POST** `/api/bookmarks/bulk` - Create multiple bookmarks at once
- **GET** `/api/bookmarks` - List all bookmarks
- **GET** `/api/bookmarks/:id` - Get specific bookmark
- **PUT** `/api/bookmarks/:id` - Update bookmark
- **DELETE** `/api/bookmarks/:id` - Delete bookmark
- **POST** `/api/bookmarks/:id/archive` - Archive bookmark

### Search
- **POST** `/api/search/semantic` - Semantic search using AI embeddings
- **GET** `/api/search/text` - Text-based search
- **GET** `/api/search/similar/:id` - Find similar items

### Suggestions
- **GET** `/api/suggestions` - Get all suggestions
- **GET** `/api/suggestions/duplicates` - Get duplicate detection suggestions
- **GET** `/api/suggestions/stale` - Get stale tab suggestions
- **GET** `/api/suggestions/related/:id` - Get related content suggestions
- **POST** `/api/suggestions/generate` - Generate new suggestions
- **PUT** `/api/suggestions/:id/accept` - Accept a suggestion
- **PUT** `/api/suggestions/:id/reject` - Reject a suggestion

### Archive
- **POST** `/api/archive` - Archive a web page
- **GET** `/api/archive/:id` - Get archived page
- **GET** `/api/archive` - List all archived pages

### Health Check
- **GET** `/health` - Check API and service health status

## Error Handling

The API uses standard HTTP status codes and returns JSON error responses:

```json
{
  "status": "error",
  "message": "Error description",
  "timestamp": "2025-11-12T18:00:00.000Z"
}
```

### Common Status Codes
- **200** - Success
- **201** - Created
- **400** - Bad Request (validation error)
- **401** - Unauthorized (authentication required)
- **402** - Payment Required (Pro upgrade required for gated feature or limit)
- **403** - Forbidden (insufficient permissions)
- **404** - Not Found
- **409** - Conflict (e.g., duplicate email)
- **500** - Internal Server Error
- **503** - Service Unavailable (e.g., ML service down)

## Request/Response Examples

### Register User
```bash
POST /api/auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "securePassword123"
}
```

Response:
```json
{
  "message": "User registered successfully",
  "userId": 1
}
```

### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Get Profile
```bash
GET /api/user/profile
Authorization: Bearer <token>
```

Response:
```json
{
  "id": 1,
  "username": "john_doe",
  "email": "john@example.com",
  "created_at": "2025-11-12T18:00:00.000Z",
  "updated_at": "2025-11-12T18:00:00.000Z"
}
```

### Update Password
```bash
PUT /api/user/password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "securePassword123",
  "newPassword": "newSecurePassword456"
}
```

Response:
```json
{
  "message": "Password updated successfully"
}
```

## Rate Limiting

The API implements rate limiting to prevent abuse:
- **100 requests per 15 minutes** per IP address

When rate limit is exceeded, the API returns a **429 Too Many Requests** status code.

## Service Health

The ML service health is monitored automatically. When the ML service is unavailable:
- Content analysis is gracefully skipped
- The API continues to function for other operations
- Health status is reflected in the `/health` endpoint

Check service health:
```bash
GET /health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-12T18:00:00.000Z",
  "services": {
    "api": "healthy",
    "mlService": "healthy",
    "mlServiceLastCheck": "2025-11-12T17:59:00.000Z"
  }
}
```

## Best Practices

1. **Always use HTTPS** in production
2. **Store JWT tokens securely** (e.g., httpOnly cookies)
3. **Implement token refresh** for long-lived sessions
4. **Handle errors gracefully** on the client side
5. **Use pagination** for large result sets
6. **Monitor rate limits** to avoid throttling
7. **Check service health** before critical operations

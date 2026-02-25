# WA Gateway API Documentation (Bun Backend)

**Version:** 1.0.0  
**Base URL:** `http://localhost:8080/api/v1`

---

## Authentication

API menggunakan JWT token untuk autentikasi. Token dapat dikirim melalui:
1. HTTP-only cookie (otomatis set saat login)
2. Authorization header: `Authorization: Bearer <token>`
3. API Key header (fallback untuk integrasi lama): `X-API-Key: <api_key>`

---

## Endpoints

### Authentication

#### Register User
```http
POST /api/v1/auth/register
```
**Headers:** `X-API-Key: <api_key>` (required)
**Body:** `{"username": "string", "password": "string"}`
**Response (201):** `{"message": "User created successfully"}`

#### Login
```http
POST /api/v1/auth/login
```
**Body:** `{"username": "string", "password": "string"}`
**Response (200):** `{"token": "jwt_token_here", "user": {"id": "user_id", "username": "string", "role": "user"}}`

#### Logout
```http
POST /api/v1/auth/logout
```
**Response (200):** `{"message": "Logged out"}`

#### Get Current User
```http
GET /api/v1/auth/me
```
**Response (200):** `{"user": {"id": "user_id", "username": "string", "role": "user"}}`

---

### Sessions

#### Get All Sessions
```http
GET /api/v1/sessions
```
**Response (200):** Array of session objects with id, name, phone, status, jid, token, browser, contactsCount, contactsSyncStatus, contactsSyncProgress, contactsSyncTotal, createdAt, updatedAt, messageCount

#### Create Session
```http
POST /api/v1/sessions
```
**Body:** `{"name": "Session 1"}`
**Response (201):** Session object with id, name, status, token, qrCode, message

#### Get QR Code
```http
GET /api/v1/sessions/:id/qr
```
**Response (200):** `{"qrCode": "data:image/png;base64,...", "status": "qr", "updatedAt": "2024-01-01T00:00:00.000Z", "hasQR": true}`

#### Delete Session
```http
DELETE /api/v1/sessions/:id
```
**Response (200):** `{"message": "Session deleted"}`

#### Reconnect Session
```http
POST /api/v1/sessions/:id/reconnect
```
**Response (200):** `{"message": "Reconnecting..."}`

#### Logout Session
```http
POST /api/v1/sessions/:id/logout
```
**Response (200):** `{"message": "Logged out"}`

#### Refresh Session Status
```http
POST /api/v1/sessions/:id/refresh
```
**Response (200):** `{"status": "connected", "isConnected": true, "details": {...}}`

---

### Contacts

#### Get Contacts
```http
GET /api/v1/sessions/:id/contacts?search=keyword
```
**Query:** `search` (optional) - Keyword untuk mencari kontak
**Response (200):** `{"total": 150, "syncStatus": "completed", "contacts": [...]}`

#### Sync Contacts
```http
POST /api/v1/sessions/:id/contacts/sync
```
**Response (200):** `{"message": "Contact sync triggered", "total": 150, "syncStatus": "syncing"}`

---

### Groups

#### Get Groups
```http
GET /api/v1/sessions/:id/groups
```
**Response (200):** Array of group objects with id, name, jid, participantCount

---

### Messages

#### Send Message
```http
POST /api/v1/messages/send
```
**Body (Text):** `{"sessionId": "session_uuid", "to": "6281234567890", "type": "text", "message": "Hello World", "useSpintax": false, "delay": true}`
**Body (Image):** `{"sessionId": "session_uuid", "to": "6281234567890", "type": "image", "mediaUrl": "https://example.com/image.jpg", "caption": "Image caption", "delay": true}`
**Body (Group):** `{"sessionId": "session_uuid", "to": "6281234567890@g.us", "type": "text", "message": "Hello Group", "delay": true}`
**Response (202):** `{"messageId": "message_uuid", "status": "queued", "message": "Pesan telah ditambahkan ke antrean"}`

#### Get Messages
```http
GET /api/v1/messages?sessionId=xxx&status=xxx&search=xxx&page=1&limit=20
```
**Query:** sessionId, status, search, page, limit (all optional)
**Response (200):** `{"data": [...], "pagination": {"total": 100, "page": 1, "limit": 20, "totalPages": 5}}`

#### Send Presence Update
```http
POST /api/v1/messages/presence
```
**Body:** `{"sessionId": "session_uuid", "to": "6281234567890@s.whatsapp.net", "type": "composing"}`
**Type Options:** composing, recording, available, unavailable
**Response (200):** `{"message": "Presence updated"}`

#### Bulk Send Message
```http
POST /api/v1/messages/bulk
```
**Body:** `{"sessionId": "session_uuid", "recipients": ["6281234567890", "6281234567891"], "message": "Hello everyone!", "useSpintax": false, "delay": true}`
**Response (202):** `{"queued": 3, "messageIds": [...], "status": "queued", "message": "3 pesan ditambahkan ke antrean"}`

---

### Queue

#### Get Queue
```http
GET /api/v1/queue
```
**Response (200):** Array of queued message objects

#### Get Queue Stats
```http
GET /api/v1/queue/stats
```
**Response (200):** `{"pending": 10, "processing": 2, "completed": 100, "failed": 5}`

#### Pause Queue
```http
POST /api/v1/queue/pause
```
**Response (200):** `{"paused": true, "message": "Antrean dijeda"}`

#### Resume Queue
```http
POST /api/v1/queue/resume
```
**Response (200):** `{"paused": false, "message": "Antrean dilanjutkan"}`

#### Retry Failed
```http
POST /api/v1/queue/retry
```
**Response (200):** `{"message": "Mencoba ulang pesan yang gagal"}`

#### Clear Queue
```http
DELETE /api/v1/queue?status=xxx
```
**Query:** `status` (optional, default: completed)
**Response (200):** `{"message": "Antrean completed dibersihkan"}`

---

### Webhooks

#### Get Webhooks
```http
GET /api/v1/webhooks
```
**Response (200):** Array of webhook objects with id, url, secret, events, status, lastTriggered, createdAt, updatedAt

#### Create Webhook
```http
POST /api/v1/webhooks
```
**Body:** `{"url": "https://example.com/webhook", "secret": "secret_key", "events": ["message.sent", "message.received"]}`
**Response (201):** Webhook object

#### Delete Webhook
```http
DELETE /api/v1/webhooks/:id
```
**Response (200):** `{"message": "Webhook dihapus"}`

#### Get Webhook Logs
```http
GET /api/v1/webhooks/logs
```
**Response (200):** Array of webhook log objects

---

### Stats

#### Get Stats
```http
GET /api/v1/stats
```
**Response (200):** `{"totalSessions": 2, "activeSessions": 1, "messagesSent": 100, "messagesQueued": 10, "messagesDelivered": 95, "messagesFailed": 5}`

#### Get Activity Data
```http
GET /api/v1/stats/activity
```
**Response (200):** Array of hourly activity data with time, sent, delivered, failed

---

### Anti-Block

#### Get Anti-Block Settings
```http
GET /api/v1/antiblock/settings
```
**Response (200):** Anti-block settings object with rateLimitEnabled, messagesPerMinute, messagesPerHour, burstLimit, delayEnabled, minDelay, maxDelay, baseDelay, warmupEnabled, warmupDays, warmupDay1Limit, warmupDay7Limit, spintaxEnabled, numberFilterEnabled, updatedAt

#### Update Anti-Block Settings
```http
POST /api/v1/antiblock/settings
```
**Body:** `{"rateLimitEnabled": true, "messagesPerMinute": 5, "messagesPerHour": 50, "delayEnabled": true, "minDelay": 1, "maxDelay": 5}`
**Response (200):** Updated settings object

#### Reset Anti-Block Settings
```http
POST /api/v1/antiblock/settings/reset
```
**Response (200):** Default settings object

---

### Templates

#### Get Templates
```http
GET /api/v1/templates
```
**Response (200):** Array of template objects with id, name, content, createdAt, updatedAt

#### Create Template
```http
POST /api/v1/templates
```
**Body:** `{"name": "Template Name", "content": "Template content with {variable}"}`
**Response (201):** Template object

#### Update Template
```http
PUT /api/v1/templates/:id
```
**Body:** `{"name": "Updated Name", "content": "Updated content"}`
**Response (200):** Updated template object

#### Delete Template
```http
DELETE /api/v1/templates/:id
```
**Response (200):** `{"message": "Template dihapus"}`

---

## Error Responses

All endpoints may return error responses:

**400 Bad Request:** `{"error": "Validation error message"}`

**401 Unauthorized:** `{"error": "Unauthorized"}`

**404 Not Found:** `{"error": "Resource not found"}`

**500 Internal Server Error:** `{"error": "Error message"}`

---

## Notes

- Semua endpoint kecuali `/auth/register`, `/auth/login`, dan `/auth/logout` memerlukan autentikasi
- Gunakan JWT token melalui cookie atau Authorization header
- API Key header hanya digunakan sebagai fallback untuk integrasi lama
- Rate limiting diterapkan untuk mencegah abuse
- Semua timestamp dalam format ISO 8601 UTC

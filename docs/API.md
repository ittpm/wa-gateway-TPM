# WA Gateway API Documentation

## Base URL

Development: `http://localhost:8080/api/v1`

Production: `https://your-domain.com/api/v1`

## Authentication

Include API key in header if configured:

```
X-API-Key: your-api-key
```

## Response Format

All responses follow this format:

```json
{
  "data": {},
  "error": null
}
```

Or for errors:

```json
{
  "error": "Error message"
}
```

## Endpoints

### Sessions

#### Create Session
Create a new WhatsApp session.

```http
POST /sessions
Content-Type: application/json

{
  "name": "Business Account 1"
}
```

Response:
```json
{
  "id": "uuid",
  "name": "Business Account 1",
  "status": "qr",
  "qrCode": "data:image/png;base64,..."
}
```

#### List Sessions
Get all sessions.

```http
GET /sessions
```

Response:
```json
[
  {
    "id": "uuid",
    "name": "Business Account 1",
    "phone": "6281234567890",
    "status": "connected",
    "createdAt": "2024-01-01T00:00:00Z",
    "messageCount": 150
  }
]
```

#### Reconnect Session
Reconnect a disconnected session.

```http
POST /sessions/{id}/reconnect
```

#### Logout Session
Logout from WhatsApp.

```http
POST /sessions/{id}/logout
```

#### Delete Session
Delete a session permanently.

```http
DELETE /sessions/{id}
```

### Messages

#### Send Text Message
Send a text message.

```http
POST /messages/send
Content-Type: application/json

{
  "sessionId": "uuid",
  "to": "6281234567890",
  "type": "text",
  "message": "Hello *World*!",
  "useSpintax": false,
  "delay": true
}
```

Response:
```json
{
  "messageId": "uuid",
  "status": "queued"
}
```

#### Send Image
Send an image message.

```http
POST /messages/send
Content-Type: application/json

{
  "sessionId": "uuid",
  "to": "6281234567890",
  "type": "image",
  "mediaUrl": "https://example.com/image.jpg",
  "caption": "Check this out!"
}
```

#### Send Document
Send a document.

```http
POST /messages/send
Content-Type: application/json

{
  "sessionId": "uuid",
  "to": "6281234567890",
  "type": "document",
  "mediaUrl": "https://example.com/doc.pdf",
  "fileName": "document.pdf",
  "caption": "Please review"
}
```

#### Send Location
Send a location.

```http
POST /messages/send
Content-Type: application/json

{
  "sessionId": "uuid",
  "to": "6281234567890",
  "type": "location",
  "latitude": -6.2088,
  "longitude": 106.8456,
  "caption": "Our office"
}
```

#### Send Contact
Send a contact card.

```http
POST /messages/send
Content-Type: application/json

{
  "sessionId": "uuid",
  "to": "6281234567890",
  "type": "vcard",
  "contactName": "John Doe",
  "contactPhone": "6289876543210"
}
```

#### Send Bulk Messages
Send messages to multiple recipients.

```http
POST /messages/bulk
Content-Type: application/json

{
  "sessionId": "uuid",
  "recipients": ["6281234567890", "6289876543210"],
  "message": "Hello {there|friend}!",
  "useSpintax": true,
  "delay": true
}
```

### Queue

#### Get Queue Items
Get messages in queue.

```http
GET /queue?status=pending
```

Response:
```json
[
  {
    "id": "uuid",
    "to": "6281234567890",
    "type": "text",
    "status": "pending",
    "attempts": 0,
    "createdAt": "2024-01-01T00:00:00Z"
  }
]
```

#### Get Queue Stats
Get queue statistics.

```http
GET /queue/stats
```

Response:
```json
{
  "pending": 10,
  "processing": 2,
  "completed": 150,
  "failed": 3
}
```

#### Pause Queue
Pause queue processing.

```http
POST /queue/pause
```

#### Resume Queue
Resume queue processing.

```http
POST /queue/resume
```

#### Retry Failed
Retry failed messages.

```http
POST /queue/retry
```

#### Clear Queue
Clear messages by status.

```http
DELETE /queue?status=completed
```

### Webhooks

#### Create Webhook
Register a webhook endpoint.

```http
POST /webhooks
Content-Type: application/json

{
  "url": "https://your-app.com/webhook",
  "secret": "webhook-secret",
  "events": ["message.received", "message.sent", "message.delivered"]
}
```

Available events:
- `message.received` - Incoming message
- `message.sent` - Message sent
- `message.delivered` - Message delivered
- `message.read` - Message read
- `message.failed` - Message failed to send
- `session.connected` - Session connected
- `session.disconnected` - Session disconnected

#### List Webhooks
Get all webhooks.

```http
GET /webhooks
```

#### Delete Webhook
Remove a webhook.

```http
DELETE /webhooks/{id}
```

#### Get Webhook Logs
Get delivery logs.

```http
GET /webhooks/logs
```

### Stats

#### Get Statistics
Get system statistics.

```http
GET /stats
```

Response:
```json
{
  "totalSessions": 5,
  "activeSessions": 3,
  "messagesSent": 1000,
  "messagesQueued": 10,
  "messagesDelivered": 985,
  "messagesFailed": 15
}
```

#### Get Activity Data
Get activity chart data.

```http
GET /stats/activity
```

Response:
```json
[
  {
    "time": "14:00",
    "sent": 45,
    "delivered": 43,
    "failed": 2
  }
]
```

### Anti-Block

#### Get Settings
Get anti-block settings.

```http
GET /antiblock/settings
```

Response:
```json
{
  "rateLimitEnabled": true,
  "messagesPerMinute": 5,
  "messagesPerHour": 50,
  "burstLimit": 10,
  "delayEnabled": true,
  "minDelay": 1,
  "maxDelay": 5,
  "warmupEnabled": true,
  "warmupDays": 7,
  "spintaxEnabled": true,
  "numberFilterEnabled": true
}
```

#### Update Settings
Update anti-block settings.

```http
POST /antiblock/settings
Content-Type: application/json

{
  "rateLimitEnabled": true,
  "messagesPerMinute": 3,
  "messagesPerHour": 30,
  "delayEnabled": true,
  "minDelay": 2,
  "maxDelay": 8
}
```

#### Reset Settings
Reset to defaults.

```http
POST /antiblock/settings/reset
```

### Number Validation

#### Validate Numbers
Check if numbers are on WhatsApp.

```http
POST /validate-numbers
Content-Type: application/json

{
  "sessionId": "uuid",
  "numbers": ["6281234567890", "6289876543210"]
}
```

Response:
```json
{
  "6281234567890": true,
  "6289876543210": false
}
```

## Webhook Payloads

### Message Received

```json
{
  "event": "message.received",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    "id": "message-id",
    "from": "6281234567890",
    "pushName": "John Doe",
    "message": "Hello!",
    "timestamp": "2024-01-01T12:00:00Z",
    "isGroup": false
  }
}
```

### Message Sent

```json
{
  "event": "message.sent",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    "messageId": "uuid",
    "waMessageId": "whatsapp-message-id",
    "to": "6281234567890",
    "type": "text"
  }
}
```

### Message Delivered

```json
{
  "event": "message.delivered",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    "waMessageId": "whatsapp-message-id",
    "to": "6281234567890"
  }
}
```

### Session Connected

```json
{
  "event": "session.connected",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    "sessionId": "uuid",
    "phone": "6281234567890"
  }
}
```

## Spintax Format

Use curly braces with pipe-separated options:

```
Hello {world|there|friend}, how are {you|you doing|things}?
```

This will randomly generate variations like:
- "Hello world, how are you?"
- "Hello there, how are you doing?"
- "Hello friend, how are things?"

## Rate Limiting

Default rate limits:
- 5 messages per minute per session
- 50 messages per hour per session
- 10 burst messages

When limit is reached, messages are queued for later delivery.

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid API key |
| 404 | Not Found |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

## SDK Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

const client = axios.create({
  baseURL: 'http://localhost:8080/api/v1',
  headers: {
    'X-API-Key': 'your-api-key'
  }
});

// Send message
async function sendMessage(to, message) {
  const response = await client.post('/messages/send', {
    sessionId: 'your-session-id',
    to: to,
    type: 'text',
    message: message,
    delay: true
  });
  return response.data;
}

// Get sessions
async function getSessions() {
  const response = await client.get('/sessions');
  return response.data;
}
```

### PHP

```php
<?php
$client = new GuzzleHttp\Client([
    'base_uri' => 'http://localhost:8080/api/v1/',
    'headers' => [
        'X-API-Key' => 'your-api-key'
    ]
]);

// Send message
$response = $client->post('messages/send', [
    'json' => [
        'sessionId' => 'your-session-id',
        'to' => '6281234567890',
        'type' => 'text',
        'message' => 'Hello!',
        'delay' => true
    ]
]);

echo $response->getBody();
```

### Python

```python
import requests

headers = {
    'X-API-Key': 'your-api-key',
    'Content-Type': 'application/json'
}

# Send message
response = requests.post(
    'http://localhost:8080/api/v1/messages/send',
    headers=headers,
    json={
        'sessionId': 'your-session-id',
        'to': '6281234567890',
        'type': 'text',
        'message': 'Hello!',
        'delay': True
    }
)

print(response.json())
```

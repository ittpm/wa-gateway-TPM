# Google Apps Script Integration Guide

## Complete Setup for WA Gateway

---

## 📌 OVERVIEW

This guide shows how to integrate WA Gateway with Google Apps Script (GAS) for:

- Sending WhatsApp messages from Google Sheets
- Tracking message delivery in Sheets
- Creating automated workflows with Forms, Calendar, and other Google services

---

## 🎯 USE CASES

### 1. Customer Outreach from Google Sheets

Send WhatsApp messages to customers listed in a Google Sheet

### 2. Form Response Automation

Automatically send WhatsApp message when Google Form is submitted

### 3. Calendar Event Notifications

Send WhatsApp reminder when Google Calendar event is coming up

### 4. Gmail Integration

Send WhatsApp when certain emails arrive

### 5. Analytics Dashboard

Send WhatsApp reports based on Google Analytics data

---

## ⚙️ SETUP STEPS

### Step 1: Get WA Gateway URL & Credentials

From your wa-gateway backend:

```bash
# Get JWT Token
curl -X POST http://your-server:9090/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'

# Response:
# {"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}
```

Get your Session ID:

```bash
# List sessions
curl http://your-server:9090/api/v1/sessions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response includes:
# [{"id":"session-uuid-here", "name":"My Account", "status":"connected"}]
```

**Save these**:

- WA Gateway URL: `http://your-server:9090/api/v1`
- JWT Token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- Session ID: `session-uuid-here`

### Step 2: Create Google Apps Script Project

1. Open a Google Sheet or Google Form
2. Click **Extensions** → **Apps Script**
3. Replace default code with the scripts below

### Step 3: Configure Script Properties

```javascript
// In Apps Script Editor:
// Click Project Settings (bottom left)
// Enable Google Cloud Project (if needed)
// Note the Script ID (you'll need this)
```

---

## 💻 IMPLEMENTATION

### Implementation #1: Send Message from Google Sheets

**Setup**:

1. Create Google Sheet with columns: `Phone`, `Message`, `Status`, `Message ID`

**Script**:

```javascript
// Script Name: WAGatewayIntegration.gs

const WA_GATEWAY_URL = "http://your-server:9090/api/v1";
const JWT_TOKEN = "YOUR_JWT_TOKEN_HERE";
const SESSION_ID = "YOUR_SESSION_ID_HERE";

// Cache tokens to avoid too many logins
const cache = CacheService.getScriptCache();

/**
 * Send WhatsApp message from Google Sheets
 * Add this to a button onClick or custom menu
 */
function sendMessageFromSheet() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const range = sheet.getDataRange();
  const values = range.getValues();

  // Skip header row
  for (let i = 1; i < values.length; i++) {
    const phone = values[i][0]; // Column A
    const message = values[i][1]; // Column B
    const status = values[i][2]; // Column C

    // Skip if already sent
    if (status === "sent") {
      continue;
    }

    // Skip if no phone or message
    if (!phone || !message) {
      continue;
    }

    try {
      // Send message
      const result = sendWhatsAppMessage(phone, message);

      // Update sheet with result
      sheet.getRange(i + 1, 3).setValue("sent");
      sheet.getRange(i + 1, 4).setValue(result.messageId);

      Logger.log(`✓ Message sent to ${phone}: ${result.messageId}`);

      // Delay to avoid rate limiting
      Utilities.sleep(1000);
    } catch (error) {
      sheet.getRange(i + 1, 3).setValue(`error: ${error.message}`);
      Logger.log(`✗ Error sending to ${phone}: ${error.message}`);
    }
  }

  SpreadsheetApp.getUi().alert("Broadcast complete!");
}

/**
 * Send single WhatsApp message via WA Gateway
 */
function sendWhatsAppMessage(phone, message) {
  const token = getToken();

  const payload = {
    sessionId: SESSION_ID,
    to: formatPhoneNumber(phone),
    type: "text",
    message: message,
    delay: true,
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(
    `${WA_GATEWAY_URL}/messages/send`,
    options,
  );

  const statusCode = response.getResponseCode();
  const result = JSON.parse(response.getContentText());

  if (statusCode !== 202) {
    throw new Error(result.error || `HTTP ${statusCode}`);
  }

  return result;
}

/**
 * Format phone number to WhatsApp format
 * Input: 0812345678 or 6281234567890 or +6281234567890
 * Output: 6281234567890
 */
function formatPhoneNumber(input) {
  // Remove all non-digits
  let phone = String(input).replace(/\D/g, "");

  // If starts with 0, replace with 62
  if (phone.startsWith("0")) {
    phone = "62" + phone.substring(1);
  }

  // If doesn't start with 62, add it
  if (!phone.startsWith("62")) {
    phone = "62" + phone;
  }

  return phone;
}

/**
 * Get JWT token (cached)
 */
function getToken() {
  // Check cache first
  let token = cache.get("wa_token");
  if (token) {
    return token;
  }

  // Get new token
  const response = UrlFetchApp.fetch(`${WA_GATEWAY_URL}/auth/login`, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      username: "admin",
      password: "YOUR_PASSWORD", // Or use getSecret()
    }),
    muteHttpExceptions: true,
  });

  const result = JSON.parse(response.getContentText());

  if (response.getResponseCode() !== 200) {
    throw new Error(result.error || "Login failed");
  }

  token = result.token;

  // Cache for 1 hour (3600 seconds)
  cache.put("wa_token", token, 3600);

  return token;
}

/**
 * Add custom menu to Google Sheet
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu("WhatsApp")
    .addItem("📱 Send Messages", "sendMessageFromSheet")
    .addItem("📊 Get Queue Status", "showQueueStatus")
    .addItem("🔄 Refresh Session", "refreshSession")
    .addSeparator()
    .addItem("📖 Help", "showHelp")
    .addToUi();
}

/**
 * Show queue status in sidebar
 */
function showQueueStatus() {
  const token = getToken();

  const response = UrlFetchApp.fetch(`${WA_GATEWAY_URL}/queue/stats`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    muteHttpExceptions: true,
  });

  const stats = JSON.parse(response.getContentText());

  const html = `
    <h2>📊 Queue Status</h2>
    <p><strong>Pending:</strong> ${stats.pending}</p>
    <p><strong>Processing:</strong> ${stats.processing}</p>
    <p><strong>Completed:</strong> ${stats.completed}</p>
    <p><strong>Failed:</strong> ${stats.failed}</p>
  `;

  const ui = SpreadsheetApp.getUi();
  ui.showModelessDialog(HtmlService.createHtmlOutput(html), "Queue Status");
}

/**
 * Refresh session status
 */
function refreshSession() {
  const token = getToken();

  const response = UrlFetchApp.fetch(
    `${WA_GATEWAY_URL}/sessions/${SESSION_ID}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      muteHttpExceptions: true,
    },
  );

  if (response.getResponseCode() !== 200) {
    SpreadsheetApp.getUi().alert("Error: Session not found");
    return;
  }

  const session = JSON.parse(response.getContentText());
  SpreadsheetApp.getUi().alert(
    `Session Status: ${session.status}\nPhone: ${session.phone || "Not connected"}`,
  );
}

/**
 * Show help dialog
 */
function showHelp() {
  const html = `
    <h2>Help: WhatsApp Integration</h2>
    <h3>Setup Required:</h3>
    <ol>
      <li>Update WA_GATEWAY_URL with your server URL</li>
      <li>Add JWT_TOKEN from WA Gateway login</li>
      <li>Add SESSION_ID from WA Gateway sessions</li>
      <li>Add your password in getToken() function</li>
    </ol>
    <h3>How to Use:</h3>
    <ol>
      <li>Column A: Phone numbers (0812... or 62812...)</li>
      <li>Column B: Message text</li>
      <li>Column C: Status (auto-filled)</li>
      <li>Column D: Message ID (auto-filled)</li>
      <li>Click "Send Messages" to broadcast</li>
    </ol>
  `;

  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html),
    "Help",
  );
}
```

---

### Implementation #2: Google Form Response → WhatsApp

**Setup**: Create a Google Form with email field

**Script**:

```javascript
// Script Name: FormResponseHandler.gs

const WA_GATEWAY_URL = "http://your-server:9090/api/v1";
const JWT_TOKEN = "YOUR_JWT_TOKEN_HERE";
const SESSION_ID = "YOUR_SESSION_ID_HERE";

/**
 * Trigger this on form submission
 * Go to Triggers (⏰ icon) → Create new trigger
 * - Choose sendFormResponseAsSMS
 * - Event type: On form submit
 */
function sendFormResponseAsWhatsApp(e) {
  const response = e.response;
  const answers = response.getItemResponses();

  // Get email from first answer
  let email = null;
  let phone = null;

  for (let i = 0; i < answers.length; i++) {
    const itemResponse = answers[i];
    const itemTitle = itemResponse.getItem().getTitle();
    const responseText = itemResponse.getResponse();

    if (itemTitle.toLowerCase().includes("email")) {
      email = responseText;
    }
    if (
      itemTitle.toLowerCase().includes("phone") ||
      itemTitle.toLowerCase().includes("whatsapp")
    ) {
      phone = responseText;
    }
  }

  if (!phone) {
    Logger.log("No phone number found in form response");
    return;
  }

  // Create message
  const message = `Terima kasih telah mengisi form kami! 
Kami akan menghubungi Anda segera.

Data yang kami terima:
${answers.map((a) => `${a.getItem().getTitle()}: ${a.getResponse()}`).join("\n")}`;

  try {
    const result = sendWhatsAppMessage(phone, message);
    Logger.log(`Form response sent to ${phone}: ${result.messageId}`);

    // Send email confirmation to respondent
    if (email) {
      GmailApp.sendEmail(
        email,
        "Form Submission Confirmation",
        `We received your form and sent a WhatsApp message to ${phone}`,
      );
    }
  } catch (error) {
    Logger.log(`Error: ${error.message}`);
  }
}

function sendWhatsAppMessage(phone, message) {
  const token = JWT_TOKEN; // Use cached token or implement caching

  const payload = {
    sessionId: SESSION_ID,
    to: formatPhoneNumber(phone),
    type: "text",
    message: message,
    delay: true,
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(
    `${WA_GATEWAY_URL}/messages/send`,
    options,
  );

  const statusCode = response.getResponseCode();
  const result = JSON.parse(response.getContentText());

  if (statusCode !== 202) {
    throw new Error(result.error || `HTTP ${statusCode}`);
  }

  return result;
}

function formatPhoneNumber(input) {
  let phone = String(input).replace(/\D/g, "");
  if (phone.startsWith("0")) {
    phone = "62" + phone.substring(1);
  }
  if (!phone.startsWith("62")) {
    phone = "62" + phone;
  }
  return phone;
}
```

---

### Implementation #3: Scheduled Broadcast Campaign

**Setup**: Send messages at specific time to many people

**Script**:

```javascript
// Script Name: BroadcastScheduler.gs

const WA_GATEWAY_URL = "http://your-server:9090/api/v1";
const JWT_TOKEN = "YOUR_JWT_TOKEN_HERE";
const SESSION_ID = "YOUR_SESSION_ID_HERE";

/**
 * Schedule this as time-based trigger
 * Go to Triggers → Create new trigger
 * - Choose broadcastMessages
 * - Event type: Time-driven
 * - Select frequency (Daily, Hourly, etc.)
 */
function broadcastMessages() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Broadcast Queue");

  if (!sheet) {
    Logger.log("Broadcast Queue sheet not found");
    return;
  }

  const range = sheet.getDataRange();
  const values = range.getValues();

  let sentCount = 0;
  let errorCount = 0;

  // Skip header row
  for (let i = 1; i < values.length; i++) {
    const phone = values[i][0];
    const message = values[i][1];
    const status = values[i][2];
    const scheduledTime = values[i][3];

    // Skip if status is not "pending"
    if (status !== "pending") {
      continue;
    }

    // Skip if scheduled time hasn't arrived
    if (scheduledTime && new Date(scheduledTime) > new Date()) {
      continue;
    }

    // Skip if no phone or message
    if (!phone || !message) {
      continue;
    }

    try {
      const result = sendWhatsAppMessage(phone, message);

      // Update status to sent
      sheet.getRange(i + 1, 3).setValue("sent");
      sheet.getRange(i + 1, 4).setValue(result.messageId);
      sheet.getRange(i + 1, 5).setValue(new Date());

      sentCount++;
      Logger.log(`✓ Sent to ${phone}`);

      // Small delay between sends
      Utilities.sleep(100);
    } catch (error) {
      sheet.getRange(i + 1, 3).setValue("error");
      sheet.getRange(i + 1, 4).setValue(error.message);

      errorCount++;
      Logger.log(`✗ Error to ${phone}: ${error.message}`);
    }
  }

  // Log summary
  Logger.log(`\n📊 Broadcast Summary:`);
  Logger.log(`✓ Sent: ${sentCount}`);
  Logger.log(`✗ Error: ${errorCount}`);

  // Send email notification
  const email = Session.getActiveUser().getEmail();
  GmailApp.sendEmail(
    email,
    `WhatsApp Broadcast Complete: ${sentCount} sent, ${errorCount} errors`,
    `Sent: ${sentCount}\nErrors: ${errorCount}`,
  );
}

function sendWhatsAppMessage(phone, message) {
  const payload = {
    sessionId: SESSION_ID,
    to: formatPhoneNumber(phone),
    type: "text",
    message: message,
    delay: true,
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${JWT_TOKEN}`,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(
    `${WA_GATEWAY_URL}/messages/send`,
    options,
  );

  const statusCode = response.getResponseCode();
  const result = JSON.parse(response.getContentText());

  if (statusCode !== 202) {
    throw new Error(result.error || `HTTP ${statusCode}`);
  }

  return result;
}

function formatPhoneNumber(input) {
  let phone = String(input).replace(/\D/g, "");
  if (phone.startsWith("0")) {
    phone = "62" + phone.substring(1);
  }
  if (!phone.startsWith("62")) {
    phone = "62" + phone;
  }
  return phone;
}
```

---

### Implementation #4: Webhook Listener (Reverse Integration)

Listen for WhatsApp messages sent through WA Gateway:

```javascript
// Script Name: WebhookHandler.gs

/**
 * Deploy this as web app
 * Go to Deploy → New Deployment → Web app
 * - Execute as: Your Account
 * - Who has access: Anyone (or specific email)
 * - Copy the deployment URL
 *
 * Register this URL as webhook in WA Gateway:
 * POST /api/v1/webhooks
 * {
 *   "url": "https://script.google.com/macros/d/DEPLOYMENT_ID/usercontent",
 *   "events": ["message.sent", "message.failed"]
 * }
 */

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    Logger.log("Webhook received:", payload);

    // Process based on event type
    switch (payload.event) {
      case "message.sent":
        handleMessageSent(payload.data);
        break;
      case "message.failed":
        handleMessageFailed(payload.data);
        break;
      case "message.delivered":
        handleMessageDelivered(payload.data);
        break;
      default:
        Logger.log("Unknown event:", payload.event);
    }

    return ContentService.createTextOutput("OK");
  } catch (error) {
    Logger.log("Error:", error);
    return ContentService.createTextOutput("ERROR", 400);
  }
}

function handleMessageSent(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Message Log");

  if (!sheet) return;

  sheet.appendRow([
    new Date(),
    "sent",
    data.to,
    data.type,
    data.waMessageId,
    JSON.stringify(data),
  ]);
}

function handleMessageFailed(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Message Log");

  if (!sheet) return;

  sheet.appendRow([
    new Date(),
    "failed",
    data.to,
    "unknown",
    data.messageId,
    data.error,
  ]);

  // Send alert email
  const email = Session.getActiveUser().getEmail();
  GmailApp.sendEmail(
    email,
    `❌ WhatsApp Message Failed`,
    `To: ${data.to}\nError: ${data.error}`,
  );
}

function handleMessageDelivered(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Message Log");

  if (!sheet) return;

  // Find and update existing row
  const range = sheet.getDataRange();
  const values = range.getValues();

  for (let i = 1; i < values.length; i++) {
    if (values[i][4] === data.waMessageId) {
      sheet.getRange(i + 1, 2).setValue("delivered");
      break;
    }
  }
}
```

---

## 🔐 SECURITY BEST PRACTICES

### Store Credentials Securely

**DON'T do this**:

```javascript
const JWT_TOKEN = "eyJ..."; // Hardcoded in script
const PASSWORD = "password123"; // Hardcoded
```

**DO this instead**:

```javascript
// Use Script Properties (encrypted by Google)
function saveCredentials() {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty("WA_JWT_TOKEN", "eyJ...");
  scriptProperties.setProperty("WA_SESSION_ID", "uuid...");
  // Don't store password! Get new token when needed
}

function getToken() {
  const scriptProperties = PropertiesService.getScriptProperties();
  let token = scriptProperties.getProperty("WA_JWT_TOKEN");

  if (!token) {
    // Get fresh token
    token = loginToWAGateway();
    scriptProperties.setProperty("WA_JWT_TOKEN", token);
  }

  return token;
}

function loginToWAGateway() {
  // Prompt user for password (won't be stored)
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    "Enter WA Gateway password:",
    ui.ButtonSet.OK_CANCEL,
  );

  if (response.getSelectedButton() === ui.Button.CANCEL) {
    throw new Error("Cancelled by user");
  }

  const password = response.getResponseText();

  const loginResponse = UrlFetchApp.fetch(
    "http://your-server:9090/api/v1/auth/login",
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        username: "admin",
        password: password,
      }),
      muteHttpExceptions: true,
    },
  );

  const result = JSON.parse(loginResponse.getContentText());
  return result.token;
}
```

### Verify Webhook Signatures

```javascript
function verifyWebhookSignature(payload, signature, secret) {
  const hmac = Utilities.computeHmacSignature(
    Utilities.MacAlgorithm.HMAC_SHA_256,
    payload,
    secret,
  );

  const computedSignature = Utilities.bytesToHex(hmac);

  return computedSignature === signature;
}

function doPost(e) {
  const payload = e.postData.contents;
  const signature = e.parameter["X-Webhook-Signature"];
  const secret =
    PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET");

  // Verify signature
  if (!verifyWebhookSignature(payload, signature, secret)) {
    return ContentService.createTextOutput("UNAUTHORIZED", 401);
  }

  // Process webhook
  const data = JSON.parse(payload);
  // ...
}
```

---

## 💡 ADVANCED EXAMPLES

### Example 1: Google Calendar Event Notification

```javascript
function notifyCalendarEventReminder() {
  const calendar = CalendarApp.getDefaultCalendar();
  const events = calendar.getEventsForDay(new Date());

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const title = event.getTitle();
    const phone = event.getDescription(); // Store phone in description

    if (phone) {
      const message = `⏰ Reminder: ${title}`;
      sendWhatsAppMessage(phone, message);
    }
  }
}
```

### Example 2: Gmail Label Trigger

```javascript
function notifyOnGmailLabel() {
  const label = GmailApp.getUserLabelByName("WhatsApp Alerts");
  const threads = label.getThreads(0, 10);

  for (let i = 0; i < threads.length; i++) {
    const thread = threads[i];
    const messages = thread.getMessages();

    for (let j = 0; j < messages.length; j++) {
      const message = messages[j];
      const subject = message.getSubject();
      const body = message.getPlainBody();

      // Extract phone from email body or subject
      const phone = extractPhoneNumber(subject + "\n" + body);

      if (phone) {
        const waMessage = `New email: ${subject}\n${body.substring(0, 100)}...`;
        sendWhatsAppMessage(phone, waMessage);
      }
    }
  }
}

function extractPhoneNumber(text) {
  const match = text.match(/(\d{10,}|\+\d{1,3}\d{9,})/);
  return match ? match[0] : null;
}
```

### Example 3: Google Analytics Reports

```javascript
function sendAnalyticsReport() {
  const analytics = GoogleAnalyticsAdmin;

  // Get yesterday's session count
  // (This example is pseudo-code - actual API varies)
  const report = analytics.getData({
    range: "yesterday",
  });

  const phone = "62812345678";
  const message = `📊 Analytics Report\nSessions: ${report.sessions}\nUsers: ${report.users}`;

  sendWhatsAppMessage(phone, message);
}
```

---

## 🐛 TROUBLESHOOTING

### Issue: "Authorization failed"

**Cause**: Invalid JWT token
**Solution**:

```javascript
// Clear cached token
PropertiesService.getScriptProperties().deleteProperty("WA_JWT_TOKEN");
// Get new token
const token = getToken();
```

### Issue: "Session not found"

**Cause**: Wrong SESSION_ID
**Solution**:

```javascript
// Get correct session ID
curl http://your-server:9090/api/v1/sessions \
  -H "Authorization: Bearer YOUR_TOKEN"
// Copy session ID and update in script
```

### Issue: "Invalid phone number"

**Cause**: Phone not in correct format
**Solution**: Ensure formatPhoneNumber() function is working

```javascript
Logger.log(formatPhoneNumber("0812345678")); // Should output: 6281234567890
```

### Issue: Messages not sending

**Cause**: Rate limiting
**Solution**:

```javascript
// Add delays between messages
Utilities.sleep(2000); // Wait 2 seconds
```

---

## ✅ TESTING CHECKLIST

- [ ] Updated WA_GATEWAY_URL to your server
- [ ] Updated JWT_TOKEN with valid token
- [ ] Updated SESSION_ID with valid session
- [ ] Tested sendWhatsAppMessage() with Ctrl+Enter
- [ ] Verified phone number formatting
- [ ] Created test Google Sheet
- [ ] Added test phone numbers
- [ ] Clicked "Send Messages" button
- [ ] Verified messages in WA Gateway queue
- [ ] Checked messages in WhatsApp

---

**Google Apps Script integration is now ready to use!**

# ClearPath AI — Voice Receptionist

Brand-new AI phone receptionist for small businesses.

- Answers inbound calls (via **Vapi**)
- Saves leads **during the call** (tool: `save_lead`)
- Emails the business (via **Resend**)
- Stores leads + call summaries in a simple dashboard

## Quick start (local)

### 1. Install

```powershell
cd C:\Users\cprat\OneDrive\ClearPathAI\voice-receptionist
npm install
copy .env.example .env
```

### 2. Fill in `.env`

Required for a real phone assistant:

- `VAPI_PRIVATE_KEY` — from [Vapi dashboard](https://dashboard.vapi.ai)
- `RESEND_API_KEY` — from [Resend](https://resend.com)
- `BUSINESS_NOTIFICATION_EMAIL` — where lead emails go
- `ADMIN_PASSWORD` — change from `change-me`

### 3. Run the server

```powershell
npm start
```

Open:

- Site: http://localhost:3003
- Dashboard: http://localhost:3003/dashboard

### 4. Expose a public HTTPS URL

Vapi cannot call `localhost`. Use one of:

- Deploy to Render (recommended), or
- `ngrok http 3003`

Then set:

```env
APP_BASE_URL=https://your-public-url
```

### 5. Create the Vapi assistant (fixes the old serverMessages issue)

```powershell
npm run setup:vapi
```

Copy the printed `VAPI_ASSISTANT_ID=...` into `.env`.

In Vapi → **Phone Numbers**, assign a number to that assistant.

### 6. Test

1. Dashboard → **Send test lead email** (checks Resend)
2. Call your Vapi number
3. Give name / phone / issue — a lead should appear mid-call
4. Hang up — call summary appears under **Recent calls**

## Webhook

`POST /webhooks/vapi`

Handles:

| Event | What happens |
|--------|----------------|
| `tool-calls` → `save_lead` | Saves lead + emails business immediately |
| `tool-calls` → `request_callback` | Flags urgent human follow-up |
| `end-of-call-report` | Saves transcript/summary + emails summary |

Optional: set `VAPI_WEBHOOK_SECRET` and the same secret on the Vapi server config.

## Sell as a subscription (next)

This MVP is single-tenant (one business via `.env`). To productize:

1. Add Stripe Customer + Subscription on signup
2. Create one Vapi assistant + phone number per customer
3. Store per-business config in a DB instead of `.env`
4. Price with included minutes + overage

## Project layout

```
voice-receptionist/
  server.js              Express app
  lib/store.js           JSON lead/call storage
  lib/email.js           Resend helpers
  lib/prompt.js          Receptionist system prompt + assistant config
  lib/vapi-webhook.js    Vapi event handlers
  scripts/setup-vapi.js  Create/update assistant via API
  public/                Landing + dashboard
```

# ClearPath AI — Voice Receptionist Demo

A single-file Node.js/Express webhook server (`server.js`) that receives Vapi
`end-of-call-report` events and emails a formatted call summary via Resend.
`vapi-assistant-config.json` holds the Vapi assistant definition (not loaded by
the server).

## Cursor Cloud specific instructions

- Runtime: Node.js (tested on v22). Install deps with `npm install`; run with
  `npm start` (`node server.js`). There is no build, lint, or test script.
- The server listens on `PORT` (default `3000`). Endpoints: `GET /` (health,
  returns `{"status":"ClearPath AI running"}`) and `POST /webhook/vapi` (Vapi
  webhook). Only messages with `type: "end-of-call-report"` trigger an email;
  other events return `{"received":true}`.
- Required env var: `RESEND_API_KEY`. It is read at module load and the Resend
  client throws `Missing API key` at startup if it is unset — the server will
  crash on boot without it. Set a value before `npm start`. Use a real key
  (format `re_...`) to actually deliver email; a placeholder lets the server
  boot and endpoints respond but email is not delivered.
- Gotcha: the Resend SDK v2 returns `{ data, error }` instead of throwing on API
  errors, and `server.js` only handles thrown errors. So `POST /webhook/vapi`
  can return `{"success":true}` even when the key is invalid and no email is
  actually sent. Verify real delivery by checking the Resend dashboard / inbox.
- This is a headless JSON API (no UI). Verify with `curl` against `GET /` and
  `POST /webhook/vapi`.

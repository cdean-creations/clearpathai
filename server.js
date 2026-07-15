require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");

const { listLeads, listCalls, saveLead } = require("./lib/store");
const { hasResendKey, sendLeadEmail } = require("./lib/email");
const { handleVapiMessage } = require("./lib/vapi-webhook");
const { buildSystemPrompt } = require("./lib/prompt");

const app = express();
const PORT = process.env.PORT || 3003;

const ADMIN_SESSION_COOKIE = "vr_admin_session";
const ADMIN_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const adminSessions = new Map();

function getBusiness() {
  return {
    name: process.env.BUSINESS_NAME || "North Texas Climate Control",
    phone: process.env.BUSINESS_PHONE || "(214) 555-0199",
    email: process.env.BUSINESS_EMAIL || "ops@example.com",
    address: process.env.BUSINESS_ADDRESS || "Dallas, TX",
    vertical: process.env.BUSINESS_VERTICAL || "HVAC",
    receptionistName: process.env.RECEPTIONIST_NAME || "Alex",
  };
}

function getAdminUsername() {
  return process.env.ADMIN_USERNAME || "admin";
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "change-me";
}

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  return header.split(";").reduce((cookies, part) => {
    const [name, ...valueParts] = part.trim().split("=");
    if (!name) return cookies;
    cookies[name] = decodeURIComponent(valueParts.join("="));
    return cookies;
  }, {});
}

function getAdminSessionToken(req) {
  return parseCookies(req)[ADMIN_SESSION_COOKIE] || null;
}

function isAdminAuthenticated(req) {
  const token = getAdminSessionToken(req);
  if (!token) return false;
  const session = adminSessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    adminSessions.delete(token);
    return false;
  }
  return true;
}

function requireAdmin(req, res, next) {
  if (!isAdminAuthenticated(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

function verifyVapiSecret(req) {
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (!secret) return true;
  const header = req.get("x-vapi-secret") || req.get("x-webhook-secret") || "";
  return header === secret;
}

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  const business = getBusiness();
  res.json({
    ok: true,
    service: "clearpath-voice-receptionist",
    business: business.name,
    receptionist: business.receptionistName,
    resendConfigured: hasResendKey(),
    vapiAssistantId: process.env.VAPI_ASSISTANT_ID || null,
    webhookPath: "/webhooks/vapi",
  });
});

app.get("/api/config", (_req, res) => {
  const business = getBusiness();
  res.json({
    business: {
      name: business.name,
      phone: business.phone,
      vertical: business.vertical,
      receptionistName: business.receptionistName,
    },
    vapiPublicKey: process.env.VAPI_PUBLIC_KEY || "",
    vapiAssistantId: process.env.VAPI_ASSISTANT_ID || "",
  });
});

app.post("/webhooks/vapi", async (req, res) => {
  if (!verifyVapiSecret(req)) {
    return res.status(401).json({ error: "Invalid webhook secret" });
  }

  try {
    const result = await handleVapiMessage(req.body, getBusiness());
    return res.status(200).json(result);
  } catch (err) {
    console.error("[webhook] error:", err);
    return res.status(200).json({
      results: [],
      error: err.message || "Webhook handler failed",
    });
  }
});

app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username !== getAdminUsername() || password !== getAdminPassword()) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = crypto.randomBytes(24).toString("hex");
  adminSessions.set(token, { expiresAt: Date.now() + ADMIN_SESSION_MAX_AGE_MS });
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(ADMIN_SESSION_MAX_AGE_MS / 1000)}`
  );
  return res.json({ ok: true });
});

app.post("/api/admin/logout", (req, res) => {
  const token = getAdminSessionToken(req);
  if (token) adminSessions.delete(token);
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
  return res.json({ ok: true });
});

app.get("/api/admin/session", (req, res) => {
  res.json({ authenticated: isAdminAuthenticated(req) });
});

app.get("/api/admin/leads", requireAdmin, (_req, res) => {
  res.json({ leads: listLeads() });
});

app.get("/api/admin/calls", requireAdmin, (_req, res) => {
  res.json({ calls: listCalls() });
});

app.post("/api/admin/test-lead", requireAdmin, async (req, res) => {
  const business = getBusiness();
  const lead = saveLead({
    name: req.body?.name || "Test Caller",
    phone: req.body?.phone || "(214) 555-0100",
    address: req.body?.address || business.address,
    issueType: req.body?.issueType || "AC not cooling — demo lead",
    urgency: req.body?.urgency || "normal",
    notes: "Created from dashboard test button",
    source: "manual-test",
  });

  try {
    const emailResult = await sendLeadEmail(lead, business);
    return res.json({ lead, email: emailResult });
  } catch (err) {
    return res.status(500).json({ lead, error: err.message });
  }
});

app.get("/api/admin/system-prompt", requireAdmin, (_req, res) => {
  res.type("text/plain").send(buildSystemPrompt(getBusiness()));
});

app.get(["/dashboard", "/dashboard.html"], (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.listen(PORT, () => {
  const business = getBusiness();
  console.log(`ClearPath Voice Receptionist running on http://localhost:${PORT}`);
  console.log(`Business: ${business.name} | Receptionist: ${business.receptionistName}`);
  console.log(`Webhook:  http://localhost:${PORT}/webhooks/vapi`);
  console.log(`Dashboard: http://localhost:${PORT}/dashboard`);
});

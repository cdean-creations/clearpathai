/**
 * Creates or updates a Vapi assistant with the correct webhook events.
 * Run: npm run setup:vapi
 *
 * Requires .env: VAPI_PRIVATE_KEY, APP_BASE_URL (public HTTPS URL in production)
 */
require("dotenv").config();

const { buildAssistantConfig } = require("../lib/prompt");

const VAPI_API = "https://api.vapi.ai";

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

function webhookUrl() {
  const base = (process.env.APP_BASE_URL || "http://localhost:3003").replace(/\/$/, "");
  return `${base}/webhooks/vapi`;
}

async function vapiRequest(method, path, body) {
  const key = process.env.VAPI_PRIVATE_KEY;
  if (!key || key.includes("your_")) {
    throw new Error("Set VAPI_PRIVATE_KEY in .env first (from https://dashboard.vapi.ai)");
  }

  const res = await fetch(`${VAPI_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`${method} ${path} failed (${res.status}): ${text}`);
  }
  return data;
}

async function main() {
  const business = getBusiness();
  const serverUrl = webhookUrl();
  const config = buildAssistantConfig({ business, serverUrl });

  console.log("Business:", business.name);
  console.log("Receptionist:", business.receptionistName);
  console.log("Webhook URL:", serverUrl);
  console.log("");

  if (serverUrl.includes("localhost")) {
    console.warn(
      "WARNING: Vapi cannot reach localhost. Deploy this app (e.g. Render) or use a tunnel (ngrok), then set APP_BASE_URL to that public HTTPS URL and re-run setup.\n"
    );
  }

  const existingId = process.env.VAPI_ASSISTANT_ID;
  let assistant;

  if (existingId) {
    console.log(`Updating existing assistant ${existingId}...`);
    assistant = await vapiRequest("PATCH", `/assistant/${existingId}`, config);
  } else {
    console.log("Creating new assistant...");
    assistant = await vapiRequest("POST", "/assistant", config);
  }

  console.log("\nAssistant ready:");
  console.log("  ID:", assistant.id);
  console.log("  Name:", assistant.name);
  console.log("  serverMessages:", JSON.stringify(assistant.serverMessages || []));
  console.log("  server.url:", assistant.server?.url || assistant.serverUrl || "(check dashboard)");
  console.log("\nAdd this to your .env file:");
  console.log(`VAPI_ASSISTANT_ID=${assistant.id}`);
  console.log("\nNext:");
  console.log("1. In Vapi dashboard → Phone Numbers → buy/assign a number to this assistant");
  console.log("2. Make sure APP_BASE_URL is your public Render/ngrok URL");
  console.log("3. Call the number and confirm a lead appears at /dashboard");
}

main().catch((err) => {
  console.error("\nSetup failed:", err.message);
  process.exit(1);
});

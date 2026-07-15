const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "..", "data");
const LEADS_FILE = path.join(DATA_DIR, "leads.json");
const CALLS_FILE = path.join(DATA_DIR, "calls.json");

function ensureStore(filePath) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]", "utf8");
  }
}

function readJson(filePath) {
  ensureStore(filePath);
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJson(filePath, data) {
  ensureStore(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function createId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function saveLead(input) {
  const leads = readJson(LEADS_FILE);
  const lead = {
    id: createId("lead"),
    createdAt: new Date().toISOString(),
    name: input.name || "",
    phone: input.phone || "",
    address: input.address || "",
    issueType: input.issueType || "",
    urgency: input.urgency || "normal",
    notes: input.notes || "",
    callId: input.callId || "",
    source: input.source || "voice",
    status: input.status || "new",
  };
  leads.unshift(lead);
  writeJson(LEADS_FILE, leads);
  return lead;
}

function listLeads() {
  return readJson(LEADS_FILE);
}

function saveCallReport(report) {
  const calls = readJson(CALLS_FILE);
  const existingIndex = calls.findIndex((c) => c.callId && c.callId === report.callId);
  if (existingIndex >= 0) {
    calls[existingIndex] = { ...calls[existingIndex], ...report, updatedAt: new Date().toISOString() };
  } else {
    calls.unshift({
      id: createId("call"),
      createdAt: new Date().toISOString(),
      ...report,
    });
  }
  writeJson(CALLS_FILE, calls);
  return calls[0];
}

function listCalls() {
  return readJson(CALLS_FILE);
}

function findLatestLeadByCallId(callId) {
  if (!callId) return null;
  const leads = readJson(LEADS_FILE);
  return leads.find((lead) => lead.callId === callId) || null;
}

module.exports = {
  saveLead,
  listLeads,
  saveCallReport,
  listCalls,
  findLatestLeadByCallId,
};

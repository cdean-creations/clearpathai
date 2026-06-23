```javascript
const express = require("express");
const { Resend } = require("resend");
const app = express();
app.use(express.json());

const CONFIG = {
demoEmail: "demo@northtexasclimatecontrol.com",
resendApiKey: process.env.RESEND_API_KEY,
port: process.env.PORT || 3000,
};

const resend = new Resend(CONFIG.resendApiKey);

function buildEmail(data) {
const {
callerName = "Unknown",
callerPhone = "Unknown",
issueType = "Unknown",
address = "Unknown",
urgency = "Unknown",
transcript = "No transcript available",
callDuration = "Unknown",
escalated = false,
timestamp = new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }),
} = data;

return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px">
<div style="background:white;border-radius:8px;padding:24px;max-width:600px;margin:auto;border:1px solid #ddd">
<div style="background:#1a4fa0;color:white;padding:16px;border-radius:8px 8px 0 0;margin:-24px -24px 24px">
<h2 style="margin:0">North Texas Climate Control</h2>
<p style="margin:4px 0 0;opacity:.85">Incoming Call Summary · ${timestamp}</p>
</div>
<p style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:bold;background:${escalated ? "#fff0f0" : "#f0fff4"};color:${escalated ? "#c0392b" : "#1a7a3a"};border:1px solid ${escalated ? "#e74c3c" : "#27ae60"}">
${escalated ? "⚠ Escalated to Live Technician" : "✓ Info Captured"}
</p>
<h3 style="color:#888;font-size:13px;text-transform:uppercase">Caller Info</h3>
<p><b>Name:</b> ${callerName}<br><b>Phone:</b> ${callerPhone}<br><b>Address:</b> ${address}</p>
<h3 style="color:#888;font-size:13px;text-transform:uppercase">Service Request</h3>
<p><b>Issue:</b> ${issueType}<br><b>Urgency:</b> ${urgency}<br><b>Call Duration:</b> ${callDuration}</p>
<h3 style="color:#888;font-size:13px;text-transform:uppercase">Transcript</h3>
<div style="background:#f9f9f9;border-left:3px solid #1a4fa0;padding:12px;font-size:13px;white-space:pre-wrap">${transcript}</div>
<p style="text-align:center;color:#aaa;font-size:12px;margin-top:24px">Powered by ClearPath AI</p>
</div>
</body>
</html>`;
}

app.post("/webhook/vapi", async (req, res) => {
const event = req.body;
if (event.message?.type !== "end-of-call-report") {
return res.status(200).json({ received: true });
}

const report = event.message;
const s = report.analysis?.structuredData || {};

const emailData = {
callerName: s.callerName,
callerPhone: s.callerPhone,
issueType: s.issueType,
address: s.address,
urgency: s.urgency,
escalated: s.escalated || false,
transcript: report.transcript,
callDuration: report.durationSeconds
? `${Math.round(report.durationSeconds / 60)} min ${report.durationSeconds % 60} sec`
: "Unknown",
timestamp: new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }),
};

const subject = emailData.escalated
? `⚠ URGENT: Transfer Requested — ${emailData.callerName} (${emailData.issueType})`
: `📋 New Call Summary — ${emailData.callerName} (${emailData.issueType})`;

try {
await resend.emails.send({
from: "noreply@resend.dev",
to: CONFIG.demoEmail,
subject,
html: buildEmail(emailData),
});
res.status(200).json({ success: true });
} catch (err) {
console.error("Resend error:", err);
res.status(500).json({ success: false, error: err.message });
}
});

app.get("/", (req, res) => res.json({ status: "ClearPath AI running" }));

app.listen(CONFIG.port, () => console.log(`Running on port ${CONFIG.port}`));

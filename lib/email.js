const { Resend } = require("resend");

function hasResendKey() {
  const key = process.env.RESEND_API_KEY;
  return Boolean(key && key !== "your_resend_key" && !key.includes("your_"));
}

function getResend() {
  if (!hasResendKey()) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

function fromAddress() {
  return process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
}

function notifyEmail() {
  return (
    process.env.BUSINESS_NOTIFICATION_EMAIL ||
    process.env.BUSINESS_EMAIL ||
    "hello@example.com"
  );
}

async function sendLeadEmail(lead, business) {
  const resend = getResend();
  const subject = `[${business.name}] New call lead — ${lead.name || "Unknown caller"} (${lead.urgency || "normal"})`;
  const html = `
    <h2>New lead from your AI receptionist</h2>
    <p><strong>Business:</strong> ${escapeHtml(business.name)}</p>
    <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
      <tr><td style="padding:6px 12px 6px 0"><strong>Name</strong></td><td>${escapeHtml(lead.name || "—")}</td></tr>
      <tr><td style="padding:6px 12px 6px 0"><strong>Phone</strong></td><td>${escapeHtml(lead.phone || "—")}</td></tr>
      <tr><td style="padding:6px 12px 6px 0"><strong>Address</strong></td><td>${escapeHtml(lead.address || "—")}</td></tr>
      <tr><td style="padding:6px 12px 6px 0"><strong>Issue</strong></td><td>${escapeHtml(lead.issueType || "—")}</td></tr>
      <tr><td style="padding:6px 12px 6px 0"><strong>Urgency</strong></td><td>${escapeHtml(lead.urgency || "normal")}</td></tr>
      <tr><td style="padding:6px 12px 6px 0"><strong>Notes</strong></td><td>${escapeHtml(lead.notes || "—")}</td></tr>
      <tr><td style="padding:6px 12px 6px 0"><strong>Call ID</strong></td><td>${escapeHtml(lead.callId || "—")}</td></tr>
    </table>
  `;

  if (!resend) {
    console.log("[email] Resend not configured — lead email skipped:", subject);
    return { skipped: true, subject };
  }

  const { data, error } = await resend.emails.send({
    from: `${business.name} Receptionist <${fromAddress()}>`,
    to: [notifyEmail()],
    subject,
    html,
  });

  if (error) {
    console.error("[email] Failed to send lead email:", error);
    throw new Error(typeof error === "string" ? error : error.message || "Email failed");
  }

  return { skipped: false, id: data?.id, subject };
}

async function sendCallSummaryEmail(report, business) {
  const resend = getResend();
  const subject = `[${business.name}] Call summary — ${report.callerPhone || "unknown number"}`;
  const html = `
    <h2>End-of-call summary</h2>
    <p><strong>Business:</strong> ${escapeHtml(business.name)}</p>
    <p><strong>Duration:</strong> ${escapeHtml(String(report.durationSeconds ?? "—"))}s</p>
    <p><strong>Ended reason:</strong> ${escapeHtml(report.endedReason || "—")}</p>
    <p><strong>Cost:</strong> $${escapeHtml(String(report.cost ?? "—"))}</p>
    <h3>Summary</h3>
    <p>${escapeHtml(report.summary || "No summary available.")}</p>
    <h3>Transcript</h3>
    <pre style="white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:12px;background:#f6f6f6;padding:12px;border-radius:8px">${escapeHtml(report.transcript || "No transcript.")}</pre>
  `;

  if (!resend) {
    console.log("[email] Resend not configured — call summary skipped:", subject);
    return { skipped: true, subject };
  }

  const { data, error } = await resend.emails.send({
    from: `${business.name} Receptionist <${fromAddress()}>`,
    to: [notifyEmail()],
    subject,
    html,
  });

  if (error) {
    console.error("[email] Failed to send call summary:", error);
    throw new Error(typeof error === "string" ? error : error.message || "Email failed");
  }

  return { skipped: false, id: data?.id, subject };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = {
  hasResendKey,
  sendLeadEmail,
  sendCallSummaryEmail,
};

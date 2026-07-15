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

function buildLeadDetailsHtml({ name, phone, address, issue }) {
  return `
    <table style="border-collapse:collapse;font-family:sans-serif;font-size:15px;line-height:1.4;margin:0 0 20px">
      <tr>
        <td style="padding:8px 16px 8px 0;vertical-align:top;color:#555"><strong>Name</strong></td>
        <td style="padding:8px 0">${escapeHtml(name || "—")}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px 8px 0;vertical-align:top;color:#555"><strong>Phone</strong></td>
        <td style="padding:8px 0">${escapeHtml(phone || "—")}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px 8px 0;vertical-align:top;color:#555"><strong>Address</strong></td>
        <td style="padding:8px 0">${escapeHtml(address || "—")}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px 8px 0;vertical-align:top;color:#555"><strong>Issue</strong></td>
        <td style="padding:8px 0">${escapeHtml(issue || "—")}</td>
      </tr>
    </table>
  `;
}

async function sendLeadEmail(lead, business) {
  const resend = getResend();
  const callerName = lead.name || "Unknown caller";
  const subject = `New lead: ${callerName}`;
  const html = `
    <h2 style="font-family:sans-serif;margin:0 0 12px">New call lead</h2>
    ${buildLeadDetailsHtml({
      name: lead.name,
      phone: lead.phone,
      address: lead.address,
      issue: lead.issueType,
    })}
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
  const callerName = report.name || "Unknown caller";
  const subject = `Call summary: ${callerName}`;
  const html = `
    <h2 style="font-family:sans-serif;margin:0 0 12px">Call summary</h2>
    ${buildLeadDetailsHtml({
      name: report.name,
      phone: report.phone || report.callerPhone,
      address: report.address,
      issue: report.issue,
    })}
    <h3 style="font-family:sans-serif;margin:0 0 8px">Summary</h3>
    <p style="font-family:sans-serif;font-size:15px;line-height:1.45;margin:0 0 20px">${escapeHtml(report.summary || "No summary available.")}</p>
    <h3 style="font-family:sans-serif;margin:0 0 8px">Transcript</h3>
    <pre style="white-space:pre-wrap;font-family:ui-monospace,Consolas,monospace;font-size:12px;background:#f6f6f6;padding:12px;border-radius:8px;margin:0">${escapeHtml(report.transcript || "No transcript.")}</pre>
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

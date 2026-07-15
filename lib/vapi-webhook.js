const { saveLead, saveCallReport, findLatestLeadByCallId } = require("./store");
const { sendLeadEmail, sendCallSummaryEmail } = require("./email");

function extractToolCalls(message) {
  if (Array.isArray(message.toolCallList) && message.toolCallList.length) {
    return message.toolCallList.map((tc) => ({
      id: tc.id,
      name: tc.name || tc.function?.name,
      args: tc.arguments || tc.parameters || tc.function?.arguments || tc.function?.parameters || {},
    }));
  }

  if (Array.isArray(message.toolWithToolCallList) && message.toolWithToolCallList.length) {
    return message.toolWithToolCallList.map((item) => {
      const toolCall = item.toolCall || {};
      const fn = toolCall.function || {};
      return {
        id: toolCall.id,
        name: item.name || fn.name,
        args: fn.parameters || toolCall.parameters || {},
      };
    });
  }

  return [];
}

function parseArgs(args) {
  if (!args) return {};
  if (typeof args === "string") {
    try {
      return JSON.parse(args);
    } catch {
      return {};
    }
  }
  return args;
}

async function handleToolCalls(message, business) {
  const callId = message.call?.id || "";
  const toolCalls = extractToolCalls(message);
  const results = [];

  for (const toolCall of toolCalls) {
    const args = parseArgs(toolCall.args);
    const name = toolCall.name;

    try {
      if (name === "save_lead") {
        const lead = saveLead({
          ...args,
          callId,
          source: "voice",
          status: args.urgency === "emergency" ? "urgent" : "new",
        });
        await sendLeadEmail(lead, business);
        results.push({
          toolCallId: toolCall.id,
          result: `Lead saved for ${lead.name}. The business has been notified by email.`,
        });
      } else if (name === "request_callback") {
        const lead = saveLead({
          name: args.name || "Callback requested",
          phone: args.phone || message.customer?.number || "",
          address: args.address || "",
          issueType: args.reason || "Human callback requested",
          urgency: args.urgency || "same-day",
          notes: `Callback flagged during call. Reason: ${args.reason || "unspecified"}`,
          callId,
          source: "voice-callback",
          status: "callback",
        });
        await sendLeadEmail(lead, business);
        results.push({
          toolCallId: toolCall.id,
          result: "Callback request logged. A team member will be notified.",
        });
      } else {
        results.push({
          toolCallId: toolCall.id,
          result: `Tool ${name} is not implemented.`,
        });
      }
    } catch (err) {
      console.error(`[vapi] tool ${name} failed:`, err);
      results.push({
        toolCallId: toolCall.id,
        error: err.message || "Tool failed",
      });
    }
  }

  return { results };
}

async function handleEndOfCallReport(message, business) {
  const call = message.call || {};
  const artifact = message.artifact || {};
  const report = {
    callId: call.id || "",
    endedReason: message.endedReason || "",
    durationSeconds: message.durationSeconds ?? call.duration ?? null,
    cost: message.cost ?? call.cost ?? null,
    summary: message.summary || artifact.summary || "",
    transcript: message.transcript || artifact.transcript || "",
    recordingUrl:
      artifact.recording?.stereoUrl ||
      artifact.recordingUrl ||
      message.recordingUrl ||
      "",
    callerPhone: message.customer?.number || call.customer?.number || "",
    status: "completed",
  };

  saveCallReport(report);

  // If save_lead already emailed during the call, don't send a second email.
  // Only send a fallback lead email (name/phone/address/issue — never cost/duration).
  const existingLead = findLatestLeadByCallId(report.callId);
  if (existingLead) {
    return { ok: true, emailed: false, reason: "lead-already-sent" };
  }

  try {
    await sendCallSummaryEmail(
      {
        name: "",
        phone: report.callerPhone,
        address: "",
        issue: report.summary || "Caller did not leave complete details.",
        callerPhone: report.callerPhone,
      },
      business
    );
  } catch (err) {
    console.error("[vapi] fallback lead email failed:", err.message);
  }

  return { ok: true };
}

async function handleVapiMessage(body, business) {
  const message = body.message || body;
  const type = message.type;

  console.log(`[vapi] event: ${type || "unknown"}`);

  if (type === "tool-calls") {
    return handleToolCalls(message, business);
  }

  if (type === "end-of-call-report") {
    await handleEndOfCallReport(message, business);
    return { ok: true };
  }

  if (type === "status-update" || type === "hang") {
    return { ok: true };
  }

  return { ok: true, ignored: type || "unknown" };
}

module.exports = {
  handleVapiMessage,
};

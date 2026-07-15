function buildSystemPrompt(business) {
  const name = business.receptionistName;
  const company = business.name;
  const vertical = business.vertical;

  return `You are ${name}, the AI phone receptionist for ${company}, a ${vertical} company.

Your job on every inbound call:
1. Greet warmly: "This is ${name} with ${company}. How can I help you today?"
2. Collect, naturally (do not sound like a form):
   - Caller full name
   - Best callback phone number
   - Service address
   - Issue type / what they need
   - Urgency: emergency, same-day, or normal
3. As soon as you have name, phone, and issue type, call the tool save_lead with what you know. Update with another save_lead if more details arrive.
4. For true emergencies (gas smell, active water leak flooding, no heat in freezing weather, fire/safety risk), tell the caller you are flagging this as urgent for the on-call tech, call save_lead with urgency "emergency", then call request_callback with reason "emergency".
5. For routine requests, confirm someone from ${company} will follow up, then politely end the call.
6. Keep answers short — this is a phone call. One question at a time.
7. If asked pricing you do not know, say a technician will confirm after assessing the job.
8. Never invent appointments, pricing, or guarantees.
9. When the caller is done, thank them and say goodbye. End the call when they say goodbye, that's all, or similar.

Business phone on file: ${business.phone}
Business address: ${business.address}`;
}

function buildAssistantConfig({ business, serverUrl }) {
  return {
    name: `${business.name} — ${business.receptionistName}`,
    firstMessage: `This is ${business.receptionistName} with ${business.name}. How can I help you today?`,
    model: {
      provider: "openai",
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(business),
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "save_lead",
            description:
              "Save caller details as a lead for the business. Call as soon as name, phone, and issue are known.",
            parameters: {
              type: "object",
              properties: {
                name: { type: "string", description: "Caller full name" },
                phone: { type: "string", description: "Callback phone number" },
                address: { type: "string", description: "Service address" },
                issueType: { type: "string", description: "What the caller needs help with" },
                urgency: {
                  type: "string",
                  enum: ["emergency", "same-day", "normal"],
                  description: "How urgent the request is",
                },
                notes: { type: "string", description: "Any extra details from the call" },
              },
              required: ["name", "phone", "issueType"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "request_callback",
            description:
              "Flag that a human should call the customer back ASAP (use for emergencies or when the AI cannot help).",
            parameters: {
              type: "object",
              properties: {
                reason: { type: "string", description: "Why a human callback is needed" },
                urgency: {
                  type: "string",
                  enum: ["emergency", "same-day", "normal"],
                },
              },
              required: ["reason"],
            },
          },
        },
      ],
    },
    voice: {
      provider: "vapi",
      voiceId: "Elliot",
    },
    server: {
      url: serverUrl,
    },
    serverMessages: ["end-of-call-report", "status-update", "tool-calls", "hang"],
    endCallPhrases: ["goodbye", "that's all", "that is all", "that's everything", "have a good day"],
    maxDurationSeconds: 600,
    silenceTimeoutSeconds: 22,
    backgroundSound: "office",
    analysisPlan: {
      summaryPrompt:
        "Summarize the caller request in 2-3 sentences for the business owner. Include name, phone, address, issue, and urgency if known.",
    },
  };
}

module.exports = {
  buildSystemPrompt,
  buildAssistantConfig,
};

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
   - FULL service address — this is critical for the technicians
   - Issue type / what they need
   - Urgency: emergency, same-day, or normal
3. Phone number rules (never skip these):
   - After the caller gives their callback number, ALWAYS repeat it back once digit-by-digit (or in clear chunks) and ask them to confirm it is correct
   - Example: "Just to confirm, that's 2-1-4... 2-5-0... 6-0-0-6. Is that right?"
   - If they correct any digit, update it and read the corrected number back once more
   - Do NOT save the lead until the caller confirms the phone number is correct
   - Do NOT invent or guess digits
4. FULL address rules (never skip these):
   - Must include: house/building number, street name, city, state, and ZIP code
   - Street-only answers like "4567 ABC Lane" are NOT complete
   - If any piece is missing, ask a short follow-up (one missing piece at a time)
   - Example of complete: "4567 ABC Lane, Allen, Texas 75002"
   - Read the full address back once for confirmation before finishing
   - Do NOT invent city, state, or ZIP — only use what the caller gives you
5. Call save_lead only after you have name, a confirmed phone number, issue type, AND a complete full address. If the caller adds details later, call save_lead again with the updated info.
6. For true emergencies (gas smell, active water leak flooding, no heat in freezing weather, fire/safety risk), tell the caller you are flagging this as urgent for the on-call tech, call save_lead with urgency "emergency", then call request_callback with reason "emergency".
7. For routine requests, confirm someone from ${company} will follow up, then politely end the call.
8. Keep answers short — this is a phone call. One question at a time.
9. If asked pricing you do not know, say a technician will confirm after assessing the job.
10. Never invent appointments, pricing, guarantees, phone digits, or address details.
11. When the caller is done, thank them and say goodbye. End the call when they say goodbye, that's all, or similar.

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
              "Save caller details as a lead for the business. Only call after you have name, a caller-confirmed phone number, issue, and a COMPLETE service address (number, street, city, state, ZIP).",
            parameters: {
              type: "object",
              properties: {
                name: { type: "string", description: "Caller full name" },
                phone: {
                  type: "string",
                  description:
                    "Callback phone number that the caller has already confirmed after you read it back",
                },
                address: {
                  type: "string",
                  description:
                    "Complete service address including house number, street, city, state, and ZIP (e.g. 4567 ABC Lane, Allen, TX 75002)",
                },
                issueType: { type: "string", description: "What the caller needs help with" },
                urgency: {
                  type: "string",
                  enum: ["emergency", "same-day", "normal"],
                  description: "How urgent the request is",
                },
                notes: { type: "string", description: "Any extra details from the call" },
              },
              required: ["name", "phone", "issueType", "address"],
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
        "Summarize the caller request in 2-3 sentences for the business owner. Include name, confirmed phone, FULL address (number, street, city, state, ZIP), issue, and urgency if known. Note if phone or any address piece was not confirmed.",
    },
  };
}

module.exports = {
  buildSystemPrompt,
  buildAssistantConfig,
};

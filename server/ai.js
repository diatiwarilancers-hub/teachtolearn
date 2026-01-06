import WebSocket from 'ws';
import dotenv from 'dotenv';

dotenv.config();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID;

// Gemini configuration for note generation
// IMPORTANT: set GEMINI_API_KEY in your .env (do NOT hardcode it in code)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_BASE =
  process.env.GEMINI_API_BASE ||
  "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MODEL =
  process.env.GEMINI_MODEL || "models/gemini-1.5-flash";

const defaultSystemPrompt =
  "You are a friendly educational AI learning companion for grades 6-10. " +
  "Have a natural conversation. Ask short questions to clarify. " +
  "When the student explains a concept, give feedback: praise 1 correct part, correct mistakes gently, then give 1-2 next steps. " +
  "Keep responses short (2-5 sentences).";

export async function callelevenlabs(userText, systemPromptOverride) {
  if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID) {
    throw new Error("ElevenLabs API credentials not configured. Please set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID in your .env file.");
  }

  console.log("📤 [ConvAI] Starting conversation with agent_id:", ELEVENLABS_AGENT_ID);
  console.log("📤 [ConvAI] User message:", userText);

  const wsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${encodeURIComponent(
    ELEVENLABS_AGENT_ID
  )}`;

  console.log("🔗 [ConvAI] WebSocket URL:", wsUrl.replace(ELEVENLABS_API_KEY, "***REDACTED***"));

  return await new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, {
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
    });

    let resolved = false;
    let conversationId = null;
    let agentResponse = null;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws.close();
        reject(new Error("Timed out waiting for agent response"));
      }
    }, 15000);

    ws.on("open", () => {
      console.log("✅ [ConvAI] WebSocket connection opened");
      ws.send(
        JSON.stringify({
          type: "conversation_initiation_client_data",
          conversation_config_override: {
            agent: {
              // Use the passed-in system prompt if provided; otherwise fall back
              prompt: { prompt: systemPromptOverride || defaultSystemPrompt },
              language: "en",
            },
          },
        })
      );
      console.log("📤 [ConvAI] Sent conversation_initiation_client_data");

      ws.send(
        JSON.stringify({
          type: "user_message",
          text: userText,
        })
      );
      console.log("📤 [ConvAI] Sent user_message");
    });

    ws.on("message", (raw) => {
      let msg;
      try { 
        msg = JSON.parse(raw.toString());
        console.log("📥 [ConvAI] Received message type:", msg?.type || "unknown");
      } catch (e) { 
        console.log("⚠️ [ConvAI] Failed to parse message:", raw.toString().substring(0, 200));
        return; 
      }

      // Capture conversation_id from various possible message types
      if (msg?.conversation_id && !conversationId) {
        conversationId = msg.conversation_id;
        console.log("✅ [ConvAI] Conversation created! conversation_id:", conversationId);
      } else if (msg?.conversation?.conversation_id && !conversationId) {
        conversationId = msg.conversation.conversation_id;
        console.log("✅ [ConvAI] Conversation created! conversation_id:", conversationId);
      } else if (msg?.conversation_initiation_server_data?.conversation_id && !conversationId) {
        conversationId = msg.conversation_initiation_server_data.conversation_id;
        console.log("✅ [ConvAI] Conversation created! conversation_id:", conversationId);
      }

      // Try multiple possible response formats for the agent's text response
      if (msg?.type === "agent_response" && msg?.agent_response_event?.agent_response) {
        agentResponse = msg.agent_response_event.agent_response;
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          ws.close();
          console.log("✅ [ConvAI] Got agent response (agent_response_event format)");
          if (conversationId) {
            console.log("✅ [ConvAI] Conversation persisted with ID:", conversationId);
          }
          resolve(agentResponse);
        }
      } else if (msg?.type === "agent_response" && msg?.agent_response) {
        agentResponse = msg.agent_response;
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          ws.close();
          console.log("✅ [ConvAI] Got agent response (direct agent_response format)");
          if (conversationId) {
            console.log("✅ [ConvAI] Conversation persisted with ID:", conversationId);
          }
          resolve(agentResponse);
        }
      } else if (msg?.response) {
        agentResponse = msg.response;
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          ws.close();
          console.log("✅ [ConvAI] Got agent response (response format)");
          if (conversationId) {
            console.log("✅ [ConvAI] Conversation persisted with ID:", conversationId);
          }
          resolve(agentResponse);
        }
      } else if (msg?.text) {
        agentResponse = msg.text;
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          ws.close();
          console.log("✅ [ConvAI] Got agent response (text format)");
          if (conversationId) {
            console.log("✅ [ConvAI] Conversation persisted with ID:", conversationId);
          }
          resolve(agentResponse);
        }
      }
    });

    ws.on("error", (err) => {
      console.error("❌ [ConvAI] WebSocket error:", err.message || err);
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    ws.on("close", (code, reason) => {
      console.log(`🔌 [ConvAI] WebSocket closed (code: ${code}, reason: ${reason?.toString() || "none"})`);
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        if (agentResponse) {
          console.log("✅ [ConvAI] Resolving with captured response");
          resolve(agentResponse);
        } else {
          reject(new Error("WebSocket closed before response"));
        }
      }
    });
  });
}

// Fetch the most recent conversation transcript from ElevenLabs ConvAI
// Returns: [{ role: "user" | "assistant", message: string }]
export async function getLatestConversationTranscript() {
  if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID) {
    throw new Error(
      "ElevenLabs API credentials not configured. Please set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID in your .env file."
    );
  }

  console.log("🔍 [Transcript] Fetching conversations for agent_id:", ELEVENLABS_AGENT_ID);

  // 1) List conversations for this agent
  const listUrl = `https://api.elevenlabs.io/v1/convai/conversations?agent_id=${encodeURIComponent(
    ELEVENLABS_AGENT_ID
  )}`;

  console.log("🔗 [Transcript] Requesting:", listUrl);

  const listRes = await fetch(listUrl, {
    method: "GET",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      Accept: "application/json",
    },
  });

  if (!listRes.ok) {
    const body = await listRes.text().catch(() => "");
    console.error("❌ [Transcript] Failed to list conversations:", listRes.status, body);
    throw new Error(
      `Failed to list ElevenLabs conversations (${listRes.status}): ${body}`
    );
  }

  const listData = await listRes.json().catch(() => ({}));
  console.log("📥 [Transcript] Raw API response keys:", Object.keys(listData));

  // Support multiple possible response shapes
  const conversations =
    (Array.isArray(listData) && listData) ||
    listData.conversations ||
    listData.items ||
    [];

  console.log(`📊 [Transcript] Found ${conversations.length} conversation(s)`);

  if (!Array.isArray(conversations) || conversations.length === 0) {
    console.log("⚠️ [Transcript] No conversations found for this agent");
    return [];
  }

  // Log all conversation IDs and timestamps for debugging
  conversations.forEach((conv, idx) => {
    const id = conv.conversation_id || conv.id || "unknown";
    const created = conv.created_at || "unknown";
    const updated = conv.updated_at || "unknown";
    console.log(`  [${idx}] conversation_id: ${id}, created_at: ${created}, updated_at: ${updated}`);
  });

  // 2) Pick the most recent conversation by creation time
  const sorted = conversations
    .slice()
    .sort((a, b) => {
      const aTime = Date.parse(a.created_at || a.updated_at || 0);
      const bTime = Date.parse(b.created_at || b.updated_at || 0);
      return bTime - aTime; // Most recent first
    });

  const latest = sorted[0] || conversations[0];
  const conversationId = latest.conversation_id || latest.id;

  if (!conversationId) {
    console.error("❌ [Transcript] Cannot identify conversation_id from latest conversation:", JSON.stringify(latest, null, 2));
    return [];
  }

  console.log("✅ [Transcript] Selected most recent conversation_id:", conversationId);
  console.log("📅 [Transcript] Conversation created_at:", latest.created_at || "unknown");
  console.log("📅 [Transcript] Conversation updated_at:", latest.updated_at || "unknown");

  // 3) Fetch full conversation details
  const detailUrl = `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(
    conversationId
  )}`;

  console.log("🔗 [Transcript] Fetching conversation details from:", detailUrl);

  const detailRes = await fetch(detailUrl, {
    method: "GET",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      Accept: "application/json",
    },
  });

  if (!detailRes.ok) {
    const body = await detailRes.text().catch(() => "");
    console.error("❌ [Transcript] Failed to fetch conversation details:", detailRes.status, body);
    throw new Error(
      `Failed to fetch ElevenLabs conversation (${detailRes.status}): ${body}`
    );
  }

  const detailData = await detailRes.json().catch(() => ({}));
  console.log("📥 [Transcript] Conversation detail keys:", Object.keys(detailData));

  // 4) Normalize messages into [{ role, message }]
  const rawMessages =
    detailData.messages ||
    detailData.history ||
    detailData.turns ||
    detailData.conversation ||
    detailData.transcript ||
    [];

  console.log(`📝 [Transcript] Found ${Array.isArray(rawMessages) ? rawMessages.length : 0} raw message(s)`);

  if (!Array.isArray(rawMessages)) {
    console.warn("⚠️ [Transcript] Messages field is not an array. Raw value:", typeof rawMessages);
    console.warn("⚠️ [Transcript] Full detailData structure:", JSON.stringify(detailData, null, 2).substring(0, 500));
    return [];
  }

  if (rawMessages.length === 0) {
    console.warn("⚠️ [Transcript] Conversation exists but has no messages");
    return [];
  }

  const transcript = rawMessages
    .map((m, idx) => {
      const roleRaw =
        m.role ||
        m.speaker ||
        (typeof m.is_user === "boolean"
          ? m.is_user
            ? "user"
            : "assistant"
          : undefined);

      const role =
        roleRaw === "user" || roleRaw === "assistant"
          ? roleRaw
          : roleRaw === "agent"
          ? "assistant"
          : "user";

      const message =
        m.text ||
        m.message ||
        m.content ||
        (typeof m === "string" ? m : "");

      if (!message) {
        console.warn(`⚠️ [Transcript] Message ${idx} has no text content:`, JSON.stringify(m).substring(0, 100));
        return null;
      }
      return { role, message };
    })
    .filter(Boolean);

  console.log(`✅ [Transcript] Normalized ${transcript.length} message(s) into transcript`);
  transcript.forEach((msg, idx) => {
    console.log(`  [${idx}] ${msg.role}: ${msg.message.substring(0, 50)}${msg.message.length > 50 ? "..." : ""}`);
  });

  return transcript;
}

// Generate structured notes from a normalized transcript using Gemini.
// Falls back to a simple heuristic summary if no Gemini key is configured.
export async function generateNotesFromTranscript(transcript) {
  if (!Array.isArray(transcript) || transcript.length === 0) {
    return "No conversation messages were found to summarize.";
  }

  // If no Gemini key is configured, use a simple placeholder summarizer
  if (!GEMINI_API_KEY) {
    console.warn(
      "GEMINI_API_KEY is not set. Falling back to basic on-server summarization."
    );
    return basicFallbackNotes(transcript);
  }

  const conversationText = transcript
    .map((m) => {
      const speaker = m.role === "assistant" ? "Tutor" : "Student";
      return `${speaker}: ${m.message}`;
    })
    .join("\n");

  const systemMessage =
    "You are an expert educational note-taking assistant for 6th–10th grade tutoring sessions. " +
    "Given a full dialogue between a student and a tutoring AI, you write clear, concise study notes.\n\n" +
    "Your notes must be structured into three sections with markdown headings:\n" +
    "1. Main Topics\n" +
    "2. Key Explanations & Insights\n" +
    "3. Action Items & Next Steps\n\n" +
    "Guidelines:\n" +
    "- Use bullet points, not paragraphs.\n" +
    "- Be concrete and specific (formulas, definitions, examples).\n" +
    "- If a section has no content, include the heading and write a single bullet like '- None discussed'.\n" +
    "- Do NOT add extra commentary or chatty language. Just the notes.";

  const url = `${GEMINI_API_BASE}/${encodeURIComponent(
    GEMINI_MODEL
  )}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  console.log("🤖 [Gemini] Calling Gemini API to generate notes...");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  systemMessage +
                  "\n\n---\n\n" +
                  "Transcript:\n\n" +
                  conversationText +
                  "\n\nWrite the structured notes now.",
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("❌ [Gemini] API error:", response.status, errText);
      const error = new Error(
        `Gemini notes generation failed (${response.status}): ${errText}`
      );
      error.responseStatus = response.status;
      throw error;
    }

    const data = await response.json().catch(() => ({}));

    // Gemini response shape:
    // { candidates: [ { content: { parts: [ { text: "..." } ] } } ] }
    const textFromGemini =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join("")
        .trim() || "";

    if (!textFromGemini) {
      console.error("❌ [Gemini] Empty response from Gemini");
      throw new Error("Gemini returned an empty response for notes.");
    }

    console.log("✅ [Gemini] Successfully generated notes from Gemini");
    return textFromGemini;
  } catch (err) {
    console.error("❌ [Gemini] Gemini notes generation error, falling back:", err);
    return basicFallbackNotes(transcript);
  }
}

// Very lightweight, non-LLM fallback summarizer that stays server-side.
function basicFallbackNotes(transcript) {
  const userMessages = transcript
    .filter((m) => m.role === "user")
    .map((m) => m.message);
  const assistantMessages = transcript
    .filter((m) => m.role === "assistant")
    .map((m) => m.message);

  const firstUser = userMessages[0] || "";
  const firstAssistant = assistantMessages[0] || "";
  const lastAssistant = assistantMessages[assistantMessages.length - 1] || "";

  const mainTopics =
    firstUser || firstAssistant
      ? `- Main question or topic: ${firstUser || firstAssistant}`
      : "- None discussed";

  const keyExplanation = lastAssistant
    ? `- Key explanation from tutor: ${lastAssistant}`
    : "- None discussed";

  const actionItem = userMessages.length
    ? "- Suggested next step: Review the main ideas from this conversation and practice with 1–2 example problems."
    : "- None discussed";

  return [
    "## Main Topics",
    mainTopics,
    "",
    "## Key Explanations & Insights",
    keyExplanation,
    "",
    "## Action Items & Next Steps",
    actionItem,
  ].join("\n");
}

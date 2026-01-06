import express from "express";
import {
  callelevenlabs,
  getLatestConversationTranscript,
  generateNotesFromTranscript,
} from "./ai.js";

const router = express.Router();

/* ---------------- CHAT ROUTE ---------------- */

router.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "Invalid messages array" });
    }

    const lastUserMessage = [...messages]
      .reverse()
      .find(m => m.role === "user");

    if (!lastUserMessage?.content) {
      return res.status(400).json({ message: "No user message found" });
    }

    const systemMessage =
      messages.find(m => m.role === "system")?.content || null;

    console.log("📩 Sending to ElevenLabs:", lastUserMessage.content);

    const reply = await callelevenlabs(
      lastUserMessage.content,
      systemMessage
    );

    res.json({ text: reply });

  } catch (err) {
    console.error("❌ /api/chat error:", err);
    res.status(500).json({
      message: "Failed to get AI response",
      details: err.message || String(err),
    });
  }
});

/* ---------------- GENERATE NOTES ROUTE ---------------- */

router.get("/generate-notes", async (req, res) => {
  try {
    console.log("📋 [Generate Notes] Starting notes generation...");
    const transcript = await getLatestConversationTranscript();

    if (!Array.isArray(transcript)) {
      console.error("❌ [Generate Notes] Transcript is not an array:", typeof transcript);
      return res.status(500).json({
        message: "Internal error: transcript format invalid",
      });
    }

    if (transcript.length === 0) {
      console.log("⚠️ [Generate Notes] No transcript found - no conversation exists yet");
      return res.status(400).json({
        message:
          "No recent conversation found. Teach the AI first to generate notes.",
      });
    }

    console.log(`📝 [Generate Notes] Generating notes from ${transcript.length} message(s)`);
    const notes = await generateNotesFromTranscript(transcript);

    if (!notes || typeof notes !== "string") {
      console.error("❌ [Generate Notes] Notes generation returned invalid format:", typeof notes);
      return res.status(500).json({
        message: "Notes generation failed unexpectedly",
      });
    }

    console.log("✅ [Generate Notes] Successfully generated notes");
    res.json({
      notes,
      source: "elevenlabs",
      messageCount: transcript.length,
    });

  } catch (err) {
    console.error("❌ [Generate Notes] Error:", err.message || err);
    console.error("❌ [Generate Notes] Stack:", err.stack);

    res.status(500).json({
      message: "Failed to generate notes from the latest conversation",
      details: err.message || String(err),
    });
  }
});

/* ---------------- FIREBASE CONFIG ROUTE ---------------- */

// Serve Firebase config to client (these values are public, but we load from env for consistency)
router.get("/firebase-config", (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBSFzIVTqrnq21jVG71XmUuN19s7g9pt2I",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "teachbackai-69ee6.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "teachbackai-69ee6",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "teachbackai-69ee6.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "930240111308",
    appId: process.env.FIREBASE_APP_ID || "1:930240111308:web:e477e73249eb2951b29869",
    // ElevenLabs agent ID (also public, used in HTML widget)
    elevenLabsAgentId: process.env.ELEVENLABS_AGENT_ID || ""
  });
});

export default router;

import { sendMessageToAI } from "./chat.js";

let recognition;
let isListening = false;

// State for notes generation
let hasChatted = false; // Track if at least one chat response has completed
let isGeneratingNotes = false; // Track if notes are being generated

// Conversation memory (OpenAI-style roles; your backend can convert)
const conversation = [
  {
    role: "system",
    content:
      "You are a friendly educational AI learning companion for grades 6-10. " +
      "Have a natural conversation. Ask short questions to clarify. " +
      "When the student explains a concept, give feedback: praise 1 correct part, correct mistakes gently, then give 1-2 next steps. " +
      "Keep responses short (2-5 sentences)."
  }
]

const micBtn = document.getElementById("micBtn");
const stopBtn = document.getElementById("stopBtn");
const status = document.getElementById("status");
const chatDisplay = document.getElementById("chatDisplay");
const leftEye = document.getElementById("leftEye");
const rightEye = document.getElementById("rightEye");

// Notes generation elements (will be null if not present in HTML)
const generateNotesBtn = document.getElementById("generateNotesBtn");
const notesDisplay = document.getElementById("notesDisplay");
const notesContent = document.getElementById("notesContent");
const notesLoading = document.getElementById("notesLoading");
const notesError = document.getElementById("notesError");

// ---------- Speech Recognition ----------
if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
  recognition = new (window.webkitSpeechRecognition || window.SpeechRecognition)();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onresult = async (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript?.trim();
    if (!transcript) return;

    addMessage(transcript, true);
    status.textContent = "Thinking...";

    // Add user message to conversation memory
    conversation.push({ role: "user", content: transcript });

    try {
      // Send full conversation so ElevenLabs can be contextual
      const aiText = await sendMessageToAI(conversation);

      // Add assistant message to memory
      conversation.push({ role: "assistant", content: aiText });

      addMessage(aiText, false);
      speak(aiText);
      status.textContent = "Listening...";
      
      // Mark that we've completed at least one chat exchange
      hasChatted = true;
      updateGenerateNotesButton();
    } catch (err) {
      console.error("AI error:", err);
      status.innerHTML =
        `⚠️ Server error. <br><small>${escapeHtml(err.message || String(err))}</small>`;
      speak("Sorry, I hit an error. Please try again.");
    }
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error", event.error);
    if (event.error === "not-allowed") {
      status.innerHTML =
        '🎤 Microphone access denied. <br><small>Please allow microphone access in your browser settings</small>';
    } else {
      status.textContent = "Speech error: " + event.error;
    }
  };

  recognition.onend = () => {
    // If user still wants to listen, restart (helps keep it continuous)
    if (isListening) {
      try { recognition.start(); } catch {}
    }
  };
} else {
  status.textContent = "Speech recognition not supported. Use Chrome/Edge/Safari.";
  micBtn.disabled = true;
}

// ---------- TTS ----------
function speak(text) {
  if (!text) return;

  // Stop any ongoing speech so it feels fast
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1.05;
  utterance.volume = 1;

  utterance.onstart = () => {
    leftEye.classList.add("talking");
    rightEye.classList.add("talking");
  };

  utterance.onend = () => {
    leftEye.classList.remove("talking");
    rightEye.classList.remove("talking");
  };

  window.speechSynthesis.speak(utterance);
}

// ---------- UI helpers ----------
function addMessage(text, isUser = false) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${isUser ? "user-message" : "bot-message"}`;
  messageDiv.textContent = text;
  chatDisplay.appendChild(messageDiv);
  chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------- Buttons ----------
micBtn.addEventListener("click", () => {
  if (isListening) return;

  isListening = true;
  micBtn.classList.add("listening");
  micBtn.textContent = "Listening...";
  stopBtn.style.display = "inline-block";

  // First bot message (NOT hardcoded steps; just a normal opener)
  const greeting =
    "Hi! Tell me what you're studying today, and then explain it in your own words. I'll help you improve it.";
  addMessage(greeting, false);
  speak(greeting);

  status.textContent = "Listening...";
  try { recognition.start(); } catch {}
});

stopBtn.addEventListener("click", () => {
  isListening = false;
  micBtn.classList.remove("listening");
  micBtn.textContent = "Start Listening";
  stopBtn.style.display = "none";
  status.textContent = "Stopped.";

  try { recognition.stop(); } catch {}
  window.speechSynthesis.cancel();
});

// ---------- Notes Generation ----------

// Update button state based on whether user has chatted
function updateGenerateNotesButton() {
  if (generateNotesBtn) {
    generateNotesBtn.disabled = !hasChatted || isGeneratingNotes;
  }
}

// Generate notes from the latest conversation
async function generateNotes() {
  if (isGeneratingNotes || !hasChatted) {
    return;
  }

  isGeneratingNotes = true;
  updateGenerateNotesButton();

  // Show loading state
  if (notesLoading) notesLoading.style.display = "block";
  if (notesError) notesError.style.display = "none";
  if (notesContent) notesContent.style.display = "none";
  if (notesDisplay) notesDisplay.style.display = "block";
  if (generateNotesBtn) {
    generateNotesBtn.textContent = "Generating notes...";
  }

  try {
    const response = await fetch("/api/generate-notes", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle error response
      const errorMessage = data.message || "Failed to generate notes";
      
      // Check if it's the "no conversation" error
      if (errorMessage.includes("Teach the AI first") || errorMessage.includes("No recent conversation")) {
        if (notesError) {
          notesError.textContent = "Teach the AI first, then generate notes.";
          notesError.style.display = "block";
        }
      } else {
        if (notesError) {
          notesError.textContent = errorMessage;
          notesError.style.display = "block";
        }
      }
      
      if (notesLoading) notesLoading.style.display = "none";
      return;
    }

    // Success - display notes
    const { notes, source, messageCount } = data;
    
    if (notesContent) {
      // Format notes (preserve markdown line breaks)
      notesContent.textContent = notes;
      notesContent.style.display = "block";
    }
    
    if (notesLoading) notesLoading.style.display = "none";
    if (notesError) notesError.style.display = "none";
    
    // Show metadata if available
    if (notesDisplay && messageCount) {
      const meta = notesDisplay.querySelector(".notes-meta");
      if (meta) {
        meta.textContent = `Generated from ${messageCount} message(s) • Source: ${source}`;
      }
    }

  } catch (err) {
    console.error("Error generating notes:", err);
    if (notesError) {
      notesError.textContent = "Failed to generate notes. Please try again.";
      notesError.style.display = "block";
    }
    if (notesLoading) notesLoading.style.display = "none";
  } finally {
    isGeneratingNotes = false;
    updateGenerateNotesButton();
    if (generateNotesBtn) {
      generateNotesBtn.textContent = "Automates Learning Notes";
    }
  }
}

// Wire up the button if it exists
if (generateNotesBtn) {
  generateNotesBtn.addEventListener("click", generateNotes);
  updateGenerateNotesButton(); // Set initial state
} 
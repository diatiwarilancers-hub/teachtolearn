// Function to send messages to the AI backend (ElevenLabs via server)
export async function sendMessageToAI(conversation) {
  try {
    console.log('🔗 Calling /api/chat endpoint (ElevenLabs backend)');
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: conversation }),
    });

    console.log('📡 Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Server error: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Received response from ElevenLabs backend:', data);
    return data.text || 'Sorry, I did not get a response.';
  } catch (error) {
    console.error('❌ Error sending message to AI (ElevenLabs backend):', error);
    throw error;
  }
}

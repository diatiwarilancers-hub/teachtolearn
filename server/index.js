import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import chatRoutes from './routes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes (before static files)
app.use('/api', chatRoutes);

// Serve landing.html for root path (teammates' frontend) - BEFORE static middleware
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/pages/landing.html'));
});

// Serve static files from client folder (but disable index.html auto-serving)
app.use(express.static(path.join(__dirname, '../client'), { index: false }));

// Serve pages from pages directory
app.get('/pages/:page', (req, res) => {
  const page = req.params.page;
  const filePath = path.join(__dirname, '../client/pages', `${page}.html`);
  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).send('Page not found');
    }
  });
});

// Fallback: serve landing.html for any other routes (for SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/pages/landing.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔑 ElevenLabs API Key: ${process.env.ELEVENLABS_API_KEY ? '✅ Loaded' : '❌ Missing'}`);
  console.log(`🤖 ElevenLabs Agent ID: ${process.env.ELEVENLABS_AGENT_ID ? '✅ Loaded' : '❌ Missing'}`);

});
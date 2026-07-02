import express from 'express';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { google } from 'googleapis';
import { GoogleGenAI } from '@google/genai';
import { getApps, initializeApp, getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    projectId: 'automatic-reason-5qmt3'
  });
}

const dbId = 'ai-studio-archeus-7a86ed20-6e3b-4a1c-9021-496374f83808';
let db: any;
try {
  db = getFirestore(getApp(), dbId);
} catch (e) {
  db = getFirestore();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());
  app.use(cookieParser(process.env.SESSION_SECRET || 'super-secret-key-for-dev'));

  // Initialize Gemini
  let ai: GoogleGenAI;
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  // --- API Routes ---
  
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Chat endpoint
  app.post('/api/chat', async (req, res) => {
    try {
      const { messages, thinking } = req.body;
      const accessToken = req.headers.authorization?.split('Bearer ')[1];
      
      if (!ai) {
        return res.status(500).json({ error: 'Gemini API not configured' });
      }

      // We'll use gemini-3.1-pro-preview with thinking for complex, otherwise gemini-3.5-flash
      const modelName = thinking ? 'gemini-3.1-pro-preview' : 'gemini-3.5-flash';
      const config: any = {
        systemInstruction: "You are Archeus, a sharp executive assistant. You manage Gmail and Google Calendar. Always confirm destructive actions (sending, deleting, scheduling) with the user before executing. Never guess ambiguous times. You have tools to search, read, send emails, and manage calendar events. When the user asks you to do something, use your tools to perform the task if you have them, otherwise explain.",
        tools: [{
          functionDeclarations: [
            {
              name: 'gmail_search',
              description: 'Search the user inbox using standard Gmail search operators (e.g. from:someone@example.com is:unread).',
              parameters: {
                type: 'OBJECT',
                properties: { query: { type: 'STRING' } },
                required: ['query']
              }
            },
            {
              name: 'gmail_read',
              description: 'Read a specific email thread by its ID.',
              parameters: {
                type: 'OBJECT',
                properties: { id: { type: 'STRING' } },
                required: ['id']
              }
            },
            {
              name: 'calendar_list',
              description: 'List upcoming events from the primary calendar.',
              parameters: {
                type: 'OBJECT',
                properties: { maxResults: { type: 'NUMBER' } },
                required: []
              }
            },
            {
              name: 'calendar_create',
              description: 'Draft a calendar event. You MUST confirm with the user before finalizing.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  summary: { type: 'STRING' },
                  start: { type: 'STRING', description: 'ISO string date time' },
                  end: { type: 'STRING', description: 'ISO string date time' }
                },
                required: ['summary', 'start', 'end']
              }
            }
          ]
        }]
      };

      if (thinking && modelName === 'gemini-3.1-pro-preview') {
        config.thinkingConfig = { thinkingLevel: 'HIGH' }; // Add thinking logic
      }

      // Convert frontend messages to Gemini format (user vs model)
      // Since function calling might take multiple turns, we'll handle a single turn loop here
      // For simplicity in a single request, we just pass the history and generate content.
      // But we need to execute tools!
      
      // Let's do a simple generateContent, and if it returns function calls, execute them and generate again.
      // We will implement a small loop.
      let currentMessages = [...messages];
      let hasMoreTurns = true;
      let finalResponseText = '';

      const oauth2Client = new google.auth.OAuth2();
      if (accessToken) oauth2Client.setCredentials({ access_token: accessToken });
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      let turnCount = 0;
      while (hasMoreTurns && turnCount < 5) {
        turnCount++;
        const response = await ai.models.generateContent({
          model: modelName,
          contents: currentMessages.map((m: any) => ({
            role: m.role,
            parts: typeof m.content === 'string' ? [{ text: m.content }] : m.content
          })),
          config
        });

        if (response.functionCalls && response.functionCalls.length > 0) {
          // Add model's function call request to history
          currentMessages.push({
            role: 'model',
            content: [{ functionCall: response.functionCalls[0] }]
          });

          const call = response.functionCalls[0];
          let functionResponse: any = {};
          
          if (!accessToken) {
            functionResponse = { error: "User is not authenticated with Google Workspace. Please sign in." };
          } else {
            try {
              if (call.name === 'gmail_search') {
                const queryStr = call.args.query as string;
                const res = await gmail.users.messages.list({ userId: 'me', q: queryStr, maxResults: 5 });
                functionResponse = { messages: res.data.messages || [] };
              } else if (call.name === 'gmail_read') {
                const idStr = call.args.id as string;
                const res = await gmail.users.messages.get({ userId: 'me', id: idStr });
                functionResponse = { snippet: res.data.snippet, payload: res.data.payload };
              } else if (call.name === 'calendar_list') {
                const maxRes = call.args.maxResults as number || 5;
                const res = await calendar.events.list({
                  calendarId: 'primary',
                  timeMin: new Date().toISOString(),
                  maxResults: maxRes,
                  singleEvents: true,
                  orderBy: 'startTime'
                });
                functionResponse = { events: res.data.items?.map(i => ({ summary: i.summary, start: i.start?.dateTime, end: i.end?.dateTime })) };
              } else if (call.name === 'calendar_create') {
                // Return drafted details back to model to ask user
                functionResponse = { status: 'Draft ready. Ask user to confirm.', draftedArgs: call.args };
              } else {
                functionResponse = { error: 'Unknown function' };
              }
            } catch (err: any) {
              functionResponse = { error: err.message };
            }
          }

          // Add function response to history
          currentMessages.push({
            role: 'user', // According to docs, function responses are provided as 'user' role with functionResponse part
            content: [{ functionResponse: { name: call.name, response: functionResponse } }]
          });
        } else {
          finalResponseText = response.text || '';
          hasMoreTurns = false;
          
          // Log to Firestore Audit Log
          try {
            await db.collection('audit_logs').add({
              timestamp: FieldValue.serverTimestamp(),
              action: 'chat_turn',
              userId: 'anonymous', // we can extract user ID if passed
              model: modelName,
              responseText: finalResponseText
            });
          } catch (e) {
            console.error("Audit log error:", e);
          }
        }
      }

      res.json({ text: finalResponseText, messages: currentMessages });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

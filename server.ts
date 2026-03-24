import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gemini API Endpoint
  app.post('/api/extract', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `请分析以下媒体报道的URL内容，并提取相关信息：${url}。
        请务必根据链接中的实际内容进行分析，不要凭空想象。
        如果是视频，请注明。
        请返回JSON格式，包含：title (标题), summary (100字以内的摘要), type (text, image-text, media-draft, video), category (disease, vaccine, video, shingles-month, other), source (媒体来源), publishDate (发布日期 YYYY-MM-DD)。`,
        config: {
          tools: [{ urlContext: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["text", "image-text", "media-draft", "video"] },
              category: { type: Type.STRING, enum: ["disease", "vaccine", "video", "shingles-month", "other"] },
              source: { type: Type.STRING },
              publishDate: { type: Type.STRING }
            },
            required: ["title", "summary", "type", "category", "source", "publishDate"]
          }
        }
      });

      res.json(JSON.parse(response.text));
    } catch (error: any) {
      console.error('Gemini API Error:', error);
      res.status(500).json({ error: error.message || 'Failed to extract article info' });
    }
  });

  // Vite middleware for development
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

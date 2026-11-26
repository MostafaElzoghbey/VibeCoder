import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import type { File, Plan } from "./types.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SYSTEM_INSTRUCTION_CODER = `
You are VibeCoder, an expert senior React frontend engineer. Your task is to generate production-ready, highly aesthetic React components based on user prompts.

RULES:
1.  **Component Structure:**
    *   **Folder Structure:** Organize code into folders:
        *   \`components/ui/\`: Reusable UI components (Button, Card, Input, etc.).
        *   \`components/\`: Feature-specific components.
        *   \`lib/\`: Utility functions.
        *   \`hooks/\`: Custom React hooks.
        *   \`types/\`: TypeScript interfaces/types.
    *   **Entry Point:** \`App.tsx\` is the entry point.
    *   **Imports:** Use relative paths (e.g., \`import { Button } from './components/ui/Button';\`).

2.  **Styling & Utilities:** 
    *   **Tailwind CSS:** Use for all styling.
    *   **Utils:** A \`cn()\` utility is available in \`lib/utils.ts\`. ALWAYS use it for merging classes.
        *   Import: \`import { cn } from '../../lib/utils';\` (adjust path as needed).
        *   Usage: \`className={cn("base-classes", className)}\`.
    *   **Icons:** Use \`lucide-react\`.

3.  **Available Libraries:** 
    *   \`react\`, \`react-dom\`, \`lucide-react\`, \`clsx\`, \`tailwind-merge\`, \`@headlessui/react\`.
    *   Do NOT import other external libraries.

4.  **Response Format:**
    *   Start with a brief explanation of what you changed/created in this step.
    *   **CRITICAL:** You MUST use the following XML format for ALL code changes. Do NOT use standard markdown code blocks (\`\`\`tsx).
    *   **To Create or Update a File:**
        <file name="path/to/file.tsx">
        // Full file content here
        </file>
    *   **To Delete a File:**
        <delete name="path/to/file.tsx" />
    *   Ensure file names are accurate (include folders) and imports match the file structure.

5.  **Context:**
    *   You may be executing a single step of a larger plan. Focus on implementing exactly what the current step requires, while maintaining integrity with existing code.
`;

const SYSTEM_INSTRUCTION_PLANNER = `
You are a Senior Technical Project Manager. Your goal is to break down a user's request into a series of logical, sequential development steps (phases) for a React/Tailwind web application.

RULES:
1.  **Analyze the Request:** Understand the scope (e.g., Landing Page, Dashboard, Chat App).
2.  **Break Down:** Create 2-4 distinct, concise phases.
    *   Phase 1 is usually scaffolding (basic layout, core UI components).
    *   Middle phases build specific features.
    *   Final phase is polish and integration.
3.  **Format:** Return ONLY a JSON object with the following structure:
    {
      "title": "Short title for the project plan",
      "steps": [
        { "id": 1, "title": "Short Step Title", "description": "Clear, concise instructions for the developer to implement this step." }
      ]
    }
4.  **Constraint:** Do not write code. Only write the plan in JSON.
`;

let aiClient: GoogleGenAI | null = null;

function getAI() {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      const isTransient = /429|500|503|UNAVAILABLE|RESOURCE_EXHAUSTED|DEADLINE_EXCEEDED/i.test(msg);
      if (!isTransient || attempt === maxRetries) {
        throw error;
      }
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastError;
}

interface ContentTurn {
  role: string;
  parts: { text: string }[];
}

function normalizeContents(history: ContentTurn[], finalUserText: string): ContentTurn[] {
  const combined: ContentTurn[] = [];
  for (const item of history) {
    if (!item || !item.parts || item.parts.length === 0) continue;
    const role = item.role === "model" ? "model" : "user";
    const text = item.parts.map((p) => p.text || "").join("\n").trim();
    if (!text) continue;
    const prev = combined[combined.length - 1];
    if (prev && prev.role === role) {
      prev.parts[0].text += "\n\n" + text;
    } else {
      combined.push({ role, parts: [{ text }] });
    }
  }

  while (combined.length > 0 && combined[0].role === "model") {
    combined.shift();
  }

  const prev = combined[combined.length - 1];
  if (prev && prev.role === "user") {
    prev.parts[0].text += "\n\n" + finalUserText;
  } else {
    combined.push({ role: "user", parts: [{ text: finalUserText }] });
  }

  return combined;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  app.post("/api/plan", async (req, res) => {
    try {
      const { prompt, files = [] } = req.body as { prompt?: string; files?: File[] };
      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "Prompt is required." });
      }

      const ai = getAI();
      const fileSummary = files
        .filter((f) => !f.name.endsWith(".keep"))
        .map((f) => f.name)
        .join(", ");

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: "gemini-4-hydrogen",
          contents: [
            {
              role: "user",
              parts: [{ text: `Current Files: ${fileSummary}\n\nUser Request: ${prompt}` }],
            },
          ],
          config: {
            systemInstruction: SYSTEM_INSTRUCTION_PLANNER,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                steps: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.INTEGER },
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                    },
                    required: ["id", "title", "description"],
                  },
                },
              },
              required: ["title", "steps"],
            },
          },
        })
      );

      const text = (response.text ?? "{}").trim();
      const parsed = JSON.parse(text) as Plan;

      if (!parsed.steps || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
        return res.json({
          title: parsed.title || "Implementation Plan",
          steps: [{ id: 1, title: "Implement Changes", description: prompt, status: "pending" }],
        });
      }

      parsed.steps = parsed.steps.map((s, idx) => ({
        ...s,
        id: s.id ?? idx + 1,
        status: "pending",
      }));

      return res.json(parsed);
    } catch (error) {
      console.error("Plan Generation Error:", error);
      const message = error instanceof Error ? error.message : "Failed to generate project plan.";
      return res.status(500).json({ error: message });
    }
  });

  app.post("/api/generate", async (req, res) => {
    try {
      const { prompt, history = [], files = [] } = req.body as {
        prompt?: string;
        history?: ContentTurn[];
        files?: File[];
      };

      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "Prompt is required." });
      }

      const ai = getAI();
      const validFiles = files.filter((f) => !f.name.endsWith(".keep"));
      const fileContext =
        validFiles.length > 0
          ? `\n\n--- CURRENT PROJECT STATE ---\nThe following files exist in the project. Use this context to understand the current codebase. ONLY return files that need to be modified or created.\n\n${validFiles
              .map((f) => `<file_context name="${f.name}">\n${f.content}\n</file_context>`)
              .join("\n\n")}\n--- END OF PROJECT STATE ---\n`
          : "";

      const contents = normalizeContents(history, prompt + fileContext);

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: "gemini-4-hydrogen",
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION_CODER,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        })
      );

      const text = response.text || "";

      const parsedFiles: File[] = [];
      const filesToDelete: string[] = [];

      const fileRegex = /<file\s+name=["']([^"']+)["']\s*>([\s\S]*?)<\/file>/g;
      const deleteRegex = /<delete\s+name=["']([^"']+)["']\s*\/?>/g;

      let match: RegExpExecArray | null;
      while ((match = fileRegex.exec(text)) !== null) {
        const name = match[1].trim();
        const content = match[2].trim();
        parsedFiles.push({
          name,
          language: name.endsWith(".json") ? "json" : "typescript",
          content,
        });
      }

      let deleteMatch: RegExpExecArray | null;
      while ((deleteMatch = deleteRegex.exec(text)) !== null) {
        filesToDelete.push(deleteMatch[1].trim());
      }

      if (parsedFiles.length === 0 && filesToDelete.length === 0) {
        const codeBlockRegex = /```(?:tsx|ts|jsx|js)?\s*([\s\S]*?)```/g;
        const codeMatch = codeBlockRegex.exec(text);
        if (codeMatch && codeMatch[1]) {
          parsedFiles.push({
            name: "App.tsx",
            language: "typescript",
            content: codeMatch[1].trim(),
          });
        }
      }

      const explanation = text
        .replace(/<file\s+name=["'][^"']+["']\s*>[\s\S]*?<\/file>/g, "")
        .replace(/<delete\s+name=["'][^"']+["']\s*\/?>/g, "")
        .replace(/```(?:tsx|ts|jsx|js)?[\s\S]*?```/g, "")
        .trim();

      return res.json({
        files: parsedFiles,
        filesToDelete,
        explanation,
      });
    } catch (error) {
      console.error("Code Generation Error:", error);
      const message = error instanceof Error ? error.message : "Failed to generate code.";
      return res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("/{*path}", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
  });
}

startServer();

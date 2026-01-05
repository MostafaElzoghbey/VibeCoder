import { GoogleGenAI } from "@google/genai";
import { GeneratedCode, File, Plan, Step } from "../types";

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
2.  **Break Down:** Create 2-5 distinct phases.
    *   Phase 1 is usually scaffolding (basic layout, routing, core UI components).
    *   Middle phases build specific features.
    *   Final phase is usually polish, assembly, or final integration.
3.  **Format:** Return ONLY a JSON object with the following structure:
    {
      "title": "Short title for the project plan",
      "steps": [
        { "id": 1, "title": "Short Step Title", "description": "Detailed instructions for the developer to implement this step." },
        ...
      ]
    }
4.  **Constraint:** Do not write code. Only write the plan in JSON.
`;

let client: GoogleGenAI | null = null;

const getClient = () => {
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return client;
};

export const generateProjectPlan = async (
  prompt: string,
  files: File[]
): Promise<Plan> => {
  const ai = getClient();
  const modelId = 'gemini-3-pro-preview';

  // Provide high-level file context so the planner knows what already exists
  const fileSummary = files.map(f => f.name).join(', ');

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: [
        { role: 'user', parts: [{ text: `Current Files: ${fileSummary}\n\nUser Request: ${prompt}` }] }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_PLANNER,
        responseMimeType: "application/json",
      }
    });

    const text = response.text || '{}';
    const plan = JSON.parse(text) as Plan;
    
    // Add default status
    plan.steps = plan.steps.map(s => ({ ...s, status: 'pending' }));
    
    return plan;
  } catch (error) {
    console.error("Plan Generation Error:", error);
    // Fallback plan if JSON parsing fails
    return {
      title: "Quick Implementation",
      steps: [
        { id: 1, title: "Implement Changes", description: prompt, status: 'pending' }
      ]
    };
  }
};

export const generateCodeFromPrompt = async (
  prompt: string,
  history: { role: string; parts: { text: string }[] }[] = [],
  files: File[] = []
): Promise<GeneratedCode> => {
  const ai = getClient();
  const modelId = 'gemini-3-pro-preview';

  const fileContext = files.length > 0
    ? `\n\n--- CURRENT PROJECT STATE ---\nThe following files exist in the project. Use this context to understand the current codebase. ONLY return files that need to be modified or created.\n\n${files.map(f => `<file_context name="${f.name}">\n${f.content}\n</file_context>`).join('\n\n')}\n--- END OF PROJECT STATE ---\n`
    : '';

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: [
        ...history, 
        { role: 'user', parts: [{ text: prompt + fileContext }] }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_CODER,
        temperature: 0.7,
      }
    });

    const text = response.text || '';
    
    const files: File[] = [];
    const filesToDelete: string[] = [];

    const fileRegex = /<file name="([^"]+)">([\s\S]*?)<\/file>/g;
    const deleteRegex = /<delete name="([^"]+)"\s*\/>/g;
    
    let match;
    while ((match = fileRegex.exec(text)) !== null) {
        const [fullMatch, name, content] = match;
        files.push({
            name: name.trim(),
            language: name.endsWith('.json') ? 'json' : 'typescript',
            content: content.trim()
        });
    }

    let deleteMatch;
    while ((deleteMatch = deleteRegex.exec(text)) !== null) {
        filesToDelete.push(deleteMatch[1].trim());
    }

    if (files.length === 0 && filesToDelete.length === 0) {
        const codeBlockRegex = /```tsx([\s\S]*?)```/g;
        const codeMatch = codeBlockRegex.exec(text);
        if (codeMatch && codeMatch[1]) {
            files.push({
                name: 'App.tsx',
                language: 'typescript',
                content: codeMatch[1].trim()
            });
        }
    }

    let explanation = text
        .replace(/<file name=".*?">[\s\S]*?<\/file>/g, '')
        .replace(/<delete name=".*?"\s*\/>/g, '')
        .trim();
    
    explanation = explanation.replace(/```tsx[\s\S]*?```/g, '').trim();

    return {
      files,
      filesToDelete,
      explanation
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to generate code. Please try again.");
  }
};

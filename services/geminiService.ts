import { GoogleGenAI } from "@google/genai";
import { GeneratedCode, File } from "../types";

const SYSTEM_INSTRUCTION = `
You are VibeCoder, an expert senior React frontend engineer. Your task is to generate production-ready, highly aesthetic React components based on user prompts.

RULES:
1.  **Component Structure:**
    *   You can generate multiple files if needed (e.g., separating components into different files).
    *   **Entry Point:** There MUST be an \`App.tsx\` file which exports the main component as default: \`export default function App() { ... }\`.
    *   **Imports:** You can import other generated files using relative paths, e.g., \`import Header from './components/Header';\`.

2.  **Styling:** 
    *   Use Tailwind CSS for ALL styling. 
    *   Make it look modern, clean, and professional (like Linear, Vercel, or Lovable designs). 
    *   Use \`min-h-screen\` in \`App.tsx\` to ensure full height.

3.  **Icons:** 
    *   Do NOT use external icon libraries that require npm installation. 
    *   Use standard SVG elements inline.

4.  **No External Dependencies:** 
    *   Do not use \`import\` for external libraries other than \`react\`, \`react-dom\`, and standard hooks.
    *   Images: Use \`https://picsum.photos/width/height\` for placeholders.

5.  **Response Format:**
    *   Start with a brief explanation.
    *   **CRITICAL:** You MUST use the following XML format for ALL code changes. Do NOT use standard markdown code blocks (\`\`\`tsx).
    *   **To Create or Update a File:**
        <file name="path/to/file.tsx">
        // Full file content here
        </file>
    *   **To Delete a File:**
        <delete name="path/to/file.tsx" />
    *   Ensure file names are accurate and imports match the file structure.

Example Output:
"I've created a dashboard with a separate header component..."
<file name="components/Header.tsx">
import React from 'react';
export default function Header() {
  return <div className="p-4 bg-gray-900 text-white">Logo</div>;
}
</file>
<file name="App.tsx">
import React from 'react';
import Header from './components/Header';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="p-8">Content</main>
    </div>
  );
}
</file>
`;

let client: GoogleGenAI | null = null;

const getClient = () => {
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return client;
};

export const generateCodeFromPrompt = async (
  prompt: string,
  history: { role: string; parts: { text: string }[] }[] = []
): Promise<GeneratedCode> => {
  const ai = getClient();
  const modelId = 'gemini-3-pro-preview';

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: [
        ...history, 
        { role: 'user', parts: [{ text: prompt }] }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      }
    });

    const text = response.text || '';
    
    // Parse the output
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

    // Fallback: If no XML files found, try to fallback to the old code block format
    // But ONLY if we strictly didn't find any XML files to avoid mixed content issues
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

    // Clean up explanation by removing the XML blocks
    let explanation = text
        .replace(/<file name=".*?">[\s\S]*?<\/file>/g, '')
        .replace(/<delete name=".*?"\s*\/>/g, '')
        .trim();
    
    // Also clean up loose code blocks if they were captured
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

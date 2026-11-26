import { GeneratedCode, File, Plan } from "../types";

async function parseJsonResponse<T>(response: Response, fallbackError: string): Promise<T> {
  const rawText = await response.text();
  let data: unknown;
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    throw new Error(`${fallbackError} (HTTP ${response.status})`);
  }

  if (!response.ok) {
    const errMsg =
      typeof data === "object" && data !== null && "error" in data && typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : `${fallbackError} (HTTP ${response.status})`;
    throw new Error(errMsg);
  }

  return data as T;
}

export const generateProjectPlan = async (
  prompt: string,
  files: File[]
): Promise<Plan> => {
  const response = await fetch("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, files }),
  });

  return parseJsonResponse<Plan>(response, "Failed to generate project plan.");
};

export const generateCodeFromPrompt = async (
  prompt: string,
  history: { role: string; parts: { text: string }[] }[] = [],
  files: File[] = []
): Promise<GeneratedCode> => {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, history, files }),
  });

  return parseJsonResponse<GeneratedCode>(response, "Failed to generate code. Please try again.");
};

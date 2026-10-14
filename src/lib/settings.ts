/**
 * Per-browser settings. Nothing here leaves the visitor's machine except the
 * requests they configure themselves (their webhook, their own LLM key).
 */
export type Settings = {
  webhookUrl: string;
  llmBaseUrl: string;
  llmModel: string;
  /** Held in sessionStorage only, so it is gone when the tab closes. */
  llmApiKey: string;
};

const KEY = "bookflow.settings.v1";
const SECRET_KEY = "bookflow.llmKey.v1";

export const defaultSettings: Settings = {
  webhookUrl: "",
  llmBaseUrl: "https://openrouter.ai/api/v1",
  llmModel: "openai/gpt-4o-mini",
  llmApiKey: "",
};

export function loadSettings(): Settings {
  let stored: Partial<Settings> = {};
  let apiKey = "";
  try {
    stored = JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
  } catch {}
  try {
    apiKey = window.sessionStorage.getItem(SECRET_KEY) ?? "";
  } catch {}
  return { ...defaultSettings, ...stored, llmApiKey: apiKey };
}

export function saveSettings(s: Settings): void {
  const { llmApiKey, ...rest } = s;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rest));
  } catch {}
  try {
    if (llmApiKey) window.sessionStorage.setItem(SECRET_KEY, llmApiKey);
    else window.sessionStorage.removeItem(SECRET_KEY);
  } catch {}
}

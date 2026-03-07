export type Artifact = {
  id: string;
  title: string;
  language: string;
  content: string;
  partial?: boolean; // true while still streaming
};

const TITLE_MAP: Record<string, string> = {
  html: "index.html",
  jsx: "App.jsx",
  tsx: "App.tsx",
  css: "styles.css",
  js: "script.js",
  ts: "script.ts",
  python: "script.py",
  py: "script.py",
};

function getTitle(language: string): string {
  return TITLE_MAP[language.toLowerCase()] ?? `code.${language}`;
}

// Matches ```lang\n...``` — complete blocks
const COMPLETE_RE = /```(\w+)[^\n]*\n([\s\S]*?)```/g;
// Matches ```lang\n... (unclosed — still streaming)
const PARTIAL_RE = /```(\w+)[^\n]*\n([\s\S]+)$/;

function extractFromText(
  text: string,
  startIndex: number
): { artifacts: Artifact[]; nextIndex: number } {
  const artifacts: Artifact[] = [];
  let index = startIndex;

  COMPLETE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  let hasComplete = false;

  while ((match = COMPLETE_RE.exec(text)) !== null) {
    hasComplete = true;
    const language = match[1].toLowerCase();
    const content = match[2].trimEnd();
    artifacts.push({
      id: `artifact-${index}`,
      title: getTitle(language),
      language,
      content,
    });
    index++;
  }

  // If no complete block found, try partial (code still streaming in)
  if (!hasComplete) {
    const partial = PARTIAL_RE.exec(text);
    if (partial && partial[2].trim().length > 0) {
      const language = partial[1].toLowerCase();
      const content = partial[2].trimEnd();
      artifacts.push({
        id: `artifact-${index}-partial`,
        title: getTitle(language),
        language,
        content,
        partial: true,
      });
      index++;
    }
  }

  return { artifacts, nextIndex: index };
}

export function parseArtifactsFromMessages(
  messages: { role: string; content: string }[]
): Artifact[] {
  const allArtifacts: Artifact[] = [];
  let globalIndex = 0;

  for (const message of messages) {
    if (message.role === "assistant") {
      const { artifacts, nextIndex } = extractFromText(
        message.content,
        globalIndex
      );
      allArtifacts.push(...artifacts);
      globalIndex = nextIndex;
    }
  }

  return allArtifacts;
}

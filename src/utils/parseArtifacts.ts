export type Artifact = {
  id: string;
  title: string;
  language: string;
  content: string;
  pageName?: string;   // set when format is ```html:PageName
  partial?: boolean;
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

function getTitle(language: string, pageName?: string): string {
  if (pageName) return `${pageName}.html`;
  return TITLE_MAP[language.toLowerCase()] ?? `code.${language}`;
}

// Matches ```lang or ```lang:PageName (complete block)
const COMPLETE_RE = /```(\w+)(?::([^\n`]+))?[^\n]*\n([\s\S]*?)```/g;
// Matches unclosed block still streaming
const PARTIAL_RE = /```(\w+)(?::([^\n`]+))?[^\n]*\n([\s\S]+)$/;

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
    const pageName = match[2]?.trim() || undefined;
    const content = match[3].trimEnd();
    artifacts.push({
      id: `artifact-${index}`,
      title: getTitle(language, pageName),
      language,
      content,
      pageName,
    });
    index++;
  }

  if (!hasComplete) {
    const partial = PARTIAL_RE.exec(text);
    if (partial && partial[3].trim().length > 0) {
      const language = partial[1].toLowerCase();
      const pageName = partial[2]?.trim() || undefined;
      const content = partial[3].trimEnd();
      artifacts.push({
        id: `artifact-${index}-partial`,
        title: getTitle(language, pageName),
        language,
        content,
        pageName,
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
      const { artifacts, nextIndex } = extractFromText(message.content, globalIndex);
      allArtifacts.push(...artifacts);
      globalIndex = nextIndex;
    }
  }

  return allArtifacts;
}

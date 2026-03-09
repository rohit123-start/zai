// Parses the --- FILE: path --- format that the AI outputs for multi-file projects.

export type ParsedFile = {
  path: string;
  content: string;
  partial?: boolean; // true while the file is still being streamed
};

export type FileCategory = "page" | "component" | "style" | "script" | "data" | "other";

// Splits AI response text into individual file entries.
// A "complete" file is one followed by another --- FILE: --- marker or end of text.
// The LAST entry is marked partial:true while streaming is still in progress.
export function parseFilesFromText(text: string, isStreaming = false): ParsedFile[] {
  const results: ParsedFile[] = [];

  // Split on --- FILE: path --- markers (flexible whitespace around dashes)
  const splits = text.split(/\n?---\s*FILE:\s*/);

  for (let i = 1; i < splits.length; i++) {
    const chunk = splits[i];
    // First line is the file path (up to the closing ---)
    const closeIdx = chunk.indexOf("---");
    if (closeIdx === -1) continue;

    const filePath = chunk.slice(0, closeIdx).trim();
    const content = chunk.slice(closeIdx + 3).replace(/^\n/, "").trimEnd();
    const isLast = i === splits.length - 1;

    results.push({
      path: filePath,
      content,
      partial: isLast && isStreaming,
    });
  }

  return results;
}

// Returns true if the AI response contains the multi-file format
export function isMultiFileResponse(text: string): boolean {
  return /---\s*FILE:\s*\S/.test(text);
}

export function getFileCategory(path: string): FileCategory {
  if (path.startsWith("pages/") && path.endsWith(".html")) return "page";
  if (path.startsWith("components/") && path.endsWith(".html")) return "component";
  if (path.startsWith("styles/")) return "style";
  if (path.startsWith("scripts/")) return "script";
  if (path.endsWith(".json")) return "data";
  return "other";
}

export function getDisplayName(path: string): string {
  const filename = path.split("/").pop() ?? path;
  return filename.replace(/\.(html|css|js|json|ts)$/, "");
}

export function getFileIcon(path: string): string {
  const cat = getFileCategory(path);
  if (cat === "page") return "📄";
  if (cat === "component") return "🧩";
  if (cat === "style") return "🎨";
  if (cat === "script") return "⚙️";
  if (cat === "data") return "📊";
  return "📁";
}

// Groups files by their top-level folder
export function groupByFolder(files: ParsedFile[]): Map<string, ParsedFile[]> {
  const map = new Map<string, ParsedFile[]>();
  for (const f of files) {
    const folder = f.path.includes("/") ? f.path.split("/")[0] : "root";
    if (!map.has(folder)) map.set(folder, []);
    map.get(folder)!.push(f);
  }
  return map;
}

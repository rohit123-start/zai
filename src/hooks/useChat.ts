"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  getMessages,
  saveMessage,
  saveArtifacts,
  getDesignGuideline,
  deleteMessages,
  upsertProjectPage,
  deleteProjectPages,
  upsertProjectFile,
  deleteProjectFiles,
  type ProjectPage,
  type ProjectFile,
} from "@/lib/db";
import { parseFilesFromText, isMultiFileResponse } from "@/utils/parseFiles";
import { parseArtifactsFromMessages } from "@/utils/parseArtifacts";

// ─── DG helpers ───────────────────────────────────────────────────────────────

function hasCodeBlock(text: string): boolean {
  return /```\w+/.test(text);
}

async function callDgExtract(
  artifactHtml: string,
  projectId: string,
  userId: string
): Promise<string | null> {
  try {
    const res = await fetch("/api/dg/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artifactHtml, projectId, userId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.dg ?? null;
  } catch {
    return null;
  }
}

async function callDgSync(
  artifactHtml: string,
  currentDg: string,
  projectId: string,
  userId: string
): Promise<string | null> {
  try {
    const res = await fetch("/api/dg/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artifactHtml, currentDg, projectId, userId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.changed ? data.dg : null;
  } catch {
    return null;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type Role = "user" | "assistant";

export type ImageAttachment = {
  base64: string;
  mimeType: string;
  preview: string;
};

export type Message = {
  id: string;
  role: Role;
  content: string;
  images?: ImageAttachment[];
};

export type PersistConfig = {
  projectId: string;
  userId: string;
  pages?: ProjectPage[];
  files?: ProjectFile[];
  onPagesUpdate?: (pages: ProjectPage[]) => void;
  onFilesUpdate?: (files: ProjectFile[]) => void;
};

// ─── Context compression ──────────────────────────────────────────────────────

// Produces a compact summary of an assistant message that contained code.
// Full HTML is stripped; only intent + metadata kept.
function summariseAssistantMessage(content: string): string {
  // Extract any explanatory prose (non-code lines)
  const prose = content
    .replace(/```[\s\S]*?```/g, "")         // remove fenced blocks
    .replace(/---\s*FILE:[\s\S]*$/m, "")    // remove --- FILE: blocks
    .trim();

  // Count artifacts / files
  const fenceMatches = [...content.matchAll(/```(\w+)(?::([^\n`]+))?/g)];
  const fileMatches  = [...content.matchAll(/---\s*FILE:\s*([^\n-]+)/g)];

  const parts: string[] = [];

  if (prose) parts.push(prose.slice(0, 200) + (prose.length > 200 ? "…" : ""));

  if (fileMatches.length > 0) {
    const names = fileMatches.map((m) => m[1].trim());
    parts.push(`[Generated files: ${names.join(", ")}]`);
  } else if (fenceMatches.length > 0) {
    const names = fenceMatches.map((m) =>
      m[2] ? `${m[2]}.html` : m[1]
    );
    parts.push(`[Generated: ${names.join(", ")}]`);
  }

  return parts.join("\n") || "[Code output]";
}

// Compresses the messages array before sending to the API:
// - Assistant messages containing code → summary only
// - All other messages → unchanged
type ApiMessage = { role: string; content: ReturnType<typeof buildContent> };
function compressForAPI(messages: Message[]): ApiMessage[] {
  return messages.map((m) => {
    if (m.role === "assistant" && hasCodeBlock(m.content)) {
      return { role: "assistant", content: summariseAssistantMessage(m.content) };
    }
    return { role: m.role, content: buildContent(m.content, m.images) };
  });
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function buildContent(
  text: string,
  images?: ImageAttachment[]
): string | { type: string; [key: string]: unknown }[] {
  if (!images || images.length === 0) return text;
  return [
    ...images.map((img) => ({
      type: "image",
      source: { type: "base64", media_type: img.mimeType, data: img.base64 },
    })),
    { type: "text", text },
  ];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export type TokenUsageSnapshot = {
  input: number;
  output: number;
  total: number;
};

export function useChat(persist?: PersistConfig) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(!!persist);
  const [lastUsage, setLastUsage] = useState<TokenUsageSnapshot | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const persistRef = useRef(persist);
  persistRef.current = persist;

  const [projectDG, setProjectDG] = useState<string | null>(null);
  const projectDGRef = useRef<string | null>(null);
  projectDGRef.current = projectDG;

  // Load messages + DG for this project
  useEffect(() => {
    if (!persist?.projectId) {
      setMessages([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setMessages([]);

    Promise.all([
      getMessages(persist.projectId).then((rows) =>
        rows.map((r) => ({ id: r.id, role: r.role as Role, content: r.content }))
      ),
      getDesignGuideline(persist.projectId),
    ])
      .then(([msgs, dg]) => {
        setMessages(msgs);
        setProjectDG(dg?.dg ?? null);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist?.projectId]);

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const sendMessage = useCallback(
    async (userInput: string, images?: ImageAttachment[]) => {
      if (!userInput.trim() || isStreaming) return;

      const p = persistRef.current;

      const userMessage: Message = {
        id: generateId(),
        role: "user",
        content: userInput.trim(),
        images,
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setIsStreaming(true);

      // Persist user message (fire-and-forget)
      if (p) {
        saveMessage(
          p.projectId,
          p.userId,
          "user",
          userInput.trim(),
          images?.map((i) => i.mimeType)
        ).catch(console.error);
      }

      const assistantId = generateId();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      const finalContentRef = { current: "" };
      const dgContext: string | null = projectDGRef.current ?? null;

      try {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        // Keep last 20 messages max; always preserve the first (original brief).
        const HISTORY_LIMIT = 20;
        const trimmed =
          updatedMessages.length > HISTORY_LIMIT
            ? [updatedMessages[0], ...updatedMessages.slice(-(HISTORY_LIMIT - 1))]
            : updatedMessages;

        // Compress: replace HTML/code in assistant messages with summaries.
        // Full code is injected once via currentPages/currentFiles below.
        const compressed = compressForAPI(trimmed);

        // Current page state from DB — injected into system prompt server-side
        const p = persistRef.current;
        const currentPages = (p?.pages ?? []).map((pg) => ({
          name: pg.page_name,
          html: pg.html_content,
        }));
        const currentFiles = (p?.files ?? []).map((f) => ({
          path: f.file_path,
          content: f.content,
        }));

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: compressed,
            dgContext,
            currentPages: currentPages.length > 0 ? currentPages : undefined,
            currentFiles: currentFiles.length > 0 ? currentFiles : undefined,
            projectId: p?.projectId,
            userId: p?.userId,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) throw new Error("Failed to connect to API");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        outer: while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            for (const line of part.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              const raw = line.slice(6).trim();
              if (raw === "[DONE]") break outer;
              try {
                const parsed = JSON.parse(raw);
                if (parsed.text) {
                  finalContentRef.current += parsed.text;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: m.content + parsed.text }
                        : m
                    )
                  );
                } else if (parsed.usage) {
                  setLastUsage({
                    input: parsed.usage.input,
                    output: parsed.usage.output,
                    total: parsed.usage.input + parsed.usage.output,
                  });
                }
              } catch {
                // ignore malformed chunks
              }
            }
          }
        }

        // Persist assistant message + artifacts + pages + DG sync
        if (p && finalContentRef.current) {
          try {
            const dbMsg = await saveMessage(
              p.projectId,
              p.userId,
              "assistant",
              finalContentRef.current
            );

            const artifacts = parseArtifactsFromMessages([
              { role: "assistant", content: finalContentRef.current },
            ]).filter((a) => !a.partial);

            if (artifacts.length > 0) {
              await saveArtifacts(
                artifacts.map(({ title, language, content }) => ({ title, language, content })),
                p.projectId,
                p.userId,
                dbMsg.id
              );

              // ── Multi-file format (--- FILE: path ---) ────────────────────
              if (isMultiFileResponse(finalContentRef.current)) {
                const parsedFiles = parseFilesFromText(finalContentRef.current);
                const completeFiles = parsedFiles.filter((f) => !f.partial);
                if (completeFiles.length > 0) {
                  const upserted: ProjectFile[] = await Promise.all(
                    completeFiles.map((f) =>
                      upsertProjectFile(p.projectId, p.userId, f.path, f.content)
                    )
                  );
                  p.onFilesUpdate?.(upserted);
                }
              } else {
                // ── html:PageName or plain html format ─────────────────────
                const htmlArtifacts = artifacts.filter((a) => a.language === "html");
                if (htmlArtifacts.length > 0 && p.onPagesUpdate) {
                  const upserted: ProjectPage[] = await Promise.all(
                    htmlArtifacts.map((a) =>
                      upsertProjectPage(
                        p.projectId,
                        p.userId,
                        a.pageName ?? "Home",
                        a.content
                      )
                    )
                  );
                  p.onPagesUpdate(upserted);
                } else if (htmlArtifacts.length > 0) {
                  htmlArtifacts.forEach((a) =>
                    upsertProjectPage(
                      p.projectId,
                      p.userId,
                      a.pageName ?? "Home",
                      a.content
                    ).catch(console.error)
                  );
                }
              }

              // Only run DG extract/sync for HTML artifacts with meaningful content (>500 chars)
              const htmlArtifact = artifacts.find((a) => a.language === "html");
              if (htmlArtifact && htmlArtifact.content.length > 500) {
                const currentDG = projectDGRef.current;
                if (!currentDG) {
                  const dg = await callDgExtract(htmlArtifact.content, p.projectId, p.userId);
                  if (dg) setProjectDG(dg);
                } else {
                  const updated = await callDgSync(
                    htmlArtifact.content, currentDG, p.projectId, p.userId
                  );
                  if (updated) setProjectDG(updated);
                }
              }
            }
          } catch (err) {
            console.error("[useChat] persist failed:", err);
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          if (p && finalContentRef.current) {
            saveMessage(p.projectId, p.userId, "assistant", finalContentRef.current)
              .catch(console.error);
          }
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: "Sorry, an error occurred. Please try again." }
                : m
            )
          );
        }
      } finally {
        setIsStreaming(false);
      }
    },
    [messages, isStreaming]
  );

  // Clears chat messages from memory and DB
  const clearMessages = useCallback(() => {
    setMessages([]);
    setProjectDG(null);
    const p = persistRef.current;
    if (p) deleteMessages(p.projectId).catch(console.error);
  }, []);

  // Deletes all project pages + files from DB and notifies parent
  const deletePages = useCallback(() => {
    const p = persistRef.current;
    if (!p) return;
    Promise.all([
      deleteProjectPages(p.projectId),
      deleteProjectFiles(p.projectId),
    ])
      .then(() => {
        p.onPagesUpdate?.([]);
        p.onFilesUpdate?.([]);
      })
      .catch(console.error);
  }, []);

  return { messages, isStreaming, isLoading, lastUsage, sendMessage, stopStreaming, clearMessages, deletePages };
}

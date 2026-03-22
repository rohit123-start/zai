"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  getMessages,
  saveMessage,
  deleteMessages,
  upsertProjectFile,
  deleteProjectFiles,
  type ProjectFile,
} from "@/lib/db";
import { parseFilesFromText, isMultiFileResponse } from "@/utils/parseFiles";

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
  files?: ProjectFile[];
  brain?: Record<string, unknown> | null;
  onFilesUpdate?: (files: ProjectFile[]) => void;
};

// ─── Context compression ──────────────────────────────────────────────────────

function hasCodeBlock(text: string): boolean {
  return /```\w+/.test(text);
}

function summariseAssistantMessage(content: string): string {
  const prose = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/---\s*FILE:[\s\S]*$/m, "")
    .trim();

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

  // Load messages for this project
  useEffect(() => {
    if (!persist?.projectId) {
      setMessages([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setMessages([]);

    getMessages(persist.projectId)
      .then((rows) =>
        rows.map((r) => ({ id: r.id, role: r.role as Role, content: r.content }))
      )
      .then(setMessages)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist?.projectId]);

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const sendMessage = useCallback(
    async (userInput: string, images?: ImageAttachment[], opts?: { silent?: boolean }) => {
      if (!userInput.trim() || isStreaming) return;

      const silent = opts?.silent ?? false;
      const p = persistRef.current;

      const userMessage: Message = {
        id: generateId(),
        role: "user",
        content: userInput.trim(),
        images,
      };

      // Always include the user message for the API call.
      // In silent mode we skip adding it to React state and the DB.
      const messagesForApi = [...messages, userMessage];
      if (!silent) setMessages(messagesForApi);
      setIsStreaming(true);

      if (p && !silent) {
        saveMessage(
          p.projectId,
          p.userId,
          "user",
          userInput.trim(),
          images?.map((i) => i.mimeType)
        ).catch(console.error);
      }

      const assistantId = generateId();
      if (!silent) {
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: "" },
        ]);
      }

      const finalContentRef = { current: "" };

      try {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const HISTORY_LIMIT = 20;
        const trimmed =
          messagesForApi.length > HISTORY_LIMIT
            ? [messagesForApi[0], ...messagesForApi.slice(-(HISTORY_LIMIT - 1))]
            : messagesForApi;

        const compressed = compressForAPI(trimmed);

        const currentFiles = (p?.files ?? []).map((f) => ({
          path: f.file_path,
          content: f.content,
        }));

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: compressed,
            currentFiles: currentFiles.length > 0 ? currentFiles : undefined,
            brain: p?.brain ?? undefined,
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
                  if (!silent) {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantId
                          ? { ...m, content: m.content + parsed.text }
                          : m
                      )
                    );
                  }
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

        // Persist assistant message + project files
        if (p && finalContentRef.current) {
          try {
            // In silent mode only files are saved — no chat messages
            if (!silent) {
              await saveMessage(p.projectId, p.userId, "assistant", finalContentRef.current);
            }

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
            }
          } catch (err) {
            console.error("[useChat] persist failed:", err);
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          if (p && finalContentRef.current && !silent) {
            saveMessage(p.projectId, p.userId, "assistant", finalContentRef.current)
              .catch(console.error);
          }
        } else if (!silent) {
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

  const clearMessages = useCallback(() => {
    setMessages([]);
    const p = persistRef.current;
    if (p) deleteMessages(p.projectId).catch(console.error);
  }, []);

  const deletePages = useCallback(() => {
    const p = persistRef.current;
    if (!p) return;
    deleteProjectFiles(p.projectId)
      .then(() => p.onFilesUpdate?.([]))
      .catch(console.error);
  }, []);

  return { messages, isStreaming, isLoading, lastUsage, sendMessage, stopStreaming, clearMessages, deletePages };
}

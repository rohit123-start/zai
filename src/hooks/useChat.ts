"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  getMessages,
  saveMessage,
  saveArtifacts,
  updateChatSessionTitle,
} from "@/lib/db";
import { parseArtifactsFromMessages } from "@/utils/parseArtifacts";

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
  sessionId: string;
  projectId: string;
  userId: string;
  onTitleUpdate?: (title: string) => void;
};

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

export function useChat(persist?: PersistConfig) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(!!persist);
  const abortControllerRef = useRef<AbortController | null>(null);
  const persistRef = useRef(persist);
  persistRef.current = persist;

  // Load persisted messages when session changes
  useEffect(() => {
    if (!persist?.sessionId) {
      setMessages([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setMessages([]);
    getMessages(persist.sessionId)
      .then((rows) => {
        setMessages(
          rows.map((r) => ({
            id: r.id,
            role: r.role,
            content: r.content,
          }))
        );
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist?.sessionId]);

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

      // Persist user message (fire-and-forget) + auto-title on first message
      if (p) {
        saveMessage(
          p.sessionId,
          p.projectId,
          p.userId,
          "user",
          userInput.trim(),
          images?.map((i) => i.mimeType)
        ).catch(console.error);

        if (messages.length === 0) {
          const title =
            userInput.trim().slice(0, 50) +
            (userInput.trim().length > 50 ? "…" : "");
          updateChatSessionTitle(p.sessionId, title)
            .then(() => p.onTitleUpdate?.(title))
            .catch(console.error);
        }
      }

      const assistantId = generateId();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      // Track final content for persistence
      const finalContentRef = { current: "" };

      try {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages.map(({ role, content, images: imgs }) => ({
              role,
              content: buildContent(content, imgs),
            })),
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error("Failed to connect to API");
        }

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
              if (raw === "[DONE]") {
                break outer; // fall through to persistence block below
              }
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
                }
              } catch {
                // ignore malformed chunks
              }
            }
          }
        }

        // Persist assistant message + artifacts after streaming completes
        if (p && finalContentRef.current) {
          try {
            const dbMsg = await saveMessage(
              p.sessionId,
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
                artifacts.map(({ title, language, content }) => ({
                  title,
                  language,
                  content,
                })),
                p.sessionId,
                p.projectId,
                p.userId,
                dbMsg.id
              );
            }
          } catch (err) {
            console.error("[useChat] Failed to persist assistant message:", err);
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // User stopped — keep whatever was streamed; persist partial
          if (p && finalContentRef.current) {
            saveMessage(
              p.sessionId,
              p.projectId,
              p.userId,
              "assistant",
              finalContentRef.current
            ).catch(console.error);
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

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, isStreaming, isLoading, sendMessage, stopStreaming, clearMessages };
}

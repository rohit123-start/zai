"use client";

import { useState, useCallback, useRef } from "react";

export type Role = "user" | "assistant";

export type ImageAttachment = {
  base64: string;
  mimeType: string;
  preview: string; // data URL for display
};

export type Message = {
  id: string;
  role: Role;
  content: string;
  images?: ImageAttachment[];
};

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Build the content payload that Anthropic expects
function buildContent(
  text: string,
  images?: ImageAttachment[]
): string | { type: string; [key: string]: unknown }[] {
  if (!images || images.length === 0) return text;

  return [
    ...images.map((img) => ({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mimeType,
        data: img.base64,
      },
    })),
    { type: "text", text },
  ];
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const sendMessage = useCallback(
    async (userInput: string, images?: ImageAttachment[]) => {
      if (!userInput.trim() || isStreaming) return;

      const userMessage: Message = {
        id: generateId(),
        role: "user",
        content: userInput.trim(),
        images,
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setIsStreaming(true);

      const assistantId = generateId();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

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

        while (true) {
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
                setIsStreaming(false);
                return;
              }
              try {
                const parsed = JSON.parse(raw);
                if (parsed.text) {
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
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // User stopped the stream intentionally — keep whatever was streamed
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

  return { messages, isStreaming, sendMessage, stopStreaming, clearMessages };
}

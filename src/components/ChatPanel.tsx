"use client";

import {
  useRef,
  useEffect,
  useState,
  KeyboardEvent,
  useCallback,
  ChangeEvent,
} from "react";
import { Message, ImageAttachment } from "@/hooks/useChat";
import MessageBubble from "./MessageBubble";
import { useAuth } from "./AuthProvider";

type Props = {
  messages: Message[];
  isStreaming: boolean;
  onSend: (text: string, images?: ImageAttachment[]) => void;
  onStop: () => void;
  onClear: () => void;
  onDeletePages?: () => void;
  hideNewChat?: boolean;
  projectName?: string;
  onBack?: () => void;
};

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_IMAGES = 5;
const MAX_SIZE_MB = 5;

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4 message-in">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5 mr-2"
        style={{
          background: "#d97706",
          color: "#0f0f0f",
          letterSpacing: "-0.5px",
          animation: "zaiPulse 1.5s ease-in-out infinite",
        }}
      >
        Z
      </div>
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{
          background: "#1f1f1f",
          border: "1px solid #2a2a2a",
          borderRadius: "12px 12px 12px 2px",
        }}
      >
        <span className="typing-dot w-2 h-2 rounded-full" style={{ background: "#d97706" }} />
        <span className="typing-dot w-2 h-2 rounded-full" style={{ background: "#d97706" }} />
        <span className="typing-dot w-2 h-2 rounded-full" style={{ background: "#d97706" }} />
      </div>
    </div>
  );
}

const MAX_IMAGE_DIM = 1024;
const JPEG_QUALITY = 0.85;

function fileToImageAttachment(file: File): Promise<ImageAttachment> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      let { width, height } = img;

      if (width > MAX_IMAGE_DIM || height > MAX_IMAGE_DIM) {
        const ratio = Math.min(MAX_IMAGE_DIM / width, MAX_IMAGE_DIM / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);

      URL.revokeObjectURL(objectUrl);

      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      const base64 = dataUrl.split(",")[1];
      resolve({ base64, mimeType: "image/jpeg", preview: dataUrl });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };

    img.src = objectUrl;
  });
}

export default function ChatPanel({ messages, isStreaming, onSend, onStop, onClear, onDeletePages, hideNewChat, projectName, onBack }: Props) {
  const { user, signOut } = useAuth();
  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<ImageAttachment[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const handleInput = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  const handleFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    setImageError(null);
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const remaining = MAX_IMAGES - pendingImages.length;
    if (remaining <= 0) {
      setImageError(`Max ${MAX_IMAGES} images allowed.`);
      e.target.value = "";
      return;
    }

    const toProcess = files.slice(0, remaining);
    const oversized = toProcess.filter((f) => f.size > MAX_SIZE_MB * 1024 * 1024);
    if (oversized.length) {
      setImageError(`Each image must be under ${MAX_SIZE_MB}MB.`);
      e.target.value = "";
      return;
    }

    const invalid = toProcess.filter((f) => !ACCEPTED_TYPES.includes(f.type));
    if (invalid.length) {
      setImageError("Only JPEG, PNG, GIF, and WebP images are supported.");
      e.target.value = "";
      return;
    }

    try {
      const attachments = await Promise.all(toProcess.map(fileToImageAttachment));
      setPendingImages((prev) => [...prev, ...attachments]);
    } catch {
      setImageError("Failed to process image(s). Please try again.");
    }

    e.target.value = "";
  }, [pendingImages.length]);

  const removeImage = useCallback((index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const canSend = (input.trim().length > 0 || pendingImages.length > 0) && !isStreaming;

  const submit = useCallback(() => {
    if (!canSend) return;
    const text = input.trim();
    const imgs = pendingImages.length > 0 ? pendingImages : undefined;
    setInput("");
    setPendingImages([]);
    setImageError(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    onSend(text || "(no text)", imgs);
  }, [canSend, input, pendingImages, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    },
    [submit]
  );

  // Paste images directly into the chat
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items).filter(
      (item) => item.kind === "file" && ACCEPTED_TYPES.includes(item.type)
    );
    if (!items.length) return;

    const files = items.map((item) => item.getAsFile()).filter(Boolean) as File[];
    const remaining = MAX_IMAGES - pendingImages.length;
    const toProcess = files.slice(0, remaining);
    if (!toProcess.length) return;

    try {
      const attachments = await Promise.all(toProcess.map(fileToImageAttachment));
      setPendingImages((prev) => [...prev, ...attachments]);
    } catch {
      setImageError("Failed to paste image.");
    }
  }, [pendingImages.length]);

  const isEmpty = messages.length === 0;
  const lastMessageIsStreaming =
    isStreaming &&
    messages.length > 0 &&
    messages[messages.length - 1].role === "assistant";

  return (
    <div className="flex flex-col h-full" style={{ background: "#0f0f0f" }}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b shrink-0"
        style={{ borderColor: "#2a2a2a" }}
      >
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-xs transition-colors mr-1"
              style={{ color: "#6b7280" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#e5e5e5")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}
          <div
            className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
            style={{ background: "#d97706", color: "#0f0f0f" }}
          >
            Z
          </div>
          <span className="text-sm font-semibold" style={{ color: "#e5e5e5" }}>
            {projectName ?? "Zai"}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "#1a1a1a", color: "#6b7280", border: "1px solid #2a2a2a" }}
          >
            claude-sonnet-4-6
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Clear chat */}
          <button
            onClick={onClear}
            disabled={isStreaming || messages.length === 0}
            title="Clear chat history"
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded transition-all duration-150"
            style={{
              background: "transparent",
              color: messages.length === 0 ? "#3a3a3a" : "#6b7280",
              border: "1px solid #2a2a2a",
              opacity: isStreaming ? 0.4 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isStreaming && messages.length > 0) {
                e.currentTarget.style.color = "#f87171";
                e.currentTarget.style.borderColor = "rgba(248,113,113,0.3)";
                e.currentTarget.style.background = "rgba(248,113,113,0.06)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = messages.length === 0 ? "#3a3a3a" : "#6b7280";
              e.currentTarget.style.borderColor = "#2a2a2a";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
            </svg>
            Clear Chat
          </button>

          {/* Delete pages */}
          {onDeletePages && (
            <button
              onClick={onDeletePages}
              disabled={isStreaming}
              title="Delete all pages"
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded transition-all duration-150"
              style={{
                background: "transparent",
                color: "#6b7280",
                border: "1px solid #2a2a2a",
                opacity: isStreaming ? 0.4 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isStreaming) {
                  e.currentTarget.style.color = "#f87171";
                  e.currentTarget.style.borderColor = "rgba(248,113,113,0.3)";
                  e.currentTarget.style.background = "rgba(248,113,113,0.06)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#6b7280";
                e.currentTarget.style.borderColor = "#2a2a2a";
                e.currentTarget.style.background = "transparent";
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><line x1="9" y1="14" x2="15" y2="14" />
              </svg>
              Delete Pages
            </button>
          )}

          {!hideNewChat && (
          <button
            onClick={onClear}
            className="text-xs px-3 py-1.5 rounded transition-all duration-150"
            style={{ background: "#1a1a1a", color: "#9ca3af", border: "1px solid #2a2a2a" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#e5e5e5";
              e.currentTarget.style.borderColor = "#3a3a3a";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#9ca3af";
              e.currentTarget.style.borderColor = "#2a2a2a";
            }}
          >
            New Chat
          </button>
          )}

          {/* User avatar + sign out */}
          {user && (
            <div className="flex items-center gap-2">
              {user.user_metadata?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.user_metadata.avatar_url}
                  alt={user.user_metadata.full_name ?? "User"}
                  className="w-7 h-7 rounded-full object-cover"
                  style={{ border: "1px solid #3a3a3a" }}
                />
              ) : (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: "#2a2a2a", color: "#e5e5e5" }}
                >
                  {(user.user_metadata?.full_name ?? user.email ?? "U")[0].toUpperCase()}
                </div>
              )}
              <button
                onClick={signOut}
                className="text-xs px-2 py-1 rounded transition-all duration-150"
                style={{ color: "#6b7280" }}
                title="Sign out"
                onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black zai-logo"
            style={{ background: "#d97706", color: "#0f0f0f", letterSpacing: "-1px" }}
          >
            Z
          </div>
          <div className="text-center">
            <p className="text-base font-semibold mb-1" style={{ color: "#e5e5e5" }}>
              What are we building today?
            </p>
            <p className="text-sm" style={{ color: "#6b7280" }}>
              Describe your idea — Zai will design and code it instantly.
            </p>
            <p className="text-xs mt-2" style={{ color: "#4b5563" }}>
              Attach images to replicate designs pixel-perfectly
            </p>
          </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isStreaming={isStreaming && i === messages.length - 1 && msg.role === "assistant"}
              />
            ))}
            {isStreaming && !lastMessageIsStreaming && <TypingIndicator />}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div
        className="shrink-0 px-4 pb-4 pt-2 border-t"
        style={{ borderColor: "#2a2a2a" }}
      >
        {/* Image previews */}
        {pendingImages.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 px-1">
            {pendingImages.map((img, i) => (
              <div key={i} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.preview}
                  alt={`attachment ${i + 1}`}
                  className="w-16 h-16 object-cover"
                  style={{ border: "1px solid #2a2a2a", borderRadius: "6px" }}
                />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                  style={{ background: "#ef4444", color: "#fff" }}
                  aria-label="Remove image"
                >
                  ×
                </button>
              </div>
            ))}
            {pendingImages.length < MAX_IMAGES && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-16 h-16 flex flex-col items-center justify-center gap-1 transition-colors duration-150"
                style={{
                  border: "1px dashed #3a3a3a",
                  borderRadius: "6px",
                  color: "#6b7280",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#d97706")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#3a3a3a")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span className="text-xs">Add</span>
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {imageError && (
          <p className="text-xs mb-2 px-1" style={{ color: "#f87171" }}>
            {imageError}
          </p>
        )}

        {/* Input box */}
        <div
          className="flex items-end gap-2 px-3 py-2"
          style={{
            background: "#1a1a1a",
            border: "1px solid #2a2a2a",
            borderRadius: "8px",
          }}
        >
          {/* Attach button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming || pendingImages.length >= MAX_IMAGES}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded transition-all duration-150 mb-0.5"
            style={{
              color: pendingImages.length >= MAX_IMAGES ? "#3a3a3a" : "#6b7280",
              opacity: isStreaming ? 0.4 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isStreaming && pendingImages.length < MAX_IMAGES)
                e.currentTarget.style.color = "#d97706";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color =
                pendingImages.length >= MAX_IMAGES ? "#3a3a3a" : "#6b7280";
            }}
            aria-label="Attach image"
            title="Attach image (JPEG, PNG, GIF, WebP — max 5MB)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={pendingImages.length > 0 ? "Add a message (optional)…" : "Message Claude…"}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm outline-none leading-relaxed py-1"
            style={{
              color: "#e5e5e5",
              maxHeight: "160px",
              overflowY: "auto",
              caretColor: "#d97706",
            }}
          />

          {isStreaming ? (
            <button
              onClick={onStop}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded transition-all duration-150"
              style={{ background: "#ef4444", color: "#fff" }}
              aria-label="Stop generation"
              title="Stop generation"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!canSend}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded transition-all duration-150"
              style={{
                background: canSend ? "#d97706" : "#2a2a2a",
                color: canSend ? "#0f0f0f" : "#4b5563",
                opacity: canSend ? 1 : 0.5,
              }}
              aria-label="Send message"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          )}
        </div>

        <p className="text-center text-xs mt-2" style={{ color: "#3a3a3a" }}>
          Enter to send · Shift+Enter for newline · paste or drag images
        </p>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}

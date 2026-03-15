"use client";

import {
  useRef,
  useEffect,
  useState,
  KeyboardEvent,
  useCallback,
  ChangeEvent,
} from "react";
import { Message, ImageAttachment, type TokenUsageSnapshot } from "@/hooks/useChat";
import MessageBubble from "./MessageBubble";
type Props = {
  messages: Message[];
  isStreaming: boolean;
  lastUsage?: TokenUsageSnapshot | null;
  onSend: (text: string, images?: ImageAttachment[]) => void;
  onStop: () => void;
  onClear: () => void;
  onDeletePages?: () => void;
  hideNewChat?: boolean;
  projectName?: string;
  onBack?: () => void;
  onShare?: () => void;
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
          background: "#06b6d4",
          color: "#000",
          letterSpacing: "-0.5px",
          fontFamily: "var(--font-space-grotesk)",
          animation: "zaiPulse 1.5s ease-in-out infinite",
        }}
      >
        Z
      </div>
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{
          background: "#0a0a0a",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "12px 12px 12px 2px",
        }}
      >
        <span className="typing-dot w-2 h-2 rounded-full" style={{ background: "#06b6d4" }} />
        <span className="typing-dot w-2 h-2 rounded-full" style={{ background: "#06b6d4" }} />
        <span className="typing-dot w-2 h-2 rounded-full" style={{ background: "#06b6d4" }} />
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

export default function ChatPanel({ messages, isStreaming, lastUsage, onSend, onStop, onClear, onDeletePages, hideNewChat, projectName, onBack, onShare }: Props) {
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
    <div className="flex flex-col h-full" style={{ background: "#000", fontFamily: "var(--font-dm-sans)" }}>

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 shrink-0"
        style={{ height: 52, borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Left: back + project name */}
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors shrink-0"
              style={{ color: "#71717a" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#71717a"; e.currentTarget.style.background = "transparent"; }}
              title="Back to projects"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}
          <span className="text-sm font-semibold truncate" style={{ color: "#fff", fontFamily: "var(--font-space-grotesk)", letterSpacing: "-0.2px" }}>
            {projectName ?? "Zeach"}
          </span>
        </div>

        {/* Right: share */}
        <div className="flex items-center gap-2 shrink-0">
          {onShare && (
            <button
              onClick={onShare}
              title="Share project"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-150"
              style={{ background: "rgba(255,255,255,0.04)", color: "#71717a", border: "1px solid rgba(255,255,255,0.07)", fontFamily: "var(--font-dm-mono)", fontSize: 11 }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#71717a"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              Share
            </button>
          )}
        </div>
      </div>

      {/* ── Model bar ────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 shrink-0"
        style={{ height: 36, borderBottom: "1px solid rgba(255,255,255,0.05)", background: "#000" }}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md" style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)" }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#06b6d4" }} />
            <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: 10, color: "#06b6d4", letterSpacing: "0.3px" }}>
              claude-sonnet-4-6
            </span>
          </div>
          {lastUsage && (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-md"
              title={`Last request: ${lastUsage.input.toLocaleString()} input + ${lastUsage.output.toLocaleString()} output tokens`}
              style={{ fontFamily: "var(--font-dm-mono)", fontSize: 10, background: "rgba(255,255,255,0.04)", color: "#3f3f46", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              {lastUsage.total.toLocaleString()} tok
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={onClear}
            disabled={isStreaming || messages.length === 0}
            title="Clear chat history"
            className="flex items-center gap-1 px-2 py-1 rounded transition-all duration-150"
            style={{ fontFamily: "var(--font-dm-mono)", fontSize: 10, color: messages.length === 0 ? "#27272a" : "#3f3f46", opacity: isStreaming ? 0.4 : 1 }}
            onMouseEnter={(e) => { if (!isStreaming && messages.length > 0) { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.background = "rgba(248,113,113,0.06)"; } }}
            onMouseLeave={(e) => { e.currentTarget.style.color = messages.length === 0 ? "#27272a" : "#3f3f46"; e.currentTarget.style.background = "transparent"; }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
            Clear
          </button>

          {onDeletePages && (
            <button
              onClick={onDeletePages}
              disabled={isStreaming}
              title="Delete all pages"
              className="flex items-center gap-1 px-2 py-1 rounded transition-all duration-150"
              style={{ fontFamily: "var(--font-dm-mono)", fontSize: 10, color: "#3f3f46", opacity: isStreaming ? 0.4 : 1 }}
              onMouseEnter={(e) => { if (!isStreaming) { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.background = "rgba(248,113,113,0.06)"; } }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#3f3f46"; e.currentTarget.style.background = "transparent"; }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" />
              </svg>
              Del pages
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black zai-logo"
              style={{ background: "#06b6d4", color: "#000", letterSpacing: "-1px", fontFamily: "var(--font-space-grotesk)", boxShadow: "0 0 32px rgba(6,182,212,0.25)" }}
            >
              Z
            </div>
            <div className="text-center">
              <p className="text-base font-semibold mb-1" style={{ color: "#fff", fontFamily: "var(--font-space-grotesk)", letterSpacing: "-0.2px" }}>
                What are we building today?
              </p>
              <p className="text-sm" style={{ color: "#71717a" }}>
                Describe your idea — Zeach will design and code it instantly.
              </p>
              <p style={{ fontFamily: "var(--font-dm-mono)", fontSize: 11, marginTop: 8, color: "#3f3f46" }}>
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
        className="shrink-0 px-3 pb-3 pt-2"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Image previews */}
        {pendingImages.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 px-0.5">
            {pendingImages.map((img, i) => (
              <div key={i} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.preview}
                  alt={`attachment ${i + 1}`}
                  className="w-14 h-14 object-cover"
                  style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
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
                className="w-14 h-14 flex flex-col items-center justify-center gap-1 transition-colors duration-150"
                style={{ border: "1px dashed rgba(255,255,255,0.12)", borderRadius: "8px", color: "#3f3f46" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#06b6d4")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: 9 }}>Add</span>
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {imageError && (
          <p className="text-xs mb-2 px-1" style={{ color: "#f87171", fontFamily: "var(--font-dm-mono)" }}>
            {imageError}
          </p>
        )}

        {/* Input box */}
        <div
          className="flex items-end gap-2 px-3 py-2.5"
          style={{
            background: "#0a0a0a",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: "10px",
          }}
        >
          {/* Attach button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming || pendingImages.length >= MAX_IMAGES}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150 mb-0.5"
            style={{ color: pendingImages.length >= MAX_IMAGES ? "#27272a" : "#52525b", opacity: isStreaming ? 0.4 : 1 }}
            onMouseEnter={(e) => { if (!isStreaming && pendingImages.length < MAX_IMAGES) e.currentTarget.style.color = "#06b6d4"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = pendingImages.length >= MAX_IMAGES ? "#27272a" : "#52525b"; }}
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
            placeholder={pendingImages.length > 0 ? "Add a message (optional)…" : "Describe what to build…"}
            rows={1}
            className="flex-1 resize-none bg-transparent outline-none leading-relaxed py-1"
            style={{
              color: "#fff",
              fontSize: 13,
              maxHeight: "160px",
              overflowY: "auto",
              caretColor: "#06b6d4",
              fontFamily: "var(--font-dm-sans)",
            }}
          />

          {isStreaming ? (
            <button
              onClick={onStop}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150"
              style={{ background: "#ef4444", color: "#fff" }}
              aria-label="Stop generation"
              title="Stop generation"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!canSend}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150"
              style={{
                background: canSend ? "#06b6d4" : "rgba(255,255,255,0.05)",
                color: canSend ? "#000" : "#3f3f46",
                boxShadow: canSend ? "0 0 14px rgba(6,182,212,0.3)" : "none",
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

        <p className="text-center mt-2" style={{ fontFamily: "var(--font-dm-mono)", fontSize: 10, color: "#27272a" }}>
          Enter to send · Shift+Enter for newline
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

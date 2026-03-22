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
  isThinking?: boolean;
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

/* ── Panel icon button ─────────────────────────────────────────────────────── */
function PanelBtn({
  onClick,
  title,
  children,
  active,
  danger,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  active?: boolean;
  danger?: boolean;
}) {
  const [hov, setHov] = useState(false);
  const bg = active
    ? "rgba(6,182,212,0.1)"
    : hov
    ? danger
      ? "rgba(239,68,68,0.08)"
      : "rgba(255,255,255,0.05)"
    : "transparent";
  const border = active
    ? "1px solid rgba(6,182,212,0.2)"
    : hov
    ? "1px solid rgba(255,255,255,0.1)"
    : "1px solid transparent";
  const color = active
    ? "#06b6d4"
    : hov
    ? danger
      ? "#ef4444"
      : "#fff"
    : "#71717a";

  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 30, height: 30, borderRadius: 8,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", color, background: bg, border,
        transition: "all 0.15s",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

export default function ChatPanel({
  messages, isStreaming, isThinking = false, lastUsage, onSend, onStop, onClear, onDeletePages,
  projectName, onBack, onShare,
}: Props) {
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
    el.style.height = Math.min(el.scrollHeight, 110) + "px";
  }, []);

  const handleFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    setImageError(null);
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = MAX_IMAGES - pendingImages.length;
    if (remaining <= 0) { setImageError(`Max ${MAX_IMAGES} images.`); e.target.value = ""; return; }
    const toProcess = files.slice(0, remaining);
    if (toProcess.some((f) => f.size > MAX_SIZE_MB * 1024 * 1024)) { setImageError(`Max ${MAX_SIZE_MB}MB per image.`); e.target.value = ""; return; }
    if (toProcess.some((f) => !ACCEPTED_TYPES.includes(f.type))) { setImageError("JPEG, PNG, GIF, WebP only."); e.target.value = ""; return; }
    try {
      const attachments = await Promise.all(toProcess.map(fileToImageAttachment));
      setPendingImages((prev) => [...prev, ...attachments]);
    } catch { setImageError("Failed to process image."); }
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

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  }, [submit]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items).filter(
      (item) => item.kind === "file" && ACCEPTED_TYPES.includes(item.type)
    );
    if (!items.length) return;
    const files = items.map((item) => item.getAsFile()).filter(Boolean) as File[];
    const toProcess = files.slice(0, MAX_IMAGES - pendingImages.length);
    if (!toProcess.length) return;
    try {
      const attachments = await Promise.all(toProcess.map(fileToImageAttachment));
      setPendingImages((prev) => [...prev, ...attachments]);
    } catch { setImageError("Failed to paste image."); }
  }, [pendingImages.length]);

  const isEmpty = messages.length === 0;
  const lastMessageIsStreaming =
    isStreaming && messages.length > 0 && messages[messages.length - 1].role === "assistant";

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "#0a0a0a", fontFamily: "var(--font-dm-sans)" }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div
        className="flex items-stretch shrink-0"
        style={{
          height: 52,
          background: "rgba(0,0,0,0.96)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Back */}
        {onBack && (
          <button
            onClick={onBack}
            title="Back to projects"
            className="flex items-center justify-center shrink-0 transition-all"
            style={{
              width: 44,
              borderRight: "1px solid rgba(255,255,255,0.06)",
              color: "#71717a",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#71717a"; e.currentTarget.style.background = "transparent"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
        )}

        {/* Project name */}
        <div
          className="flex-1 flex items-center min-w-0"
          style={{ padding: "0 14px" }}
        >
          <span
            className="truncate"
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              letterSpacing: "-0.3px",
            }}
          >
            {projectName ?? "Zeach"}
          </span>
          {lastUsage && (
            <span
              className="ml-2 shrink-0"
              title={`${lastUsage.input.toLocaleString()} in + ${lastUsage.output.toLocaleString()} out tokens`}
              style={{
                fontFamily: "var(--font-dm-mono)",
                fontSize: 9,
                color: "#3f3f46",
                letterSpacing: "0.2px",
              }}
            >
              {lastUsage.total.toLocaleString()} tok
            </span>
          )}
        </div>

        {/* Actions */}
        <div
          className="flex items-center shrink-0"
          style={{
            gap: 2, padding: "0 8px",
            borderLeft: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* Model badge */}
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-md mr-1"
            style={{
              background: "rgba(6,182,212,0.08)",
              border: "1px solid rgba(6,182,212,0.15)",
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#06b6d4" }} />
            <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: 9, color: "#06b6d4", letterSpacing: "0.3px" }}>
              sonnet
            </span>
          </div>

          {/* Clear */}
          <PanelBtn
            onClick={onClear}
            title="Clear chat history"
            danger
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
          </PanelBtn>

          {/* Share */}
          {onShare && (
            <PanelBtn onClick={onShare} title="Share project">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </PanelBtn>
          )}
        </div>
      </div>

      {/* ── Messages ────────────────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          padding: "16px 14px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.08) transparent",
        }}
      >
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            {/* Generating animation indicator when first page hasn't appeared yet */}
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center font-black"
              style={{
                background: "rgba(6,182,212,0.1)",
                border: "1px solid rgba(6,182,212,0.25)",
                color: "#06b6d4",
                fontFamily: "var(--font-space-grotesk)",
                fontSize: 20,
                letterSpacing: "-0.5px",
                animation: "zaiPulse 2s ease-in-out infinite",
              }}
            >
              Z
            </div>
            <div className="text-center">
              <p
                style={{
                  fontFamily: "var(--font-space-grotesk)",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#fff",
                  letterSpacing: "-0.2px",
                  marginBottom: 6,
                }}
              >
                What are we building today?
              </p>
              <p style={{ fontSize: 13, color: "#71717a", lineHeight: 1.5 }}>
                Describe what to change — Zeach updates screens instantly.
              </p>
              <p style={{ fontFamily: "var(--font-dm-mono)", fontSize: 10, color: "#3f3f46", marginTop: 8 }}>
                Attach images to replicate designs
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
            {/* Thinking indicator — model is in extended thinking phase */}
            {isThinking && (
              <div className="flex flex-col gap-1">
                <div
                  className="flex items-center gap-1.5"
                  style={{ fontFamily: "var(--font-dm-mono)", fontSize: 9, color: "#3f3f46" }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#a855f7" }} />
                  Zeach
                </div>
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 12px", borderRadius: 10,
                    background: "rgba(168,85,247,0.06)",
                    border: "1px solid rgba(168,85,247,0.15)",
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: 5, height: 5, borderRadius: "50%", background: "#a855f7",
                        opacity: 0.4,
                        animation: "typingBounce 1.2s ease-in-out infinite",
                        animationDelay: `${i * 0.2}s`,
                      }}
                    />
                  ))}
                  <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: 10, color: "#a855f7" }}>
                    Analyzing &amp; planning screens…
                  </span>
                </div>
              </div>
            )}
            {/* Typing indicator when AI hasn't started responding yet */}
            {isStreaming && !isThinking && !lastMessageIsStreaming && (
              <div className="flex flex-col gap-1">
                <div
                  className="flex items-center gap-1.5"
                  style={{ fontFamily: "var(--font-dm-mono)", fontSize: 9, color: "#3f3f46" }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#06b6d4" }} />
                  Zeach
                </div>
                <div className="flex items-center gap-1" style={{ padding: "8px 0" }}>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: 5, height: 5, borderRadius: "50%", background: "#06b6d4",
                        opacity: 0.3,
                        animation: "typingBounce 1.2s ease-in-out infinite",
                        animationDelay: `${i * 0.2}s`,
                      }}
                    />
                  ))}
                  <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: 11, color: "#06b6d4", marginLeft: 6 }}>
                    Generating…
                  </span>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Prompt input ────────────────────────────────────────────────────── */}
      <div
        className="shrink-0"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "10px 14px 14px" }}
      >
        {/* Image previews */}
        {pendingImages.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {pendingImages.map((img, i) => (
              <div key={i} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.preview}
                  alt={`attachment ${i + 1}`}
                  className="w-12 h-12 object-cover"
                  style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }}
                />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: "#ef4444", color: "#fff" }}
                >
                  ×
                </button>
              </div>
            ))}
            {pendingImages.length < MAX_IMAGES && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-12 h-12 flex flex-col items-center justify-center gap-0.5 transition-colors"
                style={{ border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 8, color: "#3f3f46" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#06b6d4")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: 8 }}>Add</span>
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {imageError && (
          <p className="text-xs mb-2" style={{ color: "#ef4444", fontFamily: "var(--font-dm-mono)" }}>
            {imageError}
          </p>
        )}

        {/* pbox */}
        <div
          className="flex items-end"
          style={{
            gap: 6,
            padding: "8px 8px 8px 12px",
            background: "#111",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(6,182,212,0.35)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
        >
          {/* Attach */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming || pendingImages.length >= MAX_IMAGES}
            title="Attach image"
            className="shrink-0 flex items-center justify-center transition-all"
            style={{
              width: 30, height: 30, borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.06)",
              background: "transparent",
              color: pendingImages.length >= MAX_IMAGES ? "#27272a" : "#52525b",
              opacity: isStreaming ? 0.4 : 1,
              cursor: isStreaming || pendingImages.length >= MAX_IMAGES ? "default" : "pointer",
            }}
            onMouseEnter={(e) => {
              if (!isStreaming && pendingImages.length < MAX_IMAGES) {
                e.currentTarget.style.color = "#71717a";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = pendingImages.length >= MAX_IMAGES ? "#27272a" : "#52525b";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={pendingImages.length > 0 ? "Add a message (optional)…" : "Describe what to change…"}
            rows={1}
            className="flex-1 resize-none bg-transparent outline-none"
            style={{
              padding: "3px 0",
              color: "#fff",
              fontSize: 13,
              fontFamily: "var(--font-dm-sans)",
              minHeight: 28,
              maxHeight: 110,
              lineHeight: 1.6,
              overflowY: "auto",
              caretColor: "#06b6d4",
              border: "none",
            }}
          />

          {/* Send / Stop */}
          {isStreaming ? (
            <button
              onClick={onStop}
              className="shrink-0 flex items-center justify-center transition-all"
              style={{ width: 30, height: 30, borderRadius: 8, background: "#ef4444", border: "none", color: "#fff", cursor: "pointer" }}
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
              className="shrink-0 flex items-center justify-center transition-all"
              style={{
                width: 30, height: 30, borderRadius: 8, border: "none",
                background: canSend ? "#06b6d4" : "rgba(255,255,255,0.06)",
                color: canSend ? "#000" : "#3f3f46",
                cursor: canSend ? "pointer" : "default",
                boxShadow: canSend ? "0 0 14px rgba(6,182,212,0.3)" : "none",
              }}
              title="Send message"
            >
              {/* Up arrow */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Delete pages row (only shown when pages exist) */}
        {onDeletePages && (
          <div className="flex items-center justify-between mt-2 px-0.5">
            <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: 10, color: "#27272a" }}>
              Enter ↵ to send
            </span>
            <button
              onClick={onDeletePages}
              disabled={isStreaming}
              className="flex items-center gap-1 transition-all"
              style={{
                fontFamily: "var(--font-dm-mono)", fontSize: 10,
                color: "#3f3f46", background: "transparent", border: "none", cursor: "pointer",
                opacity: isStreaming ? 0.4 : 1,
              }}
              onMouseEnter={(e) => { if (!isStreaming) { e.currentTarget.style.color = "#ef4444"; } }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#3f3f46"; }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" />
              </svg>
              Del pages
            </button>
          </div>
        )}
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

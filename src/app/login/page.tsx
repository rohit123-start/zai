"use client";

import { useAuth } from "@/components/AuthProvider";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useRef } from "react";

function LoginContent() {
  const { signInWithGoogle, signInWithOtp, verifyOtp, loading } = useAuth();
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    const { error } = await signInWithOtp(email.trim());
    setBusy(false);
    if (error) {
      setError(error);
    } else {
      setSuccessMsg(`Code sent to ${email}`);
      setStep("otp");
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const token = otp.join("");
    if (token.length < 6) return;
    setBusy(true);
    setError(null);
    const { error } = await verifyOtp(email, token);
    setBusy(false);
    if (error) {
      setError(error);
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  }

  function handleOtpChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === "ArrowLeft" && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = [...otp];
    pasted.split("").forEach((ch, i) => { next[i] = ch; });
    setOtp(next);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  }

  const isOtpComplete = otp.every((d) => d !== "");

  return (
    <div
      className="flex items-center justify-center min-h-screen relative overflow-hidden"
      style={{ background: "#000", fontFamily: "var(--font-dm-sans)" }}
    >
      {/* Dot grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
        pointerEvents: "none",
      }} />
      {/* Glow */}
      <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: 600, height: 400, background: "radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 65%)", pointerEvents: "none" }} />

      <div
        className="relative flex flex-col items-center gap-6 rounded-2xl z-10"
        style={{
          background: "#0a0a0a",
          border: "1px solid rgba(255,255,255,0.08)",
          padding: "36px 32px",
          width: 400,
          boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.02)",
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="flex items-center justify-center rounded-xl font-bold text-xl"
            style={{ width: 52, height: 52, background: "#06b6d4", color: "#000", fontFamily: "var(--font-space-grotesk)", boxShadow: "0 0 24px rgba(6,182,212,0.3)" }}
          >
            Z
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold" style={{ color: "#fff", fontFamily: "var(--font-space-grotesk)", letterSpacing: "-0.4px" }}>
              {step === "email" ? "Welcome to Zeach" : "Check your email"}
            </h1>
            <p className="text-sm mt-1" style={{ color: "#71717a" }}>
              {step === "email"
                ? "AI-generated product design"
                : `Enter the 6-digit code sent to`}
            </p>
            {step === "otp" && (
              <p className="text-sm font-medium mt-0.5" style={{ color: "#06b6d4", fontFamily: "var(--font-dm-mono)" }}>
                {email}
              </p>
            )}
          </div>
        </div>

        {/* Error */}
        {(urlError || error) && (
          <div className="w-full text-sm px-4 py-3 rounded-xl text-center" style={{ background: "rgba(239,68,68,0.06)", color: "#f87171", border: "1px solid rgba(239,68,68,0.15)" }}>
            {error ?? "Sign-in failed. Please try again."}
          </div>
        )}
        {successMsg && step === "otp" && !error && (
          <div className="w-full text-sm px-4 py-3 rounded-xl text-center" style={{ background: "rgba(16,185,129,0.06)", color: "#10b981", border: "1px solid rgba(16,185,129,0.15)" }}>
            {successMsg}
          </div>
        )}

        {/* Email step */}
        {step === "email" && (
          <form onSubmit={handleSendOtp} className="w-full flex flex-col gap-3">
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full rounded-xl text-sm outline-none transition-all"
              style={{
                background: "#111",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.1)",
                padding: "13px 16px",
                fontFamily: "var(--font-dm-sans)",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#06b6d4"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(6,182,212,0.1)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
            />
            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="w-full rounded-xl text-sm font-bold transition-all duration-150"
              style={{
                background: busy || !email.trim() ? "rgba(6,182,212,0.3)" : "#06b6d4",
                color: busy || !email.trim() ? "rgba(0,0,0,0.5)" : "#000",
                padding: "13px",
                cursor: busy || !email.trim() ? "not-allowed" : "pointer",
                fontFamily: "var(--font-space-grotesk)",
                letterSpacing: "-0.2px",
              }}
              onMouseEnter={(e) => { if (!busy && email.trim()) { e.currentTarget.style.background = "#22d3ee"; e.currentTarget.style.boxShadow = "0 0 20px rgba(6,182,212,0.3)"; } }}
              onMouseLeave={(e) => { e.currentTarget.style.background = busy || !email.trim() ? "rgba(6,182,212,0.3)" : "#06b6d4"; e.currentTarget.style.boxShadow = "none"; }}
            >
              {busy ? "Sending…" : "Continue with email →"}
            </button>
          </form>
        )}

        {/* OTP step */}
        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} className="w-full flex flex-col gap-5">
            <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="rounded-xl text-center text-xl font-bold outline-none transition-all"
                  style={{
                    width: 48, height: 56,
                    background: "#111",
                    color: "#fff",
                    border: digit ? "1px solid #06b6d4" : "1px solid rgba(255,255,255,0.1)",
                    fontFamily: "var(--font-dm-mono)",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#06b6d4"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(6,182,212,0.1)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = digit ? "#06b6d4" : "rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={busy || !isOtpComplete}
              className="w-full rounded-xl text-sm font-bold transition-all duration-150"
              style={{
                background: busy || !isOtpComplete ? "rgba(6,182,212,0.3)" : "#06b6d4",
                color: busy || !isOtpComplete ? "rgba(0,0,0,0.5)" : "#000",
                padding: "13px",
                cursor: busy || !isOtpComplete ? "not-allowed" : "pointer",
                fontFamily: "var(--font-space-grotesk)",
              }}
            >
              {busy ? "Verifying…" : "Verify code"}
            </button>

            <button
              type="button"
              onClick={() => { setStep("email"); setOtp(["","","","","",""]); setError(null); setSuccessMsg(null); }}
              className="text-xs text-center transition-colors"
              style={{ color: "#71717a", fontFamily: "var(--font-dm-mono)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#71717a")}
            >
              ← Use a different email
            </button>
          </form>
        )}

        {/* Divider */}
        <div className="w-full flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
          <span className="text-xs" style={{ color: "#3f3f46", fontFamily: "var(--font-dm-mono)" }}>or</span>
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
        </div>

        {/* Google */}
        <button
          onClick={signInWithGoogle}
          disabled={loading || busy}
          className="w-full flex items-center justify-center gap-3 rounded-xl font-medium text-sm transition-all duration-150"
          style={{
            background: "#fff",
            color: "#111",
            padding: "12px 20px",
            opacity: loading || busy ? 0.6 : 1,
            cursor: loading || busy ? "not-allowed" : "pointer",
            fontFamily: "var(--font-dm-sans)",
          }}
          onMouseEnter={(e) => { if (!loading && !busy) e.currentTarget.style.background = "#f5f5f5"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#4285F4" d="M47.5 24.6c0-1.6-.1-3.1-.4-4.6H24v8.7h13.2c-.6 3-2.4 5.6-5 7.3v6h8.1c4.7-4.4 7.2-10.8 7.2-17.4z"/>
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-8.1-6c-2.1 1.4-4.7 2.2-7.8 2.2-6 0-11-4-12.8-9.5H2.9v6.2C6.9 42.8 14.9 48 24 48z"/>
            <path fill="#FBBC05" d="M11.2 28.9c-.5-1.4-.7-2.8-.7-4.3s.3-3 .7-4.3v-6.2H2.9C1 17.7 0 20.7 0 24s1 6.3 2.9 9.1l8.3-6.2z"/>
            <path fill="#EA4335" d="M24 9.5c3.4 0 6.4 1.2 8.8 3.4l6.6-6.6C35.9 2.4 30.5 0 24 0 14.9 0 6.9 5.2 2.9 12.9l8.3 6.2C12.9 13.6 18 9.5 24 9.5z"/>
          </svg>
          Continue with Google
        </button>

        <p className="text-xs text-center" style={{ color: "#3f3f46", fontFamily: "var(--font-dm-mono)" }}>
          By signing in you agree to our terms of service
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

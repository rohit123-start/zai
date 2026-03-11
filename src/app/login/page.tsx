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
      setSuccessMsg(`A 6-digit code was sent to ${email}`);
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
    // on success the auth listener in AuthProvider will update user → middleware redirects to /
  }

  function handleOtpChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
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
    const focusIdx = Math.min(pasted.length, 5);
    otpRefs.current[focusIdx]?.focus();
  }

  const isOtpComplete = otp.every((d) => d !== "");

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: "#0f0f0f" }}>
      <div
        className="flex flex-col items-center gap-7 p-10 rounded-2xl"
        style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", width: "380px" }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black"
            style={{ background: "#d97706", color: "#0f0f0f", letterSpacing: "-1px" }}
          >
            Z
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold" style={{ color: "#e5e5e5" }}>
              {step === "email" ? "Welcome to Zai" : "Check your email"}
            </h1>
            <p className="text-sm mt-1" style={{ color: "#6b7280" }}>
              {step === "email"
                ? "Your AI design & code assistant"
                : `Enter the 6-digit code sent to`}
            </p>
            {step === "otp" && (
              <p className="text-sm font-medium mt-0.5" style={{ color: "#d97706" }}>
                {email}
              </p>
            )}
          </div>
        </div>

        {/* Error / success */}
        {(urlError || error) && (
          <div
            className="w-full text-sm px-4 py-3 rounded-lg text-center"
            style={{ background: "#2a1a1a", color: "#f87171", border: "1px solid #3a2020" }}
          >
            {error ?? "Sign-in failed. Please try again."}
          </div>
        )}
        {successMsg && step === "otp" && !error && (
          <div
            className="w-full text-sm px-4 py-3 rounded-lg text-center"
            style={{ background: "#1a2a1a", color: "#4ade80", border: "1px solid #203a20" }}
          >
            {successMsg}
          </div>
        )}

        {/* ── Step 1: Email form ── */}
        {step === "email" && (
          <form onSubmit={handleSendOtp} className="w-full flex flex-col gap-3">
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
              style={{
                background: "#111",
                color: "#e5e5e5",
                border: "1px solid #2a2a2a",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#d97706")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
            />
            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-150"
              style={{
                background: busy || !email.trim() ? "#3a2a10" : "#d97706",
                color: busy || !email.trim() ? "#78450a" : "#0f0f0f",
                cursor: busy || !email.trim() ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Sending…" : "Continue with email"}
            </button>
          </form>
        )}

        {/* ── Step 2: OTP verification ── */}
        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} className="w-full flex flex-col gap-5">
            {/* 6-box OTP input */}
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
                    width: "46px",
                    height: "54px",
                    background: "#111",
                    color: "#e5e5e5",
                    border: digit ? "1px solid #d97706" : "1px solid #2a2a2a",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#d97706")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = digit ? "#d97706" : "#2a2a2a")}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={busy || !isOtpComplete}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-150"
              style={{
                background: busy || !isOtpComplete ? "#3a2a10" : "#d97706",
                color: busy || !isOtpComplete ? "#78450a" : "#0f0f0f",
                cursor: busy || !isOtpComplete ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Verifying…" : "Verify code"}
            </button>

            <button
              type="button"
              onClick={() => { setStep("email"); setOtp(["","","","","",""]); setError(null); setSuccessMsg(null); }}
              className="text-xs text-center transition-colors"
              style={{ color: "#6b7280" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#9ca3af")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
            >
              ← Use a different email
            </button>
          </form>
        )}

        {/* ── Divider ── */}
        <div className="w-full flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: "#2a2a2a" }} />
          <span className="text-xs" style={{ color: "#4b5563" }}>or</span>
          <div className="flex-1 h-px" style={{ background: "#2a2a2a" }} />
        </div>

        {/* ── Google button ── */}
        <button
          onClick={signInWithGoogle}
          disabled={loading || busy}
          className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl font-medium text-sm transition-all duration-150"
          style={{
            background: "#fff",
            color: "#111",
            border: "1px solid #e5e7eb",
            opacity: loading || busy ? 0.6 : 1,
            cursor: loading || busy ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => { if (!loading && !busy) e.currentTarget.style.background = "#f9fafb"; }}
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

        <p className="text-xs text-center" style={{ color: "#4b5563" }}>
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

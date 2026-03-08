"use client";

import { useAuth } from "@/components/AuthProvider";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginContent() {
  const { signInWithGoogle, loading } = useAuth();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{ background: "#0f0f0f" }}
    >
      <div
        className="flex flex-col items-center gap-8 p-10 rounded-2xl"
        style={{
          background: "#1a1a1a",
          border: "1px solid #2a2a2a",
          width: "380px",
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black zai-logo"
            style={{ background: "#d97706", color: "#0f0f0f", letterSpacing: "-1px" }}
          >
            Z
          </div>
          <div className="text-center">
            <h1
              className="text-xl font-semibold"
              style={{ color: "#e5e5e5" }}
            >
              Welcome to Zai
            </h1>
            <p className="text-sm mt-1" style={{ color: "#6b7280" }}>
              Your AI design &amp; code assistant
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            className="w-full text-sm px-4 py-3 rounded-lg text-center"
            style={{ background: "#2a1a1a", color: "#f87171", border: "1px solid #3a2020" }}
          >
            Sign-in failed. Please try again.
          </div>
        )}

        {/* Google button */}
        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl font-medium text-sm transition-all duration-150"
          style={{
            background: "#fff",
            color: "#111",
            border: "1px solid #e5e7eb",
            opacity: loading ? 0.6 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.background = "#f9fafb";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#fff";
          }}
        >
          {/* Google logo SVG */}
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

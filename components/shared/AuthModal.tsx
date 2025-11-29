"use client";

import { useState } from "react";
import { X, Wallet, Github, Mail } from 'lucide-react';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const endpoint = mode === "signin" ? "/api/auth/login" : "/api/auth/signup";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Request failed");
        return;
      }
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWalletConnect = () => {
    console.log("Wallet connect clicked");
    // Add your wallet connection logic here
  };

  const handleGoogleAuth = () => {
    console.log("Google auth clicked");
    // Add your Google auth logic here
  };

  const handleGithubAuth = () => {
    console.log("GitHub auth clicked");
    // Add your GitHub auth logic here
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div 
        className="relative bg-black border border-zinc-800 shadow-2xl w-full max-w-lg p-1 z-10 rounded-md overflow-hidden"
        style={{
          /* control auth modal icon size from this CSS variable (change to adjust sizes) */
          ['--auth-icon-size' as any]: '28px'
        }}
      >
        <div className="bg-black p-10 sm:p-12 relative text-center">
          {/* Close button */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-6 right-6 text-white/60 hover:text-white transition-colors p-2"
          >
            <X className="flex-shrink-0" style={{ width: 'var(--auth-icon-size)', height: 'var(--auth-icon-size)' }} />
          </button>

          {/* Header */}
          <div className="mb-10 text-center">
            <h2 className="text-4xl font-sentient text-white mb-4 tracking-tight">
              {mode === "signin" ? "Welcome back" : "Create account"}
            </h2>
            <p className="font-mono text-base text-white/70 leading-relaxed">
              {mode === "signin"
                ? "Sign in to deploy dApps across chains"
                : "Sign up to start building onchain"}
            </p>
          </div>

          {/* Content */}
          <div className="space-y-6">
            {/* Wallet Connect Button */}
            <button
              onClick={handleWalletConnect}
              className="w-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white font-mono py-4 px-6 transition-all flex items-center justify-center gap-3 text-base"
              style={{
                clipPath: "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)"
              }}
            >
              <Wallet className="flex-shrink-0" style={{ width: 'var(--auth-icon-size)', height: 'var(--auth-icon-size)' }} />
              <span>Connect Wallet</span>
            </button>

            {/* Divider */}
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-black px-4 text-white/50 font-mono tracking-wider">
                  Or continue with
                </span>
              </div>
            </div>

            {/* Social Auth Buttons */}
            <div className="grid grid-cols-2 gap-5">
              <button
                onClick={handleGoogleAuth}
                className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white font-mono py-4 px-5 transition-all flex items-center justify-center gap-3 text-base"
                style={{
                  clipPath: "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)"
                }}
              >
                <svg style={{ width: 'var(--auth-icon-size)', height: 'var(--auth-icon-size)' }} viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google
              </button>

              <button
                onClick={handleGithubAuth}
                className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white font-mono py-4 px-5 transition-all flex items-center justify-center gap-3 text-base"
                style={{
                  clipPath: "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)"
                }}
              >
                <Github className="flex-shrink-0" style={{ width: 'var(--auth-icon-size)', height: 'var(--auth-icon-size)' }} />
                <span>GitHub</span>
              </button>
            </div>

            {/* Divider */}
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-black px-4 text-white/50 font-mono tracking-wider">
                  Or with email
                </span>
              </div>
            </div>

            {/* Email Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-white/40 font-mono px-5 py-4 text-base focus:outline-none focus:ring-2 focus:ring-yellow-400/50 transition-all"
                required
              />
              
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-white/40 font-mono px-5 py-4 text-base focus:outline-none focus:ring-2 focus:ring-yellow-400/50 transition-all"
                required
              />
              {error && (
                <div className="text-red-400 font-mono text-sm">{error}</div>
              )}
              
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-300 text-black font-mono font-bold py-4 px-6 text-lg transition-all flex items-center justify-center gap-3 mt-2"
                style={{
                  clipPath: "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)"
                }}
              >
                <Mail className="flex-shrink-0" style={{ width: 'var(--auth-icon-size)', height: 'var(--auth-icon-size)' }} />
                <span>{submitting ? "Please wait" : (mode === "signin" ? "Sign In" : "Sign Up")}</span>
              </button>
            </form>

            {/* Toggle Mode */}
            <div className="text-center text-base font-mono pt-6">
              <span className="text-white/70">
                {mode === "signin"
                  ? "Don't have an account? "
                  : "Already have an account? "}
              </span>
              <button
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                className="text-yellow-400 hover:text-yellow-500 transition-colors font-bold"
              >
                {mode === "signin" ? "Sign Up" : "Sign In"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

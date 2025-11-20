"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { appConfig } from "@/config/app.config";
import { toast } from "sonner";
import LiquidEther from "@/components/ui/LiquidEther/LiquidEther";
import { Logo } from "@/components/logo";
import { AuthModal } from "@/components/shared/AuthModal";
import Link from "next/link";
import { Send, Globe, Type } from "lucide-react";
import { cn } from "@/lib/utils";

const NETWORKS = [
  { id: "solana", name: "Solana", icon: "◎" },
  { id: "celo", name: "Celo", icon: "🌿" },
];

const MODELS = [
  { id: "gpt-5", name: "GPT-5" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  { id: "claude-4.5", name: "Claude 4.5" },
  { id: "kimi", name: "Kimi" },
];

export default function NewHomePage() {
  const router = useRouter();
  
  // State from original HomePage
  const [url, setUrl] = useState<string>("");
  const [textBrief, setTextBrief] = useState<string>("");
  // Default to text mode as buttons are removed
  const [creationMode, setCreationMode] = useState<"text" | "url">("text");
  const [selectedChain, setSelectedChain] = useState<string>("solana");
  const [selectedModel, setSelectedModel] = useState<string>("gpt-5");
  const [isTextSubmitting, setIsTextSubmitting] = useState<boolean>(false);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // URL validation helper
  const isURL = (str: string): boolean => {
    const urlPattern = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/;
    return urlPattern.test(str.trim());
  };

  const handleSubmit = async () => {
    // Simplified to just handle text submission for now as UI focus is text
    // If input looks like URL, we could auto-detect, but for now following plan
    const brief = textBrief.trim();
    if (!brief) {
      toast.error("Please describe your dapp to get started.");
      return;
    }

    if (isTextSubmitting) return;

    try {
      setIsTextSubmitting(true);
      sessionStorage.setItem('creationMode', 'text');
      sessionStorage.setItem('textBrief', brief);
      sessionStorage.setItem('initialMessage', brief);
      sessionStorage.setItem('selectedModel', selectedModel);
      sessionStorage.setItem('selectedChain', selectedChain);
      sessionStorage.setItem('autoStart', 'true');
      router.push('/generation');
    } finally {
      setIsTextSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col min-h-screen text-white overflow-hidden font-sans relative bg-black">
      <div className="absolute inset-0 z-0">
        <LiquidEther
          colors= {['#F8D84A', '#F5B800', '#FFE889']} // {['#5227FF', '#FF9FFC', '#B19EEF']}
          mouseForce={20}
          cursorSize={100}
          isViscous={false}
          viscous={30}
          iterationsViscous={32}
          iterationsPoisson={32}
          resolution={0.5}
          isBounce={false}
          autoDemo={true}
          autoSpeed={0.5}
          autoIntensity={2.2}
          takeoverDuration={0.25}
          autoResumeDelay={3000}
          autoRampDuration={0.6}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
      <AuthModal open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen} />

      {/* Header */}
      <header className="fixed z-50 pt-8 md:pt-10 top-0 left-0 w-full">
        <div className="flex items-center justify-between container mx-auto px-6">
          <Link href="/">
            <Logo className="w-[100px] md:w-[120px] text-white" />
          </Link>
          <div 
               onClick={() => setIsAuthModalOpen(true)}
               className="relative bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-3 px-8 text-lg transition-all duration-200 cursor-pointer select-none tracking-wide"
               style={{
                 clipPath: "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)"
               }}>
             SIGN IN
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col justify-center pb-20 relative z-10 container max-w-5xl mx-auto px-4 mt-20">
        <div className="text-center mb-20">
          <h1 className="text-5xl sm:text-6xl md:text-8xl font-sentient text-balance drop-shadow-2xl tracking-tight mb-8 leading-tight">
            Build multi-chain<br />dApps with AI
          </h1>
          <p className="text-xl sm:text-2xl text-white/90 font-mono tracking-wide">
            Vibe code your ideas into reality.
          </p>
        </div>

        {/* Chat/Input Box */}
        <div 
          className= "relative bg-neutral-800 border-2 border-neutral-600 shadow-2xl p-1" //"relative bg-zinc-900 border-2 border-zinc-700 shadow-2xl p-1"
          style={{
            clipPath: "polygon(0 24px, 24px 0, calc(100% - 24px) 0, 100% 24px, 100% calc(100% - 24px), calc(100% - 24px) 100%, 24px 100%, 0 calc(100% - 24px))"
          }}
        >
            <div className="p-6 sm:p-10 flex flex-col gap-8">
                <textarea
                    value={textBrief}
                    onChange={(e) => setTextBrief(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Create a token vesting contract..."
                    className="w-full bg-transparent text-white placeholder:text-white/40 resize-none outline-none font-mono text-lg sm:text-xl min-h-[140px] sm:min-h-[180px] border-none focus:ring-0 leading-relaxed"
                    rows={3}
                />

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-6 pt-4 border-t border-zinc-800/50">
                    <div className="flex flex-col sm:flex-row gap-4 flex-1">
                        {/* Custom Selects to match theme */}
                        <div className="relative w-full sm:w-[200px]">
                             <select 
                                value={selectedChain}
                                onChange={(e) => setSelectedChain(e.target.value)}
                                className="w-full appearance-none bg-zinc-800/50 border border-zinc-700 text-white text-base rounded-lg px-5 py-3 pr-10 focus:outline-none focus:ring-1 focus:ring-yellow-400/50 cursor-pointer transition-colors hover:bg-zinc-800"
                             >
                                {NETWORKS.map(n => (
                                    <option key={n.id} value={n.id}>{n.name}</option>
                                ))}
                             </select>
                             <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/50">
                                <svg width="12" height="8" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                             </div>
                        </div>

                        <div className="relative w-full sm:w-[200px]">
                             <select 
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                className="w-full appearance-none bg-zinc-800/50 border border-zinc-700 text-white text-base rounded-lg px-5 py-3 pr-10 focus:outline-none focus:ring-1 focus:ring-yellow-400/50 cursor-pointer transition-colors hover:bg-zinc-800"
                             >
                                {MODELS.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                             </select>
                             <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/50">
                                <svg width="12" height="8" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                             </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={isTextSubmitting || !textBrief.trim()}
                        className="relative bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-3 px-8 text-lg transition-all duration-200 cursor-pointer select-none tracking-wide disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                        style={{
                            clipPath: "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)"
                        }}
                    >
                        <Send className="!w-6 !h-6 flex-shrink-0" style={{ width: '24px', height: '24px', minWidth: '24px', minHeight: '24px' }} />
                        BUILD
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

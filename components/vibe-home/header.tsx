"use client";

import Link from "next/link";
import { Logo } from "./logo";

export const Header = () => {
  return (
    <div className="fixed z-50 pt-8 md:pt-14 top-0 left-0 w-full pointer-events-none">
      <header className="flex items-center justify-between container mx-auto px-4 pointer-events-auto">
        <Link href="/">
          <Logo className="text-3xl font-serif text-white" />
        </Link>
        
        <Link 
          href="/#sign-in"
          className="bg-[#FFC107] hover:bg-[#FFD54F] text-black font-bold py-2 px-6 transition-colors duration-200 flex items-center justify-center"
          style={{
            clipPath: "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)"
          }}
        >
          SIGN IN
        </Link>
      </header>
    </div>
  );
};


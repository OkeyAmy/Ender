"use client";

import { ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/shadcn/collapsible";

interface CollapsibleMessageProps {
  summary: string;
  children: ReactNode;
  type: 'system' | 'command' | 'error';
  defaultOpen?: boolean;
}

export default function CollapsibleMessage({
  summary,
  children,
  type,
  defaultOpen = false,
}: CollapsibleMessageProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const getBackgroundColor = () => {
    switch (type) {
      case 'system':
        return 'bg-[#36322F]';
      case 'command':
        return 'bg-[#36322F]';
      case 'error':
        return 'bg-red-900 border border-red-700';
      default:
        return 'bg-[#36322F]';
    }
  };

  const getTextColor = () => {
    switch (type) {
      case 'error':
        return 'text-red-100';
      default:
        return 'text-white';
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <div className={`rounded-[10px] ${getBackgroundColor()} ${getTextColor()}`}>
        <CollapsibleTrigger className="w-full px-14 py-8 flex items-center justify-between gap-3 hover:opacity-90 transition-opacity">
          <span className="text-sm font-medium text-left flex-1">{summary}</span>
          <ChevronDown
            className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 ${
              isOpen ? 'transform rotate-180' : ''
            }`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-14 pb-8 pt-2 text-sm border-t border-white/10 mt-2">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
















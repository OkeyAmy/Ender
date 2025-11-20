import { cn } from "@/lib/utils";

export const Logo = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className={cn("font-sentient font-bold text-2xl tracking-tight", className)} {...props}>
      Ender
    </div>
  );
};



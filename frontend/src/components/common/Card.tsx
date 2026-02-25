import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface Props {
  className?: string;
  children: ReactNode;
}

export function Card({ className, children }: Props) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4 shadow-sm", className)}>
      {children}
    </div>
  );
}
